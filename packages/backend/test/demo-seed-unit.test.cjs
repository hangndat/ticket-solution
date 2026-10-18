'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { D9_DEMO, D9_LEGACY_TENANT_SLUGS } = require('../dist/demo-seed');

test('D9_DEMO dataset has ≥2 tenants, events, codes, and demo markers', () => {
  assert.equal(D9_DEMO.tenants.mfest.slug, 'mfest-demo');
  assert.equal(D9_DEMO.tenants.studio.slug, 'demo-studio');
  assert.match(D9_DEMO.tenants.mfest.name, /Demo/);
  assert.match(D9_DEMO.events.mfest.name, /Demo/);
  assert.match(D9_DEMO.events.studioNight.name, /Demo/);
  assert.equal(D9_DEMO.events.mfest.rawCodes.length, 10);
  assert.equal(D9_DEMO.events.studioNight.rawCodes.length, 10);
  assert.ok(D9_DEMO.events.mfest.rawCodes[0].startsWith('DEMO-MFEST-'));
  assert.ok(D9_DEMO.events.studioNight.rawCodes[0].startsWith('DEMO-STUDIO-'));
  // Stable UUIDs (fixture contract)
  assert.match(D9_DEMO.tenants.mfest.id, /^d9d9f001-/);
  assert.match(D9_DEMO.events.mfest.id, /^d9d9f001-/);
  // Known Fun Fest → MFest rebrand only (not arbitrary slug overwrite)
  assert.deepEqual(D9_LEGACY_TENANT_SLUGS[D9_DEMO.tenants.mfest.id], [
    'demo-fun',
  ]);
  assert.equal(D9_LEGACY_TENANT_SLUGS[D9_DEMO.tenants.studio.id], undefined);
});
