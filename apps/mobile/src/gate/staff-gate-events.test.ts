import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MeEventItem } from '@ticket/contracts';
import {
  GATE_CONFIRM_PERMISSION,
  gateStaffEvents,
  pickStaffGateScope,
} from './staff-gate-events.ts';

const gateEvent: MeEventItem = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  eventId: '22222222-2222-2222-2222-222222222222',
  name: 'Gate Night',
  permissions: [GATE_CONFIRM_PERMISSION],
};

const otherEvent: MeEventItem = {
  tenantId: '33333333-3333-3333-3333-333333333333',
  eventId: '44444444-4444-4444-4444-444444444444',
  name: 'Attendee only',
  permissions: ['ticket.view'],
};

test('gateStaffEvents keeps only gate.confirm assignments', () => {
  assert.deepEqual(gateStaffEvents([gateEvent, otherEvent]), [gateEvent]);
});

test('pickStaffGateScope prefers persisted when still eligible', () => {
  const picked = pickStaffGateScope(
    [otherEvent, gateEvent],
    {
      tenantId: gateEvent.tenantId,
      eventId: gateEvent.eventId,
      name: 'Stale name',
    },
  );
  assert.equal(picked?.name, 'Gate Night');
});

test('pickStaffGateScope falls back to first gate event', () => {
  const picked = pickStaffGateScope([gateEvent], null);
  assert.deepEqual(picked, {
    tenantId: gateEvent.tenantId,
    eventId: gateEvent.eventId,
    name: gateEvent.name,
  });
});
