'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('worker exports safe offline sync replay helpers', () => {
  const worker = require('../dist');
  assert.equal(typeof worker.replayOfflineSyncBatch, 'function');
  assert.equal(typeof worker.applyOfflineSyncBatch, 'function');
});
