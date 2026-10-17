import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from './generated/prisma/client';
import type { EmailAdapter } from './email-adapter';
import { readPublicWebBaseUrl } from './email-adapter';
import type { ApnsAdapter } from './apns';
import { revokeDeviceTokenByValue } from './device-tokens';
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
import {
  buildOwnerTicketLink,
  openCurrentCredentialForQr,
  renderCredentialQrPng,
} from './qr-ticket';
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
  const retry = options.retryConfig ?? readRetryConfig(options.env);
  const publicWebBaseUrl =
    options.publicWebBaseUrl ??
    readPublicWebBaseUrl(options.env ?? process.env);

  for (const row of rows) {
    try {
      if (row.type === 'MembershipInvite') {
        await withTenant(db, row.tenant_id, async (tx) => {
          await tx.$executeRaw`
            UPDATE outbox
            SET status = 'PROCESSING', updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${row.outbox_id}::uuid
              AND status = 'LEASED'
          `;
        });
        const invitePayloads = await withTenant(db, row.tenant_id, async (tx) =>
          tx.$queryRaw<{ payload: Prisma.JsonValue }[]>`
            SELECT payload FROM outbox
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${row.outbox_id}::uuid
          `,
        );
        const invitePayload = (invitePayloads[0]?.payload ?? {}) as {
          inviteId?: string;
          email?: string;
          role?: string;
          token?: string;
          expiresAt?: string;
        };
        if (!email.sendMembershipInvite) {
          throw new Error('invite_email_unsupported');
        }
        await email.sendMembershipInvite({
          tenantId: row.tenant_id,
          inviteId: invitePayload.inviteId ?? row.aggregate_id,
          toEmail: invitePayload.email ?? '',
          role: invitePayload.role ?? 'Owner',
          token: invitePayload.token ?? '',
          expiresAt: invitePayload.expiresAt ?? '',
        });
        await withTenant(db, row.tenant_id, async (tx) => {
          await markOutboxCompleteFenced(tx, row, options.leaseOwner);
        });
        metricsInc('notification_provider_total', {
          channel: 'email_invite',
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

      if (row.attempts > retry.maxAttempts) {
        await withTenant(db, row.tenant_id, async (tx) => {
          await markChannelDead(tx, row, options.leaseOwner, 'max attempts');
          await markOutboxDeadFenced(
            tx,
            row,
            options.leaseOwner,
            'max attempts',
          );
        });
        failed += 1;
        continue;
      }

      const outcome = await withTenant(db, row.tenant_id, async (tx) => {
        const fenced = await tx.$executeRaw`
          UPDATE outbox
          SET status = 'PROCESSING', updated_at = now()
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND id = ${row.outbox_id}::uuid
            AND status = 'LEASED'
            AND lease_owner = ${options.leaseOwner}
            AND lease_token = ${row.lease_token}
        `;
        if (Number(fenced) === 0) {
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
        if (notification?.state === 'ACCEPTED') {
          await markOutboxCompleteFenced(tx, row, options.leaseOwner);
          return 'completed' as const;
        }

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
          await appendAttempt(tx, {
            tenantId: row.tenant_id,
            notificationId: notification?.id ?? randomUUID(),
            ordinal: row.attempts,
            channel: 'email',
            leaseOwner: options.leaseOwner,
            leaseToken: row.lease_token,
            providerStatus: 'DEAD',
            providerRef: null,
            sanitizedError: 'ticket revoked/cancelled — not sending QR',
          });
          if (notification) {
            await tx.$executeRaw`
              UPDATE notifications
              SET state = 'DEAD',
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
          await markOutboxDeadFenced(
            tx,
            row,
            options.leaseOwner,
            'ticket revoked/cancelled',
          );
          return 'completed' as const;
        }

        const creds = await tx.$queryRaw<
          Array<{
            version: number;
            token_hash: string;
            encrypted_token: string;
            status: string;
          }>
        >`
          SELECT version, token_hash, encrypted_token, status
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

        const opened = openCurrentCredentialForQr({
          encryptedToken: cred.encrypted_token,
          credentialKeyMaterial: options.credentialKeyMaterial,
          expectedTokenHash: cred.token_hash,
        });

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
          const configs = await tx.$queryRaw<Array<{ payload: Prisma.JsonValue }>>`
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
        const qrPng = await renderCredentialQrPng({
          ticketId,
          tenantId: row.tenant_id,
          eventId,
          credentialVersion: cred.version,
          token: opened.token,
        });

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

        // Send outside long DB work but still inside tenant tx for fencing after.
        // Provider call may take time; lease fencing prevents stale ack.
        const result = await email.sendTicketIssued({
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
          credentialVersion: cred.version,
          credentialTokenHash: opened.tokenHash,
        });

        const providerStatus = result.providerStatus ?? 'ACCEPTED';
        if (notification) {
          await appendAttempt(tx, {
            tenantId: row.tenant_id,
            notificationId: notification.id,
            ordinal: row.attempts,
            channel: 'email',
            leaseOwner: options.leaseOwner,
            leaseToken: row.lease_token,
            providerStatus,
            providerRef: result.providerRef,
            sanitizedError: null,
          });

          const updated = await tx.$executeRaw`
            UPDATE notifications
            SET state = ${providerStatus},
                provider_ref = ${result.providerRef},
                attempts = ${row.attempts}::integer,
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
        }

        if (providerStatus === 'UNKNOWN') {
          await scheduleRetryFenced(
            tx,
            row,
            options.leaseOwner,
            retry,
            'provider timeout unknown',
            'UNKNOWN',
          );
          return 'failed' as const;
        }

        // APNs push for TicketIssued (ADR-12). Only when caller opts in via
        // options.apns (including null = fail-closed if tokens exist).
        // N1-only callers omit the key and skip push entirely.
        if (!Object.prototype.hasOwnProperty.call(options, 'apns')) {
          await markOutboxCompleteFenced(tx, row, options.leaseOwner);
          return 'completed' as const;
        }
        const ownerForPush =
          (payload as { ownerUserId?: string }).ownerUserId ??
          ticket.owner_user_id ??
          null;
        if (ownerForPush) {
          // listActiveDeviceTokensForUser opens its own tenant scope; call outside
          // this tx by returning a marker — instead inline token query here.
          const devices = await tx.$queryRaw<
            Array<{ id: string; token: string; environment: string }>
          >`
            SELECT id, token, environment
            FROM list_active_device_tokens_for_user(${ownerForPush}::uuid)
          `;
          if (devices.length > 0) {
            const apns = options.apns;
            if (!apns) {
              throw new Error('apns_misconfigured');
            }
            for (const device of devices) {
              const pushKey = `ticket:${ticketId}:issued:push:${device.id}`;
              const existingPush = await tx.$queryRaw<
                Array<{ id: string; state: string }>
              >`
                SELECT id, state FROM notifications
                WHERE tenant_id = ${row.tenant_id}::uuid
                  AND business_key = ${pushKey}
                FOR UPDATE
              `;
              const existing = existingPush[0];
              if (existing?.state === 'SENT' || existing?.state === 'ACCEPTED') {
                continue;
              }
              if (!existing) {
                const notificationId = randomUUID();
                await tx.$executeRaw`
                  INSERT INTO notifications (
                    tenant_id, event_id, id, business_key, channel, state,
                    attempts, payload, created_at, updated_at
                  ) VALUES (
                    ${row.tenant_id}::uuid,
                    ${eventId}::uuid,
                    ${notificationId}::uuid,
                    ${pushKey},
                    'push',
                    'PENDING',
                    0,
                    ${JSON.stringify({ ticketId, deviceRegistrationId: device.id })}::jsonb,
                    now(),
                    now()
                  )
                  ON CONFLICT (tenant_id, business_key) DO NOTHING
                `;
              }
              const sendResult = await apns.send({
                deviceToken: device.token,
                environment: device.environment as 'sandbox' | 'production',
                title: 'Vé đã sẵn sàng',
                body: 'Vé của bạn đã được cấp.',
                data: { ticketId },
              });
              if (sendResult.ok) {
                await tx.$executeRaw`
                  UPDATE notifications
                  SET state = 'ACCEPTED',
                      provider_ref = ${sendResult.providerRef},
                      attempts = attempts + 1,
                      last_error = NULL,
                      updated_at = now()
                  WHERE tenant_id = ${row.tenant_id}::uuid
                    AND business_key = ${pushKey}
                `;
                metricsInc('notification_provider_total', {
                  channel: 'push',
                  result: 'accepted',
                });
                continue;
              }
              if (sendResult.invalidateToken) {
                await revokeDeviceTokenByValue(db, device.token);
                await tx.$executeRaw`
                  UPDATE notifications
                  SET state = 'FAILED',
                      attempts = attempts + 1,
                      last_error = 'provider_error',
                      updated_at = now()
                  WHERE tenant_id = ${row.tenant_id}::uuid
                    AND business_key = ${pushKey}
                `;
                metricsInc('notification_provider_total', {
                  channel: 'push',
                  result: 'invalidated',
                });
                continue;
              }
              if (sendResult.retryable) {
                metricsInc('notification_provider_total', {
                  channel: 'push',
                  result: 'retryable',
                });
                throw new Error('provider_error');
              }
              await tx.$executeRaw`
                UPDATE notifications
                SET state = 'FAILED',
                    attempts = attempts + 1,
                    last_error = 'provider_error',
                    updated_at = now()
                WHERE tenant_id = ${row.tenant_id}::uuid
                  AND business_key = ${pushKey}
              `;
              metricsInc('notification_provider_total', {
                channel: 'push',
                result: 'failed',
              });
            }
          }
        }

        await markOutboxCompleteFenced(tx, row, options.leaseOwner);
        return 'completed' as const;
      });
      if (outcome === 'completed') completed += 1;
      else if (outcome === 'failed') failed += 1;
    } catch (error) {
      failed += 1;
      const message = sanitizeProviderError(
        error instanceof Error ? error.message : 'unknown error',
      );
      try {
        await withTenant(db, row.tenant_id, async (tx) => {
          await scheduleRetryFenced(
            tx,
            row,
            options.leaseOwner,
            retry,
            message,
            'FAILED',
          );
        });
      } catch {
        // Best-effort; reconciler can reclaim expired leases.
      }
    }
  }

  return { claimed: rows.length, completed, failed };
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
): Promise<void> {
  const businessKey = `ticket:${row.aggregate_id}:issued:email`;
  const notes = await tx.$queryRaw<Array<{ id: string; attempts: number }>>`
    SELECT id, attempts FROM notifications
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND business_key = ${businessKey}
      AND channel = 'email'
    FOR UPDATE
  `;
  const notification = notes[0];
  const dead = row.attempts >= retry.maxAttempts;
  const state = dead ? 'DEAD' : noteState;
  const backoff = computeBackoffSeconds(row.attempts, retry);

  if (notification) {
    await appendAttempt(tx, {
      tenantId: row.tenant_id,
      notificationId: notification.id,
      ordinal: row.attempts,
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
          attempts = ${row.attempts}::integer,
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

  if (dead) {
    await markOutboxDeadFenced(tx, row, leaseOwner, message);
    return;
  }

  await tx.$executeRaw`
    UPDATE outbox
    SET status = 'PENDING',
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        next_attempt_at = clock_timestamp() + make_interval(secs => ${backoff}::integer),
        updated_at = now()
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid
      AND lease_owner = ${leaseOwner}
      AND lease_token = ${row.lease_token}
  `;
}

async function markChannelDead(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
  reason: string,
): Promise<void> {
  const businessKey = `ticket:${row.aggregate_id}:issued:email`;
  const notes = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM notifications
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND business_key = ${businessKey}
      AND channel = 'email'
  `;
  if (notes[0]) {
    await appendAttempt(tx, {
      tenantId: row.tenant_id,
      notificationId: notes[0].id,
      ordinal: row.attempts,
      channel: 'email',
      leaseOwner,
      leaseToken: row.lease_token,
      providerStatus: 'DEAD',
      providerRef: null,
      sanitizedError: reason,
    });
    await tx.$executeRaw`
      UPDATE notifications
      SET state = 'DEAD',
          last_error = ${reason},
          lease_owner = NULL,
          lease_token = NULL,
          lease_expires_at = NULL,
          updated_at = now()
      WHERE tenant_id = ${row.tenant_id}::uuid
        AND id = ${notes[0].id}::uuid
        AND channel = 'email'
    `;
  }
}

async function markOutboxCompleteFenced(
  tx: Prisma.TransactionClient,
  row: ClaimedOutboxRow,
  leaseOwner: string,
): Promise<void> {
  await tx.$executeRaw`
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
  `;
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
        lease_owner = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE tenant_id = ${row.tenant_id}::uuid
      AND id = ${row.outbox_id}::uuid
      AND (
        (lease_owner = ${leaseOwner} AND lease_token = ${row.lease_token})
        OR lease_token IS NULL
      )
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
  if (credentialKeyMaterial.length < 16) {
    const retry = options?.retryConfig ?? readRetryConfig(options?.env);
    for (const row of claimed) {
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
    return {
      claimed: claimed.length,
      completed: 0,
      failed: claimed.length,
    };
  }
  return processClaimedOutbox(db, email, claimed, {
    credentialKeyMaterial,
    leaseOwner,
    publicWebBaseUrl: options?.publicWebBaseUrl,
    retryConfig: options?.retryConfig,
    env: options?.env ?? process.env,
    apns: options?.apns,
  });
}
