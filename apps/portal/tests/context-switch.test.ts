import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextRequestGate } from '../src/nav/context-request-gate';
import {
  eventSwitchDestination,
  tenantSwitchDestination,
} from '../src/nav/context-destination';
import {
  confirmDiscardIfDirty,
  registerDirtyForm,
} from '../src/nav/unsaved-changes';

test('late response from previous context cannot replace the newer selection', async () => {
  const gate = createContextRequestGate();
  let finishOld!: (value: string) => void;
  const oldResponse = new Promise<string>((resolve) => {
    finishOld = resolve;
  });
  let selection = '';
  const old = gate.begin('tenant-a/event-a');
  const oldUpdate = oldResponse.then((value) => {
    if (old.isCurrent()) selection = value;
  });
  const current = gate.begin('tenant-b/event-b');
  if (current.isCurrent()) selection = 'tenant-b';
  finishOld('tenant-a');
  await oldUpdate;
  assert.equal(selection, 'tenant-b');
});

test('switch keeps an allowed event subroute and reports a denied fallback', () => {
  const event = { tenantId: 'b', eventId: 'e2', permissions: ['event.config'] };
  assert.deepEqual(eventSwitchDestination('/t/a/e/e1/types', event), {
    path: '/t/b/e/e2/types',
    preserved: true,
  });
  assert.deepEqual(eventSwitchDestination('/t/a/e/e1/support', event), {
    path: '/t/b/e/e2/guests',
    preserved: false,
  });
});

test('tenant switch keeps an allowed org subroute, or finds matching event section', () => {
  const tenant = { tenantId: 'b', tenantPermissions: ['members.manage'] };
  const events = [{ tenantId: 'b', eventId: 'e2', permissions: ['cs.lookup'] }];
  assert.deepEqual(tenantSwitchDestination('/t/a/members', tenant, events), {
    path: '/t/b/members',
    preserved: true,
  });
  assert.deepEqual(
    tenantSwitchDestination('/t/a/e/e1/support', tenant, events),
    { path: '/t/b/e/e2/support', preserved: true },
  );
  assert.deepEqual(tenantSwitchDestination('/t/a/settings', tenant, events), {
    path: '/t/b',
    preserved: false,
  });
  assert.deepEqual(
    tenantSwitchDestination('/t/a', { tenantId: 'b', tenantPermissions: [] }, [
      { tenantId: 'b', eventId: 'e2', permissions: ['report.read'] },
    ]),
    { path: '/t/b', preserved: true },
  );
});

test('dirty form asks before a context switch and clears after save or unmount', () => {
  const previousWindow = globalThis.window;
  let asked = 0;
  globalThis.window = {
    confirm: () => {
      asked += 1;
      return false;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as Window & typeof globalThis;
  try {
    const unregister = registerDirtyForm('Unsaved changes');
    assert.equal(confirmDiscardIfDirty(), false);
    assert.equal(asked, 1);
    unregister();
    assert.equal(confirmDiscardIfDirty(), true);
    assert.equal(asked, 1);
  } finally {
    globalThis.window = previousWindow;
  }
});
