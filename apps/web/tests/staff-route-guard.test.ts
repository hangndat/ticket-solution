import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveNavCapabilities,
  parseMeEventsResponse,
} from '../src/nav/capabilities';

/**
 * Staff SSR gate policy (Issue #1021 / E01):
 * - Valid 200 + gate.confirm → allow
 * - Valid 200 without gate → deny redirect
 * - 502/503 → render shell (tested via integration; policy mirrored here)
 */
test('gate discovery: staff with gate.confirm passes capability derivation', () => {
  const meEvents = parseMeEventsResponse(200, {
    staffEligible: true,
    items: [
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        eventId: '22222222-2222-4222-8222-222222222222',
        name: 'Night',
        permissions: ['gate.confirm'],
      },
    ],
  });
  assert.ok(meEvents);
  const caps = deriveNavCapabilities({
    authenticated: true,
    meEvents,
    meTenants: null,
    platformMe: null,
  });
  assert.equal(caps.showGate, true);
});

test('gate discovery: upstream timeout shape does not look authenticated', () => {
  const meEvents = parseMeEventsResponse(502, null);
  assert.equal(meEvents, null);
  const caps = deriveNavCapabilities({
    authenticated: meEvents !== null,
    meEvents,
    meTenants: null,
    platformMe: null,
  });
  assert.equal(caps.showGate, false);
});
