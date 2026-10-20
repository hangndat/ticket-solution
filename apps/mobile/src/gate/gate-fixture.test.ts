import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MFEST_DEMO_GATE_SCOPE,
  isLocalDevPlaceholderGateScope,
} from './gate-fixture.ts';

test('placeholder gate scope is detected', () => {
  assert.equal(
    isLocalDevPlaceholderGateScope(
      'a1111111-1111-4111-8111-111111111111',
      'b2222222-2222-4222-8222-222222222222',
    ),
    true,
  );
  assert.equal(
    isLocalDevPlaceholderGateScope(
      MFEST_DEMO_GATE_SCOPE.tenantId,
      MFEST_DEMO_GATE_SCOPE.eventId,
    ),
    false,
  );
});
