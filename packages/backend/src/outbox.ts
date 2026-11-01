import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from './generated/prisma/client';
import type { EmailAdapter, EmailSendResult } from './email-adapter';
import { readPublicWebBaseUrl } from './email-adapter';
import { reserveEmailBudget, settleEmailBudget } from './email-budget';
import { isSmtpDefiniteReject } from './smtp-send';
import type { ApnsAdapter } from './apns';
import {
  correctDeviceTokenEnvironment,
  revokeDeviceTokenByValue,
} from './device-tokens';
import { withTenant } from './tenant-context';
import {
  computeBackoffSeconds,
  readRetryConfig,
  sanitizeProviderError,
  type RetryConfig,
} from './notification-retry';
import {
  readPublishedGuideContact,
  renderTemplate,
  resolveTicketIssuedTemplate,
} from './notification-templates';
import { renderGateCredentialQrPng } from './qr-ticket';
import {
  readGateCredentialSigningConfig,
  signGateCredentialJws,
  type GateCredentialSigningConfig,
} from './gate-credential';
import {
  buildGuestInvitationClaimLink,
  buildInviteAcceptLink,
  buildOwnerTicketLink,
} from './web-links';
import { metricsInc } from './metrics-registry';

export type ClaimedOutboxRow = {
  outbox_id: string;
  tenant_id: string;
  event_id: string | null;
  type: string;
  aggregate_id: string;
  payload_version: number;
  lease_token: string;
  attempts: number;
};

export type ProcessOutboxResult = {
  claimed: number;
  completed: number;
  failed: number;
};

export type ProcessOutboxOptions = {
  credentialKeyMaterial: string;
  publicWebBaseUrl?: string;
  retryConfig?: RetryConfig;
  leaseOwner: string;
  env?: NodeJS.ProcessEnv;
  /** Fail-closed when tokens exist but adapter missing/misconfigured. */
  apns?: ApnsAdapter | null;
};

/** Claim a batch via SECURITY DEFINER function (cross-tenant, no PII). */
export async function claimOutboxBatch(
  db: PrismaClient,
  leaseOwner: string,
  limit = 10,
  leaseSeconds = 30,
): Promise<ClaimedOutboxRow[]> {
  return db.$queryRaw<ClaimedOutboxRow[]>`
    SELECT outbox_id, tenant_id, event_id, type, aggregate_id, payload_version,
           lease_token, attempts
    FROM claim_outbox_batch(
      ${limit}::integer,
      ${leaseOwner}::text,
      ${leaseSeconds}::integer
    )
  `;
}

/**
 * Process TicketIssued outbox rows: MIME email with current credential QR,
 * then mark COMPLETE only when lease fence matches.
 * Email failure leaves ticket intact; bounded retry + append-only attempts.
 */
export async function processClaimedOutbox(
  db: PrismaClient,
  email: EmailAdapter,
  rows: ClaimedOutboxRow[],
  options: ProcessOutboxOptions,
): Promise<ProcessOutboxResult> {
  let completed = 0;
  let failed = 0;
  let gateSigningConfig: GateCredentialSigningConfig | null = null;
  const retry = options.retryConfig ?? readRetryConfig(options.env);
  const publicWebBaseUrl =
    options.publicWebBaseUrl ??
    readPublicWebBaseUrl(options.env ?? process.env);

  for (const row of rows) {
    let emailAttempted = false;
    let emailFailureState: 'FAILED' | 'UNKNOWN' = 'FAILED';
    try {
      if (row.type === 'MembershipInvite') {
        const invitePayload = await withTenant(
          db,
          row.tenant_id,
          async (tx) => {
            const fenced = await fenceOutboxToProcessing(
              tx,
              row,
              options.leaseOwner,
            );
            if (!fenced) {
              return null;
            }
            const invitePayloads = await tx.$queryRaw<
              { payload: Prisma.JsonValue }[]
            >`
              SELECT payload FROM outbox
              WHERE tenant_id = ${row.tenant_id}::uuid
                AND id = ${row.outbox_id}::uuid
            `;
            return (invitePayloads[0]?.payload ?? {}) as {
              inviteId?: string;
              email?: string;
              role?: string;
              token?: string;
              expiresAt?: string;
            };
          },
        );
        if (!invitePayload) {
          continue;
        }
        if (!email.sendMembershipInvite) {
          throw new Error('invite_email_unsupported');
        }
        const inviteToken = invitePayload.token ?? '';
        if (!inviteToken || !(invitePayload.email ?? '').trim()) {
          throw new Error('invite_payload_incomplete');
        }
        const acceptUrl = buildInviteAcceptLink({
          publicWebBaseUrl,
          token: inviteToken,
        });
        const delivery = await sendBudgetedEmail(db, row, () => email.sendMembershipInvite!({
          tenantId: row.tenant_id,
          inviteId: invitePayload.inviteId ?? row.aggregate_id,
          toEmail: invitePayload.email ?? '',
          role: invitePayload.role ?? 'Owner',
          token: inviteToken,
          expiresAt: invitePayload.expiresAt ?? '',
          acceptUrl,
        }), () => { emailAttempted = true; });
        if (delivery.kind === 'deferred') {
          await deferEmailBudget(db, row, options.leaseOwner, delivery.due, delivery.reason);
          continue;
        }
        if (delivery.kind !== 'sent') continue;
        if (delivery.result.providerStatus === 'UNKNOWN') {
          emailFailureState = 'UNKNOWN';
          throw new Error('provider_result_unknown');
        }
        const completedInvite = await withTenant(db, row.tenant_id, (tx) =>
          markOutboxCompleteFenced(tx, row, options.leaseOwner),
        );
        if (!completedInvite) continue;
        metricsInc('notification_provider_total', {
          channel: 'email_invite',
          result: 'accepted',
        });
        completed += 1;
        metricsInc('outbox_jobs_total', { result: 'completed' });
        continue;
      }

      // Token storage only — claim recovery reads payload regardless of status.
      // Do not send mail here; InvitationReady is the dispatch/mail event.
      if (row.type === 'InvitationTokenMinted') {
        const done = await withTenant(db, row.tenant_id, async (tx) => {
          const fenced = await fenceOutboxToProcessing(
            tx,
            row,
            options.leaseOwner,
          );
          if (!fenced) {
            return false;
          }
          return markOutboxCompleteFenced(tx, row, options.leaseOwner);
        });
        if (!done) {
          continue;
        }
        completed += 1;
        metricsInc('outbox_jobs_total', { result: 'completed' });
        continue;
      }

      if (row.type === 'InvitationReady') {
        const readyPhase = await withTenant(db, row.tenant_id, async (tx) => {
          const fenced = await fenceOutboxToProcessing(
            tx,
            row,
            options.leaseOwner,
          );
          if (!fenced) {
            return null;
          }
          const readyRows = await tx.$queryRaw<
            Array<{
              payload: Prisma.JsonValue;
              event_id: string | null;
            }>
          >`
            SELECT payload, event_id FROM outbox
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${row.outbox_id}::uuid
          `;
          return readyRows[0] ?? null;
        });
        if (!readyPhase) {
          continue;
        }
        const readyRows = [readyPhase];
        const readyPayload = (readyRows[0]?.payload ?? {}) as {
          invitationId?: string;
          email?: string;
          token?: string;
          ttlHours?: number;
        };
        const eventId = readyRows[0]?.event_id ?? row.event_id ?? '';
        if (!email.sendGuestInvitation) {
          throw new Error('guest_invitation_email_unsupported');
        }
        const claimToken = readyPayload.token ?? '';
        if (!claimToken || !(readyPayload.email ?? '').trim() || !eventId) {
          throw new Error('guest_invitation_payload_incomplete');
        }

        const meta = await withTenant(db, row.tenant_id, async (tx) => {
          const events = await tx.$queryRaw<
            Array<{ name: string; slug: string }>
          >`
            SELECT name, slug FROM events
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${eventId}::uuid
          `;
          const tenants = await tx.$queryRaw<Array<{ slug: string }>>`
            SELECT slug FROM tenants WHERE id = ${row.tenant_id}::uuid
          `;
          return {
            eventName: events[0]?.name ?? '',
            eventSlug: events[0]?.slug ?? '',
            tenantSlug: tenants[0]?.slug ?? '',
          };
        });

        const claimUrl = buildGuestInvitationClaimLink({
          publicWebBaseUrl,
          token: claimToken,
          tenantId: row.tenant_id,
          eventId,
          tenantSlug: meta.tenantSlug || undefined,
          eventSlug: meta.eventSlug || undefined,
        });
        const delivery = await sendBudgetedEmail(db, row, () => email.sendGuestInvitation!({
          tenantId: row.tenant_id,
          eventId,
          invitationId: readyPayload.invitationId ?? row.aggregate_id,
          toEmail: readyPayload.email ?? '',
          token: claimToken,
          claimUrl,
          eventName: meta.eventName || undefined,
          ttlHours: readyPayload.ttlHours,
        }), () => { emailAttempted = true; });
        if (delivery.kind === 'deferred') {
          await deferEmailBudget(db, row, options.leaseOwner, delivery.due, delivery.reason);
          continue;
        }
        if (delivery.kind !== 'sent') continue;
        if (delivery.result.providerStatus === 'UNKNOWN') {
          emailFailureState = 'UNKNOWN';
          throw new Error('provider_result_unknown');
        }
        const completedReady = await withTenant(db, row.tenant_id, (tx) =>
          markOutboxCompleteFenced(tx, row, options.leaseOwner),
        );
        if (!completedReady) continue;
        metricsInc('notification_provider_total', {
          channel: 'email_guest_invite',
          result: 'accepted',
        });
        completed += 1;
        metricsInc('outbox_jobs_total', { result: 'completed' });
        continue;
      }

      if (row.type !== 'TicketIssued') {
        await withTenant(db, row.tenant_id, async (tx) => {
          await markOutboxDeadFenced(
            tx,
            row,
            options.leaseOwner,
            'unsupported type',
          );
        });
        failed += 1;
        continue;
      }

      const prep = await withTenant(db, row.tenant_id, async (tx) => {
        const fenced = await fenceOutboxToProcessing(
          tx,
          row,
          options.leaseOwner,
        );
        if (!fenced) {
          return 'stale' as const;
        }

        const payloads = await tx.$queryRaw<{ payload: Prisma.JsonValue }[]>`
          SELECT payload FROM outbox
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND id = ${row.outbox_id}::uuid
        `;
        const payload = (payloads[0]?.payload ?? {}) as {
          ticketId?: string;
          requestId?: string;
          email?: string | null;
          eventId?: string;
          templateVersion?: number | null;
        };

        const ticketId = payload.ticketId ?? row.aggregate_id;
        const eventId = payload.eventId ?? row.event_id ?? '';
        const businessKey =
          (payload as { businessKey?: string }).businessKey ??
          `ticket:${ticketId}:issued:email`;

        const notes = await tx.$queryRaw<
          Array<{
            id: string;
            state: string;
            channel: string;
            attempts: number;
            template_version: number | null;
          }>
        >`
          SELECT id, state, channel, attempts, template_version
          FROM notifications
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND business_key = ${businessKey}
            AND channel = 'email'
          FOR UPDATE
        `;
        const notification = notes[0];
        if (!notification) throw new Error('email_notification_missing');
        const tickets = await tx.$queryRaw<
          Array<{
            id: string;
            state: string;
            credential_version: number;
            owner_user_id: string;
          }>
        >`
          SELECT id, state, credential_version, owner_user_id
          FROM tickets
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND id = ${ticketId}::uuid
        `;
        const ticket = tickets[0];
        if (!ticket) {
          throw new Error('ticket missing for outbox aggregate');
        }
        if (ticket.state === 'REVOKED' || ticket.state === 'CANCELLED') {
          if (notification.state !== 'ACCEPTED') {
            await appendAttempt(tx, {
              tenantId: row.tenant_id,
              notificationId: notification.id,
              ordinal: notification.attempts + 1,
              channel: 'email',
              leaseOwner: options.leaseOwner,
              leaseToken: row.lease_token,
              providerStatus: 'DEAD',
              providerRef: null,
              sanitizedError: 'ticket revoked/cancelled — not sending QR',
            });
            await tx.$executeRaw`
              UPDATE notifications
              SET state = 'DEAD',
                  attempts = ${notification.attempts + 1}::integer,
                  last_error = 'ticket revoked/cancelled',
                  lease_owner = NULL,
                  lease_token = NULL,
                  lease_expires_at = NULL,
                  updated_at = now()
              WHERE tenant_id = ${row.tenant_id}::uuid
                AND id = ${notification.id}::uuid
                AND channel = 'email'
            `;
          }
          await tx.$executeRaw`
            UPDATE notifications SET state = 'DEAD',
              last_error = 'ticket revoked/cancelled', next_attempt_at = NULL,
              updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid AND channel = 'push'
              AND business_key LIKE ${`ticket:${ticketId}:issued:push:%`}
              AND state NOT IN ('ACCEPTED', 'DEAD')
          `;
          await markOutboxDeadFenced(
            tx,
            row,
            options.leaseOwner,
            'ticket revoked/cancelled',
          );
          return 'dead' as const;
        }
        await snapshotTicketIssuedPush(tx, row, options, payload, ticket);
        if (notification.state === 'ACCEPTED') {
          return {
            kind: 'push_pending' as const,
            ticketId,
            eventId,
            payload,
            ticket,
          };
        }
        if (notification.state === 'DEAD') {
          await markOutboxDeadFenced(tx, row, options.leaseOwner, 'email dead');
          return 'dead' as const;
        }

        const creds = await tx.$queryRaw<
          Array<{
            version: number;
            status: string;
          }>
        >`
          SELECT version, status
          FROM ticket_credentials
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND ticket_id = ${ticketId}::uuid
            AND version = ${ticket.credential_version}::integer
            AND status = 'ACTIVE'
          LIMIT 1
        `;
        const cred = creds[0];
        if (!cred) {
          throw new Error('active credential missing for ticket');
        }
        if (!gateSigningConfig) {
          try {
            gateSigningConfig = await readGateCredentialSigningConfig(
              options.env ?? process.env,
              options.credentialKeyMaterial,
            );
          } catch {
            throw new Error('gate_credential_signing_config_invalid');
          }
        }
        let jws: string;
        try {
          jws = await signGateCredentialJws({
            claims: {
              tid: row.tenant_id,
              eid: eventId,
              tkt: ticketId,
              ver: ticket.credential_version,
            },
            privateKeyPem: gateSigningConfig.signingPrivateKeyPem,
            kid: gateSigningConfig.currentKeyId,
          });
        } catch {
          throw new Error('gate_credential_signing_failed');
        }

        const events = await tx.$queryRaw<
          Array<{
            name: string;
            slug: string;
            published_config_version: number | null;
          }>
        >`
          SELECT e.name, e.slug, e.published_config_version
          FROM events e
          WHERE e.tenant_id = ${row.tenant_id}::uuid
            AND e.id = ${eventId}::uuid
        `;
        const event = events[0];
        if (!event) {
          throw new Error('event missing for TicketIssued');
        }

        const tenants = await tx.$queryRaw<Array<{ slug: string }>>`
          SELECT slug FROM tenants WHERE id = ${row.tenant_id}::uuid
        `;
        const tenantSlug = tenants[0]?.slug ?? row.tenant_id;

        let publishedPayload: unknown = {};
        if (event.published_config_version != null) {
          const configs = await tx.$queryRaw<
            Array<{ payload: Prisma.JsonValue }>
          >`
            SELECT payload FROM event_config_versions
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND event_id = ${eventId}::uuid
              AND version = ${event.published_config_version}::integer
            LIMIT 1
          `;
          publishedPayload = configs[0]?.payload ?? {};
        }
        const { guideText, contactText } =
          readPublishedGuideContact(publishedPayload);

        const template = await resolveTicketIssuedTemplate(
          tx,
          row.tenant_id,
          eventId,
          notification?.template_version ?? payload.templateVersion ?? null,
        );
        const ticketLink = buildOwnerTicketLink({
          publicWebBaseUrl,
          tenantSlug,
          ticketId,
        });
        const vars = {
          eventName: event.name,
          ticketId,
          ticketLink,
          guideText,
          contactText,
        };
        const subject = renderTemplate(template.subject, vars, 'text');
        const text = renderTemplate(template.bodyText, vars, 'text');
        const html = renderTemplate(template.bodyHtml, vars, 'html');
        let qrPng: Buffer;
        try {
          qrPng = await renderGateCredentialQrPng(jws);
        } catch {
          throw new Error('gate_credential_qr_render_failed');
        }

        const messageId = `<ticket-issued.${ticketId}.${createHash('sha256')
          .update(businessKey)
          .digest('hex')
          .slice(0, 16)}@vemoki.local>`;

        if (notification) {
          await tx.$executeRaw`
            UPDATE notifications
            SET lease_owner = ${options.leaseOwner},
                lease_token = ${row.lease_token},
                lease_expires_at = clock_timestamp() + interval '30 seconds',
                updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${notification.id}::uuid
              AND channel = 'email'
          `;
        }

        return {
          kind: 'send' as const,
          sendPayload: {
            tenantId: row.tenant_id,
            eventId,
            ticketId,
            toEmail: payload.email ?? null,
            requestId: payload.requestId ?? '',
            subject,
            text,
            html,
            qrPng,
            messageId,
          },
          notification,
          template,
          ticketId,
          eventId,
          payload,
          ticket,
        };
      });

      if (prep === 'stale') {
        continue;
      }
      if (prep === 'dead') {
        failed += 1;
        continue;
      }
      if (prep.kind === 'push_pending') {
        const pushOutcome = await deliverTicketIssuedApns(
          db,
          row,
          options,
          prep,
          retry,
        );
        if (pushOutcome === 'completed') completed += 1;
        if (pushOutcome === 'failed') failed += 1;
        continue;
      }
      if (prep.kind !== 'send') {
        throw new Error('ticket_issued_prep_invalid');
      }

      // Provider I/O outside tenant transaction (H2); ack in a follow-up tx.
      const delivery = await sendBudgetedEmail(
        db, row, () => email.sendTicketIssued(prep.sendPayload),
        () => { emailAttempted = true; },
      );
      if (delivery.kind === 'deferred') {
        await deferEmailBudget(db, row, options.leaseOwner, delivery.due, delivery.reason);
        continue;
      }
      if (delivery.kind !== 'sent') continue;
      const result = delivery.result;

      const outcome = await withTenant(db, row.tenant_id, async (tx) => {
        if (!(await lockOutboxLease(tx, row, options.leaseOwner))) {
          return 'stale' as const;
        }
        const notification = prep.notification;
        const template = prep.template;
        const ticketId = prep.ticketId;
        const eventId = prep.eventId;
        const payload = prep.payload;
        const ticket = prep.ticket;

        const providerStatus = result.providerStatus ?? 'ACCEPTED';
        if (notification) {
          const updated = await tx.$executeRaw`
            UPDATE notifications
            SET state = ${providerStatus},
                provider_ref = ${result.providerRef},
                attempts = ${notification.attempts + 1}::integer,
                last_error = NULL,
                template_version = ${template.version},
                lease_owner = NULL,
                lease_token = NULL,
                lease_expires_at = NULL,
                updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${notification.id}::uuid
              AND channel = 'email'
              AND lease_owner = ${options.leaseOwner}
              AND lease_token = ${row.lease_token}
          `;
          if (Number(updated) === 0) {
            // Stale lease — do not complete outbox; another worker owns it.
            return 'stale' as const;
          }
          await appendAttempt(tx, {
            tenantId: row.tenant_id,
            notificationId: notification.id,
            ordinal: notification.attempts + 1,
            channel: 'email',
            leaseOwner: options.leaseOwner,
            leaseToken: row.lease_token,
            providerStatus,
            providerRef: result.providerRef,
            sanitizedError: null,
          });
        }

        if (providerStatus === 'UNKNOWN') {
          const ordinal = notification.attempts + 1;
          const dead = ordinal >= retry.maxAttempts;
          const backoff = pushBackoff(ordinal, retry);
          await tx.$executeRaw`
            UPDATE notifications SET state = ${dead ? 'DEAD' : 'UNKNOWN'},
              next_attempt_at = CASE WHEN ${dead}::boolean THEN NULL
                ELSE clock_timestamp() + make_interval(secs => ${backoff}::integer) END,
              last_error = 'provider_result_unknown', updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${notification.id}::uuid
          `;
          if (dead) {
            await markOutboxDeadFenced(
              tx,
              row,
              options.leaseOwner,
              'email result unknown',
            );
          } else {
            await tx.$executeRaw`
              UPDATE outbox SET status = 'PENDING',
                next_attempt_at = clock_timestamp() + make_interval(secs => ${backoff}::integer),
                lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
                updated_at = now()
              WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${row.outbox_id}::uuid
                AND lease_owner = ${options.leaseOwner} AND lease_token = ${row.lease_token}
            `;
          }
          return 'failed' as const;
        }

        // APNs I/O follows the fenced email ack; completion checks every intent.
        return {
          kind: 'push_pending' as const,
          ticketId,
          eventId,
          payload,
          ticket,
        };
      });

      if (outcome === 'stale') {
        continue;
      }
      if (outcome === 'failed') {
        failed += 1;
        continue;
      }
      if (outcome.kind === 'push_pending') {
        const pushOutcome = await deliverTicketIssuedApns(
          db,
          row,
          options,
          outcome,
          retry,
        );
        if (pushOutcome === 'completed') completed += 1;
        if (pushOutcome === 'failed') failed += 1;
        continue;
      }
    } catch (error) {
      failed += 1;
      const message = sanitizeProviderError(
        error instanceof Error ? error.message : 'unknown error',
      );
      try {
        if (emailAttempted && !isSmtpDefiniteReject(error)) {
          emailFailureState = 'UNKNOWN';
        }
        await withTenant(db, row.tenant_id, async (tx) => {
          await scheduleRetryFenced(
            tx,
            row,
            options.leaseOwner,
            retry,
            message,
            emailFailureState,
            emailAttempted,
          );
        });
      } catch {
        // Best-effort; reconciler can reclaim expired leases.
      }
    }
  }

  return { claimed: rows.length, completed, failed };
}

async function sendBudgetedEmail(
  db: PrismaClient,
  row: ClaimedOutboxRow,
  send: () => Promise<EmailSendResult>,
  onAttempt: () => void,
): Promise<
  | { kind: 'sent'; result: EmailSendResult }
  | { kind: 'deferred'; reason: 'email_budget_deferred' | 'email_budget_config_missing'; due: Date }
  | { kind: 'duplicate' | 'stale' }
> {
  const admission = await reserveEmailBudget(db, {
    tenantId: row.tenant_id,
    outboxId: row.outbox_id,
    leaseToken: row.lease_token,
  });
  if (admission.kind !== 'reserved') return admission;
  onAttempt();
  let result: EmailSendResult;
  try {
    result = await send();
  } catch (error) {
    await settleEmailBudget(
      db, row.tenant_id, admission.attemptId,
      isSmtpDefiniteReject(error) ? 'RELEASED' : 'UNKNOWN',
    );
    throw error;
  }
  await settleEmailBudget(
    db, row.tenant_id, admission.attemptId,
    result.providerStatus === 'ACCEPTED' ? 'ACCEPTED' : 'UNKNOWN',
    result.providerStatus === 'ACCEPTED' ? result.providerRef : null,
  );
  return { kind: 'sent', result };
}

async function deferEmailBudget(
  db: PrismaClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
  due: Date,
  reason: 'email_budget_deferred' | 'email_budget_config_missing',
): Promise<void> {
  await withTenant(db, row.tenant_id, async (tx) => {
    if (!(await lockOutboxLease(tx, row, leaseOwner))) return;
    await tx.$executeRaw`
      UPDATE outbox SET status = 'PENDING', next_attempt_at = ${due}::timestamptz,
        payload = payload || ${JSON.stringify({ emailBudgetDeferred: reason })}::jsonb,
        lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
        updated_at = now()
      WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${row.outbox_id}::uuid
        AND lease_owner = ${leaseOwner} AND lease_token = ${row.lease_token}
    `;
  });
}

type TicketIssuedPushContext = {
  kind: 'push_pending';
  ticketId: string;
  eventId: string;
  payload: {
    ticketId?: string;
    requestId?: string;
    email?: string | null;
    eventId?: string;
    templateVersion?: number | null;
    ownerUserId?: string;
  };
  ticket: {
    id: string;
    state: string;
    credential_version: number;
    owner_user_id: string;
  };
};

type PushDelivery = {
  id: string;
  business_key: string;
  state: string;
  attempts: number;
  next_attempt_at: Date | null;
  payload: { deviceRegistrationId?: string };
};

async function snapshotTicketIssuedPush(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  options: ProcessOutboxOptions,
  payload: { ticketId?: string },
  ticket: { owner_user_id: string },
): Promise<void> {
  const storedRows = await tx.$queryRaw<Array<{ payload: Prisma.JsonValue }>>`
    SELECT payload FROM outbox WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid FOR UPDATE
  `;
  const stored = (storedRows[0]?.payload ?? {}) as Record<string, unknown>;
  if (stored['deliverySnapshot']) return;
  const ticketId = payload.ticketId ?? row.aggregate_id;
  const prefix = `ticket:${ticketId}:issued:push:%`;
  const prior = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM notifications WHERE tenant_id = ${row.tenant_id}::uuid
      AND channel = 'push' AND business_key LIKE ${prefix}
  `;
  const enabled =
    Object.prototype.hasOwnProperty.call(options, 'apns') || prior.length > 0;
  if (enabled) {
    const devices = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM list_active_device_tokens_for_user(${ticket.owner_user_id}::uuid)
    `;
    for (const device of devices) {
      const key = `ticket:${ticketId}:issued:push:${device.id}`;
      await tx.$executeRaw`
        INSERT INTO notifications (
          tenant_id, event_id, id, business_key, channel, state,
          attempts, payload, created_at, updated_at
        ) VALUES (
          ${row.tenant_id}::uuid, ${row.event_id}::uuid, ${randomUUID()}::uuid,
          ${key}, 'push', 'PENDING', 0,
          ${JSON.stringify({ ticketId, deviceRegistrationId: device.id })}::jsonb,
          now(), now()
        ) ON CONFLICT (tenant_id, business_key) DO NOTHING
      `;
    }
  }
  const count = await tx.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM notifications
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND channel = 'push' AND business_key LIKE ${prefix}
  `;
  const snapshot = {
    version: 1,
    push: enabled ? 'enabled' : 'disabled',
    count: Number(count[0]?.count ?? 0),
  };
  await tx.$executeRaw`
    UPDATE outbox SET payload = payload || ${JSON.stringify({ deliverySnapshot: snapshot })}::jsonb,
      updated_at = now()
    WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${row.outbox_id}::uuid
      AND lease_owner = ${options.leaseOwner} AND lease_token = ${row.lease_token}
  `;
}

function pushBackoff(attempt: number, retry: RetryConfig): number {
  const seconds = computeBackoffSeconds(attempt, retry);
  return Number.isFinite(seconds) ? seconds : 1;
}

/** Provider I/O is outside transactions; each DB acknowledgement holds the outbox fence. */
async function deliverTicketIssuedApns(
  db: PrismaClient,
  row: ClaimedOutboxRow,
  options: ProcessOutboxOptions,
  ctx: TicketIssuedPushContext,
  retry: RetryConfig,
): Promise<'completed' | 'failed' | 'stale'> {
  const prefix = `ticket:${ctx.ticketId}:issued:push:%`;
  const initial = await withTenant(db, row.tenant_id, async (tx) => {
    if (!(await lockOutboxLease(tx, row, options.leaseOwner))) return null;
    const outbox = await tx.$queryRaw<Array<{ payload: Prisma.JsonValue }>>`
      SELECT payload FROM outbox WHERE tenant_id = ${row.tenant_id}::uuid
        AND id = ${row.outbox_id}::uuid
    `;
    const snapshot = (
      outbox[0]?.payload as {
        deliverySnapshot?: { push: string; count: number };
      }
    )?.deliverySnapshot;
    if (!snapshot) throw new Error('push_snapshot_missing');
    const deliveries = await tx.$queryRaw<PushDelivery[]>`
      SELECT id, business_key, state, attempts, next_attempt_at, payload
      FROM notifications WHERE tenant_id = ${row.tenant_id}::uuid
        AND channel = 'push' AND business_key LIKE ${prefix}
      ORDER BY business_key
    `;
    if (deliveries.length !== snapshot.count)
      throw new Error('push_snapshot_incomplete');
    return deliveries;
  });
  if (!initial) return 'stale';

  for (const delivery of initial) {
    if (delivery.state === 'ACCEPTED' || delivery.state === 'DEAD') continue;
    if (delivery.next_attempt_at && delivery.next_attempt_at > new Date())
      continue;
    const beforeSend = await withTenant(db, row.tenant_id, async (tx) => {
      if (!(await lockOutboxLease(tx, row, options.leaseOwner))) return null;
      const fresh = await tx.$queryRaw<
        Array<{ state: string; attempts: number }>
      >`
        SELECT state, attempts FROM notifications
        WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${delivery.id}::uuid FOR UPDATE
      `;
      if (
        !fresh[0] ||
        fresh[0].state === 'ACCEPTED' ||
        fresh[0].state === 'DEAD'
      ) {
        return { skip: true } as const;
      }
      // Revocation can happen after email or an earlier device was accepted.
      // Serialize this check with ticket state changes before each provider call.
      const tickets = await tx.$queryRaw<Array<{ state: string }>>`
        SELECT state FROM tickets
        WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${ctx.ticketId}::uuid
        FOR UPDATE
      `;
      if (tickets[0]?.state === 'REVOKED' || tickets[0]?.state === 'CANCELLED') {
        await tx.$executeRaw`
          UPDATE notifications SET state = 'DEAD',
            last_error = 'ticket revoked/cancelled', next_attempt_at = NULL,
            lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
            updated_at = now()
          WHERE tenant_id = ${row.tenant_id}::uuid AND channel = 'push'
            AND business_key LIKE ${prefix} AND state NOT IN ('ACCEPTED', 'DEAD')
        `;
        await markOutboxDeadFenced(tx, row, options.leaseOwner, 'ticket revoked/cancelled');
        return { revoked: true } as const;
      }
      if (!tickets[0]) throw new Error('ticket missing for push delivery');
      const active = await tx.$queryRaw<
        Array<{ id: string; token: string; environment: string }>
      >`
        SELECT id, token, environment
        FROM list_active_device_tokens_for_user(${ctx.ticket.owner_user_id}::uuid)
      `;
      const device = active.find(
        (item) => item.id === delivery.payload.deviceRegistrationId,
      );
      if (!device) {
        const ordinal = fresh[0].attempts + 1;
        await tx.$executeRaw`
          UPDATE notifications SET state = 'DEAD', attempts = ${ordinal}::integer,
            last_error = 'device_revoked_or_reassigned', next_attempt_at = NULL, updated_at = now()
          WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${delivery.id}::uuid
        `;
        await appendAttempt(tx, {
          tenantId: row.tenant_id,
          notificationId: delivery.id,
          ordinal,
          channel: 'push',
          leaseOwner: options.leaseOwner,
          leaseToken: row.lease_token,
          providerStatus: 'DEAD',
          providerRef: null,
          sanitizedError: 'device_revoked_or_reassigned',
        });
        return { skip: true } as const;
      }
      // Each device gets a fresh fenced lease. The APNs deadline is shorter
      // than this window, so a slow batch cannot outlive its original claim.
      const renewed = await tx.$executeRaw`
        UPDATE outbox SET lease_expires_at = clock_timestamp() + interval '30 seconds',
          updated_at = now()
        WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${row.outbox_id}::uuid
          AND lease_owner = ${options.leaseOwner} AND lease_token = ${row.lease_token}
          AND lease_expires_at > clock_timestamp()
      `;
      if (Number(renewed) !== 1) return null;
      return { skip: false, device } as const;
    });
    if (!beforeSend) return 'stale';
    if ('revoked' in beforeSend) return 'failed';
    if (beforeSend.skip) continue;

    let result: Awaited<
      ReturnType<NonNullable<ProcessOutboxOptions['apns']>['send']>
    > | null = null;
    let errorState: 'UNKNOWN' | 'FAILED' | 'DEAD' | null = null;
    if (!options.apns) {
      errorState = 'FAILED';
    } else {
      const controller = new AbortController();
      let timer: NodeJS.Timeout | undefined;
      try {
        result = await Promise.race([
          options.apns.send({
            deviceToken: beforeSend.device.token,
            environment: beforeSend.device.environment as
              'sandbox' | 'production',
            title: 'Vé đã sẵn sàng',
            body: 'Vé của bạn đã được cấp.',
            data: { ticketId: ctx.ticketId },
            signal: controller.signal,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error('apns_request_timeout_or_aborted'));
            }, 15_000);
          }),
        ]);
      } catch {
        errorState = 'UNKNOWN';
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    if (result && !result.ok) {
      errorState =
        result.invalidateToken || !result.retryable ? 'DEAD' : 'FAILED';
    }
    const ack = await withTenant(db, row.tenant_id, async (tx) => {
      if (!(await lockOutboxLease(tx, row, options.leaseOwner))) return false;
      const fresh = await tx.$queryRaw<
        Array<{ state: string; attempts: number }>
      >`
        SELECT state, attempts FROM notifications
        WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${delivery.id}::uuid FOR UPDATE
      `;
      if (
        !fresh[0] ||
        fresh[0].state === 'ACCEPTED' ||
        fresh[0].state === 'DEAD'
      )
        return false;
      const ordinal = fresh[0].attempts + 1;
      const terminal =
        errorState === 'DEAD' || (!!errorState && ordinal >= retry.maxAttempts);
      const state = result?.ok
        ? 'ACCEPTED'
        : terminal
          ? 'DEAD'
          : (errorState ?? 'UNKNOWN');
      const backoff =
        state === 'ACCEPTED' || state === 'DEAD'
          ? null
          : pushBackoff(ordinal, retry);
      const providerRef = result?.ok ? result.providerRef : null;
      const error =
        state === 'ACCEPTED'
          ? null
          : errorState === 'UNKNOWN'
            ? 'provider_result_unknown'
            : !options.apns
              ? 'apns_misconfigured'
              : 'provider_error';
      await tx.$executeRaw`
        UPDATE notifications SET state = ${state}, attempts = ${ordinal}::integer,
          provider_ref = ${providerRef}, last_error = ${error},
          next_attempt_at = CASE WHEN ${backoff}::integer IS NULL THEN NULL
            ELSE clock_timestamp() + make_interval(secs => ${backoff}::integer) END,
          updated_at = now()
        WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${delivery.id}::uuid
      `;
      await appendAttempt(tx, {
        tenantId: row.tenant_id,
        notificationId: delivery.id,
        ordinal,
        channel: 'push',
        leaseOwner: options.leaseOwner,
        leaseToken: row.lease_token,
        providerStatus: state,
        providerRef,
        sanitizedError: error,
      });
      return true;
    });
    if (!ack) return 'stale';
    if (
      result?.ok &&
      result.resolvedEnvironment !== beforeSend.device.environment
    ) {
      await correctDeviceTokenEnvironment(db, {
        userId: ctx.ticket.owner_user_id,
        registrationId: beforeSend.device.id,
        environment: result.resolvedEnvironment,
      });
      metricsInc('notification_provider_total', {
        channel: 'push',
        result: 'env_corrected',
      });
    }
    if (result && !result.ok && result.invalidateToken) {
      await revokeDeviceTokenByValue(db, beforeSend.device.token);
    }
    metricsInc('notification_provider_total', {
      channel: 'push',
      result: result?.ok
        ? 'accepted'
        : errorState === 'UNKNOWN'
          ? 'unknown'
          : 'failed',
    });
  }

  return withTenant(db, row.tenant_id, async (tx) => {
    if (!(await lockOutboxLease(tx, row, options.leaseOwner)))
      return 'stale' as const;
    const tickets = await tx.$queryRaw<Array<{ state: string }>>`
      SELECT state FROM tickets
      WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${ctx.ticketId}::uuid
      FOR UPDATE
    `;
    if (tickets[0]?.state === 'REVOKED' || tickets[0]?.state === 'CANCELLED') {
      await tx.$executeRaw`
        UPDATE notifications SET state = 'DEAD',
          last_error = 'ticket revoked/cancelled', next_attempt_at = NULL,
          lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
          updated_at = now()
        WHERE tenant_id = ${row.tenant_id}::uuid AND channel = 'push'
          AND business_key LIKE ${prefix} AND state NOT IN ('ACCEPTED', 'DEAD')
      `;
      await markOutboxDeadFenced(tx, row, options.leaseOwner, 'ticket revoked/cancelled');
      return 'failed' as const;
    }
    if (!tickets[0]) throw new Error('ticket missing for push delivery');
    const states = await tx.$queryRaw<
      Array<{ state: string; next_attempt_at: Date | null }>
    >`
      SELECT state, next_attempt_at FROM notifications
      WHERE tenant_id = ${row.tenant_id}::uuid
        AND channel = 'push' AND business_key LIKE ${prefix}
    `;
    const pending = states.filter(
      (item) => item.state !== 'ACCEPTED' && item.state !== 'DEAD',
    );
    if (pending.length === 0) {
      if (states.some((item) => item.state === 'DEAD')) {
        await markOutboxDeadFenced(
          tx,
          row,
          options.leaseOwner,
          'push delivery dead',
        );
        return 'failed' as const;
      }
      return (await markOutboxCompleteFenced(tx, row, options.leaseOwner))
        ? ('completed' as const)
        : ('stale' as const);
    }
    const next = pending.map(
      (item) => item.next_attempt_at?.getTime() ?? Date.now(),
    );
    const due = new Date(Math.min(...next));
    await tx.$executeRaw`
      UPDATE outbox SET status = 'PENDING', next_attempt_at = ${due}::timestamptz,
        lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, updated_at = now()
      WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${row.outbox_id}::uuid
        AND lease_owner = ${options.leaseOwner} AND lease_token = ${row.lease_token}
    `;
    return 'failed' as const;
  });
}
async function appendAttempt(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    notificationId: string;
    ordinal: number;
    channel: string;
    leaseOwner: string;
    leaseToken: string;
    providerStatus: string;
    providerRef: string | null;
    sanitizedError: string | null;
  },
): Promise<void> {
  await tx.$executeRaw`
    INSERT INTO notification_attempts (
      tenant_id, notification_id, ordinal, channel,
      lease_owner, lease_token, started_at, finished_at,
      provider_status, provider_ref, sanitized_error, created_at
    ) VALUES (
      ${input.tenantId}::uuid, ${input.notificationId}::uuid,
      ${input.ordinal}::integer, ${input.channel},
      ${input.leaseOwner}, ${input.leaseToken},
      clock_timestamp(), clock_timestamp(),
      ${input.providerStatus}, ${input.providerRef},
      ${input.sanitizedError}, now()
    )
    ON CONFLICT (tenant_id, notification_id, ordinal) DO NOTHING
  `;
}

async function scheduleRetryFenced(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
  retry: RetryConfig,
  message: string,
  noteState: 'FAILED' | 'UNKNOWN' | 'DEAD',
  emailAttempted = false,
): Promise<void> {
  if (!(await lockOutboxLease(tx, row, leaseOwner))) return;
  const payloads = await tx.$queryRaw<Array<{ business_key: string | null }>>`
    SELECT payload->>'businessKey' AS business_key FROM outbox
    WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${row.outbox_id}::uuid
  `;
  const businessKey = payloads[0]?.business_key || `ticket:${row.aggregate_id}:issued:email`;
  const notes = await tx.$queryRaw<
    Array<{ id: string; attempts: number; state: string }>
  >`
    SELECT id, attempts, state FROM notifications
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND business_key = ${businessKey}
      AND channel = 'email'
    FOR UPDATE
  `;
  const notification = notes[0];
  const emailPending = notification?.state !== 'ACCEPTED' && notification?.state !== 'DEAD';
  const ordinal = (notification?.attempts ?? 0) + 1;
  // A claim/control failure is not a provider attempt. Push attempts are
  // recorded at their own fenced ack; this catch cannot identify an unsent
  // device as the source of a control-plane failure.
  let pushDead = false;
  let pushPending = false;
  let pushReady = false;
  let pushDue: Date | null = null;
  if (!emailPending) {
    const push = await tx.$queryRaw<Array<{ state: string; next_attempt_at: Date | null }>>`
      SELECT state, next_attempt_at FROM notifications
      WHERE tenant_id = ${row.tenant_id}::uuid AND channel = 'push'
        AND business_key LIKE ${`ticket:${row.aggregate_id}:issued:push:%`}
      FOR UPDATE
    `;
    for (const delivery of push) {
      if (delivery.state === 'DEAD') pushDead = true;
      if (delivery.state === 'ACCEPTED') continue;
      if (delivery.state !== 'DEAD') {
        pushPending = true;
        if (!delivery.next_attempt_at || delivery.next_attempt_at <= new Date()) {
          pushReady = true;
        } else if (!pushDue || delivery.next_attempt_at < pushDue) {
          pushDue = delivery.next_attempt_at;
        }
      }
    }
  }
  const dead = emailPending && emailAttempted && ordinal >= retry.maxAttempts;
  const state = dead ? 'DEAD' : noteState;
  const computed = computeBackoffSeconds(
    emailPending && emailAttempted ? ordinal : Math.max(1, row.attempts),
    retry,
  );
  const backoff = Number.isFinite(computed) ? computed : 1;

  if (notification && emailPending && emailAttempted) {
    await appendAttempt(tx, {
      tenantId: row.tenant_id,
      notificationId: notification.id,
      ordinal,
      channel: 'email',
      leaseOwner,
      leaseToken: row.lease_token,
      providerStatus: state,
      providerRef: null,
      sanitizedError: message,
    });
    await tx.$executeRaw`
      UPDATE notifications
      SET state = ${state},
          attempts = ${ordinal}::integer,
          last_error = ${message},
          next_attempt_at = CASE
            WHEN ${dead}::boolean THEN NULL
            ELSE clock_timestamp() + make_interval(secs => ${backoff}::integer)
          END,
          lease_owner = NULL,
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = now()
      WHERE tenant_id = ${row.tenant_id}::uuid
        AND id = ${notification.id}::uuid
        AND channel = 'email'
    `;
  }

  if (dead || notification?.state === 'DEAD' || (pushDead && !pushPending)) {
    await markOutboxDeadFenced(tx, row, leaseOwner, message);
    return;
  }

  const fallbackDue = new Date(Date.now() + backoff * 1000);
  const nextDue = !pushReady && pushDue ? pushDue : fallbackDue;
  await tx.$executeRaw`
    UPDATE outbox
    SET status = 'PENDING',
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        next_attempt_at = ${nextDue}::timestamptz,
        updated_at = now()
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid
      AND lease_owner = ${leaseOwner}
      AND lease_token = ${row.lease_token}
  `;
}

async function fenceOutboxToProcessing(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
): Promise<boolean> {
  const fenced = await tx.$executeRaw`
    UPDATE outbox
    SET status = 'PROCESSING', updated_at = now()
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid
      AND status = 'LEASED'
      AND lease_owner = ${leaseOwner}
      AND lease_token = ${row.lease_token}
       AND lease_expires_at > clock_timestamp()
  `;
  return Number(fenced) > 0;
}

async function lockOutboxLease(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
): Promise<boolean> {
  const current = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM outbox WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid
      AND status IN ('LEASED', 'PROCESSING')
      AND lease_owner = ${leaseOwner} AND lease_token = ${row.lease_token}
      AND lease_expires_at > clock_timestamp() FOR UPDATE
  `;
  return current.length === 1;
}

async function markOutboxCompleteFenced(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
): Promise<boolean> {
  const changed = await tx.$executeRaw`
    UPDATE outbox
    SET status = 'COMPLETE',
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid
      AND lease_owner = ${leaseOwner}
      AND lease_token = ${row.lease_token}
      AND lease_expires_at > clock_timestamp()
  `;
  return Number(changed) === 1;
}

async function markOutboxDeadFenced(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
  reason: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE outbox
    SET status = 'DEAD',
        payload = payload || ${JSON.stringify({ deadReason: reason })}::jsonb,
        next_attempt_at = NULL,
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid
      AND lease_owner = ${leaseOwner}
      AND lease_token = ${row.lease_token}
      AND lease_expires_at > clock_timestamp()
  `;
}

/** One relay tick: claim then process. Safe to call from worker loop. */
export async function relayOutboxOnce(
  db: PrismaClient,
  email: EmailAdapter,
  leaseOwner: string,
  limit = 10,
  options?: Partial<ProcessOutboxOptions>,
): Promise<ProcessOutboxResult> {
  const claimed = await claimOutboxBatch(db, leaseOwner, limit);
  if (claimed.length === 0) {
    return { claimed: 0, completed: 0, failed: 0 };
  }
  const credentialKeyMaterial =
    options?.credentialKeyMaterial?.trim() ||
    process.env['TICKET_CREDENTIAL_KEY']?.trim() ||
    '';
  // TicketIssued needs credential key for QR; invite types must not stall on it.
  if (credentialKeyMaterial.length < 16) {
    const needsCredential = claimed.filter((r) => r.type === 'TicketIssued');
    const invitesOnly = claimed.filter((r) => r.type !== 'TicketIssued');
    if (needsCredential.length > 0) {
      const retry = options?.retryConfig ?? readRetryConfig(options?.env);
      for (const row of needsCredential) {
        try {
          await withTenant(db, row.tenant_id, async (tx) => {
            await scheduleRetryFenced(
              tx,
              row,
              leaseOwner,
              retry,
              'TICKET_CREDENTIAL_KEY misconfigured',
              'FAILED',
            );
          });
        } catch {
          /* ignore */
        }
      }
    }
    if (invitesOnly.length === 0) {
      return {
        claimed: claimed.length,
        completed: 0,
        failed: needsCredential.length,
      };
    }
    // Process non-TicketIssued (MembershipInvite / InvitationReady / TokenMinted)
    // without credential key.
    const inviteOpts: ProcessOutboxOptions = {
      credentialKeyMaterial: '',
      leaseOwner,
      publicWebBaseUrl: options?.publicWebBaseUrl,
      retryConfig: options?.retryConfig,
      env: options?.env,
    };
    if (options && Object.prototype.hasOwnProperty.call(options, 'apns')) {
      inviteOpts.apns = options.apns;
    }
    const inviteResult = await processClaimedOutbox(
      db,
      email,
      invitesOnly,
      inviteOpts,
    );
    return {
      claimed: claimed.length,
      completed: inviteResult.completed,
      failed: needsCredential.length + inviteResult.failed,
    };
  }
  const processOpts: ProcessOutboxOptions = {
    credentialKeyMaterial,
    leaseOwner,
    publicWebBaseUrl: options?.publicWebBaseUrl,
    retryConfig: options?.retryConfig,
    env: options?.env ?? process.env,
  };
  if (options && Object.prototype.hasOwnProperty.call(options, 'apns')) {
    processOpts.apns = options.apns;
  }
  return processClaimedOutbox(db, email, claimed, processOpts);
}
