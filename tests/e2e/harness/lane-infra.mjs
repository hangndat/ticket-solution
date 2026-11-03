// Cấp phát theo từng run bên trong một lane dùng chung: database từ template,
// realm import qua admin API, mailbox và object storage. Container của lane giữ
// nguyên; cleanup chỉ xóa tài nguyên mang runId của chính run này.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrationsFingerprint, templateDatabase, ROOT } from './lane.mjs';

const requireBackend = createRequire(
  resolve(ROOT, 'packages/backend/package.json'),
);

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function assertIdentifier(name) {
  if (!IDENTIFIER.test(name))
    throw new Error(`BLOCKED: tên database không hợp lệ (${name})`);
  return name;
}

function adminUrl(state, database) {
  const password = encodeURIComponent(state.secrets.pg);
  return `postgresql://postgres:${password}@127.0.0.1:${state.ports.pg}/${database}`;
}

async function withClient(url, body) {
  const { Client } = requireBackend('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await body(client);
  } finally {
    await client.end();
  }
}

async function databaseExists(client, name) {
  const { rows } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [name],
  );
  return rows.length > 0;
}

// secrets.pg là hex do harness sinh, không phải input người dùng; PG không nhận
// bind parameter trong CREATE ROLE nên giữ nguyên cách nội suy của seed.
async function ensureClusterRoles(client, password) {
  await client.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ticket_runtime') THEN
    CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ticket_platform_runtime') THEN
    CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_owner') THEN
    CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;`);
  if (!/^[0-9a-f]{16,}$/.test(password))
    throw new Error('BLOCKED: lane PG secret phải là hex do harness sinh');
  await client.query(`DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'e2e_runtime') THEN
    CREATE ROLE e2e_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT;
  ELSE
    ALTER ROLE e2e_runtime LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT;
  END IF;
END $$;`);
  await client.query(
    'GRANT ticket_runtime, ticket_platform_runtime TO e2e_runtime',
  );
}

async function buildTemplate(state, template) {
  const { migrationFiles } = requireBackend('./test/migration-files.cjs');
  await withClient(adminUrl(state, 'postgres'), (client) =>
    client.query(`CREATE DATABASE ${template}`),
  );
  try {
    await withClient(adminUrl(state, template), async (client) => {
      await client.query(
        'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
      );
      await client.query('SET ROLE migration_owner');
      for (const file of migrationFiles())
        await client.query(readFileSync(file, 'utf8'));
      await client.query('RESET ROLE');
    });
  } catch (error) {
    // Template dở dang nguy hiểm hơn là không có template: xóa để run sau dựng lại.
    await withClient(adminUrl(state, 'postgres'), (client) =>
      client.query(`DROP DATABASE IF EXISTS ${template}`),
    ).catch(() => {});
    throw error;
  }
}

/**
 * Dựng database riêng cho run từ template đã migrate sẵn. Template mang
 * fingerprint của migration nên schema đổi là tự sinh template mới.
 */
export async function provisionRunDatabase(state) {
  const database = assertIdentifier(state.databaseName);
  const template = assertIdentifier(templateDatabase(migrationsFingerprint()));
  let needsTemplate = false;
  await withClient(adminUrl(state, 'postgres'), async (client) => {
    await ensureClusterRoles(client, state.secrets.pg);
    needsTemplate = !(await databaseExists(client, template));
  });
  if (needsTemplate) await buildTemplate(state, template);
  await withClient(adminUrl(state, 'postgres'), async (client) => {
    if (await databaseExists(client, database))
      throw new Error(`BLOCKED: database ${database} đã tồn tại trong lane`);
    await client.query(`CREATE DATABASE ${database} TEMPLATE ${template}`);
  });
  state.databaseTemplate = template;
  return database;
}

export async function dropRunDatabase(state) {
  if (!state.databaseName) return;
  const database = assertIdentifier(state.databaseName);
  await withClient(adminUrl(state, 'postgres'), async (client) => {
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database],
    );
    await client.query(`DROP DATABASE IF EXISTS ${database}`);
  });
}

function keycloakBase(state) {
  return `http://127.0.0.1:${state.ports.auth}`;
}

async function keycloakAdminToken(state) {
  const response = await fetch(
    `${keycloakBase(state)}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: 'e2e-admin',
        password: state.secrets.kc,
      }),
    },
  );
  if (!response.ok)
    throw new Error(`BLOCKED: Keycloak admin token HTTP ${response.status}`);
  const body = await response.json();
  if (!body.access_token) throw new Error('BLOCKED: thiếu admin access_token');
  return body.access_token;
}

async function adminRequest(state, token, path, init) {
  const response = await fetch(`${keycloakBase(state)}/admin${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return response;
}

/**
 * Realm mang tên lane (cố định để issuer không đổi giữa các run) nhưng nội dung
 * là của run hiện tại: xóa rồi import lại cho mỗi run.
 */
export async function importRealms(state, realmPaths) {
  const token = await keycloakAdminToken(state);
  for (const realmPath of realmPaths.filter(Boolean)) {
    const representation = JSON.parse(readFileSync(realmPath, 'utf8'));
    const name = representation.realm;
    const existing = await adminRequest(state, token, `/realms/${name}`, {
      method: 'DELETE',
    });
    if (!existing.ok && existing.status !== 404)
      throw new Error(
        `BLOCKED: xóa realm ${name} thất bại HTTP ${existing.status}`,
      );
    const created = await adminRequest(state, token, '/realms', {
      method: 'POST',
      body: JSON.stringify(representation),
    });
    if (!created.ok)
      throw new Error(
        `BLOCKED: import realm ${name} thất bại HTTP ${created.status}`,
      );
  }
}

/** Grant only the run-scoped erasure service account Keycloak user management. */
export async function provisionErasureClient(state) {
  const token = await keycloakAdminToken(state);
  const realm = encodeURIComponent(state.realm);
  const get = async (path) => {
    const response = await adminRequest(state, token, path);
    if (!response.ok)
      throw new Error(`BLOCKED: Keycloak erasure setup HTTP ${response.status}`);
    return response.json();
  };
  const client = (await get(`/realms/${realm}/clients?clientId=e2e-erasure`))
    .find((item) => item.clientId === 'e2e-erasure');
  const management = (await get(`/realms/${realm}/clients?clientId=realm-management`))
    .find((item) => item.clientId === 'realm-management');
  if (!client?.id || !management?.id)
    throw new Error('BLOCKED: Keycloak erasure/realm-management client missing');
  const service = await get(`/realms/${realm}/clients/${client.id}/service-account-user`);
  const role = await get(`/realms/${realm}/clients/${management.id}/roles/manage-users`);
  if (!service?.id || !role?.id)
    throw new Error('BLOCKED: Keycloak erasure service account/role missing');
  const granted = await adminRequest(
    state, token,
    `/realms/${realm}/users/${service.id}/role-mappings/clients/${management.id}`,
    { method: 'POST', body: JSON.stringify([role]) },
  );
  if (!granted.ok)
    throw new Error(`BLOCKED: Keycloak erasure role grant HTTP ${granted.status}`);
}

export async function deleteRealms(state, names) {
  const token = await keycloakAdminToken(state);
  for (const name of names.filter(Boolean)) {
    const response = await adminRequest(state, token, `/realms/${name}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404)
      throw new Error(
        `BLOCKED: xóa realm ${name} thất bại HTTP ${response.status}`,
      );
  }
}

/** Mailpit của lane dùng chung; run tuần tự nên xóa sạch hộp thư ở đầu run. */
export async function clearMailbox(state) {
  const response = await fetch(
    `http://127.0.0.1:${state.ports.mailpit}/api/v1/messages`,
    { method: 'DELETE' },
  );
  if (!response.ok)
    throw new Error(`BLOCKED: xóa Mailpit thất bại HTTP ${response.status}`);
}

/**
 * Bucket, user và policy của MinIO đã mang runId; trong lane phải tự xóa vì
 * container không bị hạ cùng run.
 */
export function removeRunObjectStorage(state, image, rootSecret) {
  if (!state.minio || !rootSecret) return;
  const host = `http://e2e-access:${rootSecret}@minio:9000`;
  const mc = (args) =>
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        `${state.project}_default`,
        '--env',
        'MC_HOST_e2e',
        '--entrypoint',
        'mc',
        image,
        ...args,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 8e6,
        env: { ...process.env, MC_HOST_e2e: host },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
  const failures = [];
  const attempt = (args) => {
    try {
      mc(args);
    } catch (error) {
      failures.push(`${args.join(' ')}: ${error.status ?? error.code}`);
    }
  };
  for (const bucket of Object.values(state.minio.buckets))
    attempt(['rb', '--force', `e2e/${bucket}`]);
  for (const identity of Object.values(state.minio.identities))
    attempt(['admin', 'user', 'remove', 'e2e', identity.accessKey]);
  for (const role of ['shared', 'exports'])
    attempt(['admin', 'policy', 'rm', 'e2e', `e2e-${role}-${state.id}`]);
  if (failures.length) {
    writeFileSync(
      resolve(state.dir, 'lane-object-cleanup.log'),
      failures.join('\n') + '\n',
      { mode: 0o600 },
    );
  }
}
