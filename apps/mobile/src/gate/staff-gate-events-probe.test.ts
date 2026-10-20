import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MeEventsResponse } from '@ticket/contracts';
import { scanCopy } from '../components/screen-state-copy.ts';
import { staffGateEventsFromProbe } from './staff-gate-events-probe.ts';

const eligibleBody: MeEventsResponse = {
  staffEligible: true,
  items: [
    {
      tenantId: '11111111-1111-1111-1111-111111111111',
      eventId: '22222222-2222-2222-2222-222222222222',
      name: 'Gate Event',
      permissions: ['gate.scan'],
    },
  ],
};

test('eligible ok returns body', () => {
  const out = staffGateEventsFromProbe({ status: 'ok', body: eligibleBody });
  assert.equal(out.kind, 'eligible');
  if (out.kind === 'eligible') {
    assert.equal(out.body.staffEligible, true);
  }
});

test('ok not staffEligible is ineligible (caller may clear workspace)', () => {
  const out = staffGateEventsFromProbe({
    status: 'ok',
    body: { staffEligible: false, items: [] },
  });
  assert.equal(out.kind, 'ineligible');
});

test('unreachable is probe-error with network copy — not ineligible', () => {
  const out = staffGateEventsFromProbe({ status: 'unreachable' });
  assert.equal(out.kind, 'probe-error');
  if (out.kind === 'probe-error') {
    assert.equal(out.message, scanCopy.eventPicker.error);
    assert.notEqual(out.message, scanCopy.eventPicker.empty);
  }
});

test('unauthorized is probe-error with session copy', () => {
  const out = staffGateEventsFromProbe({ status: 'unauthorized' });
  assert.equal(out.kind, 'probe-error');
  if (out.kind === 'probe-error') {
    assert.equal(out.message, scanCopy.eventPicker.sessionExpired);
  }
});

test('invalid is probe-error — not ineligible', () => {
  const out = staffGateEventsFromProbe({ status: 'invalid' });
  assert.equal(out.kind, 'probe-error');
  if (out.kind === 'probe-error') {
    assert.equal(out.message, scanCopy.eventPicker.invalidResponse);
  }
});
