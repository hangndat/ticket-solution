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
import {
  connectivityLabel,
  presentGateDecision,
  shortId,
} from '../src/gate/gate-outcome-copy';
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

test('banner copy is plain VI and guides to staff app (no web queue)', () => {
  const offline = bannerCopyForLink('offline');
  assert.ok(offline);
  assert.match(offline!.title, /Cổng web offline/i);
  assert.match(offline!.body, /Không xếp hàng trên web/);
  assert.match(offline!.body, /app Nhân viên/);
  assert.doesNotMatch(offline!.body, /CHECKIN_OFFLINE|ADR-18|#105/);

  const degraded = bannerCopyForLink('degraded');
  assert.ok(degraded);
  assert.match(degraded!.body, /không giả nhận|Không cho khách qua/i);
  assert.match(degraded!.body, /app Nhân viên/);
  assert.doesNotMatch(degraded!.body, /CHECKIN_OFFLINE|ADR-18|#105/);

  assert.equal(bannerCopyForLink('online'), null);
});

test('blocked offline decision never admits', () => {
  assert.equal(BLOCKED_OFFLINE_DECISION.kind, 'deny');
  assert.equal(BLOCKED_OFFLINE_DECISION.code, 'GATE_OFFLINE');
  assert.match(BLOCKED_OFFLINE_DECISION.message, /Không xếp hàng trên web/);
});

test('unknown API path mentions staff app guide (no fake queue)', () => {
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

test('ALREADY_CHECKED_IN still admits (known result, not new check-in)', () => {
  const again = decideGateConfirm({
    status: 409,
    json: { code: 'ALREADY_CHECKED_IN', message: 'Đã vào.', ticketId: 't1', checkinId: 'c1' },
    timedOut: false,
    networkError: false,
  });
  assert.equal(again.kind, 'admit');
});

test('presentGateDecision titles match PD §2.4 (no queued on web)', () => {
  assert.equal(presentGateDecision(null).title, 'Chờ mã vé');
  assert.equal(
    presentGateDecision({ kind: 'admit', ticketId: 't', checkinId: 'c', message: 'Đã ghi nhận check-in. Cho vào.' })
      .title,
    'Cho vào',
  );
  assert.equal(
    presentGateDecision({
      kind: 'admit',
      ticketId: 't',
      checkinId: 'c',
      message: 'Vé đã có check-in hiện hành. Cho qua theo kết quả đã có — không tạo lượt mới.',
    }).kind,
    'already-checked-in',
  );
  assert.equal(
    presentGateDecision({ kind: 'deny', code: 'REVOKED', message: 'Thu hồi.' }).title,
    'Không cho vào',
  );
  const unknown = presentGateDecision({ kind: 'unknown', message: 'Chưa rõ.' });
  assert.equal(unknown.title, 'Chưa rõ — không cho vào');
  assert.equal(unknown.assertive, true);
  assert.equal(unknown.tone, 'unknown');

  const blocked = presentGateDecision(BLOCKED_OFFLINE_DECISION);
  assert.equal(blocked.kind, 'offline-blocked');
  assert.equal(blocked.title, 'Cổng web offline');
});

test('connectivityLabel and shortId helpers', () => {
  assert.equal(connectivityLabel('online'), 'Trực tuyến');
  assert.equal(connectivityLabel('offline'), 'Web · offline');
  assert.equal(connectivityLabel('degraded'), 'Web · API suy giảm');
  assert.equal(shortId(''), '—');
  assert.equal(shortId('abcdefghij'), 'abcdefgh…');
});
