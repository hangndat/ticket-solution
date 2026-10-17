import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isApiUnreachableResult,
  resolveGateLinkState,
} from '../src/gate/connectivity';
import {
  bannerCopyForLink,
  BLOCKED_OFFLINE_DECISION,
  IOS_OFFLINE_QUEUE_GUIDE,
} from '../src/gate/offline-messages';
import { decideGateConfirm } from '../src/gate/decide';

test('resolveGateLinkState: offline wins over degraded', () => {
  assert.equal(
    resolveGateLinkState({ browserOnline: false, apiUnreachable: true }),
    'offline',
  );
  assert.equal(
    resolveGateLinkState({ browserOnline: true, apiUnreachable: true }),
    'degraded',
  );
  assert.equal(
    resolveGateLinkState({ browserOnline: true, apiUnreachable: false }),
    'online',
  );
});

test('isApiUnreachableResult covers timeout, network, 0, 5xx', () => {
  assert.equal(isApiUnreachableResult({ timedOut: true, networkError: false, status: 0 }), true);
  assert.equal(isApiUnreachableResult({ timedOut: false, networkError: true, status: 0 }), true);
  assert.equal(isApiUnreachableResult({ timedOut: false, networkError: false, status: 502 }), true);
  assert.equal(isApiUnreachableResult({ timedOut: false, networkError: false, status: 200 }), false);
  assert.equal(isApiUnreachableResult({ timedOut: false, networkError: false, status: 409 }), false);
});

test('banner copy is VI and guides to iOS CHECKIN_OFFLINE', () => {
  const offline = bannerCopyForLink('offline');
  assert.ok(offline);
  assert.match(offline!.title, /offline/i);
  assert.match(offline!.body, /CHECKIN_OFFLINE/);
  assert.match(offline!.body, /iOS/);

  const degraded = bannerCopyForLink('degraded');
  assert.ok(degraded);
  assert.match(degraded!.body, /không giả nhận|Không cho khách qua/i);
  assert.match(degraded!.body, /#105|ADR-18/);

  assert.equal(bannerCopyForLink('online'), null);
});

test('blocked offline decision never admits', () => {
  assert.equal(BLOCKED_OFFLINE_DECISION.kind, 'deny');
  assert.equal(BLOCKED_OFFLINE_DECISION.code, 'GATE_OFFLINE');
  assert.match(BLOCKED_OFFLINE_DECISION.message, /CHECKIN_OFFLINE/);
});

test('unknown API path mentions iOS queue guide (contract #105)', () => {
  const decision = decideGateConfirm({
    status: 0,
    json: null,
    timedOut: true,
    networkError: false,
  });
  assert.equal(decision.kind, 'unknown');
  if (decision.kind === 'unknown') {
    assert.match(decision.message, /Không cho khách qua/);
    assert.ok(decision.message.includes(IOS_OFFLINE_QUEUE_GUIDE.slice(0, 40)));
  }
});

test('ALREADY_CHECKED_IN still admits (aligned with #105 conflict code)', () => {
  const again = decideGateConfirm({
    status: 409,
    json: { code: 'ALREADY_CHECKED_IN', message: 'Đã vào.', ticketId: 't1', checkinId: 'c1' },
    timedOut: false,
    networkError: false,
  });
  assert.equal(again.kind, 'admit');
});
