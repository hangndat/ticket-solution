'use strict';
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Client } = require('../../../packages/backend/node_modules/pg');
const {
  migrationFiles,
} = require('../../../packages/backend/test/migration-files.cjs');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startPostgres() {
  const name = `ticket-e2e-backend-${randomBytes(6).toString('hex')}`;
  const password = randomBytes(24).toString('hex');
  const database = 'e2e_backend';
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.e2e.backend=true',
    '-e',
    `POSTGRES_PASSWORD=${password}`,
    '-e',
    `POSTGRES_DB=${database}`,
    '-p',
    '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
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
          database,
        );
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    if (!ready) throw new Error('Isolated PostgreSQL did not become ready');
    const port = docker('port', name, '5432/tcp').split(':').at(-1);
    const adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
    const admin = new Client({
      connectionString: adminUrl,
      connectionTimeoutMillis: 2000,
    });
    await admin.connect();
    try {
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
      for (const file of migrationFiles())
        await admin.query(readFileSync(file, 'utf8'));
      await admin.query('RESET ROLE');
      await admin.query(
        `CREATE ROLE e2e_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`,
      );
      await admin.query('GRANT ticket_runtime TO e2e_login');
    } finally {
      await admin.end();
    }
    return {
      name,
      adminUrl,
      url: `postgresql://e2e_login:${password}@127.0.0.1:${port}/${database}`,
      stop() {
        docker('rm', '-f', name);
      },
    };
  } catch (error) {
    docker('rm', '-f', name);
    throw error;
  }
}

module.exports = { startPostgres };
