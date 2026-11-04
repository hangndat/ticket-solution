'use strict';

// Test-owned child uses the real worker with a lease owner tied to its PID.
const { createWorker } = require('../../../apps/worker/dist/index.js');
const { createDatabase } = require('../../../packages/backend/dist');
const database = createDatabase(process.env.DATABASE_URL, 5, true);
let blocked = false;
const instrumented = new Proxy(database, {
  get(target, property) {
    if (property === '$queryRaw')
      return async (...args) => {
        const rows = await target.$queryRaw(...args);
        if (
          process.env.JOB02_BARRIER === '1' &&
          !blocked &&
          Array.isArray(args[0]) &&
          args[0].join('').includes('claim_outbox_batch') &&
          rows.length > 0
        ) {
          blocked = true;
          process.send({ event: 'claimed' });
          await new Promise((resolve) => process.once('message', resolve));
        }
        return rows;
      };
    const value = target[property];
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
createWorker({
  env: process.env,
  database: instrumented,
  leaseOwner: `job02-pid-${process.pid}`,
})
  .then(() => {
    const keepAlive = setInterval(() => {}, 60_000);
    process.once('SIGTERM', () => {
      clearInterval(keepAlive);
      void database.$disconnect();
    });
  })
  .catch(() => {
    process.exitCode = 1;
  });
