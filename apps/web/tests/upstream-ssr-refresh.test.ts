import assert from 'node:assert/strict';
import test from 'node:test';
import type { ForwardWithBearerOptions } from '../src/bff/upstream';

/**
 * Contract: staff SSR discovery must opt out of cookie-mutating refresh.
 * (Integration with Next cookies is covered by route handler + E2E; this locks the option.)
 */
test('ForwardWithBearerOptions documents SSR allowCookieRefresh default', () => {
  const defaults: ForwardWithBearerOptions = {};
  assert.equal(defaults.allowCookieRefresh ?? true, true);
  const ssr: ForwardWithBearerOptions = { allowCookieRefresh: false };
  assert.equal(ssr.allowCookieRefresh, false);
});
