#!/usr/bin/env node
/**
 * VCX-925 — idempotent OIDC persona memberships + volume fixture data (UI869 DB only).
 */
'use strict';

const { randomUUID } = require('node:crypto');

async function loadGuard() {
  return import('./lib/ui869-fixture-guard.mjs');
}

async function loadCatalog() {
  return import('./lib/ui869-persona-catalog.mjs');
}

const {
  createDatabase,
  readCodeHmacEnvironment,
  D9_DEMO,
  withTenant,
  tenantPermissionsForRole,
  eventPermissionsForRole,
  hashRedemptionCode,
} = require('../packages/backend/dist');

function samePermissionSet(a, b) {
  const left = [...a].sort().join('\0');
  const right = [...b].sort().join('\0');
  return left === right;
}

async function ensureUser(db, issuer, subject, email) {
  const existing = await db.user.findUnique({
    where: { issuer_subject: { issuer, subject } },
  });
  if (existing) {
    if (existing.email !== email || !existing.emailVerified) {
      await db.user.update({
        where: { id: existing.id },
        data: { email, emailVerified: true },
      });
    }
    return existing.id;
  }
  const row = await db.user.create({
    data: {
      id: randomUUID(),
      issuer,
      subject,
      email,
      emailVerified: true,
    },
  });
  return row.id;
}

async function ensureRoleAccess(
  tx,
  { tenantId, eventId, userId, role, eventPermissions },
) {
  const expectedTenantPerms = [...tenantPermissionsForRole(role)];
  const expectedEventPerms = eventPermissions ?? [...eventPermissionsForRole(role)];

  const existing = await tx.membership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  let membershipId;
  let membershipAction = 'skipped';
  if (existing && !existing.revokedAt) {
    membershipId = existing.id;
    const needs =
      existing.role !== role ||
      !samePermissionSet(existing.permissions, expectedTenantPerms);
    if (needs) {
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          role,
          permissions: expectedTenantPerms,
          activatedAt: existing.activatedAt ?? new Date(),
        },
      });
      membershipAction = 'updated';
    }
  } else if (existing?.revokedAt) {
    await tx.membership.update({
      where: { id: existing.id },
      data: {
        role,
        permissions: expectedTenantPerms,
        activatedAt: new Date(),
        revokedAt: null,
      },
    });
    membershipId = existing.id;
    membershipAction = 'revived';
  } else {
    membershipId = randomUUID();
    await tx.membership.create({
      data: {
        id: membershipId,
        tenantId,
        userId,
        role,
        permissions: expectedTenantPerms,
        activatedAt: new Date(),
      },
    });
    membershipAction = 'created';
  }

  const assignment = await tx.eventAssignment.findUnique({
    where: {
      tenantId_eventId_membershipId: { tenantId, eventId, membershipId },
    },
  });
  let assignmentAction = 'skipped';
  if (assignment && !assignment.revokedAt) {
    if (!samePermissionSet(assignment.permissions, expectedEventPerms)) {
      await tx.eventAssignment.update({
        where: { id: assignment.id },
        data: {
          permissions: expectedEventPerms,
          activatedAt: assignment.activatedAt ?? new Date(),
        },
      });
      assignmentAction = 'updated';
    }
  } else if (assignment?.revokedAt) {
    await tx.eventAssignment.update({
      where: { id: assignment.id },
      data: {
        permissions: expectedEventPerms,
        activatedAt: new Date(),
        revokedAt: null,
      },
    });
    assignmentAction = 'revived';
  } else {
    await tx.eventAssignment.create({
      data: {
        id: randomUUID(),
        tenantId,
        eventId,
        membershipId,
        permissions: expectedEventPerms,
        activatedAt: new Date(),
      },
    });
    assignmentAction = 'created';
  }
  return { membershipAction, assignmentAction };
}

async function passwordToken(issuer, username, password) {
  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: 'ticket-web',
      client_secret: 'dev-web-secret-change-me',
      username,
      password,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`persona_token_failed:${username}:${res.status}`);
  }
  const payload = JSON.parse(
    Buffer.from(json.access_token.split('.')[1], 'base64url').toString('utf8'),
  );
  return { sub: payload.sub, token: json.access_token };
}

async function seedVolume(db, hmac, issuer, report) {
  const tenantId = D9_DEMO.tenants.mfest.id;
  const eventId = D9_DEMO.events.mfest.id;
  const sourceId = D9_DEMO.events.mfest.sourceId;
  const ticketTypeId = D9_DEMO.events.mfest.ticketTypeId;
  const ns = 'vcx925-ui869';

  await withTenant(db, tenantId, async (tx) => {
    let codesAdded = 0;
    for (let i = 1; i <= 40; i += 1) {
      const raw = `VCX925-BULK-${String(i).padStart(3, '0')}`;
      const digest = hashRedemptionCode(hmac, raw);
      const existing = await tx.$queryRaw`
        SELECT id FROM redemption_codes
        WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
          AND code_hmac = ${digest} LIMIT 1`;
      if (existing[0]) continue;
      await tx.$executeRaw`
        INSERT INTO redemption_codes (
          tenant_id, event_id, id, code_hmac, code_pepper_version,
          source_id, ticket_type_id, status, created_at, updated_at
        ) VALUES (
          ${tenantId}::uuid, ${eventId}::uuid, ${randomUUID()}::uuid,
          ${digest}, ${hmac.version}, ${sourceId}::uuid,
          ${ticketTypeId}::uuid, 'AVAILABLE', now(), now()
        )`;
      codesAdded += 1;
    }
    report.volume.codesAdded = codesAdded;

    let ticketsAdded = 0;
    for (let i = 1; i <= 30; i += 1) {
      const email = `vcx925-guest-${String(i).padStart(3, '0')}@example.com`;
      const sub = `${ns}-guest-${String(i).padStart(3, '0')}`;
      const userId = await ensureUser(db, issuer, sub, email);
      const existing = await tx.$queryRaw`
        SELECT t.id FROM tickets t
        WHERE t.tenant_id = ${tenantId}::uuid AND t.event_id = ${eventId}::uuid
          AND t.owner_user_id = ${userId}::uuid LIMIT 1`;
      if (existing[0]) continue;
      const raw = `VCX925-TKT-${String(i).padStart(3, '0')}`;
      const digest = hashRedemptionCode(hmac, raw);
      const codeId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO redemption_codes (
          tenant_id, event_id, id, code_hmac, code_pepper_version,
          source_id, ticket_type_id, status, created_at, updated_at
        ) VALUES (
          ${tenantId}::uuid, ${eventId}::uuid, ${codeId}::uuid,
          ${digest}, ${hmac.version}, ${sourceId}::uuid,
          ${ticketTypeId}::uuid, 'AVAILABLE', now(), now()
        )`;
      const requestId = randomUUID();
      const ticketId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO redemption_requests (
          tenant_id, event_id, id, actor_user_id, redemption_code_id,
          status, expires_at, created_at, updated_at
        ) VALUES (
          ${tenantId}::uuid, ${eventId}::uuid, ${requestId}::uuid,
          ${userId}::uuid, ${codeId}::uuid, 'ISSUED',
          now() + interval '1 day', now(), now()
        )`;
      await tx.$executeRaw`
        UPDATE redemption_codes SET status = 'CONSUMED', updated_at = now()
        WHERE tenant_id = ${tenantId}::uuid AND id = ${codeId}::uuid`;
      await tx.$executeRaw`
        INSERT INTO tickets (
          tenant_id, event_id, id, owner_user_id, ticket_type_id, source_id,
          request_id, redemption_code_id, state, created_at, updated_at
        ) VALUES (
          ${tenantId}::uuid, ${eventId}::uuid, ${ticketId}::uuid,
          ${userId}::uuid, ${ticketTypeId}::uuid, ${sourceId}::uuid,
          ${requestId}::uuid, ${codeId}::uuid, 'ACTIVE', now(), now()
        )`;
      ticketsAdded += 1;
    }
    report.volume.ticketsAdded = ticketsAdded;

    let pendingAdded = 0;
    for (let i = 1; i <= 20; i += 1) {
      const raw = `VCX925-PEND-${String(i).padStart(3, '0')}`;
      const digest = hashRedemptionCode(hmac, raw);
      const codeRows = await tx.$queryRaw`
        SELECT id, status FROM redemption_codes
        WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
          AND code_hmac = ${digest} LIMIT 1`;
      let codeId = codeRows[0]?.id;
      if (!codeId) {
        codeId = randomUUID();
        await tx.$executeRaw`
          INSERT INTO redemption_codes (
            tenant_id, event_id, id, code_hmac, code_pepper_version,
            source_id, ticket_type_id, status, created_at, updated_at
          ) VALUES (
            ${tenantId}::uuid, ${eventId}::uuid, ${codeId}::uuid,
            ${digest}, ${hmac.version}, ${sourceId}::uuid,
            ${ticketTypeId}::uuid, 'HELD', now(), now()
          )`;
      }
      const reqRows = await tx.$queryRaw`
        SELECT id FROM redemption_requests
        WHERE tenant_id = ${tenantId}::uuid AND redemption_code_id = ${codeId}::uuid
          AND status = 'PENDING_REVIEW' LIMIT 1`;
      if (reqRows[0]) continue;
      const actorId = await ensureUser(
        db,
        issuer,
        `${ns}-pending-actor-${String(i).padStart(3, '0')}`,
        `vcx925-pending-${String(i).padStart(3, '0')}@example.com`,
      );
      const requestId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO redemption_requests (
          tenant_id, event_id, id, actor_user_id, redemption_code_id,
          status, expires_at, created_at, updated_at
        ) VALUES (
          ${tenantId}::uuid, ${eventId}::uuid, ${requestId}::uuid,
          ${actorId}::uuid, ${codeId}::uuid, 'PENDING_REVIEW',
          now() + interval '1 day', now(), now()
        )`;
      pendingAdded += 1;
    }
    report.volume.pendingAdded = pendingAdded;
  });
}

async function main() {
  const guard = await loadGuard();
  const catalog = await loadCatalog();
  const target = guard.assertUi869FixtureTarget(process.env);
  const hmac = readCodeHmacEnvironment(process.env);
  const db = createDatabase(target.databaseUrl, 2);
  const report = {
    ok: true,
    fixture: true,
    namespace: guard.UI869_FIXTURE_NS,
    personas: [],
    volume: { codesAdded: 0, ticketsAdded: 0, pendingAdded: 0 },
  };

  try {
    const { ensureKeycloakPersonas } = await import('./lib/ui869-keycloak-personas.mjs');
    await ensureKeycloakPersonas({ issuer: target.issuer });

    for (const persona of catalog.PERSONAS) {
      if (persona.id === 'legacy-staff-owner' || persona.kind === 'attendee') {
        if (persona.kind === 'attendee') {
          const { sub } = await passwordToken(
            target.issuer,
            persona.email,
            persona.password,
          );
          await ensureUser(db, target.issuer, sub, persona.email);
        }
        continue;
      }
      const { sub } = await passwordToken(
        target.issuer,
        persona.email,
        persona.password,
      );
      const userId = await ensureUser(db, target.issuer, sub, persona.email);
      const access = [];
      for (const assignment of persona.assignments) {
        const result = await withTenant(
          db,
          assignment.tenantId,
          (tx) =>
            ensureRoleAccess(tx, {
              tenantId: assignment.tenantId,
              eventId: assignment.eventId,
              userId,
              role: persona.role,
              eventPermissions: assignment.permissions,
            }),
        );
        access.push({ ...assignment, ...result });
      }
      report.personas.push({
        id: persona.id,
        email: persona.email,
        role: persona.role,
        userId,
        access,
      });
    }

    await seedVolume(db, hmac, target.issuer, report);
    console.log(JSON.stringify(report));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, errorCode: error.message }));
  process.exitCode = 1;
});
