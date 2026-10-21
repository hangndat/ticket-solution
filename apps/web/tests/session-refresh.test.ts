import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sessionRefreshRoutePath,
  SSR_REFRESH_ATTEMPT_COOKIE,
} from '../src/oidc/session-refresh';

test('sessionRefreshRoutePath encodes allowlisted next paths', () => {
  assert.equal(
    sessionRefreshRoutePath('/gate'),
    '/api/auth/refresh?next=%2Fgate',
  );
  assert.equal(
    sessionRefreshRoutePath('/admin'),
    '/api/auth/refresh?next=%2Fadmin',
  );
  assert.equal(
    sessionRefreshRoutePath('https://evil.example'),
    '/api/auth/refresh?next=%2F',
  );
});

test('SSR refresh attempt cookie name is stable', () => {
  assert.equal(SSR_REFRESH_ATTEMPT_COOKIE, 'vemoki_ssr_refresh_attempt');
});
