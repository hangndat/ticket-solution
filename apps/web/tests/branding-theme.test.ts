import assert from 'node:assert/strict';
import test from 'node:test';
// Import leaf modules (avoid load.ts → bff/upstream → @ticket/contracts in unit tests).
import {
  brandingCssVarEntries,
  brandingToCssVars,
  eventBrandingPresentation,
} from '../src/branding/css-vars';
import {
  brandingFromEventBrand,
  parseTenantBranding,
  sanitizeLogoUrl,
  toBrandingDto,
} from '../src/branding/parse';
import { VEMOKI_BRANDING } from '../src/branding/vemoki';

test('Vemoki defaults match Electric Violet tokens', () => {
  assert.equal(VEMOKI_BRANDING.wordmark, 'Vemoki');
  assert.equal(VEMOKI_BRANDING.colors.ink, '#17151F');
  assert.equal(VEMOKI_BRANDING.colors.paper, '#FFFFFF');
  assert.equal(VEMOKI_BRANDING.colors.signal, '#7038FF');
  assert.equal(VEMOKI_BRANDING.colors.focus, '#7038FF');
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

test('brandingCssVarEntries expose the current platform token values', () => {
  const entries = Object.fromEntries(brandingCssVarEntries(VEMOKI_BRANDING));
  assert.equal(entries['--ink'], '#17151F');
  assert.equal(entries['--paper'], '#FFFFFF');
  assert.equal(entries['--signal'], '#7038FF');
  assert.equal(entries['--focus'], '#7038FF');
  assert.equal(entries['--brand'], '#7038FF');
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

test('published event primary reaches event primary utilities without changing platform vars', () => {
  const { branding, style } = eventBrandingPresentation(
    { primaryColor: '#245B47', organizationName: 'MFest' },
    'mfest-demo',
  );
  const eventVars = Object.fromEntries(Object.entries(style));
  const platformVars = Object.fromEntries(
    Object.entries(brandingToCssVars(VEMOKI_BRANDING)),
  );

  assert.equal(branding.primaryColor, '#245B47');
  assert.equal(eventVars['--brand'], '#245B47');
  assert.equal(eventVars['--color-primary'], 'var(--brand)');
  assert.equal(platformVars['--brand'], '#7038FF');
  assert.equal(platformVars['--color-primary'], undefined);
});

test('invalid published event primary falls back through event main style vars', () => {
  const { branding, style } = eventBrandingPresentation(
    { primaryColor: 'not-a-color', organizationName: 'Local test event' },
    'local-test',
  );
  const eventVars = Object.fromEntries(Object.entries(style));

  assert.equal(branding.primaryColor, '#7038FF');
  assert.equal(eventVars['--brand'], '#7038FF');
  assert.equal(eventVars['--color-primary'], 'var(--brand)');
});

test('toBrandingDto is JSON-safe for BFF responses', () => {
  const dto = toBrandingDto(VEMOKI_BRANDING);
  assert.equal(dto.wordmark, 'Vemoki');
  assert.equal(dto.primaryColor, '#7038FF');
  assert.equal(dto.logoUrl, null);
});
