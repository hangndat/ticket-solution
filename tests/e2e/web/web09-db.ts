import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { CaseFixture } from '../harness/contract';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

/** Verify the isolated fixture under the runtime role and tenant-local RLS. */
export async function readWeb09Database(
  fixture: CaseFixture,
  tenantId: string,
  actorIds: string[],
) {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR) {
    throw new Error('BLOCKED: WEB-09 requires isolated E2E PostgreSQL');
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const memberships = await client.query(
      'SELECT user_id FROM memberships WHERE tenant_id=$1::uuid AND user_id=ANY($2::uuid[])',
      [tenantId, actorIds],
    );
    const tickets = await client.query(
      'SELECT id, owner_user_id, state, request_id FROM tickets WHERE tenant_id=$1::uuid ORDER BY id',
      [tenantId],
    );
    const operations = await client.query(
      'SELECT actor_user_id, client_key FROM operations WHERE tenant_id=$1::uuid AND event_id=$2::uuid',
      [
        tenantId,
        tenantId === fixture.tenantId
          ? fixture.eventId
          : fixture.data?.otherEventId,
      ],
    );
    await client.query('COMMIT');
    return {
      memberships: memberships.rows as Array<{ user_id: string }>,
      tickets: tickets.rows as Array<{
        id: string;
        owner_user_id: string;
        state: string;
        request_id: string;
      }>,
      operations: operations.rows as Array<{
        actor_user_id: string;
        client_key: string;
      }>,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}
