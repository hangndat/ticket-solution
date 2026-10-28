import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasDemoMediaForEventId,
  hasDemoMediaForTenantSlug,
} from './demo-media.ts';

test('fixture event ids resolve bundled demo media keys', () => {
  assert.equal(hasDemoMediaForEventId('demo-mfest'), true);
  assert.equal(hasDemoMediaForEventId('demo-studio-night'), true);
});

test('stable demo UUIDs from brand/demo/manifest also resolve media', () => {
  assert.equal(
    hasDemoMediaForEventId('11111111-1111-4111-8111-111111111101'),
    true,
  );
  assert.equal(
    hasDemoMediaForEventId('22222222-2222-4222-8222-222222222201'),
    true,
  );
});

test('unknown event ids do not invent demo media', () => {
  assert.equal(hasDemoMediaForEventId('prod-event'), false);
  assert.equal(hasDemoMediaForEventId(null), false);
  assert.equal(hasDemoMediaForEventId(undefined), false);
});

test('demo tenant slugs map to bundled pack keys', () => {
  assert.equal(hasDemoMediaForTenantSlug('mfest-demo'), true);
  assert.equal(hasDemoMediaForTenantSlug('demo-studio'), true);
  assert.equal(hasDemoMediaForTenantSlug('acme'), false);
});

test('prod published seed UUIDs do not match fixture demo media by id', () => {
  // api.vemoki.com seed reuses mfest-demo / demo-studio tenant slugs but
  // distinct event ids — EventBanner must key demo pack off eventId only.
  assert.equal(
    hasDemoMediaForEventId('d9d9f001-0002-4000-8000-000000000001'),
    false,
  );
  assert.equal(
    hasDemoMediaForEventId('d9d9f001-0002-4000-8000-000000000002'),
    false,
  );
});
