'use strict';

// Test-only preload: exercise the real worker with one shared DB connection.
const pg = require('../../../packages/backend/node_modules/pg');
const { AsyncLocalStorage, AsyncResource } = require('node:async_hooks');
const relayScope = new AsyncLocalStorage();
const owners = new WeakMap();
let workerPool;
const Pool = pg.Pool;
pg.Pool = class SingleConnectionPool extends Pool {
  constructor(options) {
    super({ ...options, max: 1 });
    workerPool = this;
    this.on('release', (_error, client) => {
      const scope = owners.get(client);
      if (scope) scope.clients.delete(client);
      owners.delete(client);
    });
    console.log(JSON.stringify({ event: 'job06_test_pool_limit', max: 1 }));
  }
  connect(callback) {
    const scope = relayScope.getStore();
    const track = (client) => {
      if (scope) {
        owners.set(client, scope);
        scope.clients.add(client);
        console.log(JSON.stringify({ event: 'job06_relay_db_acquire' }));
        if (scope.sending) console.log(JSON.stringify({ event: 'job06_relay_db_during_smtp' }));
      }
      return client;
    };
    if (callback) {
      const bound = AsyncResource.bind(callback);
      return super.connect((error, client, release) => bound(error, client && track(client), release));
    }
    return super.connect().then(track);
  }
};

// Attribute pool checkouts to the real relay's async context, not other worker lanes.
const outbox = require('../../../packages/backend/dist/outbox.js');
const relay = outbox.relayOutboxOnce;
outbox.relayOutboxOnce = (db, email, ...args) => {
  const scope = { clients: new Set(), sending: false };
  const wrappedEmail = { ...email, async sendMembershipInvite(payload) {
    // Positive control: acquire only after the real claim and budget reservation.
    const injected = process.env.JOB06_TEST_HOLD_CONNECTION === '1'
      ? await workerPool.connect() : null;
    scope.sending = true;
    console.log(JSON.stringify({ event: 'job06_relay_smtp_start', held: scope.clients.size }));
    if (process.env.JOB06_TEST_HOLD_CONNECTION === 'during') {
      setTimeout(async () => {
        const client = await workerPool.connect();
        client.release();
      }, 100);
    }
    try {
      return await email.sendMembershipInvite(payload);
    } finally {
      scope.sending = false;
      if (injected) injected.release();
    }
  } };
  return relayScope.run(scope, () => relay(db, wrappedEmail, ...args));
};
