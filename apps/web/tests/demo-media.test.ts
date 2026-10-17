import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  DEMO_BANNER_PATH,
  DEMO_LOGO_PATH,
  demoMediaForEventId,
  demoMediaForTenantSlug,
  hasDemoMediaForEventId,
  sanitizeMediaUrl,
} from '../src/demo-media';
import { demoEventRoutes, findDemoEvent } from '../src/events';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('bundled demo logo and banner files exist under public/demo', () => {
  assert.equal(existsSync(path.join(webRoot, 'public/demo/logo.png')), true);
  assert.equal(existsSync(path.join(webRoot, 'public/demo/banner.png')), true);
});

test('every web marketing fixture resolves a local media pack', () => {
  for (const route of demoEventRoutes()) {
    const event = findDemoEvent(route.tenantSlug, route.eventSlug)!;
    assert.ok(hasDemoMediaForEventId(event.id));
    const pack = demoMediaForEventId(event.id);
    assert.deepEqual(pack, {
      logoUrl: DEMO_LOGO_PATH,
      bannerUrl: DEMO_BANNER_PATH,
    });
    assert.ok(demoMediaForTenantSlug(event.tenantSlug));
  }
});

test('seed fixture ids and UUIDs also resolve demo media', () => {
  for (const id of [
    'demo-fun-fest',
    'demo-studio-night',
    '11111111-1111-4111-8111-111111111101',
    '22222222-2222-4222-8222-222222222201',
  ]) {
    assert.ok(demoMediaForEventId(id));
  }
  assert.ok(demoMediaForTenantSlug('demo-fun'));
  assert.ok(demoMediaForTenantSlug('demo-studio'));
});

test('unknown events never invent media URLs', () => {
  assert.equal(demoMediaForEventId('unknown'), null);
  assert.equal(demoMediaForEventId(''), null);
  assert.equal(demoMediaForEventId(null), null);
  assert.equal(demoMediaForTenantSlug('other-tenant'), null);
  assert.equal(hasDemoMediaForEventId('constructor'), false);
});

test('sanitizeMediaUrl allows https and root-relative only', () => {
  assert.equal(sanitizeMediaUrl('/demo/logo.png'), '/demo/logo.png');
  assert.equal(
    sanitizeMediaUrl('https://cdn.example.com/a.png'),
    'https://cdn.example.com/a.png',
  );
  assert.equal(sanitizeMediaUrl('http://cdn.example.com/a.png'), null);
  assert.equal(sanitizeMediaUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeMediaUrl('data:image/png;base64,xx'), null);
  assert.equal(sanitizeMediaUrl('//evil.example/x'), null);
  assert.equal(sanitizeMediaUrl('/../etc/passwd'), null);
  assert.equal(sanitizeMediaUrl(''), null);
  assert.equal(sanitizeMediaUrl(null), null);
});
