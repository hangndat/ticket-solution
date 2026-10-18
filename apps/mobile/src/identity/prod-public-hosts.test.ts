import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VEMOKI_PROD_PUBLIC } from '../../app.config.ts';

test('prod bake OIDC issuer is auth host, not web apex or app. product host', () => {
  assert.equal(
    VEMOKI_PROD_PUBLIC.oidcIssuer,
    'https://auth.vemoki.com/realms/ticket',
  );
  assert.equal(VEMOKI_PROD_PUBLIC.apiBaseUrl, 'https://api.vemoki.com');
  assert.doesNotMatch(VEMOKI_PROD_PUBLIC.oidcIssuer, /^(https:\/\/)?(www\.)?vemoki\.com/);
  assert.doesNotMatch(VEMOKI_PROD_PUBLIC.oidcIssuer, /app\.vemoki\.com/);
  assert.doesNotMatch(VEMOKI_PROD_PUBLIC.apiBaseUrl, /app\.vemoki\.com/);
});
