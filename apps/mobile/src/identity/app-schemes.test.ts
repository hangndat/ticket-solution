import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APP_SCHEMES,
  OIDC_POST_LOGOUT_URI,
  OIDC_REDIRECT_SCHEME,
  PRIMARY_APP_SCHEME,
  isAppScheme,
} from './app-schemes.ts';

test('dual schemes keep Vemoki brand and legacy ticketsolution', () => {
  assert.deepEqual([...APP_SCHEMES], ['vemoki', 'ticketsolution']);
  assert.equal(PRIMARY_APP_SCHEME, 'vemoki');
  assert.equal(OIDC_REDIRECT_SCHEME, 'vemoki');
  assert.equal(OIDC_POST_LOGOUT_URI, 'vemoki://oauth/logout');
  assert.equal(isAppScheme('vemoki:'), true);
  assert.equal(isAppScheme('ticketsolution:'), true);
  assert.equal(isAppScheme('https:'), false);
});

test('OIDC redirect/logout stay on custom schemes (not web apex or app. subdomain)', () => {
  assert.equal(OIDC_REDIRECT_SCHEME.includes('.'), false);
  assert.match(OIDC_POST_LOGOUT_URI, /^vemoki:\/\/oauth\/logout$/);
  assert.doesNotMatch(OIDC_POST_LOGOUT_URI, /vemoki\.com|app\.vemoki/);
});
