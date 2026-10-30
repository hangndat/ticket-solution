import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { CaseFixture } from '../harness/contract';

const requireBackend = createRequire(
  resolve(process.cwd(), 'packages/backend/package.json'),
);
const { Client } = requireBackend('pg');

export type TicketConsentSnapshot = {
  entitlement: Record<string, unknown>;
  formVersion: string;
  termsVersion: string;
  formDefinitionHash: string;
  termsContentHash: string;
};

export type EventConfigMutationSnapshot = {
  publishedVersion: number | null;
  revision: number;
  configVersionCount: number;
  auditCount: number;
  operationCount: number;
  outboxCount: number;
};

export async function readEventConfigMutationSnapshot(
  fixture: CaseFixture,
): Promise<EventConfigMutationSnapshot> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR) {
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const row = (
      await client.query(
        `SELECT
           e.published_config_version AS published_version,
           e.revision,
           (SELECT count(*)::int FROM event_config_versions
            WHERE tenant_id = $1::uuid AND event_id = $2::uuid) AS config_version_count,
           (SELECT count(*)::int FROM audit_logs
            WHERE tenant_id = $1::uuid AND event_id = $2::uuid) AS audit_count,
           (SELECT count(*)::int FROM operations
            WHERE tenant_id = $1::uuid AND event_id = $2::uuid) AS operation_count,
           (SELECT count(*)::int FROM outbox
            WHERE tenant_id = $1::uuid AND event_id = $2::uuid) AS outbox_count
         FROM events e
         WHERE e.tenant_id = $1::uuid AND e.id = $2::uuid`,
        [fixture.tenantId, fixture.eventId],
      )
    ).rows[0] as Record<string, string | number | null> | undefined;
    if (!row) {
      throw new Error(`BLOCKED: event ${fixture.eventId} missing for PG snapshot`);
    }
    await client.query('COMMIT');
    const publishedRaw = row.published_version;
    const publishedVersion =
      publishedRaw == null
        ? null
        : typeof publishedRaw === 'number'
          ? publishedRaw
          : Number(publishedRaw);
    return {
      publishedVersion: Number.isInteger(publishedVersion) ? publishedVersion : null,
      revision: Number(row.revision),
      configVersionCount: Number(row.config_version_count),
      auditCount: Number(row.audit_count),
      operationCount: Number(row.operation_count),
      outboxCount: Number(row.outbox_count),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

export async function readTicketConsentSnapshot(
  fixture: CaseFixture,
  ticketId: string,
): Promise<TicketConsentSnapshot> {
  if (!process.env.DATABASE_URL || !process.env.E2E_RUN_DIR) {
    throw new Error(
      'BLOCKED: PostgreSQL assertion requires isolated E2E runtime',
    );
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [
      fixture.tenantId,
    ]);
    const row = (
      await client.query(
        `SELECT entitlement_snapshot::text AS entitlement,
                form_version, terms_version,
                form_definition_hash, terms_content_hash
         FROM tickets t
         INNER JOIN redemption_requests r
           ON r.tenant_id = t.tenant_id AND r.id = t.request_id
         WHERE t.tenant_id = $1::uuid AND t.id = $2::uuid`,
        [fixture.tenantId, ticketId],
      )
    ).rows[0] as Record<string, string> | undefined;
    if (!row) {
      throw new Error(`BLOCKED: ticket ${ticketId} missing for PG snapshot`);
    }
    await client.query('COMMIT');
    return {
      entitlement: JSON.parse(row.entitlement) as Record<string, unknown>,
      formVersion: row.form_version,
      termsVersion: row.terms_version,
      formDefinitionHash: row.form_definition_hash,
      termsContentHash: row.terms_content_hash,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}
