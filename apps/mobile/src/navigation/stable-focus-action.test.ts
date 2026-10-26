import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
// @ts-expect-error react-test-renderer has no bundled declaration in this app.
import TestRenderer, { act } from 'react-test-renderer';
import { useStableFocusAction } from './stable-focus-action.ts';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('rerender keeps focus callback stable and next focus uses current workspace action', async () => {
  const calls: string[] = [];
  const callbacks: (() => void)[] = [];
  function Probe({ action }: { action: () => Promise<void> }) {
    callbacks.push(useStableFocusAction(action));
    return null;
  }
  const first = async () => { calls.push('first'); };
  const second = async () => { calls.push('second'); };
  let renderer!: ReturnType<typeof TestRenderer.create>;
  await act(async () => { renderer = TestRenderer.create(React.createElement(Probe, { action: first })); });
  await act(async () => { renderer.update(React.createElement(Probe, { action: second })); });

  assert.equal(callbacks.length, 2);
  assert.equal(callbacks[0], callbacks[1]);
  assert.deepEqual(calls, []);
  await act(async () => { callbacks[1]!(); });
  assert.deepEqual(calls, ['second']);
  await act(async () => { renderer.unmount(); });
});
