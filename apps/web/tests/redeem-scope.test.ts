import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRedeemScope } from '../src/redeem/redeem-scope';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';

test('validateRedeemScope accepts trimmed UUID scope', () => {
  assert.equal(validateRedeemScope(`  ${TENANT_ID}  `, EVENT_ID), null);
});

test('validateRedeemScope blocks empty tenantId before BFF', () => {
  const issue = validateRedeemScope('', EVENT_ID);
  assert.ok(issue);
  assert.equal(issue?.fieldId, 'tenantId');
});

test('validateRedeemScope blocks malformed UUIDs', () => {
  const tenant = validateRedeemScope('org-slug', EVENT_ID);
  assert.equal(tenant?.fieldId, 'tenantId');
  const event = validateRedeemScope(TENANT_ID, 'event-slug');
  assert.equal(event?.fieldId, 'eventId');
});
