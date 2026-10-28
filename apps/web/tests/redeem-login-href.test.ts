import assert from 'node:assert/strict';
import test from 'node:test';
import { redeemLoginHref } from '../src/redeem/login-href';

test('redeem login preserves validated event scope without code/token/query injection', () => {
  const href = redeemLoginHref({
    tenantSlug: 'tenant-a',
    eventSlug: 'event-a',
    tenantId: 'invalid-id',
    eventId: 'invalid-id',
  });
  const start = new URL(href, 'https://app.example.test');
  assert.equal(start.pathname, '/api/auth/login');
  assert.equal(
    start.searchParams.get('return'),
    '/redeem?tenantSlug=tenant-a&eventSlug=event-a',
  );
  const injected = redeemLoginHref({
    tenantSlug: 'evil&code=secret',
    eventSlug: 'https://evil.test',
  });
  assert.equal(new URL(injected, start).searchParams.get('return'), '/redeem');
});
