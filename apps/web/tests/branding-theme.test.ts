import assert from 'node:assert/strict';
import test from 'node:test';
// Import leaf modules (avoid load.ts → bff/upstream → @ticket/contracts in unit tests).
import { brandingCssVarEntries } from '../src/branding/css-vars';
import {
  brandingFromEventBrand,
  parseTenantBranding,
  sanitizeLogoUrl,
  toBrandingDto,
} from '../src/branding/parse';
import { VEMOKI_BRANDING } from '../src/branding/vemoki';

test('Vemoki defaults match D6 O09 tokens', () => {
  assert.equal(VEMOKI_BRANDING.wordmark, 'vemoki');
  assert.equal(VEMOKI_BRANDING.colors.ink, '#22241f');
  assert.equal(VEMOKI_BRANDING.colors.paper, '#f7f6f1');
  assert.equal(VEMOKI_BRANDING.colors.signal, '#9b3a18');
  assert.equal(VEMOKI_BRANDING.colors.focus, '#235fd0');
  assert.equal(VEMOKI_BRANDING.source, 'vemoki-default');
  assert.equal(VEMOKI_BRANDING.logoUrl, null);
});

test('parseTenantBranding maps BE fields onto CSS token colors', () => {
  const parsed = parseTenantBranding({
    tenantSlug: 'acme',
    displayName: 'Acme Events',
    primaryColor: '#112233',
    secondaryColor: '#445566',
    logoUrl: 'https://cdn.example.com/logo.png',
    logoAssetId: '11111111-1111-1111-1111-111111111111',
  });
  assert.ok(parsed);
  assert.equal(parsed!.source, 'tenant');
  assert.equal(parsed!.tenantSlug, 'acme');
  assert.equal(parsed!.displayName, 'Acme Events');
  assert.equal(parsed!.wordmark, 'acme events');
  assert.equal(parsed!.colors.signal, '#112233');
  assert.equal(parsed!.colors.focus, '#445566');
  assert.equal(parsed!.primaryColor, '#112233');
  assert.equal(parsed!.logoUrl, 'https://cdn.example.com/logo.png');
  assert.equal(parsed!.colors.ink, VEMOKI_BRANDING.colors.ink);
});

test('parseTenantBranding rejects empty / invalid payloads', () => {
  assert.equal(parseTenantBranding(null), null);
  assert.equal(parseTenantBranding({}), null);
  assert.equal(parseTenantBranding({ primaryColor: 'red' }), null);
  assert.equal(
    parseTenantBranding({ logoUrl: 'javascript:alert(1)' }),
    null,
  );
});

test('sanitizeLogoUrl allowlists https and root-relative only', () => {
  assert.equal(sanitizeLogoUrl('https://cdn.example.com/a.png'), 'https://cdn.example.com/a.png');
  assert.equal(sanitizeLogoUrl('/assets/logo.png'), '/assets/logo.png');
  assert.equal(sanitizeLogoUrl('http://insecure.example/a.png'), null);
  assert.equal(sanitizeLogoUrl('//evil.example/a.png'), null);
  assert.equal(sanitizeLogoUrl('../etc/passwd'), null);
  assert.equal(sanitizeLogoUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeLogoUrl('data:image/png;base64,xxx'), null);
});

test('brandingCssVarEntries expose D6 token names', () => {
  const entries = Object.fromEntries(brandingCssVarEntries(VEMOKI_BRANDING));
  assert.equal(entries['--ink'], '#22241f');
  assert.equal(entries['--paper'], '#f7f6f1');
  assert.equal(entries['--signal'], '#9b3a18');
  assert.equal(entries['--focus'], '#235fd0');
  assert.equal(entries['--brand'], '#9b3a18');
});

test('brandingFromEventBrand scopes demo event chrome', () => {
  const b = brandingFromEventBrand(
    { primaryColor: '#783013', organizationName: 'MFest' },
    'mfest',
  );
  assert.equal(b.source, 'demo-event');
  assert.equal(b.tenantSlug, 'mfest');
  assert.equal(b.colors.signal, '#783013');
  assert.equal(b.displayName, 'MFest');
  assert.match(b.wordmark, /mfest/);
});

test('toBrandingDto is JSON-safe for BFF responses', () => {
  const dto = toBrandingDto(VEMOKI_BRANDING);
  assert.equal(dto.wordmark, 'vemoki');
  assert.equal(dto.primaryColor, '#9b3a18');
  assert.equal(dto.logoUrl, null);
});
