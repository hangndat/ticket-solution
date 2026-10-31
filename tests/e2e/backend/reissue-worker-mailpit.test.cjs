'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const { startPostgres } = require('./pg-fixture.cjs');
const {
  createDatabase, withTenant, createPrismaIdentityUserRepository,
  seedEventInventory, redeemAndIssueTicket, unwrapRedeemOutcome,
  readCodeHmacEnvironment, grantMembership, grantEventAssignment,
  reissueTicketCredential, revokeTicket,
  openCredentialToken, renderCredentialQrPng,
} = require('../../../packages/backend/dist');

const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const credentialKey = 'reissue-mailpit-credential-key';
const hmac = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'reissue-mailpit-test-pepper!!', CODE_HMAC_VERSION: '1',
});

async function startMailpit() {
  const name = `ticket-reissue-mailpit-${randomBytes(5).toString('hex')}`;
  docker('run', '-d', '--name', name, '--label', 'ticket.e2e.backend=true',
    '-p', '127.0.0.1::1025', '-p', '127.0.0.1::8025', 'axllent/mailpit:v1.27.10');
  try {
    const smtpPort = docker('port', name, '1025/tcp').split(':').at(-1);
    const apiPort = docker('port', name, '8025/tcp').split(':').at(-1);
    const api = `http://127.0.0.1:${apiPort}`;
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        ready = (await fetch(`${api}/api/v1/info`)).ok;
        if (ready) break;
      } catch { /* container starting */ }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'isolated Mailpit must become ready');
    return { name, api, smtpUrl: `smtp+plain://127.0.0.1:${smtpPort}` };
  } catch (error) {
    docker('rm', '-f', name);
    throw error;
  }
}

async function messages(api) {
  const response = await fetch(`${api}/api/v1/messages`);
  assert.equal(response.status, 200);
  return response.json();
}

async function runWorkerUntil(pgUrl, mail, predicate) {
  const worker = spawn(process.execPath, ['apps/worker/dist/main.js'], {
    cwd: require('node:path').resolve(__dirname, '../../..'),
    stdio: 'ignore',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      DATABASE_URL: pgUrl,
      SMTP_URL: mail.smtpUrl,
      SMTP_FROM: 'tickets@reissue.test',
      PUBLIC_WEB_BASE_URL: 'https://tickets.example.test',
      TICKET_CREDENTIAL_KEY: credentialKey,
      OUTBOX_POLL_MS: '100',
    },
  });
  try {
    for (let i = 0; i < 100; i++) {
      if (worker.exitCode !== null) throw new Error('worker exited before relay completed');
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('worker did not complete relay within 20 seconds');
  } finally {
    if (worker.exitCode === null) worker.kill('SIGTERM');
    if (worker.exitCode === null) {
      let deadline;
      await Promise.race([
        new Promise((resolve) => worker.once('close', resolve)),
        new Promise((resolve) => { deadline = setTimeout(resolve, 5000); }),
      ]);
      clearTimeout(deadline);
      if (worker.exitCode === null) worker.kill('SIGKILL');
    }
  }
}

function pngAttachment(rawMime) {
  const part = rawMime.match(/Content-Type:\s*image\/png[^\r\n]*[\s\S]*?Content-Transfer-Encoding:\s*base64\s*\r?\n[\s\S]*?\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)\r?\n--/i);
  assert.ok(part, 'Mailpit MIME must carry an inline PNG attachment');
  return Buffer.from(part[1].replace(/\s/g, ''), 'base64');
}

test('R reissue worker Mailpit: new owner QR, then revoke-before-relay DEAD',
  { timeout: 240000 }, async () => {
    let pg;
    let mail;
    let db;
    try {
      pg = await startPostgres();
      mail = await startMailpit();
      db = createDatabase(pg.url, 4);
      const users = createPrismaIdentityUserRepository(db);
      const owner = await users.upsertFromVerifiedIdentity({
        issuer: 'https://auth.example.test/realms/ticket', subject: randomUUID(),
        email: 'reissue-owner@example.test', emailVerified: true,
      });
      const staff = await users.upsertFromVerifiedIdentity({
        issuer: 'https://auth.example.test/realms/ticket', subject: randomUUID(),
        email: 'reissue-staff@example.test', emailVerified: true,
      });
      const tenantId = randomUUID();
      const eventId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({ data: { id: tenantId, slug: 'reissue-mailpit', name: 'Reissue Mailpit' } });
        await tx.event.create({ data: {
          tenantId, id: eventId, slug: 'reissue-event', name: 'Reissue Event', status: 'PUBLISHED',
        } });
        await seedEventInventory(tx, hmac, {
          tenantId, eventId, eventQuota: 3, rawCodes: ['REISSUE-MAILPIT'],
        });
        const membership = await grantMembership(tx, {
          tenantId, userId: staff.userId, role: 'Supervisor',
          permissions: ['ticket.reissue', 'ticket.revoke'],
        });
        await grantEventAssignment(tx, {
          tenantId, eventId, membershipId: membership.membershipId,
          permissions: ['ticket.reissue', 'ticket.revoke'],
        });
      });
      const issued = unwrapRedeemOutcome(await withTenant(db, tenantId, (tx) =>
        redeemAndIssueTicket(tx, hmac, credentialKey, {
          tenantId, eventId, actorUserId: owner.userId, actorEmail: owner.email,
          emailVerified: true, rawCode: 'REISSUE-MAILPIT', idempotencyKey: randomUUID(),
        })));
      await runWorkerUntil(pg.url, mail, async () => {
        const rows = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
          SELECT state FROM notifications WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${`ticket:${issued.ticketId}:issued:email`}`);
        return rows[0]?.state === 'ACCEPTED' && (await messages(mail.api)).total === 1;
      });
      assert.equal((await messages(mail.api)).total, 1, 'initial version sent');
      const firstMessageId = (await messages(mail.api)).messages[0].ID;

      const rotate = () => withTenant(db, tenantId, (tx) =>
        reissueTicketCredential(tx, credentialKey, {
          tenantId, eventId, ticketId: issued.ticketId, actorUserId: staff.userId,
          reason: 'replacement requested', idempotencyKey: randomUUID(),
        }));
      const second = await rotate();
      assert.equal(second.credentialVersion, 2);
      const credential = await withTenant(db, tenantId, async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT version, status, encrypted_token FROM ticket_credentials
          WHERE tenant_id = ${tenantId}::uuid AND ticket_id = ${issued.ticketId}::uuid
          ORDER BY version`;
        return rows;
      });
      assert.deepEqual(credential.map((row) => [row.version, row.status]),
        [[1, 'REVOKED'], [2, 'ACTIVE']]);
      await runWorkerUntil(pg.url, mail, async () => {
        const rows = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
          SELECT state FROM notifications WHERE tenant_id = ${tenantId}::uuid
            AND business_key LIKE ${`ticket:${issued.ticketId}:reissue:email:%`}
          ORDER BY created_at DESC LIMIT 1`);
        return rows[0]?.state === 'ACCEPTED' && (await messages(mail.api)).total === 2;
      });
      const sent = await messages(mail.api);
      assert.equal(sent.total, 2, 'reissue sent once through the worker');
      const msg = sent.messages.find((row) => row.ID !== firstMessageId);
      assert.ok(msg, 'a distinct reissue message must reach Mailpit');
      const rawResponse = await fetch(`${mail.api}/api/v1/message/${msg.ID}/raw`);
      assert.equal(rawResponse.status, 200);
      const rawMime = await rawResponse.text();
      assert.match(rawMime, /reissue-owner@example\.test/i);
      const token = openCredentialToken(credential[1].encrypted_token, credentialKey);
      const expectedPng = await renderCredentialQrPng({
        ticketId: issued.ticketId, tenantId, eventId, credentialVersion: 2, token,
      });
      assert.deepEqual(pngAttachment(rawMime), expectedPng,
        'MIME QR must contain the version 2 token and identity');

      const third = await rotate();
      assert.equal(third.credentialVersion, 3);
      await withTenant(db, tenantId, (tx) => revokeTicket(tx, {
        tenantId, eventId, ticketId: issued.ticketId, actorUserId: staff.userId,
        reason: 'revoke before email relay',
      }));
      await runWorkerUntil(pg.url, mail, async () => {
        const rows = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
          SELECT state FROM notifications WHERE tenant_id = ${tenantId}::uuid
            AND business_key LIKE ${`ticket:${issued.ticketId}:reissue:email:%`}
          ORDER BY created_at DESC LIMIT 1`);
        return rows[0]?.state === 'DEAD';
      });
      const terminal = await withTenant(db, tenantId, async (tx) => tx.$queryRaw`
        SELECT n.state AS notification_state, o.status AS outbox_status
        FROM notifications n JOIN outbox o
          ON o.tenant_id = n.tenant_id AND o.payload->>'businessKey' = n.business_key
        WHERE n.tenant_id = ${tenantId}::uuid AND n.channel = 'email'
          AND n.business_key LIKE ${`ticket:${issued.ticketId}:reissue:email:%`}
        ORDER BY n.created_at DESC LIMIT 1`);
      assert.equal(terminal[0].notification_state, 'DEAD');
      assert.equal(terminal[0].outbox_status, 'DEAD');
      assert.equal((await messages(mail.api)).total, 2,
        'revoked ticket must not send a third email');
    } finally {
      if (db) await db.$disconnect();
      if (mail) docker('rm', '-f', mail.name);
      if (pg) pg.stop();
    }
  });
