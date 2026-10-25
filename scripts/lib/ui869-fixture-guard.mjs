/**
 * Fail-closed guards for UI869 / VCX-925 local persona fixtures only.
 * Never targets shared ticket_d9_demo, remote hosts, or production namespaces.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export const UI869_FIXTURE_DB = 'ticket_ui869_dev';
export const UI869_FIXTURE_NS = 'vcx925-ui869';
export const UI869_D9_TENANT_IDS = new Set([
  'd9d9f001-0001-4000-8000-000000000001',
  'd9d9f001-0001-4000-8000-000000000002',
]);

function parseDb(urlString) {
  const url = new URL(urlString);
  const db = url.pathname.replace(/^\//, '').split('/')[0] || '';
  return { url, db, local: LOOPBACK.has(url.hostname) };
}

export function assertUi869FixtureTarget(env = process.env) {
  const databaseUrl = env.DATABASE_URL || env.UI869_ADMIN_DATABASE_URL;
  const issuer = env.OIDC_ISSUER || env.UI869_OIDC_ISSUER;
  const api = env.UI869_API_URL || 'http://127.0.0.1:3498';
  if (!databaseUrl?.trim()) throw new Error('ui869_fixture_guard_missing_database_url');
  if (!issuer?.trim()) throw new Error('ui869_fixture_guard_missing_oidc_issuer');
  const db = parseDb(databaseUrl);
  if (!db.local || db.db !== UI869_FIXTURE_DB) {
    throw new Error('ui869_fixture_guard_database_mismatch');
  }
  const iss = new URL(issuer.replace(/\/$/, ''));
  if (!LOOPBACK.has(iss.hostname)) {
    throw new Error('ui869_fixture_guard_issuer_not_loopback');
  }
  const apiUrl = new URL(api);
  if (!LOOPBACK.has(apiUrl.hostname)) {
    throw new Error('ui869_fixture_guard_api_not_loopback');
  }
  return {
    databaseUrl: databaseUrl.trim(),
    issuer: issuer.replace(/\/$/, ''),
    apiUrl: api.replace(/\/$/, ''),
  };
}

export function assertUi869CleanupScope(tenantIds) {
  for (const id of tenantIds) {
    if (!UI869_D9_TENANT_IDS.has(id)) {
      throw new Error(`ui869_fixture_cleanup_refused_unknown_tenant:${id}`);
    }
  }
}
