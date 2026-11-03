/** Fenced outbox and notification attempt writes. No provider I/O runs here. */
import type { Prisma } from './generated/prisma/client';
import { computeBackoffSeconds, type RetryConfig } from './notification-retry';
import type { ClaimedOutboxRow } from './outbox';

export async function appendAttempt(
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

export async function scheduleRetryFenced(
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
  const businessKey =
    payloads[0]?.business_key || `ticket:${row.aggregate_id}:issued:email`;
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
  const emailPending =
    notification?.state !== 'ACCEPTED' && notification?.state !== 'DEAD';
  const ordinal = (notification?.attempts ?? 0) + 1;
  // A claim/control failure is not a provider attempt. Push attempts are
  // recorded at their own fenced ack; this catch cannot identify an unsent
  // device as the source of a control-plane failure.
  let pushDead = false;
  let pushPending = false;
  let pushReady = false;
  let pushDue: Date | null = null;
  if (!emailPending) {
    const push = await tx.$queryRaw<
      Array<{ state: string; next_attempt_at: Date | null }>
    >`
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
        if (
          !delivery.next_attempt_at ||
          delivery.next_attempt_at <= new Date()
        ) {
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

export async function fenceOutboxToProcessing(
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

export async function lockOutboxLease(
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

export async function markOutboxCompleteFenced(
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

export async function markOutboxDeadFenced(
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
