import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect } from 'playwright/test';
import type { CaseFixture } from '../harness/contract';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

function requirePg() {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR) {
    throw new Error(
      'BLOCKED: invitation PostgreSQL control requires isolated E2E runtime',
    );
  }
  return new Client({ connectionString: process.env.DATABASE_URL });
}

/** Expire all dispatched invitations for an event before claim (run-scoped fixture only). */
export async function expireDispatchedInvitations(
  fixture: CaseFixture,
  eventId: string,
): Promise<number> {
  const client = requirePg();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const result = await client.query(
      `UPDATE guest_invitations
       SET expires_at = now() - interval '1 hour',
           updated_at = now()
       WHERE tenant_id = $1::uuid
         AND event_id = $2::uuid
         AND state = 'DISPATCHED'`,
      [fixture.tenantId, eventId],
    );
    await client.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

/** Revoke dispatched invitations before claim (run-scoped fixture only). */
export async function revokeDispatchedInvitations(
  fixture: CaseFixture,
  eventId: string,
): Promise<number> {
  const client = requirePg();
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const result = await client.query(
      `UPDATE guest_invitations
       SET state = 'REVOKED', updated_at = now()
       WHERE tenant_id = $1::uuid
         AND event_id = $2::uuid
         AND state = 'DISPATCHED'`,
      [fixture.tenantId, eventId],
    );
    await client.query('COMMIT');
    return result.rowCount ?? 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

export async function countTicketsForOwner(
  fixture: CaseFixture,
  ownerUserId: string,
  eventId: string,
): Promise<number> {
  const client = requirePg();
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const rows = await client.query(
      `SELECT count(*)::int AS n FROM tickets
       WHERE tenant_id = $1::uuid AND event_id = $2::uuid
         AND owner_user_id = $3::uuid`,
      [fixture.tenantId, eventId, ownerUserId],
    );
    await client.query('COMMIT');
    return Number(rows.rows[0]?.n ?? 0);
  } finally {
    await client.end();
  }
}

/** Business state for one isolated invitation event; excludes worker delivery status. */
export async function readInvitationEventSnapshot(
  fixture: CaseFixture,
  eventId: string,
) {
  const client = requirePg();
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const rows = async (sql: string) =>
      (await client.query(sql, [fixture.tenantId, eventId])).rows;
    const snapshot = {
      invitations: await rows(`SELECT id, state, claimed_by, redemption_code_id
        FROM guest_invitations WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id`),
      requests: await rows(`SELECT id, status, actor_user_id, redemption_code_id
        FROM redemption_requests WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id`),
      tickets: await rows(`SELECT id, state, owner_user_id, request_id
        FROM tickets WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id`),
      codes: await rows(`SELECT id, status FROM redemption_codes
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id`),
      quotas: await rows(`SELECT id, scope, scope_id, allocated FROM quota_buckets
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid ORDER BY id`),
      redeemOperations: await rows(`SELECT id, actor_user_id, client_key, status
        FROM operations WHERE tenant_id=$1::uuid AND event_id=$2::uuid
          AND command='redemption.redeem' ORDER BY id`),
      ticketOutbox: await rows(`SELECT id, aggregate_id FROM outbox
        WHERE tenant_id=$1::uuid AND event_id=$2::uuid
          AND type='TicketIssued' ORDER BY id`),
    };
    await client.query('COMMIT');
    return snapshot;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

/** Compare quota bucket allocated counts between two invitation snapshots. */
export function assertInvitationQuotaDelta(
  before: Awaited<ReturnType<typeof readInvitationEventSnapshot>>,
  after: Awaited<ReturnType<typeof readInvitationEventSnapshot>>,
  delta: number,
  label = 'quota',
) {
  expect(after.quotas.map((row) => row.id)).toEqual(
    before.quotas.map((row) => row.id),
  );
  for (let i = 0; i < after.quotas.length; i++) {
    expect(
      Number(after.quotas[i].allocated) - Number(before.quotas[i].allocated),
      `${label}: bucket ${String(after.quotas[i].scope)}`,
    ).toBe(delta);
  }
}
