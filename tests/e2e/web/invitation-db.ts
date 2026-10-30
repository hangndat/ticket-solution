import { createRequire } from 'node:module';
import { resolve } from 'node:path';
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
