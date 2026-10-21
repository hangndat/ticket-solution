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
import { eventArtTone } from '../src/ui/event-art-tone';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('bundled demo logo and banner files exist under public/demo', () => {
  assert.equal(existsSync(path.join(webRoot, 'public/demo/logo.png')), true);
  assert.equal(existsSync(path.join(webRoot, 'public/demo/banner.png')), true);
});

test('D9 seed tenant slugs and event ids resolve a local media pack', () => {
  for (const id of [
    'demo-mfest',
    'demo-studio-night',
    'fixture-mfest',
    'fixture-form-forum',
    '11111111-1111-4111-8111-111111111101',
    '22222222-2222-4222-8222-222222222201',
  ]) {
    assert.ok(hasDemoMediaForEventId(id));
    assert.deepEqual(demoMediaForEventId(id), {
      logoUrl: DEMO_LOGO_PATH,
      bannerUrl: DEMO_BANNER_PATH,
    });
  }
  for (const slug of ['mfest-demo', 'demo-studio', 'mfest', 'northline']) {
    assert.ok(demoMediaForTenantSlug(slug));
  }
});

test('unknown events never invent media URLs', () => {
  assert.equal(demoMediaForEventId('unknown'), null);
  assert.equal(demoMediaForEventId(''), null);
  assert.equal(demoMediaForEventId(null), null);
  assert.equal(demoMediaForTenantSlug('other-tenant'), null);
  assert.equal(hasDemoMediaForEventId('constructor'), false);
});

test('eventArtTone returns a stable decorative tone', () => {
  const id = '11111111-1111-4111-8111-111111111101';
  assert.equal(eventArtTone(id), eventArtTone(id));
  assert.ok(['default', 'green', 'gold'].includes(eventArtTone(id)));
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
