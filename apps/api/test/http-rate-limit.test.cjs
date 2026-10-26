const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const {
  abuseTenantIdFromKey,
  secondsUntilNextRateLimitWindow,
} = require('../dist/http-rate-limit.js');

describe('abuseTenantIdFromKey', () => {
  it('returns a stable UUID-shaped id for the same key', () => {
    const a = abuseTenantIdFromKey('ip:203.0.113.1');
    const b = abuseTenantIdFromKey('ip:203.0.113.1');
    assert.equal(a, b);
    assert.match(
      a,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('hourly Retry-After', () => {
  it('counts seconds to the same UTC boundary used by the counter', () => {
    assert.equal(
      secondsUntilNextRateLimitWindow(new Date('2026-10-26T12:00:00.000Z')),
      3600,
    );
    assert.equal(
      secondsUntilNextRateLimitWindow(new Date('2026-10-26T12:59:59.001Z')),
      1,
    );
  });
});
