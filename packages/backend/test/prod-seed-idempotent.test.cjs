'use strict';

/**
 * Epic #686 prod seed idempotency on isolated PostgreSQL.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  seedProdDataset,
  PROD_SEED,
  readCodeHmacEnvironment,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const MIGRATIONS = migrationFiles();
const OIDC = 'http://127.0.0.1:8080/realms/ticket';

async function startIsolatedPostgres() {
  const name = 'ticket-prod-seed-' + randomBytes(4).toString('hex');
  const password = randomBytes(18).toString('hex');
  docker(
    'run',
    '-d',
    '--name',
    name,
    '-e',
    'POSTGRES_PASSWORD=' + password,
    '-e',
    'POSTGRES_DB=prod_seed_test',
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      docker(
        'exec',
        name,
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        'prod_seed_test',
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  assert.ok(ready, 'database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString:
      'postgresql://postgres:' +
      password +
      '@127.0.0.1:' +
      port +
      '/prod_seed_test',
  });
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await admin.connect();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    await admin.query(
      'CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS',
    );
    await admin.query(
      'GRANT CREATE, USAGE ON SCHEMA public TO migration_owner',
    );
    await admin.query('SET ROLE migration_owner');
    for (const file of MIGRATIONS) await admin.query(readFileSync(file, 'utf8'));
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE prod_seed_login LOGIN PASSWORD '" +
        password +
        "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO prod_seed_login');
    await admin.query('GRANT ticket_platform_runtime TO prod_seed_login');
  } finally {
    await admin.end().catch(() => {});
  }
  return {
    name,
    url:
      'postgresql://prod_seed_login:' +
      password +
      '@127.0.0.1:' +
      port +
      '/prod_seed_test',
  };
}

test(
  'prod seed: first run inserts; second run skips codes and is idempotent',
  { timeout: 300000 },
  async () => {
    let containerName;
    let db;
    try {
      const boot = await startIsolatedPostgres();
      containerName = boot.name;
      db = createDatabase(boot.url, 2);
      const hmac = readCodeHmacEnvironment({
        CODE_HMAC_PEPPER: 'prod-seed-test-pepper!!',
        CODE_HMAC_VERSION: '1',
      });
      const opts = {
        oidcIssuer: OIDC,
        createMissingStaffUsers: true,
      };
      const first = await seedProdDataset(db, hmac, opts);
      assert.equal(first.fixture, true);
      assert.equal(first.tenants.length, 4);
      assert.equal(first.events.length, 6);
      assert.ok(first.codesInserted > 0);
      assert.equal(first.staffEmailsMissing.length, 0);

      const second = await seedProdDataset(db, hmac, opts);
      assert.equal(second.codesInserted, 0);
      assert.ok(second.codesSkipped >= first.codesInserted);
      assert.ok(second.configsSkipped >= 1);

      const tenantCount = await db.tenant.count({
        where: {
          id: { in: Object.values(PROD_SEED.tenants).map((t) => t.id) },
        },
      });
      assert.equal(tenantCount, 4);
    } finally {
      if (db) await db.$disconnect().catch(() => {});
      if (containerName) {
        try {
          docker('rm', '-f', containerName);
        } catch {
          /* ignore */
        }
      }
    }
  },
);
