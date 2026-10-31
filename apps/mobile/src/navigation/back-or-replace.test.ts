import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBackOrReplace } from './back-or-replace-decision.ts';

test('back when history exists', () => {
  assert.deepEqual(resolveBackOrReplace(true, '/x'), { kind: 'back' });
});

test('replace to fallback when no history', () => {
  assert.deepEqual(resolveBackOrReplace(false, '/staff-account'), {
    kind: 'replace',
    href: '/staff-account',
  });
});
