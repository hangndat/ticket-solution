import assert from 'node:assert/strict';
import test from 'node:test';
import { createContextRequestGate } from '../src/nav/context-request-gate';
import {
  eventSwitchDestination,
  tenantSwitchDestination,
} from '../src/nav/context-destination';
import {
  confirmDiscardIfDirty,
  installUnsavedNavigation,
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

test('cancelling Back and Forward blocks route rendering and restores the entry', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const listeners = new Map<string, EventListener>();
  const moves: number[] = [];
  let prompts = 0;
  const history = {
    state: {} as Record<string, unknown>,
    pushState(data: Record<string, unknown>) {
      this.state = data;
    },
    replaceState(data: Record<string, unknown>) {
      this.state = data;
    },
    go(delta: number) {
      moves.push(delta);
    },
  };
  globalThis.window = {
    history,
    confirm: () => {
      prompts += 1;
      return false;
    },
    addEventListener: (name: string, listener: EventListener) =>
      listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  } as unknown as Window & typeof globalThis;
  globalThis.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as Document;
  let unregister = () => {};
  let uninstall = () => {};
  try {
    uninstall = installUnsavedNavigation();
    const first = history.state;
    window.history.pushState({}, '', '/second');
    const second = history.state;
    const pop = (state: Record<string, unknown>) => {
      let blocked = false;
      listeners.get('popstate')!({
        state,
        stopImmediatePropagation: () => {
          blocked = true;
        },
      } as unknown as PopStateEvent);
      return blocked;
    };
    unregister = registerDirtyForm('Unsaved changes');
    assert.equal(pop(first), true);
    assert.deepEqual(moves, [1]);
    assert.equal(pop(second), true); // restoration must not render or ask again
    assert.equal(prompts, 1);
    unregister();
    assert.equal(pop(first), false); // clean Back is allowed
    unregister = registerDirtyForm('Unsaved changes');
    assert.equal(pop(second), true); // dirty Forward restores in the other direction
    assert.deepEqual(moves, [1, -1]);
    assert.equal(prompts, 2);
  } finally {
    unregister();
    uninstall();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
