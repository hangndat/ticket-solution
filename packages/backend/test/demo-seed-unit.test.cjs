'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { D9_DEMO } = require('../dist/demo-seed');

test('D9_DEMO dataset has ≥2 tenants, events, codes, and demo markers', () => {
  assert.equal(D9_DEMO.tenants.fun.slug, 'demo-fun');
  assert.equal(D9_DEMO.tenants.studio.slug, 'demo-studio');
  assert.match(D9_DEMO.tenants.fun.name, /Demo/);
  assert.match(D9_DEMO.events.funFest.name, /Demo/);
  assert.match(D9_DEMO.events.studioNight.name, /Demo/);
  assert.equal(D9_DEMO.events.funFest.rawCodes.length, 10);
  assert.equal(D9_DEMO.events.studioNight.rawCodes.length, 10);
  assert.ok(D9_DEMO.events.funFest.rawCodes[0].startsWith('DEMO-FUN-'));
  assert.ok(D9_DEMO.events.studioNight.rawCodes[0].startsWith('DEMO-STUDIO-'));
  // Stable UUIDs (fixture contract)
  assert.match(D9_DEMO.tenants.fun.id, /^d9d9f001-/);
  assert.match(D9_DEMO.events.funFest.id, /^d9d9f001-/);
});
