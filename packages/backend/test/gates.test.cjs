const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { migrationFiles } = require('./migration-files.cjs');
const { Client } = require('pg');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  grantMembership,
  grantEventAssignment,
  GateError,
  GATE_ERROR_CODES,
  openStaffSession,
  listEventGates,
  createEventGate,
} = require('../dist');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

async function startIsolatedPostgres() {
  const name = 'ticket-o31-gates-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  docker(
    'run', '-d', '--name', name,
    '-e', 'POSTGRES_PASSWORD=' + password,
    '-e', 'POSTGRES_DB=o31_test',
    '-p', '127.0.0.1::5432',
    'postgres:18.1-alpine',
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      docker('exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'o31_test');
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(ready, 'task database must become ready');
  const port = docker('port', name, '5432/tcp').split(':').at(-1);
  const admin = new Client({
    connectionString: 'postgresql://postgres:' + password + '@127.0.0.1:' + port + '/o31_test',
  });
  try {
    for (let i = 0; i < 30; i++) {
      try {
        await admin.connect();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    await admin.query('CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE ticket_platform_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('CREATE ROLE migration_owner NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await admin.query('GRANT CREATE, USAGE ON SCHEMA public TO migration_owner');
    await admin.query('SET ROLE migration_owner');
    for (const file of migrationFiles()) {
      await admin.query(readFileSync(file, 'utf8'));
    }
    await admin.query('RESET ROLE');
    await admin.query(
      "CREATE ROLE o31_login LOGIN PASSWORD '" + password + "' NOSUPERUSER NOBYPASSRLS INHERIT",
    );
    await admin.query('GRANT ticket_runtime TO o31_login');
    return {
      name,
      url: 'postgresql://o31_login:' + password + '@127.0.0.1:' + port + '/o31_test',
    };
  } finally {
    await admin.end().catch(() => {});
  }
}

test('O31 gates: list/create/open per gate, RLS, cross-event, backward compat', { timeout: 180000 }, async () => {
  let name;
  let db;
  try {
    const boot = await startIsolatedPostgres();
    name = boot.name;
    db = createDatabase(boot.url, 4);
    const users = createPrismaIdentityUserRepository(db);
    const iss = 'http://127.0.0.1:8080/realms/ticket';
    const staff = await users.upsertFromVerifiedIdentity({ issuer: iss, subject: 'g-staff', email: 'g-staff@example.com', emailVerified: true });
    const admin = await users.upsertFromVerifiedIdentity({ issuer: iss, subject: 'g-admin', email: 'g-admin@example.com', emailVerified: true });
    const outsider = await users.upsertFromVerifiedIdentity({ issuer: iss, subject: 'g-out', email: 'g-out@example.com', emailVerified: true });
    const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const ev1 = 'e1111111-1111-4111-8111-111111111111';
    const ev2 = 'e2222222-2222-4222-8222-222222222222';
    const ev3 = 'e3333333-3333-4333-8333-333333333333';
    for (const [tenantId, slug, events] of [
      [tenantA, 'gates-a', [ev1, ev2]],
      [tenantB, 'gates-b', [ev3]],
    ]) {
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({ data: { id: tenantId, slug, name: slug } });
        for (const id of events) {
          await tx.event.create({
            data: { tenantId, id, slug: 'ev-' + id.slice(0, 2), name: 'Event ' + id.slice(0, 2), status: 'PUBLISHED' },
          });
        }
      });
    }
    await withTenant(db, tenantA, async (tx) => {
      const sm = await grantMembership(tx, { tenantId: tenantA, userId: staff.userId, role: 'STAFF', permissions: ['gate.confirm'] });
      for (const eventId of [ev1, ev2]) {
        await grantEventAssignment(tx, { tenantId: tenantA, eventId, membershipId: sm.membershipId, permissions: ['gate.confirm'] });
      }
      const am = await grantMembership(tx, { tenantId: tenantA, userId: admin.userId, role: 'ADMIN', permissions: ['event.update', 'gate.confirm'] });
      for (const eventId of [ev1, ev2]) {
        await grantEventAssignment(tx, { tenantId: tenantA, eventId, membershipId: am.membershipId, permissions: ['event.update', 'gate.confirm'] });
      }
    });
    await withTenant(db, tenantB, async (tx) => {
      const om = await grantMembership(tx, { tenantId: tenantB, userId: outsider.userId, role: 'STAFF', permissions: ['gate.confirm'] });
      await grantEventAssignment(tx, { tenantId: tenantB, eventId: ev3, membershipId: om.membershipId, permissions: ['gate.confirm'] });
    });

    // zero gates -> empty list; open without gateId keeps legacy behaviour
    assert.deepEqual(await withTenant(db, tenantA, (tx) => listEventGates(tx, { tenantId: tenantA, eventId: ev1, userId: staff.userId })), []);
    const legacy = await withTenant(db, tenantA, (tx) => openStaffSession(tx, { tenantId: tenantA, eventId: ev1, userId: staff.userId }));
    assert.equal(legacy.gateId, null);
    assert.equal(legacy.gateName, null);

    // staff (no event.update) cannot create
    await assert.rejects(
      withTenant(db, tenantA, (tx) => createEventGate(tx, { tenantId: tenantA, eventId: ev1, userId: staff.userId, name: 'X' })),
      (e) => e.code === 'PERMISSION_DENIED' || /permission/i.test(e.message),
    );

    const gateB = await withTenant(db, tenantA, (tx) => createEventGate(tx, { tenantId: tenantA, eventId: ev1, userId: admin.userId, name: 'Cổng B', sortOrder: 2 }));
    const gateA = await withTenant(db, tenantA, (tx) => createEventGate(tx, { tenantId: tenantA, eventId: ev1, userId: admin.userId, name: 'Cổng A', sortOrder: 1 }));
    const gateOther = await withTenant(db, tenantA, (tx) => createEventGate(tx, { tenantId: tenantA, eventId: ev2, userId: admin.userId, name: 'Cổng A', sortOrder: 1 }));
    await assert.rejects(
      withTenant(db, tenantA, (tx) => createEventGate(tx, { tenantId: tenantA, eventId: ev1, userId: admin.userId, name: ' Cổng A ' })),
      (e) => e instanceof GateError && e.code === GATE_ERROR_CODES.GATE_NAME_CONFLICT,
    );
    const listed = await withTenant(db, tenantA, (tx) => listEventGates(tx, { tenantId: tenantA, eventId: ev1, userId: staff.userId }));
    assert.deepEqual(listed.map((g) => g.name), ['Cổng A', 'Cổng B']);
    assert.ok(listed.every((g) => g.eventId === ev1));

    // open per gate; repeated open keeps today's invariant (new ACTIVE row each time)
    const s1 = await withTenant(db, tenantA, (tx) => openStaffSession(tx, { tenantId: tenantA, eventId: ev1, userId: staff.userId, gateId: gateA.id }));
    const s2 = await withTenant(db, tenantA, (tx) => openStaffSession(tx, { tenantId: tenantA, eventId: ev1, userId: staff.userId, gateId: gateA.id }));
    assert.equal(s1.gateId, gateA.id);
    assert.equal(s1.gateName, 'Cổng A');
    assert.notEqual(s1.sessionId, s2.sessionId);

    // gate from another event (same tenant) rejected; unknown gate rejected
    await assert.rejects(
      withTenant(db, tenantA, (tx) => openStaffSession(tx, { tenantId: tenantA, eventId: ev1, userId: staff.userId, gateId: gateOther.id })),
      (e) => e instanceof GateError && e.code === GATE_ERROR_CODES.GATE_NOT_FOUND,
    );
    // cross-tenant: tenant B sees nothing and cannot open on tenant A's gate
    assert.deepEqual(await withTenant(db, tenantB, (tx) => listEventGates(tx, { tenantId: tenantB, eventId: ev3, userId: outsider.userId })), []);
    await assert.rejects(
      withTenant(db, tenantB, (tx) => openStaffSession(tx, { tenantId: tenantB, eventId: ev3, userId: outsider.userId, gateId: gateB.id })),
      (e) => e instanceof GateError && e.code === GATE_ERROR_CODES.GATE_NOT_FOUND,
    );
    const visibleToB = await withTenant(db, tenantB, (tx) => tx.$queryRaw`SELECT count(*)::int AS n FROM gates`);
    assert.equal(visibleToB[0].n, 0);
    await assert.rejects(
      withTenant(db, tenantB, (tx) => tx.$executeRaw`
        INSERT INTO gates (tenant_id, event_id, id, name)
        VALUES (${tenantA}::uuid, ${ev1}::uuid, gen_random_uuid(), 'evil')`),
    );
    // DB-level composite FK: session cannot point at another event's gate
    await assert.rejects(
      withTenant(db, tenantA, (tx) => tx.$executeRaw`
        UPDATE staff_sessions SET gate_id = ${gateOther.id}::uuid
        WHERE tenant_id = ${tenantA}::uuid AND id = ${s1.sessionId}::uuid`),
    );
  } finally {
    await db?.$disconnect?.().catch(() => {});
    if (name) {
      try { docker('rm', '-f', name); } catch {}
    }
  }
});
