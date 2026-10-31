'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const path = require('node:path');
const { startPostgres } = require('./pg-fixture.cjs');
const { startRedis } = require('./redis-fixture.cjs');
const {
  createDatabase,
  withTenant,
  createPrismaIdentityUserRepository,
  seedEventInventory,
  redeemAndIssueTicket,
  unwrapRedeemOutcome,
  readCodeHmacEnvironment,
  getTicketForOwner,
} = require('../../../packages/backend/dist');

const root = path.resolve(__dirname, '../../..');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const credentialKey = 'job01-durable-outbox-cred-key';
const hmac = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'job01-durable-outbox-pepper!!',
  CODE_HMAC_VERSION: '1',
});

async function startMailpit() {
  const name = `ticket-job01-mailpit-${randomBytes(5).toString('hex')}`;
  docker(
    'run',
    '-d',
    '--name',
    name,
    '--label',
    'ticket.e2e.backend=true',
    '-p',
    '127.0.0.1::1025',
    '-p',
    '127.0.0.1::8025',
    'axllent/mailpit:v1.27.10',
  );
  try {
    const smtpPort = docker('port', name, '1025/tcp').split(':').at(-1);
    const apiPort = docker('port', name, '8025/tcp').split(':').at(-1);
    const api = `http://127.0.0.1:${apiPort}`;
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        ready = (await fetch(`${api}/api/v1/info`)).ok;
        if (ready) break;
      } catch {
        /* starting */
      }
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

function spawnWorker(pgUrl, mail, redisUrl) {
  return spawn(process.execPath, ['apps/worker/dist/main.js'], {
    cwd: root,
    stdio: 'ignore',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      DATABASE_URL: pgUrl,
      SMTP_URL: mail.smtpUrl,
      SMTP_FROM: 'tickets@job01.test',
      PUBLIC_WEB_BASE_URL: 'https://tickets.job01.test',
      TICKET_CREDENTIAL_KEY: credentialKey,
      OUTBOX_POLL_MS: '100',
      REDIS_URL: redisUrl,
    },
  });
}

async function waitForWorkerRelay(worker, db, tenantId, ticketId, mail) {
  const businessKey = `ticket:${ticketId}:issued:email`;
  for (let i = 0; i < 100; i++) {
    if (worker.exitCode !== null) {
      throw new Error(`worker exited early with code ${worker.exitCode}`);
    }
    const rows = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
      SELECT o.status AS outbox_status, n.state AS notification_state
      FROM outbox o
      JOIN notifications n
        ON n.tenant_id = o.tenant_id
       AND n.business_key = ${businessKey}
      WHERE o.tenant_id = ${tenantId}::uuid
        AND o.type = 'TicketIssued'
        AND o.aggregate_id = ${ticketId}::uuid
      LIMIT 1`);
    const row = rows[0];
    const mailTotal = (await messages(mail.api)).total;
    if (
      row?.outbox_status === 'COMPLETE' &&
      row?.notification_state === 'ACCEPTED' &&
      mailTotal === 1
    ) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('worker did not relay TicketIssued within 20 seconds');
}

async function stopWorker(worker) {
  if (worker.exitCode !== null) return;
  worker.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => worker.once('close', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (worker.exitCode === null) worker.kill('SIGKILL');
}

test(
  '[JOB-01] R durable outbox: worker stopped, Redis restart, Mailpit relay once',
  { timeout: 300000 },
  async () => {
    let pg;
    let mail;
    let redis;
    let db;
    let worker;
    try {
      pg = await startPostgres();
      mail = await startMailpit();
      redis = await startRedis();
      db = createDatabase(pg.url, 4);

      const users = createPrismaIdentityUserRepository(db);
      const owner = await users.upsertFromVerifiedIdentity({
        issuer: 'https://auth.example.test/realms/ticket',
        subject: randomUUID(),
        email: 'job01-owner@example.test',
        emailVerified: true,
      });
      const tenantId = randomUUID();
      const eventId = randomUUID();
      const eventName = 'JOB-01 Durable Outbox Event';
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'job01-outbox', name: 'JOB-01 Outbox' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'job01-event',
            name: eventName,
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, hmac, {
          tenantId,
          eventId,
          eventQuota: 2,
          rawCodes: ['JOB01-TICKET'],
        });
      });

      const issued = unwrapRedeemOutcome(
        await withTenant(db, tenantId, (tx) =>
          redeemAndIssueTicket(tx, hmac, credentialKey, {
            tenantId,
            eventId,
            actorUserId: owner.userId,
            actorEmail: owner.email,
            emailVerified: true,
            rawCode: 'JOB01-TICKET',
            idempotencyKey: randomUUID(),
          }),
        ),
      );

      const visible = await withTenant(db, tenantId, (tx) =>
        getTicketForOwner(tx, tenantId, owner.userId, issued.ticketId),
      );
      assert.equal(visible.ticketId, issued.ticketId);
      assert.equal(visible.state, 'ACTIVE');

      const pending = await withTenant(db, tenantId, async (tx) => {
        const outbox = await tx.$queryRaw`
          SELECT type, status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${issued.ticketId}::uuid`;
        const notifications = await tx.$queryRaw`
          SELECT state, business_key FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${`ticket:${issued.ticketId}:issued:email`}`;
        const tickets = await tx.$queryRaw`
          SELECT COUNT(*)::int AS n FROM tickets
          WHERE tenant_id = ${tenantId}::uuid AND id = ${issued.ticketId}::uuid`;
        return { outbox, notifications, tickets };
      });
      assert.equal(pending.tickets[0].n, 1);
      assert.equal(pending.outbox.length, 1);
      assert.equal(pending.outbox[0].type, 'TicketIssued');
      assert.equal(pending.outbox[0].status, 'PENDING');
      assert.equal(pending.notifications.length, 1);
      assert.equal(pending.notifications[0].state, 'PENDING');

      await redis.restart();
      const afterRedis = await withTenant(db, tenantId, async (tx) => {
        const outbox = await tx.$queryRaw`
          SELECT status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${issued.ticketId}::uuid`;
        const notifications = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${`ticket:${issued.ticketId}:issued:email`}`;
        return { outbox, notifications };
      });
      assert.equal(afterRedis.outbox[0].status, 'PENDING');
      assert.equal(afterRedis.notifications[0].state, 'PENDING');
      assert.equal((await messages(mail.api)).total, 0);

      worker = spawnWorker(pg.url, mail, redis.url);
      await waitForWorkerRelay(worker, db, tenantId, issued.ticketId, mail);
      await stopWorker(worker);
      worker = null;

      assert.equal((await messages(mail.api)).total, 1);
      const msg = (await messages(mail.api)).messages[0];
      const rawResponse = await fetch(`${mail.api}/api/v1/message/${msg.ID}/raw`);
      assert.equal(rawResponse.status, 200);
      const rawMime = await rawResponse.text();
      assert.match(rawMime, /job01-owner@example\.test/i);
      assert.match(rawMime, /job01-outbox/i);

      const terminal = await withTenant(db, tenantId, async (tx) => {
        const outbox = await tx.$queryRaw`
          SELECT status FROM outbox
          WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${issued.ticketId}::uuid`;
        const notifications = await tx.$queryRaw`
          SELECT state FROM notifications
          WHERE tenant_id = ${tenantId}::uuid
            AND business_key = ${`ticket:${issued.ticketId}:issued:email`}`;
        return { outbox, notifications };
      });
      assert.equal(terminal.outbox[0].status, 'COMPLETE');
      assert.equal(terminal.notifications[0].state, 'ACCEPTED');
    } finally {
      if (worker) await stopWorker(worker);
      if (db) await db.$disconnect();
      if (mail) docker('rm', '-f', mail.name);
      if (redis) redis.stop();
      if (pg) pg.stop();
    }
  },
);
