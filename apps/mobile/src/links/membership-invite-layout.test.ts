import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inviteFooterLift } from './membership-invite-layout.ts';

test('invite footer clears the accessory when focus does not raise the software keyboard', () => {
  assert.equal(inviteFooterLift(0, false, 32), 0);
  assert.equal(inviteFooterLift(0, true, 32), 32);
  assert.equal(inviteFooterLift(300, true, 32), 300);
  assert.equal(inviteFooterLift(300, false, 32), 300);
});
