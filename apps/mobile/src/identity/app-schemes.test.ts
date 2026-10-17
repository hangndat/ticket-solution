import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  APP_SCHEMES,
  OIDC_REDIRECT_SCHEME,
  PRIMARY_APP_SCHEME,
  isAppScheme,
} from './app-schemes.ts';

test('dual schemes keep Vemoki brand and legacy ticketsolution', () => {
  assert.deepEqual([...APP_SCHEMES], ['vemoki', 'ticketsolution']);
  assert.equal(PRIMARY_APP_SCHEME, 'vemoki');
  assert.equal(OIDC_REDIRECT_SCHEME, 'ticketsolution');
  assert.equal(isAppScheme('vemoki:'), true);
  assert.equal(isAppScheme('ticketsolution:'), true);
  assert.equal(isAppScheme('https:'), false);
});
