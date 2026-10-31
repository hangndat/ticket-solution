import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startWalletFocusRefresh } from './wallet-focus-refresh.ts';

test('blurred hydration cannot refresh or clear busy for the next focus', async () => {
  let finish!: () => void;
  const delayed = new Promise<void>((resolve) => { finish = resolve; });
  const events: string[] = [];
  const stop = startWalletFocusRefresh({
    hydrate: async (active) => { await delayed; if (active()) events.push('old cache'); },
    refresh: async () => { events.push('old refresh'); },
    setBusy: (busy) => events.push(`old busy ${busy}`),
  });
  stop();
  startWalletFocusRefresh({
    hydrate: async () => { events.push('new cache'); },
    refresh: async (active) => { if (active()) events.push('new refresh'); },
    setBusy: (busy) => events.push(`new busy ${busy}`),
  });
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['old busy true', 'new busy true', 'new cache', 'new refresh', 'new busy false']);
});
