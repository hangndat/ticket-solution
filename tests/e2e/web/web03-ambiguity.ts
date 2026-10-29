import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect } from 'playwright/test';
import type { CaseFixture } from '../harness/contract';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

/** Exercise the run-local legacy ambiguity gate after the routable branch. */
export async function withAmbiguousRoutingGroup<T>(
  fixture: CaseFixture,
  codeId: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR)
    throw new Error('BLOCKED: ambiguity fixture requires isolated E2E runtime');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let groupId: string | undefined;
  try {
    const rows = await client.query(
      "SELECT id FROM code_routing_groups WHERE routed_tenant_id=$1::uuid AND routed_code_id=$2::uuid AND resolution='ROUTABLE'",
      [fixture.tenantId, codeId],
    );
    expect(rows.rows).toHaveLength(1);
    groupId = String(rows.rows[0].id);
    await client.query(
      "UPDATE code_routing_groups SET resolution='AMBIGUOUS', routed_tenant_id=NULL, routed_event_id=NULL, routed_code_id=NULL, updated_at=now() WHERE id=$1::uuid",
      [groupId],
    );
    return await run();
  } finally {
    if (groupId) {
      await client.query(
        "UPDATE code_routing_groups SET resolution='ROUTABLE', routed_tenant_id=$2::uuid, routed_event_id=$3::uuid, routed_code_id=$4::uuid, updated_at=now() WHERE id=$1::uuid",
        [groupId, fixture.tenantId, fixture.eventId, codeId],
      );
    }
    await client.end();
  }
}
