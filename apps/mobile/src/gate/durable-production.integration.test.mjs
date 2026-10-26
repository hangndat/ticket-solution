import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://api.test';
const nodeRequire = createRequire(import.meta.url);
globalThis.require = (name) => name === 'expo-notifications'
  ? { setBadgeCountAsync: async () => true, getDevicePushTokenAsync: async () => ({ data: 'synthetic' }) }
  : nodeRequire(name);

const bytes = globalThis.__f02SecureBytes ??= new Map();
const { session } = await import('../identity/session.ts');
const { verifyViaMe } = await import('../identity/fetch-me.ts');
const { StaffGateWorkspaceProvider, useStaffGateWorkspace } = await import('./staff-gate-workspace-context.tsx');
const { offlineScanQueue } = await import('./offline-queue-session.ts');
const { staffEligibility } = await import('../identity/staff-eligibility.ts');
const { useStaffWorkspace } = await import('../navigation/use-staff-workspace.ts');
const { logoutAndClearWalletArtifacts } = await import('../tickets/wallet-logout.ts');
const { registerApnsDeviceToken } = await import('../push/apns-device-token.ts');

let unreachableA = false;
let replayRevoked = false;
let replayPostCount = 0;
const deletedRegistrations = [];
globalThis.fetch = async (url, init) => {
  const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '');
  if (String(url).endsWith('/v1/me')) {
    if (token === 'A-token' && unreachableA) return new Response(null, { status: 503 });
    return Response.json({ userId: token?.slice(0, 1) ?? 'A' });
  }
  if (String(url).endsWith('/v1/me/events')) {
    return Response.json({ staffEligible: !replayRevoked, items: replayRevoked ? [] : [
      { tenantId: 'tenant', eventId: 'event', name: 'Event', permissions: ['gate.confirm'] },
    ] });
  }
  if (init?.method === 'POST' && String(url).endsWith('/offline-sync')) {
    replayPostCount += 1;
    if (replayRevoked) {
      return Response.json({ code: 'MEMBERSHIP_REVOKED', retryable: false }, { status: 403 });
    }
    throw new Error('unexpected offline replay before revoke');
  }
  if (init?.method === 'POST' && String(url).endsWith('/v1/me/device-tokens')) {
    return Response.json({ registrationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      environment: 'sandbox', registeredAt: '2026-10-24T00:00:00.000Z' });
  }
  if (init?.method === 'DELETE') {
    deletedRegistrations.push({ id: String(url).split('/').at(-1), bearer: token });
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 404 });
};

let latest;
let staffChromeVisible;
function Probe() {
  latest = useStaffGateWorkspace();
  staffChromeVisible = useStaffWorkspace();
  return React.createElement('Probe', { ready: latest.ready, historyCount: latest.deviceHistory.length });
}
const tree = () => React.createElement(StaffGateWorkspaceProvider, { active: true }, React.createElement(Probe));
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); }); };

test('production session + provider + logout: A unknown/remount B stays closed until bind and purges A', async () => {
  bytes.set('app:ticket.gate.workspace.v2.A', JSON.stringify({
    v: 2, selected: { tenantId: 'tenant', eventId: 'event', name: 'A event' },
    sessionsByScope: {}, opsByScope: {},
  }));
  bytes.set('app:ticket.gate.workspace.v2.B', JSON.stringify({
    v: 2, selected: { tenantId: 'tenant', eventId: 'event', name: 'B event' },
    sessionsByScope: {}, opsByScope: {},
  }));
  let renderer;
  await act(async () => { renderer = TestRenderer.create(tree()); });
  await act(async () => { await session.establish('A-token', verifyViaMe); });
  await flush();
  assert.equal(session.getSnapshot().status, 'verified');
  assert.equal(latest?.ready, true);
  assert.equal(latest?.gateScope?.eventId, 'event');
  const apns = await registerApnsDeviceToken({ session, platform: 'ios', fetchImpl: globalThis.fetch,
    notifications: { getDevicePushTokenAsync: async () => ({ data: 'synthetic-token' }),
      setBadgeCountAsync: async () => true }, resolveEnvironment: () => 'sandbox' });
  assert.equal(apns.status, 'ready');
  unreachableA = true;
  await act(async () => { await session.restore(verifyViaMe); });
  await flush();
  assert.equal(latest?.gateScope, null);
  await act(async () => { renderer.unmount(); });
  let releaseB;
  globalThis.__f02HoldBLoad = new Promise((resolve) => { releaseB = resolve; });
  await act(async () => { renderer = TestRenderer.create(tree()); });
  await act(async () => { await session.establish('B-token', verifyViaMe); });
  await flush();
  assert.ok(deletedRegistrations.some((item) =>
    item.id === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' && item.bearer === 'A-token'));
  assert.equal(bytes.has('app:ticket.gate.workspace.v2.A'), false);
  assert.equal(latest?.gateScope, null);
  await act(async () => {
    latest.setEventPickerOpen(true);
    latest.selectGateScope({ tenantId: 'tenant', eventId: 'event', name: 'wrong' });
    latest.handleCameraScan('not-a-ticket');
    latest.dismissPendingAction();
    await Promise.all([
      latest.submitScan('not-a-ticket'), latest.reconcile(), latest.syncNow(),
      latest.focusSync(), latest.importKnownOperation('not-an-id'),
      latest.refreshGateEvents(), latest.logoutStaff(),
    ]);
  });
  assert.equal(latest?.gateScope, null);
  assert.equal(session.getSnapshot().status, 'verified');
  assert.equal(bytes.has('app:ticket.gate.workspace.v2.B'), false);
  releaseB();
  globalThis.__f02HoldBLoad = null;
  await flush();
  assert.equal(latest?.ready, true);
  assert.equal(latest?.gateScope?.eventId, 'event');
  await act(async () => { await logoutAndClearWalletArtifacts({ userId: 'B', tenantId: 'tenant' }); });
  await flush();
  assert.equal(bytes.has('app:ticket.gate.workspace.v2.B'), false);
  assert.equal(latest?.gateScope, null);
  await act(async () => { renderer.unmount(); });
});

test('production verified hook and logout remain closed on intent, readback, commit and delete failures', async () => {
  bytes.set('app:ticket.gate.workspace.v2.A', JSON.stringify({ v: 2, selected: null, sessionsByScope: {}, opsByScope: {} }));
  bytes.set('app:ticket.gate.workspace.v2.C', JSON.stringify({ v: 2, selected: null, sessionsByScope: {}, opsByScope: {} }));
  let renderer;
  await act(async () => { renderer = TestRenderer.create(tree()); });
  globalThis.__f02SecureFault = (operation, name) => {
    if (operation === 'write' && name === 'ticket.gate.identity-owner.v1') throw new Error('intent failed');
  };
  await assert.rejects(async () => { await act(async () => { await session.establish('C-token', verifyViaMe); }); }, /Không thể chuẩn bị dữ liệu cổng/);
  assert.notEqual(session.getSnapshot().status, 'verified');
  assert.equal(latest?.gateScope, null);
  assert.equal(bytes.has('app:ticket.gate.workspace.v2.A'), true);
  globalThis.__f02SecureFault = (operation, name) => {
    if (operation === 'read' && name === 'ticket.gate.identity-owner.v1') throw new Error('readback failed');
  };
  await assert.rejects(async () => { await act(async () => { await session.establish('C-token', verifyViaMe); }); }, /Không thể chuẩn bị dữ liệu cổng/);
  assert.notEqual(session.getSnapshot().status, 'verified');
  globalThis.__f02SecureFault = null;
  await act(async () => { await session.establish('C-token', verifyViaMe); });
  await flush();
  assert.equal(session.getSnapshot().status, 'verified');
  assert.equal(bytes.has('app:ticket.gate.workspace.v2.A'), false);
  globalThis.__f02SecureFault = (operation, name) => {
    if (operation === 'delete' && name === 'ticket.gate.workspace.v2.C') throw new Error('delete failed');
  };
  await assert.rejects(async () => { await act(async () => { await logoutAndClearWalletArtifacts({ userId: 'C', tenantId: 'tenant' }); }); }, /Chưa thể hoàn tất dọn dẹp đăng xuất/);
  await flush();
  assert.equal(latest?.gateScope, null);
  assert.equal(bytes.has('app:ticket.gate.workspace.v2.C'), true);
  globalThis.__f02SecureFault = null;
  await act(async () => { await logoutAndClearWalletArtifacts({ userId: 'C', tenantId: 'tenant' }); });
  assert.equal(bytes.has('app:ticket.gate.workspace.v2.C'), false);
  bytes.set('app:ticket.gate.workspace.v2.D', JSON.stringify({ v: 2, selected: null, sessionsByScope: {}, opsByScope: {} }));
  globalThis.__f02SecureFault = (operation, name, value) => {
    if (operation === 'write' && name === 'ticket.gate.identity-owner.v1' &&
        JSON.parse(value).lastVerifiedUserId === 'D') throw new Error('commit failed');
  };
  await assert.rejects(async () => { await act(async () => { await session.establish('D-token', verifyViaMe); }); }, /Không thể chuẩn bị dữ liệu cổng/);
  assert.notEqual(session.getSnapshot().status, 'verified');
  globalThis.__f02SecureFault = null;
  await act(async () => { await session.establish('D-token', verifyViaMe); });
  assert.equal(session.getSnapshot().status, 'verified');
  await assert.rejects(logoutAndClearWalletArtifacts({ userId: 'A', tenantId: 'tenant' }), /Phiên tài khoản đã đổi/);
  assert.equal(session.getSnapshot().status, 'verified');
  await act(async () => { renderer.unmount(); });
  globalThis.__f02SecureFault = (operation, name) => {
    if (operation === 'read' && name === 'ticket.gate.workspace.v2.D') throw new Error('workspace read failed');
  };
  await act(async () => { renderer = TestRenderer.create(tree()); });
  await flush();
  assert.equal(latest?.ready, false);
  assert.match(latest?.gateEventsError ?? '', /Vui lòng thử lại/);
  globalThis.__f02SecureFault = null;
  await act(async () => { await latest.refreshGateEvents(); });
  await flush();
  assert.equal(latest?.ready, true);
  await act(async () => { renderer.unmount(); });
});

test('active Staff pending queue + membership revoke + sync hides chrome without ticket rejection', async () => {
  const scope = { tenantId: 'tenant', eventId: 'event', name: 'Event' };
  const gateSessionId = '44444444-4444-4444-8444-444444444444';
  bytes.set('app:ticket.gate.workspace.v2.E', JSON.stringify({
    v: 2,
    selected: scope,
    sessionsByScope: { 'tenant::event': gateSessionId },
    opsByScope: {},
  }));
  replayRevoked = false;
  replayPostCount = 0;
  let renderer;
  await act(async () => { renderer = TestRenderer.create(tree()); });
  await act(async () => { await session.establish('E-token', verifyViaMe); });
  await flush();
  await act(async () => { await staffEligibility.refresh(session); });
  assert.equal(latest?.ready, true);
  assert.equal(latest?.sessionId, gateSessionId);
  assert.equal(staffChromeVisible, true);

  await act(async () => {
    await offlineScanQueue.enqueue({
      ticketId: '11111111-1111-4111-8111-111111111111',
      tenantId: scope.tenantId,
      eventId: scope.eventId,
      staffSessionId: gateSessionId,
    });
  });
  assert.equal(latest?.queueSnap.pendingCount, 1);

  replayRevoked = true;
  await act(async () => { await latest.syncNow(); });
  await flush();
  assert.equal(replayPostCount, 1);
  assert.equal(staffEligibility.getSnapshot().staffEligible, false);
  assert.equal(staffChromeVisible, false);
  assert.equal(offlineScanQueue.getSnapshot().items[0]?.localStatus, 'pending');
  assert.equal(offlineScanQueue.getSnapshot().conflictCount, 0);
  assert.equal(latest?.ops.some((op) => op.phase === 'admitted'), false);
  await act(async () => { renderer.unmount(); });
  replayRevoked = false;
});
