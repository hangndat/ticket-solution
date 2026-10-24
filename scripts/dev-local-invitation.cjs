#!/usr/bin/env node
// Local-only invitation fixture, using existing import/dispatch/outbox services.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(ROOT, '.local-dev/ui869');
const LINK_FILE = path.join(STATE, 'invitation.json');
const backend = require('../packages/backend/dist');
const loopback = raw => ['localhost','127.0.0.1','[::1]'].includes(new URL(raw).hostname);

async function seed() {
  const config = {};
  for (const line of fs.readFileSync(path.join(STATE, 'env.sh'), 'utf8').split('\n')) {
    const match = /^export (UI869_[A-Z_]+)='([^']*)'$/.exec(line);
    if (match) config[match[1]] = match[2];
  }
  const database = process.env.DATABASE_URL || config.UI869_ADMIN_DATABASE_URL;
  const smtp = process.env.SMTP_URL || 'smtp://127.0.0.1:1026';
  const minio = process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9002';
  if (!loopback(database) || new URL(database).pathname !== '/ticket_ui869_dev' || !loopback(smtp) || !loopback(minio)) throw Error('local_fixture_target_required');
  const db = backend.createDatabase(database, 2);
  const hmac = backend.readCodeHmacEnvironment({CODE_HMAC_PEPPER:config.UI869_CODE_HMAC_PEPPER,CODE_HMAC_VERSION:config.UI869_CODE_HMAC_VERSION});
  const tenantId = backend.D9_DEMO.tenants.mfest.id, event = backend.D9_DEMO.events.mfest;
  const eventId = event.id;
  const store = backend.createMinioObjectStore({endpoint:minio,accessKey:'minioadmin',secretKey:'minioadmin',bucket:'vemoki-assets',region:'us-east-1'});
  try {
    const people = await db.$queryRaw`SELECT id FROM users WHERE email = 'staff@example.com' AND issuer = ${config.UI869_OIDC_ISSUER}`;
    if (!people[0]) throw Error('fixture_staff_required');
    const scope = {tenantId,eventId,actorUserId:people[0].id};
    let invitation = await backend.withTenant(db,tenantId,async tx => (await tx.$queryRaw`SELECT id, state, expires_at FROM guest_invitations WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid AND invited_email = 'attendee@example.com'`)[0]);
    let created = false;
    if (!invitation) {
      const uploaded = await backend.uploadImportFile(db,store,{...scope,kind:'GUESTS',filename:'ui869-guest-fixture.csv',contentType:'text/csv',body:Buffer.from('email\nattendee@example.com\n')});
      const job = await backend.createImportJob(db,{...scope,idempotencyKey:randomUUID(),body:{kind:'GUESTS',sourceId:event.sourceId,ticketTypeId:event.ticketTypeId,fileId:uploaded.fileId}});
      const preview = await backend.previewImportJob(db,store,{...scope,importId:job.importId});
      if (preview.errorRowCount || preview.invitationCount !== 1) throw Error('fixture_import_preview_invalid');
      await backend.commitImportJob(db,store,hmac,{...scope,importId:job.importId,idempotencyKey:randomUUID(),body:{previewRevision:preview.previewRevision,mappingRevision:preview.mappingRevision,fileHash:preview.fileHash}});
      invitation = await backend.withTenant(db,tenantId,async tx => (await tx.$queryRaw`SELECT id, state, expires_at FROM guest_invitations WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid AND invited_email = 'attendee@example.com'`)[0]);
      created = true;
    }
    if (invitation.state === 'PENDING') {
      const preview = await backend.previewInvitationDispatch(db,{...scope,body:{invitationIds:[invitation.id]}});
      await backend.dispatchGuestInvitations(db,{...scope,idempotencyKey:randomUUID(),body:{invitationIds:[invitation.id],previewRevision:preview.previewRevision}});
    }
    const email = backend.createSmtpEmailAdapter({smtpUrl:smtp,fromAddress:'tickets@vemoki.local',nodeEnv:'development'});
    let failed = 0;
    for (let i=0;i<8;i++) {
      const tick = await backend.relayOutboxOnce(db,email,`ui869-local-${randomUUID()}`,20,{credentialKeyMaterial:config.UI869_TICKET_CREDENTIAL_KEY,publicWebBaseUrl:'http://localhost:3417',env:{NODE_ENV:'development',PUBLIC_WEB_BASE_URL:'http://localhost:3417'}});
      failed += tick.failed;
      if (!tick.claimed) break;
    }
    if (failed) throw Error('fixture_mail_delivery_failed');
    const minted = await backend.withTenant(db,tenantId,async tx => (await tx.$queryRaw`SELECT payload FROM outbox WHERE tenant_id = ${tenantId}::uuid AND type = 'InvitationTokenMinted' AND aggregate_id = ${invitation.id}::uuid ORDER BY created_at DESC LIMIT 1`)[0]);
    if (!minted?.payload?.token) throw Error('fixture_invitation_token_missing');
    const claimUrl = backend.buildGuestInvitationClaimLink({publicWebBaseUrl:'http://localhost:3417',token:minted.payload.token,tenantId,eventId,tenantSlug:backend.D9_DEMO.tenants.mfest.slug,eventSlug:event.slug});
    fs.mkdirSync(STATE,{recursive:true,mode:0o700});
    fs.writeFileSync(LINK_FILE,JSON.stringify({invitationId:invitation.id,claimUrl,expiresAt:invitation.expires_at,fixture:true})+'\n',{mode:0o600});
    fs.chmodSync(LINK_FILE,0o600);
    return {ok:true,created,fixture:true,mailpit:'http://127.0.0.1:8026',privateLinkFile:'.local-dev/ui869/invitation.json',outboxFailures:failed};
  } finally { await db.$disconnect(); }
}

function open() {
  const data = JSON.parse(fs.readFileSync(LINK_FILE,'utf8'));
  const url = new URL(data.claimUrl);
  if (!loopback(url) || url.pathname !== '/claim' || data.fixture !== true) throw Error('local_fixture_target_required');
  const result = spawnSync(process.env.ORCA_CLI_COMMAND || '/Applications/Orca.app/Contents/Resources/bin/orca',['tab','create','--url',data.claimUrl,'--worktree','active','--json'],{cwd:ROOT,encoding:'utf8'});
  if (result.status !== 0) throw Error('fixture_browser_open_failed');
  const receipt = JSON.parse(result.stdout);
  if (!receipt.ok || !receipt.result?.browserPageId) throw Error('fixture_browser_open_failed');
  return {ok:true,browserPageId:receipt.result.browserPageId};
}

if (require.main === module) {
  Promise.resolve().then(()=>{
    const command = process.argv[2] || 'seed';
    if (command === 'open') return open();
    if (command === 'seed') return seed();
    throw Error('usage_seed_or_open');
  }).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(JSON.stringify({ok:false,errorCode:/^[a-z_]+$/.test(error.message)?error.message:'local_invitation_fixture_failed'}));process.exitCode=1;});
}
module.exports = { seed };
