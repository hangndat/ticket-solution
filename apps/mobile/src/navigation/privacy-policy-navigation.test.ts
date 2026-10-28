import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parsePrivacyOrigin,
  privacyPolicyHref,
  resolvePrivacyDismissAction,
} from './privacy-policy-navigation.ts';

test('privacy dismiss goes back when history exists', () => {
  assert.deepEqual(resolvePrivacyDismissAction(true, 'staff'), { kind: 'back' });
});

test('privacy dismiss without history falls back per origin', () => {
  assert.deepEqual(resolvePrivacyDismissAction(false, 'attendee'), {
    kind: 'replace',
    pathname: '/(tabs)/(events)',
  });
  assert.deepEqual(resolvePrivacyDismissAction(false, 'staff'), {
    kind: 'replace',
    pathname: '/staff-account',
  });
});

test('privacy origin param parsing defaults to attendee', () => {
  assert.equal(parsePrivacyOrigin('staff'), 'staff');
  assert.equal(parsePrivacyOrigin(['staff']), 'staff');
  assert.equal(parsePrivacyOrigin(undefined), 'attendee');
  assert.equal(privacyPolicyHref('staff').params.from, 'staff');
});
