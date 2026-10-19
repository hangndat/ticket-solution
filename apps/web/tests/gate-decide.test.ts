import assert from 'node:assert/strict';
import test from 'node:test';
import { decideGateConfirm, lookupKnownCheckin } from '../src/gate/decide';

const base = {
  status: 200,
  json: null as unknown,
  timedOut: false,
  networkError: false,
};

test('confirm 200 with check-in admits', () => {
  const decision = decideGateConfirm({
    ...base,
    json: {
      state: 'USED',
      ticketId: '11111111-1111-4111-8111-111111111111',
      checkinId: '22222222-2222-4222-8222-222222222222',
    },
  });
  assert.equal(decision.kind, 'admit');
  if (decision.kind === 'admit') {
    assert.equal(decision.checkinId, '22222222-2222-4222-8222-222222222222');
  }
});

test('confirm 201 with check-in admits', () => {
  const decision = decideGateConfirm({
    ...base,
    status: 201,
    json: {
      state: 'USED',
      ticketId: '11111111-1111-4111-8111-111111111111',
      checkinId: '22222222-2222-4222-8222-222222222222',
    },
  });
  assert.equal(decision.kind, 'admit');
});

test('timeout, network, and 502 stay unknown and do not admit', () => {
  for (const result of [
    { ...base, status: 0, timedOut: true },
    { ...base, status: 0, networkError: true },
    { ...base, status: 502, json: { code: 'UPSTREAM_UNAVAILABLE', message: 'down' } },
    { ...base, status: 500, json: { code: 'INTERNAL', message: 'boom' } },
  ]) {
    const decision = decideGateConfirm(result);
    assert.equal(decision.kind, 'unknown');
    if (decision.kind === 'unknown') {
      assert.match(decision.message, /Không cho khách qua/);
    }
  }
});

test('expired hold denies; already checked in is a known admit', () => {
  const expired = decideGateConfirm({
    ...base,
    status: 409,
    json: { code: 'RESERVATION_EXPIRED', message: 'Hết hạn giữ chỗ.' },
  });
  assert.equal(expired.kind, 'deny');

  const again = decideGateConfirm({
    ...base,
    status: 409,
    json: { code: 'ALREADY_CHECKED_IN', message: 'Đã vào.' },
  });
  assert.equal(again.kind, 'admit');
});

test('CS lookup admits only a recorded check-in id', () => {
  const missing = lookupKnownCheckin([], '11111111-1111-4111-8111-111111111111');
  assert.equal(missing.kind, 'unknown');
  const found = lookupKnownCheckin(
    [
      {
        ticketId: '11111111-1111-4111-8111-111111111111',
        checkinId: '22222222-2222-4222-8222-222222222222',
        message: 'Đã ghi nhận check-in. Cho vào.',
      },
    ],
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(found.kind, 'admit');
});
