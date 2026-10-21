'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  PROD_SEED,
  PROD_SEED_NAMESPACE,
  assertProdSeedMutateAllowed,
} = require('../dist');

test('PROD_SEED dataset: 4 tenants, 6 events, no · Demo marker', () => {
  const tenants = Object.values(PROD_SEED.tenants);
  assert.equal(tenants.length, 4);
  const events = Object.values(PROD_SEED.events);
  assert.equal(events.length, 6);
  for (const t of tenants) {
    assert.match(t.id, new RegExp(`^${PROD_SEED_NAMESPACE}`));
    assert.ok(!/· Demo/.test(t.name));
    assert.ok(!/· Demo/.test(t.slug));
  }
  for (const e of events) {
    assert.match(e.id, new RegExp(`^${PROD_SEED_NAMESPACE}`));
    assert.ok(!/· Demo/.test(e.name));
    assert.ok(e.rawCodes[0].startsWith('VEM-'));
    assert.equal(e.rawCodes.length, 10);
  }
  assert.equal(PROD_SEED.tenants.mekong.slug, 'mekong-makers');
  assert.equal(events.filter((e) => e.orgKey === 'lucbao').length, 1);
  assert.equal(events.filter((e) => e.orgKey === 'saigon').length, 2);
  assert.equal(events.filter((e) => e.orgKey === 'hoian').length, 3);
});

test('assertProdSeedMutateAllowed requires confirm unless dry-run', () => {
  assert.throws(
    () => assertProdSeedMutateAllowed({}),
    /PROD_SEED_CONFIRM/,
  );
  assert.throws(
    () => assertProdSeedMutateAllowed({ PROD_SEED_CONFIRM: '0' }),
    /PROD_SEED_CONFIRM/,
  );
  assert.doesNotThrow(() =>
    assertProdSeedMutateAllowed({ PROD_SEED_CONFIRM: '1' }),
  );
  assert.doesNotThrow(() =>
    assertProdSeedMutateAllowed({ PROD_SEED_DRY_RUN: '1' }),
  );
});
