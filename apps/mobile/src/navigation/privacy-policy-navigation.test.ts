import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRIVACY_DISMISS_FALLBACK_PATH,
  resolvePrivacyDismissAction,
} from './privacy-policy-navigation.ts';

test('privacy dismiss uses back when stack allows', () => {
  assert.deepEqual(resolvePrivacyDismissAction(true), { kind: 'back' });
});

test('privacy dismiss falls back to account tab when no back stack', () => {
  assert.deepEqual(resolvePrivacyDismissAction(false), {
    kind: 'replace',
    pathname: PRIVACY_DISMISS_FALLBACK_PATH,
  });
});
