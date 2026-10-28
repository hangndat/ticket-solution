import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sessionRefreshRoutePath,
  ssrTerminalAuthRejectPath,
  SSR_REFRESH_ATTEMPT_COOKIE,
} from '../src/oidc/session-refresh';

test('sessionRefreshRoutePath encodes allowlisted next paths', () => {
  assert.equal(
    sessionRefreshRoutePath('/admin'),
    '/api/auth/refresh?next=%2Fadmin',
  );
  assert.equal(
    sessionRefreshRoutePath('/gate'),
    '/api/auth/refresh?next=%2F',
    'retired /gate post-login path falls back to home',
  );
  assert.equal(
    sessionRefreshRoutePath('https://evil.example'),
    '/api/auth/refresh?next=%2F',
  );
});

test('SSR refresh attempt cookie name is stable', () => {
  assert.equal(SSR_REFRESH_ATTEMPT_COOKIE, 'vemoki_ssr_refresh_attempt');
});

test('ssrTerminalAuthRejectPath fails closed without login redirect loop', () => {
  assert.equal(
    ssrTerminalAuthRejectPath('/admin'),
    '/auth?error=session_rejected&next=%2Fadmin',
  );
  assert.equal(
    ssrTerminalAuthRejectPath('/gate'),
    '/auth?error=session_rejected&next=%2F',
  );
  assert.equal(
    ssrTerminalAuthRejectPath('https://evil.example'),
    '/auth?error=session_rejected&next=%2F',
  );
  assert.doesNotMatch(
    ssrTerminalAuthRejectPath('/admin'),
    /\/auth\?next=/,
    'terminal path must not be bare /auth?next= (SSO loop)',
  );
});
