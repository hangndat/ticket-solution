#!/usr/bin/env node
// Additive local fixtures. Uses the existing backend seed and real OIDC/API;
// never resets tickets or invents authenticated sessions.
'use strict';
const { randomUUID } = require('node:crypto');
const {
  createDatabase, readCodeHmacEnvironment, hashRedemptionCode,
  seedD9DemoDataset, D9_DEMO, withTenant, backfillCodeRoutingFromRedemptionCodes,
} = require('../packages/backend/dist');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  const issuer = new URL(process.env.OIDC_ISSUER || '');
  const api = new URL(process.env.UI869_API_URL || 'http://127.0.0.1:3498');
  const local = u => ['localhost','127.0.0.1','[::1]'].includes(u.hostname);
  if (!local(url) || url.pathname !== '/ticket_ui869_dev' || !local(issuer) || !local(api)) throw Error('local_fixture_target_required');
  const hmac = readCodeHmacEnvironment(process.env);
  const db = createDatabase(url.toString(), 2);
  const request = async (path, options = {}) => {
    const res = await fetch(new URL(path, api), { ...options, signal: AbortSignal.timeout(15000) });
    const body = await res.json();
    if (!res.ok) throw Error(`fixture_api_${res.status}_${body.error?.code || body.code || 'failed'}`);
    return body;
  };
  try {
    const users = await db.$queryRaw`SELECT subject, email FROM users WHERE issuer = ${issuer.toString().replace(/\/$/, '')} AND email IN ('staff@example.com','attendee@example.com')`;
    const staffSubject = users.find(u => u.email === 'staff@example.com')?.subject;
    const attendeeSubject = users.find(u => u.email === 'attendee@example.com')?.subject;
    if (!staffSubject || !attendeeSubject) throw Error('base_demo_users_required');
    const original = structuredClone(D9_DEMO.events.studioNight);
    const past = {
      ...original, slug: 'studio-night-past',
      name: 'Studio Night — Đêm nhạc mùa trước · Demo',
      startsAt: new Date(Date.now() - 60 * 86400000),
      rawCodes: Array.from({ length: 5 }, (_, i) => `DEMO-PAST-${String(i + 1).padStart(3, '0')}`),
    };
    for (const key of ['id','ticketTypeId','sourceId','eventBucketId','typeBucketId','sourceBucketId']) past[key] = original[key].replace('d9d9f001', 'd8690001');
    // Change the seed's in-process fixture definition only; API/build sources stay intact.
    D9_DEMO.events.studioNight = past;
    await seedD9DemoDataset(db, hmac, { oidcIssuer: issuer.toString().replace(/\/$/, ''), staffSubject, attendeeSubject });
    const mfest = D9_DEMO.events.mfest;
    const mfestTenant = D9_DEMO.tenants.mfest.id;
    const studioTenant = D9_DEMO.tenants.studio.id;
    await withTenant(db, mfestTenant, async tx => {
      await tx.$executeRaw`UPDATE events SET starts_at = now() + interval '30 days' WHERE tenant_id = ${mfestTenant}::uuid AND id = ${mfest.id}::uuid`;
      const disabledHash = hashRedemptionCode(hmac, 'DEMO-MFEST-008');
      await tx.$executeRaw`UPDATE redemption_codes SET status = 'DISABLED', updated_at = now() WHERE tenant_id = ${mfestTenant}::uuid AND event_id = ${mfest.id}::uuid AND code_hmac = ${disabledHash} AND status = 'AVAILABLE'`;
    });
    await withTenant(db, studioTenant, async tx => {
      await tx.$executeRaw`UPDATE events SET starts_at = now() + interval '45 days' WHERE tenant_id = ${studioTenant}::uuid AND id = ${original.id}::uuid`;
    });
    // D9's legacy raw insert predates single-code routing. Run the supported backfill.
    const routing = await db.$transaction(tx => backfillCodeRoutingFromRedemptionCodes(tx));
    const grantRes = await fetch(new URL('protocol/openid-connect/token', `${issuer.toString().replace(/\/$/, '')}/`), {
      method: 'POST', signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ grant_type:'password', client_id:'ticket-web', client_secret:'dev-web-secret-change-me', username:'attendee@example.com', password:'attendee-demo' }),
    });
    const grant = await grantRes.json();
    if (!grantRes.ok || !grant.access_token) throw Error('fixture_oidc_grant_failed');
    const headers = { authorization:`Bearer ${grant.access_token}`, 'content-type':'application/json' };
    const seedTicket = async (tenantId, eventId, rawCode) => {
      const digest = hashRedemptionCode(hmac, rawCode);
      const rows = await withTenant(db, tenantId, tx => tx.$queryRaw`SELECT status FROM redemption_codes WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid AND code_hmac = ${digest}`);
      if (rows[0]?.status === 'CONSUMED') return 'preserved';
      if (rows[0]?.status !== 'AVAILABLE') throw Error('fixture_ticket_code_not_available');
      const idempotencyKey = randomUUID();
      await request(`/v1/tenants/${tenantId}/events/${eventId}/redemptions`, {
        method:'POST', headers:{...headers,'idempotency-key':idempotencyKey},
        body:JSON.stringify({ code:rawCode, idempotencyKey, termsVersion:'terms-v1', termsAccepted:true }),
      });
      return 'created';
    };
    const activeTicket = await seedTicket(studioTenant, original.id, 'DEMO-STUDIO-010');
    const pastTicket = await seedTicket(studioTenant, past.id, 'DEMO-PAST-005');
    await withTenant(db, studioTenant, async tx => {
      await tx.$executeRaw`UPDATE events SET redemption_opens_at = now() - interval '90 days', redemption_closes_at = now() - interval '30 days', check_in_opens_at = now() - interval '90 days', check_in_closes_at = now() - interval '30 days' WHERE tenant_id = ${studioTenant}::uuid AND id = ${past.id}::uuid`;
    });
    const catalog = await request('/v1/public/events?limit=20');
    console.log(JSON.stringify({ ok:true, fixture:true, events:catalog.items?.length, routingCandidatesAdded:routing.candidates, ambiguousGroups:routing.ambiguousGroups, activeTicket, pastTicket, codes:{ valid:'DEMO-MFEST-002', disabled:'DEMO-MFEST-008', consumed:'DEMO-STUDIO-010', pastEvent:'DEMO-PAST-001', unknown:'DEMO-NOT-FOUND' } }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(JSON.stringify({ ok:false, errorCode:error.message })); process.exitCode=1; });
