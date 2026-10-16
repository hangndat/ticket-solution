import type { PrismaClient, Prisma } from './generated/prisma/client';
import type { EmailAdapter } from './email-adapter';
import { withTenant } from './tenant-context';

export type ClaimedOutboxRow = {
  outbox_id: string;
  tenant_id: string;
  event_id: string | null;
  type: string;
  aggregate_id: string;
  payload_version: number;
};

export type ProcessOutboxResult = {
  claimed: number;
  completed: number;
  failed: number;
};

/** Claim a batch via SECURITY DEFINER function (cross-tenant, no PII). */
export async function claimOutboxBatch(
  db: PrismaClient,
  leaseOwner: string,
  limit = 10,
  leaseSeconds = 30,
): Promise<ClaimedOutboxRow[]> {
  return db.$queryRaw<ClaimedOutboxRow[]>`
    SELECT outbox_id, tenant_id, event_id, type, aggregate_id, payload_version
    FROM claim_outbox_batch(
      ${limit}::integer,
      ${leaseOwner}::text,
      ${leaseSeconds}::integer
    )
  `;
}

/**
 * Process TicketIssued outbox rows: send email, then mark COMPLETE in DB.
 * Email failure leaves ticket intact and outbox eligible for retry.
 */
export async function processClaimedOutbox(
  db: PrismaClient,
  email: EmailAdapter,
  rows: ClaimedOutboxRow[],
): Promise<ProcessOutboxResult> {
  let completed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      if (row.type !== 'TicketIssued') {
        await withTenant(db, row.tenant_id, async (tx) => {
          await markOutboxDead(tx, row.tenant_id, row.outbox_id, 'unsupported type');
        });
        failed += 1;
        continue;
      }

      await withTenant(db, row.tenant_id, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox
          SET status = 'PROCESSING', updated_at = now()
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND id = ${row.outbox_id}::uuid
            AND status = 'LEASED'
        `;

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
        };

        const ticketId = payload.ticketId ?? row.aggregate_id;
        const tickets = await tx.$queryRaw<{ id: string; state: string }[]>`
          SELECT id, state FROM tickets
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND id = ${ticketId}::uuid
        `;
        if (!tickets[0]) {
          throw new Error('ticket missing for outbox aggregate');
        }

        const businessKey = `ticket:${ticketId}:issued:email`;
        const notes = await tx.$queryRaw<
          { id: string; state: string }[]
        >`
          SELECT id, state FROM notifications
          WHERE tenant_id = ${row.tenant_id}::uuid
            AND business_key = ${businessKey}
          FOR UPDATE
        `;
        const notification = notes[0];
        if (notification?.state === 'SENT') {
          await markOutboxComplete(tx, row.tenant_id, row.outbox_id);
          return;
        }

        const result = await email.sendTicketIssued({
          tenantId: row.tenant_id,
          eventId: payload.eventId ?? row.event_id ?? '',
          ticketId,
          toEmail: payload.email ?? null,
          requestId: payload.requestId ?? '',
        });

        if (notification) {
          await tx.$executeRaw`
            UPDATE notifications
            SET state = 'SENT',
                provider_ref = ${result.providerRef},
                attempts = attempts + 1,
                last_error = NULL,
                updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${notification.id}::uuid
          `;
        }
        await markOutboxComplete(tx, row.tenant_id, row.outbox_id);
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      const message =
        error instanceof Error ? error.message.slice(0, 500) : 'unknown error';
      try {
        await withTenant(db, row.tenant_id, async (tx) => {
          await tx.$executeRaw`
            UPDATE outbox
            SET status = 'PENDING',
                lease_owner = NULL,
                lease_expires_at = NULL,
                updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${row.outbox_id}::uuid
          `;
          const businessKey = `ticket:${row.aggregate_id}:issued:email`;
          await tx.$executeRaw`
            UPDATE notifications
            SET state = 'FAILED',
                attempts = attempts + 1,
                last_error = ${message},
                next_attempt_at = clock_timestamp() + interval '30 seconds',
                updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND business_key = ${businessKey}
          `;
        });
      } catch {
        // Best-effort; reconciler can reclaim expired leases.
      }
    }
  }

  return { claimed: rows.length, completed, failed };
}

async function markOutboxComplete(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outboxId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE outbox
    SET status = 'COMPLETE',
        lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = now()
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ${outboxId}::uuid
  `;
}

async function markOutboxDead(
  tx: Prisma.TransactionClient,
  tenantId: string,
  outboxId: string,
  reason: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE outbox
    SET status = 'DEAD',
        payload = payload || ${JSON.stringify({ deadReason: reason })}::jsonb,
        updated_at = now()
    WHERE tenant_id = ${tenantId}::uuid
      AND id = ${outboxId}::uuid
  `;
}

/** One relay tick: claim then process. Safe to call from worker loop. */
export async function relayOutboxOnce(
  db: PrismaClient,
  email: EmailAdapter,
  leaseOwner: string,
  limit = 10,
): Promise<ProcessOutboxResult> {
  const claimed = await claimOutboxBatch(db, leaseOwner, limit);
  if (claimed.length === 0) {
    return { claimed: 0, completed: 0, failed: 0 };
  }
  return processClaimedOutbox(db, email, claimed);
}
