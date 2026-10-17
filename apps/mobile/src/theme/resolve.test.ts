import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultThemeTokens, resolveThemeTokens } from './resolve.ts';
import { brand } from './tokens.ts';

test('defaultThemeTokens matches Vemoki platform brand', () => {
  const tokens = defaultThemeTokens();
  assert.equal(tokens.signal, brand.signal);
  assert.equal(tokens.wordmark, brand.wordmark);
  assert.equal(tokens.source, 'default');
  assert.equal(tokens.logoUrl, null);
  assert.equal(tokens.tenantSlug, null);
});

test('resolveThemeTokens applies tenant primaryColor and wordmark', () => {
  const tokens = resolveThemeTokens(
    {
      tenantSlug: 'acme',
      organizationName: 'Acme Org',
      primaryColor: '#245b47',
      secondaryColor: '#112233',
      logoUrl: 'https://cdn.example/logo.png',
      wordmark: 'Acme',
      brandVersion: 1,
    },
    'api',
  );
  assert.equal(tokens.signal, '#245b47');
  assert.equal(tokens.focus, '#112233');
  assert.equal(tokens.wordmark, 'Acme');
  assert.equal(tokens.organizationName, 'Acme Org');
  assert.equal(tokens.logoUrl, 'https://cdn.example/logo.png');
  assert.equal(tokens.source, 'api');
  assert.equal(tokens.tenantSlug, 'acme');
  assert.equal(tokens.ink, brand.ink);
});

test('resolveThemeTokens null → full Vemoki default', () => {
  const tokens = resolveThemeTokens(null);
  assert.deepEqual(tokens, defaultThemeTokens());
});

test('resolveThemeTokens falls back wordmark to organizationName', () => {
  const tokens = resolveThemeTokens({
    tenantSlug: 'fun',
    organizationName: 'MFest',
    primaryColor: '#59428a',
  });
  assert.equal(tokens.wordmark, 'MFest');
  assert.equal(tokens.logoUrl, null);
});
