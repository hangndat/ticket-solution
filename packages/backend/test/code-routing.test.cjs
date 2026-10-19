'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRedemptionCodeInput,
  routingFingerprint,
  routingKeyFromFingerprint,
  digestAliasesForCode,
  signResolveToken,
  verifyResolveToken,
} = require('../dist/index.js');

test('normalizeRedemptionCodeInput trims and uppercases', () => {
  assert.equal(normalizeRedemptionCodeInput('  ab-cd  '), 'AB-CD');
});

test('routing fingerprint is stable', () => {
  const fp = routingFingerprint('test-pepper-secret-ok!!', 'ABC');
  const key = routingKeyFromFingerprint(fp);
  assert.match(key, /^pf:[a-f0-9]{64}$/);
});

test('digest aliases cover all configured peppers', () => {
  const peppers = [
    { version: 1, pepper: 'pepper-one-16-chars-min!' },
    { version: 2, pepper: 'pepper-two-16-chars-min!' },
  ];
  const aliases = digestAliasesForCode(peppers, 'code1');
  assert.equal(aliases.length, 2);
  assert.notEqual(aliases[0].hmac, aliases[1].hmac);
});

test('resolve token round-trip', () => {
  const secret = 'resolve-token-secret-min-len';
  const { token } = signResolveToken(secret, {
    actorUserId: '00000000-0000-4000-8000-000000000001',
    routingGroupId: '00000000-0000-4000-8000-000000000002',
    tenantId: '00000000-0000-4000-8000-000000000003',
    eventId: '00000000-0000-4000-8000-000000000004',
    routedCodeId: '00000000-0000-4000-8000-000000000005',
  });
  const claims = verifyResolveToken(secret, token);
  assert.ok(claims);
  assert.equal(claims.actorUserId, '00000000-0000-4000-8000-000000000001');
});
