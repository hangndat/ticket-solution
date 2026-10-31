'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { migrationFiles } = require('./migration-files.cjs');
const {
  createDatabase, createPrismaIdentityUserRepository, withTenant,
  grantMembership, grantEventAssignment, eventPermissionsForRole,
} = require('../dist');

const migration = path.join(__dirname,
  '../prisma/migrations/202610290004_ticket_reissue_grants/migration.sql');
const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

test('reissue grant migration backfills only active built-in revoke grants',
  { timeout: 180000 }, async () => {
    const name = 'ticket-reissue-grants-' + randomBytes(5).toString('hex');
    const password = randomBytes(20).toString('hex');
    let admin;
    let db;
    try {
      docker('run', '-d', '--name', name,
        '-e', 'POSTGRES_PASSWORD=' + password,
        '-e', 'POSTGRES_DB=reissue_grants_test',
        '-p', '127.0.0.1::5432', 'postgres:18.1-alpine');
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try {
          docker('exec', name, 'pg_isready', '-h', '127.0.0.1',
            '-U', 'postgres', '-d', 'reissue_grants_test');
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      assert.ok(ready);
      const port = docker('port', name, '5432/tcp').split(':').at(-1);
      const base = `postgresql://postgres:${password}@127.0.0.1:${port}/reissue_grants_test`;
      admin = new Client({ connectionString: base });
      await admin.connect();
      await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
      await admin.query('SET ROLE migration_owner');
      for (const file of migrationFiles().filter((file) => file !== migration)) {
        await admin.query(readFileSync(file, 'utf8'));
      }
      await admin.query('RESET ROLE');
      await admin.query(`CREATE ROLE reissue_login LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS INHERIT`);
      await admin.query('GRANT ticket_runtime TO reissue_login');
      db = createDatabase(base.replace('postgres:', 'reissue_login:'), 3);
      const users = createPrismaIdentityUserRepository(db);
      const tenantId = randomUUID();
      const eventId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({ data: { id: tenantId, slug: 'reissue-grants', name: 'Reissue grants' } });
        await tx.event.create({ data: {
          tenantId, id: eventId, slug: 'reissue-grants-event',
          name: 'Reissue grants event', status: 'PUBLISHED',
        } });
      });

      const cases = [
        ['owner', 'Owner', ['ticket.revoke'], true],
        ['supervisor', 'Supervisor', ['ticket.revoke'], true],
        ['restricted-owner', 'Owner', ['gate.confirm'], false],
        ['manager', 'Manager', ['ticket.revoke'], false],
        ['cs', 'CS', ['ticket.revoke'], false],
        ['scanner', 'Scanner', ['ticket.revoke'], false],
        ['preset', randomUUID(), ['ticket.revoke'], false],
        ['inactive-membership', 'Supervisor', ['ticket.revoke'], false, 'inactiveMembership'],
        ['inactive-assignment', 'Owner', ['ticket.revoke'], false, 'inactiveAssignment'],
        ['revoked-membership', 'Supervisor', ['ticket.revoke'], false, 'revokedMembership'],
        ['revoked-assignment', 'Owner', ['ticket.revoke'], false, 'revokedAssignment'],
      ];
      const assignments = new Map();
      for (const [label, role, permissions, , state] of cases) {
        const user = await users.upsertFromVerifiedIdentity({
          issuer: 'http://localhost/realms/ticket', subject: label,
          email: `${label}@example.com`, emailVerified: true,
        });
        await withTenant(db, tenantId, async (tx) => {
          const membership = await grantMembership(tx, {
            tenantId, userId: user.userId, role, permissions: [],
            ...(state === 'inactiveMembership' ? { activatedAt: null } : {}),
          });
          const assignment = await grantEventAssignment(tx, {
            tenantId, eventId, membershipId: membership.membershipId,
            permissions,
            ...(state === 'inactiveAssignment' ? { activatedAt: null } : {}),
          });
          assignments.set(label, assignment.assignmentId);
          if (state === 'revokedMembership') {
            await tx.$executeRaw`UPDATE memberships SET revoked_at = clock_timestamp()
              WHERE tenant_id = ${tenantId}::uuid AND id = ${membership.membershipId}::uuid`;
          }
          if (state === 'revokedAssignment') {
            await tx.$executeRaw`UPDATE event_assignments SET revoked_at = clock_timestamp()
              WHERE tenant_id = ${tenantId}::uuid AND id = ${assignment.assignmentId}::uuid`;
          }
        });
      }

      assert.ok(eventPermissionsForRole('Owner').includes('ticket.reissue'));
      assert.ok(eventPermissionsForRole('Supervisor').includes('ticket.reissue'));
      for (const role of ['Manager', 'CS', 'Scanner']) {
        assert.ok(!eventPermissionsForRole(role).includes('ticket.reissue'));
      }

      const sql = readFileSync(migration, 'utf8');
      await admin.query('SET ROLE migration_owner');
      await admin.query(sql);
      await admin.query(sql);
      await admin.query('RESET ROLE');
      const rows = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
        SELECT id, permissions FROM event_assignments WHERE tenant_id = ${tenantId}::uuid
      `);
      for (const [label, , , expected] of cases) {
        const row = rows.find((item) => item.id === assignments.get(label));
        assert.ok(row, label);
        assert.equal(row.permissions.filter((permission) => permission === 'ticket.reissue').length,
          expected ? 1 : 0, label);
      }
      const functionDef = await admin.query(
        "SELECT pg_get_functiondef('accept_membership_invite(text,uuid,text)'::regprocedure) AS sql",
      );
      assert.match(functionDef.rows[0].sql,
        /WHEN 'Supervisor' THEN ARRAY\['gate.confirm','gate.undo','ticket.revoke','ticket.reissue'\]/);
      assert.match(functionDef.rows[0].sql,
        /WHEN 'Owner' THEN ARRAY\[[^\n]+ticket.revoke','ticket.reissue'\]/);
    } finally {
      if (db) await db.$disconnect();
      if (admin) await admin.end().catch(() => {});
      try { docker('rm', '-f', name); } catch { /* already removed */ }
    }
  });
