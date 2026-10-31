'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { createServer: createNetServer } = require('node:net');
const { once } = require('node:events');
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
  processClaimedOutbox,
  collectWorkerDueJobSnapshot,
} = require('../../../packages/backend/dist');

const root = path.resolve(__dirname, '../../..');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const credentialKey = 'job02-lease-fence-cred-key';
const hmac = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'job02-lease-fence-pepper!!',
  CODE_HMAC_VERSION: '1',
});

async function startMailpit() {
  const name = `ticket-job02-mailpit-${randomBytes(5).toString('hex')}`;
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

/** Accepts SMTP greeting then stalls so the worker keeps a live lease during relay. */
async function startStalledSmtp() {
  const server = createNetServer((socket) => {
    socket.write('220 job02-stall ESMTP\r\n');
    socket.resume();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  return {
    smtpUrl: `smtp+plain://127.0.0.1:${port}`,
    close() {
      server.closeAllConnections?.();
      server.close();
    },
  };
}

async function messages(api) {
  const response = await fetch(`${api}/api/v1/messages`);
  assert.equal(response.status, 200);
  return response.json();
}

function spawnWorker(pgUrl, mail, redisUrl, extraEnv = {}) {
  return spawn(process.execPath, ['apps/worker/dist/main.js'], {
    cwd: root,
    stdio: 'ignore',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      DATABASE_URL: pgUrl,
      SMTP_URL: mail.smtpUrl,
      SMTP_FROM: 'tickets@job02.test',
      PUBLIC_WEB_BASE_URL: 'https://tickets.job02.test',
      TICKET_CREDENTIAL_KEY: credentialKey,
      OUTBOX_POLL_MS: '100',
      REDIS_URL: redisUrl,
      ...extraEnv,
    },
  });
}

async function readOutboxRow(db, tenantId, ticketId) {
  const rows = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
    SELECT o.id AS outbox_id, o.status, o.lease_owner, o.lease_token,
           o.lease_expires_at, o.attempts,
           o.lease_expires_at <= clock_timestamp() AS lease_expired,
           n.state AS notification_state
    FROM outbox o
    JOIN notifications n
      ON n.tenant_id = o.tenant_id
     AND n.business_key = ${`ticket:${ticketId}:issued:email`}
    WHERE o.tenant_id = ${tenantId}::uuid
      AND o.aggregate_id = ${ticketId}::uuid
      AND o.type = 'TicketIssued'
    LIMIT 1`);
  return rows[0];
}

async function waitForClaimedOutbox(db, tenantId, ticketId) {
  for (let i = 0; i < 80; i++) {
    const row = await readOutboxRow(db, tenantId, ticketId);
    if (
      row &&
      row.lease_owner &&
      row.lease_token &&
      (row.status === 'LEASED' || row.status === 'PROCESSING')
    ) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('worker did not claim outbox within 8 seconds');
}

async function waitForLeaseExpired(db, tenantId, ticketId) {
  for (let i = 0; i < 90; i++) {
    const row = await readOutboxRow(db, tenantId, ticketId);
    if (row?.lease_expired) return row;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('outbox lease did not expire within 45 seconds');
}

async function waitForTerminalRelay(db, tenantId, ticketId, mail) {
  for (let i = 0; i < 100; i++) {
    const row = await readOutboxRow(db, tenantId, ticketId);
    const mailTotal = (await messages(mail.api)).total;
    if (
      row?.status === 'COMPLETE' &&
      row?.notification_state === 'ACCEPTED' &&
      mailTotal === 1
    ) {
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('replacement worker did not complete relay within 20 seconds');
}

function countingTicketEmailAdapter() {
  let ticketSends = 0;
  return {
    adapter: {
      async sendTicketIssued() {
        ticketSends += 1;
        return { providerRef: 'mock:stale', providerStatus: 'ACCEPTED' };
      },
      async sendMembershipInvite() {
        throw new Error('not used');
      },
      async sendGuestInvitation() {
        throw new Error('not used');
      },
    },
    getTicketSends: () => ticketSends,
  };
}

test(
  '[JOB-02] R lease fence: kill worker after claim, reclaim, stale ack fenced',
  { timeout: 300000 },
  async () => {
    let pg;
    let mail;
    let redis;
    let stall;
    let db;
    let workerA;
    let workerB;
    try {
      pg = await startPostgres();
      mail = await startMailpit();
      redis = await startRedis();
      stall = await startStalledSmtp();
      db = createDatabase(pg.url, 4);

      const users = createPrismaIdentityUserRepository(db);
      const owner = await users.upsertFromVerifiedIdentity({
        issuer: 'https://auth.example.test/realms/ticket',
        subject: randomUUID(),
        email: 'job02-owner@example.test',
        emailVerified: true,
      });
      const tenantId = randomUUID();
      const eventId = randomUUID();
      await withTenant(db, tenantId, async (tx) => {
        await tx.tenant.create({
          data: { id: tenantId, slug: 'job02-fence', name: 'JOB-02 Fence' },
        });
        await tx.event.create({
          data: {
            tenantId,
            id: eventId,
            slug: 'job02-event',
            name: 'JOB-02 Lease Fence Event',
            status: 'PUBLISHED',
          },
        });
        await seedEventInventory(tx, hmac, {
          tenantId,
          eventId,
          eventQuota: 2,
          rawCodes: ['JOB02-TICKET'],
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
            rawCode: 'JOB02-TICKET',
            idempotencyKey: randomUUID(),
          }),
        ),
      );

      const pending = await readOutboxRow(db, tenantId, issued.ticketId);
      assert.equal(pending.status, 'PENDING');
      assert.equal(pending.notification_state, 'PENDING');
      assert.equal((await messages(mail.api)).total, 0);

      workerA = spawnWorker(pg.url, stall, redis.url);
      const claimed = await waitForClaimedOutbox(db, tenantId, issued.ticketId);
      assert.ok(claimed.lease_owner, 'claimed row must record lease owner');
      workerA.kill('SIGKILL');
      await new Promise((resolve) => {
        workerA.once('close', resolve);
        setTimeout(resolve, 2000);
      });
      workerA = null;

      assert.equal((await messages(mail.api)).total, 0, 'no SMTP before reclaim');

      const expired = await waitForLeaseExpired(db, tenantId, issued.ticketId);
      assert.ok(
        expired.lease_expired,
        'PG lease must expire naturally after worker death',
      );

      const due = await collectWorkerDueJobSnapshot(db);
      const relayDue = due.find((row) => row.jobClass === 'relay_outbox');
      assert.ok(relayDue, 'worker due snapshot must include relay_outbox');
      assert.ok(
        relayDue.dueCount >= 1 || relayDue.reclaimCount >= 1,
        'expired lease must surface as due or reclaim',
      );

      workerB = spawnWorker(pg.url, mail, redis.url);
      await waitForTerminalRelay(db, tenantId, issued.ticketId, mail);
      await new Promise((resolve) => {
        workerB.kill('SIGTERM');
        workerB.once('close', resolve);
        setTimeout(resolve, 3000);
      });
      workerB = null;

      const tickets = await withTenant(db, tenantId, (tx) => tx.$queryRaw`
        SELECT COUNT(*)::int AS n FROM tickets
        WHERE tenant_id = ${tenantId}::uuid AND id = ${issued.ticketId}::uuid`);
      assert.equal(tickets[0].n, 1, 'exactly one logical ticket');

      const mock = countingTicketEmailAdapter();
      const staleRow = {
        outbox_id: claimed.outbox_id,
        tenant_id: tenantId,
        event_id: eventId,
        type: 'TicketIssued',
        aggregate_id: issued.ticketId,
        payload_version: 1,
        lease_token: claimed.lease_token,
        attempts: claimed.attempts ?? 0,
      };
      const stale = await processClaimedOutbox(db, mock.adapter, [staleRow], {
        credentialKeyMaterial: credentialKey,
        leaseOwner: claimed.lease_owner,
        publicWebBaseUrl: 'https://tickets.job02.test',
        env: { NODE_ENV: 'test' },
      });
      assert.equal(mock.getTicketSends(), 0, 'stale worker must not call provider');
      assert.equal(stale.completed, 0, 'stale ack must not mark COMPLETE again');
      assert.equal((await messages(mail.api)).total, 1, 'still one logical email');
    } finally {
      if (workerA && workerA.exitCode === null) workerA.kill('SIGKILL');
      if (workerB && workerB.exitCode === null) workerB.kill('SIGKILL');
      if (stall) stall.close();
      if (db) await db.$disconnect();
      if (mail) docker('rm', '-f', mail.name);
      if (redis) redis.stop();
      if (pg) pg.stop();
    }
  },
);
