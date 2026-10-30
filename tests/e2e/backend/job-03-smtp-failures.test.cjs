'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const path = require('node:path');
const { startPostgres } = require('./pg-fixture.cjs');
const { startRedis } = require('./redis-fixture.cjs');
const { startStalledSmtp, startRejectingSmtp } = require('./smtp-fixture.cjs');
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

const credentialKey = 'job03-smtp-failures-cred-key';
const hmac = readCodeHmacEnvironment({
  CODE_HMAC_PEPPER: 'job03-smtp-failures-pepper!!',
  CODE_HMAC_VERSION: '1',
});

async function startMailpit() {
  const name = `ticket-job03-mailpit-${randomBytes(5).toString('hex')}`;
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

function spawnWorker(pgUrl, mail, redisUrl, extraEnv = {}) {
  return spawn(process.execPath, ['apps/worker/dist/main.js'], {
    cwd: root,
    stdio: 'ignore',
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'test',
      DATABASE_URL: pgUrl,
      SMTP_URL: mail.smtpUrl,
      SMTP_FROM: 'tickets@job03.test',
      PUBLIC_WEB_BASE_URL: 'https://tickets.job03.test',
      TICKET_CREDENTIAL_KEY: credentialKey,
      OUTBOX_POLL_MS: '100',
      REDIS_URL: redisUrl,
      NOTIFICATION_MAX_ATTEMPTS: '3',
      NOTIFICATION_INITIAL_BACKOFF_SECONDS: '1',
      NOTIFICATION_MAX_BACKOFF_SECONDS: '2',
      ...extraEnv,
    },
  });
}

async function readRelayState(db, tenantId, ticketId) {
  return withTenant(db, tenantId, async (tx) => {
    const outbox = await tx.$queryRaw`
      SELECT status, attempts, next_attempt_at
      FROM outbox
      WHERE tenant_id = ${tenantId}::uuid
        AND aggregate_id = ${ticketId}::uuid
        AND type = 'TicketIssued'
      LIMIT 1`;
    const notifications = await tx.$queryRaw`
      SELECT state, attempts, last_error
      FROM notifications
      WHERE tenant_id = ${tenantId}::uuid
        AND business_key = ${`ticket:${ticketId}:issued:email`}
      LIMIT 1`;
    const tickets = await tx.$queryRaw`
      SELECT state FROM tickets
      WHERE tenant_id = ${tenantId}::uuid AND id = ${ticketId}::uuid
      LIMIT 1`;
    return {
      outbox: outbox[0],
      notification: notifications[0],
      ticketState: tickets[0]?.state,
    };
  });
}

async function seedTicket(db) {
  const users = createPrismaIdentityUserRepository(db);
  const owner = await users.upsertFromVerifiedIdentity({
    issuer: 'https://auth.example.test/realms/ticket',
    subject: randomUUID(),
    email: 'job03-owner@example.test',
    emailVerified: true,
  });
  const tenantId = randomUUID();
  const eventId = randomUUID();
  await withTenant(db, tenantId, async (tx) => {
    await tx.tenant.create({
      data: { id: tenantId, slug: 'job03-smtp', name: 'JOB-03 SMTP' },
    });
    await tx.event.create({
      data: {
        tenantId,
        id: eventId,
        slug: 'job03-event',
        name: 'JOB-03 SMTP Event',
        status: 'PUBLISHED',
      },
    });
    await seedEventInventory(tx, hmac, {
      tenantId,
      eventId,
      eventQuota: 2,
      rawCodes: ['JOB03-TICKET'],
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
        rawCode: 'JOB03-TICKET',
        idempotencyKey: randomUUID(),
      }),
    ),
  );
  return { tenantId, eventId, ticketId: issued.ticketId, ownerUserId: owner.userId };
}

async function waitForWorkerTerminal(worker, db, tenantId, ticketId, mail) {
  for (let i = 0; i < 120; i++) {
    if (worker.exitCode !== null) {
      throw new Error(`worker exited early with code ${worker.exitCode}`);
    }
    const state = await readRelayState(db, tenantId, ticketId);
    const mailTotal = (await messages(mail.api)).total;
    if (
      state.outbox?.status === 'COMPLETE' &&
      state.notification?.state === 'ACCEPTED' &&
      mailTotal >= 1
    ) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('worker did not reach terminal relay state within 24 seconds');
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

async function accelerateRetry(db, tenantId, ticketId) {
  await withTenant(db, tenantId, async (tx) => {
    await tx.$executeRaw`
      UPDATE notifications
      SET next_attempt_at = clock_timestamp() - interval '1 second'
      WHERE tenant_id = ${tenantId}::uuid
        AND business_key = ${`ticket:${ticketId}:issued:email`}
    `;
    await tx.$executeRaw`
      UPDATE outbox
      SET next_attempt_at = clock_timestamp() - interval '1 second',
          lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
          status = 'PENDING'
      WHERE tenant_id = ${tenantId}::uuid
        AND aggregate_id = ${ticketId}::uuid
        AND type = 'TicketIssued'
    `;
  });
}

test(
  '[JOB-03] R SMTP failure and timeout: bounded retry, truthful PG state, ticket stays committed',
  { timeout: 300000 },
  async () => {
    let pg;
    let mail;
    let redis;
    let reject;
    let stall;
    let db;
    let worker;
    try {
      pg = await startPostgres();
      mail = await startMailpit();
      redis = await startRedis();
      reject = await startRejectingSmtp();
      stall = await startStalledSmtp();
      db = createDatabase(pg.url, 4);
      const { tenantId, ticketId, ownerUserId } = await seedTicket(db);

      const visible = await withTenant(db, tenantId, (tx) =>
        getTicketForOwner(tx, tenantId, ownerUserId, ticketId),
      );
      assert.equal(visible.state, 'ACTIVE');

      worker = spawnWorker(pg.url, reject, redis.url);
      let sawFailure = false;
      for (let i = 0; i < 80; i++) {
        const state = await readRelayState(db, tenantId, ticketId);
        if (
          state.outbox?.status === 'PENDING' &&
          state.notification &&
          state.notification.attempts >= 1 &&
          state.notification.attempts <= 3 &&
          (state.notification.state === 'FAILED' ||
            state.notification.state === 'UNKNOWN')
        ) {
          sawFailure = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.ok(sawFailure, 'rejecting SMTP must record bounded retry state in PG');
      assert.equal((await messages(mail.api)).total, 0, 'reject path must not deliver to Mailpit');

      await stopWorker(worker);
      worker = null;

      worker = spawnWorker(pg.url, stall, redis.url);
      let sawUnknown = false;
      for (let i = 0; i < 60; i++) {
        const state = await readRelayState(db, tenantId, ticketId);
        if (state.notification?.state === 'UNKNOWN') {
          sawUnknown = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.ok(sawUnknown, 'stalled SMTP must surface UNKNOWN by transport deadline');
      await stopWorker(worker);
      worker = null;

      await accelerateRetry(db, tenantId, ticketId);
      worker = spawnWorker(pg.url, mail, redis.url);
      await waitForWorkerTerminal(worker, db, tenantId, ticketId, mail);
      await stopWorker(worker);
      worker = null;

      const finalState = await readRelayState(db, tenantId, ticketId);
      assert.equal(finalState.ticketState, 'ACTIVE');
      assert.equal(finalState.outbox?.status, 'COMPLETE');
      assert.equal(finalState.notification?.state, 'ACCEPTED');
      assert.ok(
        (await messages(mail.api)).total >= 1,
        'Mailpit must show at least one logical delivery (ADR-17 allows duplicate SMTP)',
      );
    } finally {
      if (worker) await stopWorker(worker);
      if (stall) stall.close();
      if (reject) reject.close();
      if (db) await db.$disconnect();
      if (mail) docker('rm', '-f', mail.name);
      if (redis) redis.stop();
      if (pg) pg.stop();
    }
  },
);

test(
  '[JOB-03] R crash after SMTP accept before PG ack: ticket not rolled back, recovery may duplicate SMTP',
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
      const { tenantId, ticketId, ownerUserId } = await seedTicket(db);

      const child = require.resolve(
        '../../../packages/backend/test/fixtures/exit-after-smtp.cjs',
      );
      assert.throws(
        () =>
          execFileSync(process.execPath, [child], {
            encoding: 'utf8',
            env: {
              ...process.env,
              DATABASE_URL: pg.url,
              TEST_CREDENTIAL_KEY: credentialKey,
              SMTP_URL: mail.smtpUrl,
              SMTP_FROM: 'tickets@job03.test',
              PUBLIC_WEB_BASE_URL: 'https://tickets.job03.test',
              NODE_ENV: 'test',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          }),
        (error) =>
          error.status === 91 && error.stdout.includes('SMTP_ACCEPTED'),
      );

      const afterCrash = await readRelayState(db, tenantId, ticketId);
      assert.equal(afterCrash.ticketState, 'ACTIVE');
      assert.notEqual(afterCrash.outbox?.status, 'COMPLETE');
      assert.equal(afterCrash.notification?.state, 'PENDING');
      assert.ok(
        (await messages(mail.api)).total >= 1,
        'provider accept may have delivered before crash (at-least-once)',
      );

      const visible = await withTenant(db, tenantId, (tx) =>
        getTicketForOwner(tx, tenantId, ownerUserId, ticketId),
      );
      assert.equal(visible.ticketId, ticketId);

      await withTenant(db, tenantId, async (tx) => {
        await tx.$executeRaw`
          UPDATE outbox SET lease_expires_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = ${tenantId}::uuid AND aggregate_id = ${ticketId}::uuid
            AND type = 'TicketIssued'
        `;
      });

      worker = spawnWorker(pg.url, mail, redis.url);
      await waitForWorkerTerminal(worker, db, tenantId, ticketId, mail);
      await stopWorker(worker);
      worker = null;

      const recovered = await readRelayState(db, tenantId, ticketId);
      assert.equal(recovered.ticketState, 'ACTIVE');
      assert.equal(recovered.outbox?.status, 'COMPLETE');
      assert.equal(recovered.notification?.state, 'ACCEPTED');
      assert.ok(
        (await messages(mail.api)).total >= 1,
        'do not assert exactly-once SMTP delivery per ADR-17',
      );
    } finally {
      if (worker) await stopWorker(worker);
      if (db) await db.$disconnect();
      if (mail) docker('rm', '-f', mail.name);
      if (redis) redis.stop();
      if (pg) pg.stop();
    }
  },
);
