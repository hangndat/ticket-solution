import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const requireBackend = createRequire(
  resolve(import.meta.dirname, '../../../packages/backend/package.json'),
);

/** Give ordinary Web fixtures a finite SMTP budget; preserve explicit limit cases. */
export async function seedWebEmailBudgets(state, manifest) {
  const tenants = new Set(
    Object.entries(manifest.cases)
      .filter(([id]) => /^WEB-(0[2-9]|1[0-3])$/.test(id))
      .map(([, fixture]) => fixture.tenantId),
  );
  if (!tenants.size) return;
  const url = new URL(state.databaseUrl);
  if (
    manifest.runId !== state.id ||
    manifest.runtime?.ownerRunId !== state.id ||
    state.project !== `e2e-${state.id}` ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.port !== String(state.ports.pg)
  ) {
    throw new Error(
      'BLOCKED: email budget fixture requires its owned local DB',
    );
  }

  const { Client } = requireBackend('pg');
  const client = new Client({ connectionString: state.databaseUrl });
  await client.connect();
  try {
    for (const tenantId of tenants) {
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL ROLE ticket_runtime');
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [
          tenantId,
        ]);
        await client.query(
          `INSERT INTO tenant_limits (tenant_id, email_per_day)
           VALUES ($1::uuid, 1000)
           ON CONFLICT (tenant_id) DO NOTHING`,
          [tenantId],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}
