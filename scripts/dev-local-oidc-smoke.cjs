#!/usr/bin/env node
/** HTTP smoke against real local Keycloak and the isolated API. No token output. */
'use strict';
const { D9_DEMO } = require('../packages/backend/dist');
const issuer = process.env.OIDC_ISSUER;
const api = process.env.UI869_API_URL || 'http://127.0.0.1:3498';
if (issuer !== 'http://127.0.0.1:8080/realms/ticket' || !api.startsWith('http://127.0.0.1:')) {
  throw Error('isolated_local_services_required');
}
const users = [
  ['staff@example.com', 'staff-demo'],
  ['scoped-staff@example.com', 'scoped-staff-demo'],
  ['revoked-staff@example.com', 'revoked-staff-demo'],
  ['no-access@example.com', 'no-access-demo'],
  ['attendee@example.com', 'attendee-demo'],
];
async function token(username, password) {
  const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ grant_type: 'password', client_id: 'ticket-web', client_secret: 'dev-web-secret-change-me', username, password }),
  });
  if (!response.ok) throw Error(`oidc_login_failed:${username}:${response.status}`);
  return (await response.json()).access_token;
}
async function call(accessToken, path, method = 'GET', body) {
  const response = await fetch(`${api}/v1${path}`, {
    method, signal: AbortSignal.timeout(15000),
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.status;
}
async function main() {
  const tokens = Object.fromEntries(await Promise.all(users.map(async ([name, password]) => [name, await token(name, password)])));
  const mf = D9_DEMO.tenants.mfest.id, studio = D9_DEMO.tenants.studio.id;
  const event = D9_DEMO.events.mfest.id, studioEvent = D9_DEMO.events.studioNight.id;
  const cases = [
    ['owner_report', 'staff@example.com', `/tenants/${mf}/events/${event}/report`, 'GET', undefined, 200],
    ['scoped_report_denied', 'scoped-staff@example.com', `/tenants/${mf}/events/${event}/report`, 'GET', undefined, 403],
    ['revoked_report_denied', 'revoked-staff@example.com', `/tenants/${mf}/events/${event}/report`, 'GET', undefined, 403],
    ['no_access_report_denied', 'no-access@example.com', `/tenants/${mf}/events/${event}/report`, 'GET', undefined, 403],
    ['attendee_report_denied', 'attendee@example.com', `/tenants/${mf}/events/${event}/report`, 'GET', undefined, 403],
    ['scoped_gate', 'scoped-staff@example.com', `/gate/events/${event}/sessions`, 'POST', { tenantId: mf }, 200],
    ['cross_tenant_gate_denied', 'scoped-staff@example.com', `/gate/events/${studioEvent}/sessions`, 'POST', { tenantId: studio }, 403],
    ['revoked_gate_denied', 'revoked-staff@example.com', `/gate/events/${event}/sessions`, 'POST', { tenantId: mf }, 403],
    ['no_access_gate_denied', 'no-access@example.com', `/gate/events/${event}/sessions`, 'POST', { tenantId: mf }, 403],
  ];
  const results = [];
  for (const [name, user, path, method, body, expected] of cases) {
    const actual = await call(tokens[user], path, method, body);
    results.push({ name, expected, actual, ok: actual === expected });
  }
  console.log(JSON.stringify({ ok: results.every(r => r.ok), issuer, api, results }, null, 2));
  if (results.some(r => !r.ok)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
