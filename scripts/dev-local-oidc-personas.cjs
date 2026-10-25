#!/usr/bin/env node
/** Extra identities for an isolated local Keycloak/D9 fixture. Never use in production. */
'use strict';

const { randomUUID } = require('node:crypto');
const { existsSync, readFileSync, writeFileSync, chmodSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const {
  createDatabase, D9_DEMO, tenantPermissionsForRole, eventPermissionsForRole,
} = require('../packages/backend/dist');

const state = process.env.UI869_DEV_STATE_DIR || path.join(__dirname, '../.local-dev/ui869');
const receiptFile = path.join(state, 'oidc-personas.json');
const project = process.env.UI869_COMPOSE_PROJECT || 'ui869dev';
const issuer = process.env.OIDC_ISSUER;
const databaseUrl = process.env.DATABASE_URL;
if (issuer !== 'http://127.0.0.1:8080/realms/ticket' || !databaseUrl) {
  throw Error('isolated_local_issuer_and_database_required');
}
const dbUrl = new URL(databaseUrl);
if (dbUrl.hostname !== '127.0.0.1' || dbUrl.port !== '55433' || dbUrl.pathname !== '/ticket_ui869_dev') {
  throw Error('isolated_local_database_required');
}
const container = `${project}-keycloak-1`;
const actualProject = execFileSync('docker', ['inspect', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}', container], { encoding: 'utf8' }).trim();
if (actualProject !== project) throw Error('isolated_fixture_keycloak_required');

const personas = [
  { name: 'scoped-staff@example.com', password: 'scoped-staff-demo', role: 'Scanner', access: 'mfest' },
  { name: 'revoked-staff@example.com', password: 'revoked-staff-demo', role: 'Scanner', access: 'revoked' },
  { name: 'no-access@example.com', password: 'no-access-demo', access: 'none' },
];
const base = issuer.replace(/\/realms\/ticket\/?$/, '');
async function request(url, options = {}) {
  const result = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!result.ok) throw Error(`keycloak_http_${result.status}`);
  return result;
}

async function main() {
  const grant = await (await request(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password: 'admin' }),
  })).json();
  const headers = { authorization: `Bearer ${grant.access_token}`, 'content-type': 'application/json' };
  const receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, 'utf8')) : {};
  const db = createDatabase(databaseUrl, 2);
  try {
    for (const persona of personas) {
      const url = `${base}/admin/realms/ticket/users`;
      const users = await (await request(`${url}?username=${encodeURIComponent(persona.name)}&exact=true`, { headers })).json();
      let subject;
      if (users.length === 0) {
        const created = await request(url, { method: 'POST', headers, body: JSON.stringify({
          username: persona.name, email: persona.name, enabled: true, emailVerified: true,
          firstName: 'Local', lastName: 'Fixture', requiredActions: [],
          credentials: [{ type: 'password', value: persona.password, temporary: false }],
          attributes: { fixture: ['vd08-local-oidc'] },
        }) });
        subject = created.headers.get('location')?.split('/').pop();
        if (!subject) throw Error('missing_created_subject');
        receipt[persona.name] = subject;
        writeFileSync(receiptFile, JSON.stringify(receipt) + '\n', { mode: 0o600 });
        chmodSync(receiptFile, 0o600);
      } else {
        if (users.length !== 1 || receipt[persona.name] !== users[0].id) throw Error(`fixture_identity_collision:${persona.name}`);
        subject = users[0].id;
      }
      const user = await db.user.upsert({
        where: { issuer_subject: { issuer, subject } },
        create: { id: randomUUID(), issuer, subject, email: persona.name, emailVerified: true },
        update: {},
      });
      if (persona.access === 'none') continue;
      const tenantId = D9_DEMO.tenants.mfest.id;
      const eventId = D9_DEMO.events.mfest.id;
      const revoked = persona.access === 'revoked';
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        const membership = await tx.membership.upsert({
          where: { tenantId_userId: { tenantId, userId: user.id } },
          create: { id: randomUUID(), tenantId, userId: user.id, role: persona.role,
            permissions: tenantPermissionsForRole(persona.role), activatedAt: new Date(), revokedAt: revoked ? new Date() : null },
          update: { role: persona.role, permissions: tenantPermissionsForRole(persona.role), activatedAt: new Date(), revokedAt: revoked ? new Date() : null },
        });
        await tx.eventAssignment.upsert({
          where: { tenantId_eventId_membershipId: { tenantId, eventId, membershipId: membership.id } },
          create: { id: randomUUID(), tenantId, eventId, membershipId: membership.id,
            permissions: eventPermissionsForRole(persona.role), activatedAt: new Date(), revokedAt: revoked ? new Date() : null },
          update: { permissions: eventPermissionsForRole(persona.role), activatedAt: new Date(), revokedAt: revoked ? new Date() : null },
        });
      });
    }
    console.log(JSON.stringify({ ok: true, fixture: true, personas: personas.map(({ name, access }) => ({ name, access })) }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
