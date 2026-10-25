#!/usr/bin/env node
/**
 * API verification matrix for VCX-925 persona fixtures (positive + negative).
 */
import { assertUi869FixtureTarget, UI869_FIXTURE_NS } from './lib/ui869-fixture-guard.mjs';
import { PERSONAS, FIXTURE_TENANTS } from './lib/ui869-persona-catalog.mjs';

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
    throw new Error(`token_${username}_${res.status}`);
  }
  return json.access_token;
}

async function api(base, token, method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

function personaById(id) {
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown_persona:${id}`);
  return p;
}

function hasPerm(items, perm) {
  return items.some((e) => (e.permissions || []).includes(perm));
}

async function runChecks(target) {
  const rows = [];
  const issuer = target.issuer;
  const apiBase = target.apiUrl;
  const mfest = FIXTURE_TENANTS.mfest.id;
  const studio = FIXTURE_TENANTS.studio.id;
  const mfestEvent = FIXTURE_TENANTS.mfestEvent;

  const owner = personaById('owner');
  const manager = personaById('manager');
  const cs = personaById('cs');
  const scanner = personaById('scanner');
  const reportOnly = personaById('report-only');
  const attendee = personaById('attendee');

  const ownerToken = await passwordToken(issuer, owner.email, owner.password);
  const managerToken = await passwordToken(issuer, manager.email, manager.password);
  const csToken = await passwordToken(issuer, cs.email, cs.password);
  const scannerToken = await passwordToken(issuer, scanner.email, scanner.password);
  const reportToken = await passwordToken(issuer, reportOnly.email, reportOnly.password);
  const attendeeToken = await passwordToken(issuer, attendee.email, attendee.password);

  const ownerTenants = await api(apiBase, ownerToken, 'GET', '/v1/me/tenants');
  rows.push({
    persona: 'owner',
    check: 'me/tenants includes mfest Owner perms',
    expected: '200 + tenant.profile',
    actual: ownerTenants.status,
    pass:
      ownerTenants.status === 200 &&
      (ownerTenants.json?.items || []).some(
        (t) =>
          t.tenantId === mfest &&
          (t.tenantPermissions || []).includes('tenant.profile'),
      ),
  });

  const managerTenants = await api(apiBase, managerToken, 'GET', '/v1/me/tenants');
  rows.push({
    persona: 'manager',
    check: 'me/tenants scoped mfest only',
    expected: '200 + only mfest',
    actual: managerTenants.status,
    pass:
      managerTenants.status === 200 &&
      (managerTenants.json?.items || []).length === 1 &&
      managerTenants.json.items[0].tenantId === mfest,
  });

  const managerEvents = await api(apiBase, managerToken, 'GET', '/v1/me/events');
  rows.push({
    persona: 'manager',
    check: 'me/events event.config',
    expected: '200 + event.config',
    actual: managerEvents.status,
    pass:
      managerEvents.status === 200 &&
      hasPerm(managerEvents.json?.items || [], 'event.config'),
  });

  const csMembers = await api(
    apiBase,
    csToken,
    'GET',
    `/v1/tenants/${mfest}/members?limit=5`,
  );
  rows.push({
    persona: 'cs',
    check: 'portal members list (setup/admin)',
    expected: '403',
    actual: csMembers.status,
    pass: csMembers.status === 403,
  });

  const csConfig = await api(
    apiBase,
    csToken,
    'POST',
    `/v1/tenants/${mfest}/events/${mfestEvent}/config-versions`,
    { schemaVersion: 1, brand: { primaryColor: '#000', organizationName: 'x' }, sections: [] },
  );
  rows.push({
    persona: 'cs',
    check: 'event config write',
    expected: '403',
    actual: csConfig.status,
    pass: csConfig.status === 403,
  });

  const scannerMembers = await api(
    apiBase,
    scannerToken,
    'GET',
    `/v1/tenants/${mfest}/members?limit=5`,
  );
  rows.push({
    persona: 'scanner',
    check: 'portal admin members',
    expected: '403',
    actual: scannerMembers.status,
    pass: scannerMembers.status === 403,
  });

  const scannerEvents = await api(apiBase, scannerToken, 'GET', '/v1/me/events');
  rows.push({
    persona: 'scanner',
    check: 'me/events gate.confirm without members.manage',
    expected: '200 + gate.confirm, no members.manage tenant perm',
    actual: scannerEvents.status,
    pass:
      scannerEvents.status === 200 &&
      scannerEvents.json?.staffEligible === true &&
      hasPerm(scannerEvents.json?.items || [], 'gate.confirm'),
  });

  const reportEvents = await api(apiBase, reportToken, 'GET', '/v1/me/events');
  rows.push({
    persona: 'report-only',
    check: 'me/events report.read only',
    expected: '200 + report.read, no event.config',
    actual: reportEvents.status,
    pass:
      reportEvents.status === 200 &&
      hasPerm(reportEvents.json?.items || [], 'report.read') &&
      !hasPerm(reportEvents.json?.items || [], 'event.config'),
  });

  const managerStudio = await api(
    apiBase,
    managerToken,
    'GET',
    `/v1/tenants/${studio}/members?limit=5`,
  );
  rows.push({
    persona: 'manager',
    check: 'cross-tenant studio access',
    expected: '403 or 404',
    actual: managerStudio.status,
    pass: managerStudio.status === 403 || managerStudio.status === 404,
  });

  const attendeeTenants = await api(apiBase, attendeeToken, 'GET', '/v1/me/tenants');
  rows.push({
    persona: 'attendee',
    check: 'me/tenants empty staff membership',
    expected: '200 + no staff tenant perms',
    actual: attendeeTenants.status,
    pass:
      attendeeTenants.status === 200 &&
      (attendeeTenants.json?.items || []).every(
        (t) => !(t.tenantPermissions || []).includes('members.manage'),
      ),
  });

  const publicEvents = await fetch(`${apiBase}/v1/public/events?limit=50`);
  const publicJson = await publicEvents.json().catch(() => ({}));
  rows.push({
    persona: 'public',
    check: 'catalog volume >= 2 events',
    expected: '>=2',
    actual: publicEvents.status,
    pass: publicEvents.ok && (publicJson.items || []).length >= 2,
  });

  const allPass = rows.every((r) => r.pass);
  return { namespace: UI869_FIXTURE_NS, pass: allPass, rows };
}

async function main() {
  const target = assertUi869FixtureTarget(process.env);
  const result = await runChecks(target);
  console.log(JSON.stringify({ ok: result.pass, ...result }, null, 2));
  if (!result.pass) process.exitCode = 1;
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exitCode = 1;
});
