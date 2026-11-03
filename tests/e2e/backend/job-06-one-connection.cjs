'use strict';

// Test-only preload: exercise the real worker with one shared DB connection.
const pg = require('../../../packages/backend/node_modules/pg');
const Pool = pg.Pool;
pg.Pool = class SingleConnectionPool extends Pool {
  constructor(options) {
    super({ ...options, max: 1 });
    console.log(JSON.stringify({ event: 'job06_test_pool_limit', max: 1 }));
  }
};
