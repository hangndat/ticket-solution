import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  normalizeAssetUrl,
  normalizeHexColor,
  parseTenantBranding,
} from './parse.ts';

test('normalizeHexColor accepts #RGB #RRGGBB #RRGGBBAA', () => {
  assert.equal(normalizeHexColor('#AbC'), '#aabbcc');
  assert.equal(normalizeHexColor('#245B47'), '#245b47');
  assert.equal(normalizeHexColor('#245B47FF'), '#245b47ff');
  assert.equal(normalizeHexColor('  #9b3a18  '), '#9b3a18');
});

test('normalizeHexColor rejects junk', () => {
  assert.equal(normalizeHexColor('red'), null);
  assert.equal(normalizeHexColor('#12'), null);
  assert.equal(normalizeHexColor('#1234567'), null);
  assert.equal(normalizeHexColor(''), null);
  assert.equal(normalizeHexColor(null), null);
});

test('normalizeAssetUrl accepts https and root-relative', () => {
  assert.equal(
    normalizeAssetUrl('https://cdn.example/logo.png'),
    'https://cdn.example/logo.png',
  );
  assert.equal(normalizeAssetUrl('/assets/logo.png'), '/assets/logo.png');
  assert.equal(normalizeAssetUrl('data:image/png;base64,xxx'), undefined);
  assert.equal(normalizeAssetUrl('//evil.example/x'), undefined);
  assert.equal(normalizeAssetUrl(''), undefined);
});

test('parseTenantBranding accepts BE TenantBranding shape', () => {
  const ok = parseTenantBranding({
    tenantId: '22222222-2222-2222-2222-222222222222',
    slug: 'acme',
    displayName: 'Acme Org',
    primaryColor: '#245B47',
    secondaryColor: '#235FD0',
    logoAssetId: null,
    version: 2,
  });
  assert.deepEqual(ok, {
    organizationName: 'Acme Org',
    primaryColor: '#245b47',
    secondaryColor: '#235fd0',
    tenantSlug: 'acme',
    tenantId: '22222222-2222-2222-2222-222222222222',
    logoAssetId: null,
    brandVersion: 2,
  });
});

test('parseTenantBranding strips invalid logoUrl without failing', () => {
  const parsed = parseTenantBranding({
    tenantSlug: 'acme',
    organizationName: 'Acme',
    primaryColor: '#000',
    logoUrl: 'javascript:alert(1)',
  });
  assert.ok(parsed);
  assert.equal(parsed.logoUrl, undefined);
  assert.equal(parsed.primaryColor, '#000000');
});

test('parseTenantBranding preserves signalGlyph when tenant provides it', () => {
  const parsed = parseTenantBranding({
    tenantSlug: 'acme',
    organizationName: 'Acme',
    primaryColor: '#245b47',
    signalGlyph: ' ↗ ',
  });
  assert.ok(parsed);
  assert.equal(parsed.signalGlyph, '↗');
});

test('parseTenantBranding rejects empty / incomplete payloads', () => {
  assert.equal(parseTenantBranding({ primaryColor: '#000000' }), null);
  assert.equal(
    parseTenantBranding({
      tenantSlug: 'acme',
      organizationName: 'Acme',
      primaryColor: 'not-a-color',
    }),
    null,
  );
});
