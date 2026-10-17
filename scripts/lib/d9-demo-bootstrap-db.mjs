/**
 * Bootstrap throwaway `ticket_d9_demo` on local Compose Postgres via psql.
 * Applies backend migrations (test/migration-files order). Fixture/dev only.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const MIGRATIONS_DIR = path.join(
  ROOT,
  'packages/backend/prisma/migrations',
);

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) =>
      statSync(path.join(MIGRATIONS_DIR, name)).isDirectory(),
    )
    .sort()
    .map((name) => path.join(MIGRATIONS_DIR, name, 'migration.sql'));
}

function envOr(name, fallback) {
  return process.env[name] || fallback;
}

export async function bootstrapD9DemoDatabase() {
  const host = envOr('POSTGRES_HOST', '127.0.0.1');
  const port = envOr('POSTGRES_PORT', '55432');
  const user = envOr('POSTGRES_USER', 'ticket_dev');
  const password = envOr('POSTGRES_PASSWORD', 'local_dev_only');
  const dbName = envOr('D9_DEMO_DB', 'ticket_d9_demo');
  const runtimeUser = envOr('D9_DEMO_RT_USER', 'd9_demo_rt');
  const runtimePassword =
    process.env.D9_DEMO_RT_PASSWORD ||
    `d9_${randomBytes(12).toString('hex')}`;

  const adminPostgres = `postgresql://${user}:${password}@${host}:${port}/postgres`;
  const adminDb = `postgresql://${user}:${password}@${host}:${port}/${dbName}`;

  // Drop/create database
  execFileSync(
    'psql',
    [
      adminPostgres,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  execFileSync(
    'psql',
    [
      adminPostgres,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `DROP DATABASE IF EXISTS ${dbName};`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  execFileSync(
    'psql',
    [
      adminPostgres,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `CREATE DATABASE ${dbName};`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const preamble = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ticket_runtime') THEN
    CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ticket_platform_runtime') THEN
    CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_owner') THEN
    CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT CREATE, USAGE ON SCHEMA public TO migration_owner;
SET ROLE migration_owner;
`;
  const tmp = mkdtempSync(path.join(tmpdir(), 'd9-mig-'));
  const combined = path.join(tmp, 'all.sql');
  let sql = preamble;
  for (const file of migrationFiles()) {
    sql += `\n-- ${path.basename(path.dirname(file))}\n`;
    sql += readFileSync(file, 'utf8');
    sql += '\n';
  }
  sql += '\nRESET ROLE;\n';
  writeFileSync(combined, sql);
  execFileSync(
    'psql',
    [adminDb, '-v', 'ON_ERROR_STOP=1', '-f', combined],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

  const roleSql = `
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${runtimeUser}') THEN
    DROP ROLE ${runtimeUser};
  END IF;
END $$;
CREATE ROLE ${runtimeUser} LOGIN NOSUPERUSER NOBYPASSRLS INHERIT PASSWORD '${runtimePassword.replace(/'/g, "''")}';
GRANT ticket_runtime TO ${runtimeUser};
`;
  execFileSync(
    'psql',
    [adminDb, '-v', 'ON_ERROR_STOP=1', '-c', roleSql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

  return {
    dbName,
    runtimeUser,
    adminUrl: adminDb,
    runtimeUrl: `postgresql://${runtimeUser}:${runtimePassword}@${host}:${port}/${dbName}`,
    runtimePassword,
    bootstrapId: randomUUID(),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  bootstrapD9DemoDatabase()
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      console.error(e.stderr || e.message || e);
      process.exit(1);
    });
}
