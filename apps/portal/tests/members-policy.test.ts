import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eventAssignmentRoleAllowed,
  isLastOwnerError,
} from '../src/ops/members-policy';

test('last-Owner is a distinct, user-facing error', () => {
  assert.equal(isLastOwnerError('LAST_OWNER_REQUIRED'), true);
  assert.equal(isLastOwnerError('PERMISSION_DENIED'), false);
  assert.equal(isLastOwnerError(null), false);
});

test('event assignment rejects Owner and unknown roles', () => {
  assert.equal(eventAssignmentRoleAllowed('Manager'), true);
  assert.equal(eventAssignmentRoleAllowed('Scanner'), true);
  assert.equal(eventAssignmentRoleAllowed('Owner'), false);
  assert.equal(eventAssignmentRoleAllowed('Custom'), false);
});
