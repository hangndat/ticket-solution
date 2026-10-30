import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { CaseFixture } from '../harness/contract';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

export type ImportBusinessSnapshot = {
  codes: number;
  tickets: number;
  invitations: number;
  outbox: number;
  audit: number;
  commit_ops: number;
  allocated: number | null;
  import_jobs: number;
};

export type CodeStatusRow = {
  id: string;
  status: string;
  raw_hint: string | null;
};

function connectionString(): string {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR) {
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  }
  return process.env.DATABASE_URL;
}

async function withTenantRead<T>(
  fixture: CaseFixture,
  tenantId: string,
  fn: (client: InstanceType<typeof Client>) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      tenantId,
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export async function readImportBusinessSnapshot(
  fixture: CaseFixture,
  eventId = fixture.eventId,
): Promise<ImportBusinessSnapshot> {
  return withTenantRead(fixture, fixture.tenantId, async (client) => {
    const rows = await client.query(
      `
        SELECT
          (SELECT count(*)::int FROM redemption_codes WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS codes,
          (SELECT count(*)::int FROM tickets WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS tickets,
          (SELECT count(*)::int FROM guest_invitations WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS invitations,
          (SELECT count(*)::int FROM outbox WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS outbox,
          (SELECT count(*)::int FROM audit_logs WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS audit,
          (SELECT count(*)::int FROM operations WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND command='import.commit') AS commit_ops,
          (SELECT allocated FROM quota_buckets WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND scope='EVENT') AS allocated,
          (SELECT count(*)::int FROM import_jobs WHERE tenant_id=$1::uuid AND event_id=$2::uuid) AS import_jobs
      `,
      [fixture.tenantId, eventId],
    );
    return rows.rows[0] as ImportBusinessSnapshot;
  });
}

export async function readCodeStatuses(
  fixture: CaseFixture,
): Promise<CodeStatusRow[]> {
  return withTenantRead(fixture, fixture.tenantId, async (client) => {
    const rows = await client.query(
      `SELECT id::text AS id, status::text AS status, null::text AS raw_hint
       FROM redemption_codes
       WHERE tenant_id=$1::uuid AND event_id=$2::uuid
       ORDER BY id`,
      [fixture.tenantId, fixture.eventId],
    );
    return rows.rows as CodeStatusRow[];
  });
}

export function snapshotEqual(
  a: ImportBusinessSnapshot,
  b: ImportBusinessSnapshot,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Compare business rows that preview/commit must not mutate (jobs metadata may change). */
export function businessRowsUnchanged(
  a: ImportBusinessSnapshot,
  b: ImportBusinessSnapshot,
): boolean {
  return (
    a.codes === b.codes &&
    a.tickets === b.tickets &&
    a.invitations === b.invitations &&
    a.outbox === b.outbox &&
    a.audit === b.audit &&
    a.commit_ops === b.commit_ops &&
    a.allocated === b.allocated
  );
}
