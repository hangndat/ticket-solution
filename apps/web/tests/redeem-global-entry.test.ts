import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isGlobalRedeemEntryEnabled,
  isTenantBoundRedeemQuery,
  globalRedeemEntryEnabled,
} from '../src/redeem/global-entry';

test('global entry flag is off unless NEXT_PUBLIC_SINGLE_CODE_RESOLVE=1', () => {
  const prev = process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE;
  process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE = '0';
  assert.equal(isGlobalRedeemEntryEnabled(), false);
  process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE = '1';
  assert.equal(isGlobalRedeemEntryEnabled(), true);
  if (prev === undefined) delete process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE;
  else process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE = prev;
});

test('tenant-bound query disables global entry', () => {
  process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE = '1';
  assert.equal(isTenantBoundRedeemQuery({ tenantId: '  ' }), false);
  assert.equal(
    isTenantBoundRedeemQuery({ eventSlug: 'demo' }),
    true,
  );
  assert.equal(
    globalRedeemEntryEnabled({ tenantSlug: 'org' }),
    false,
  );
  assert.equal(globalRedeemEntryEnabled({}), true);
  delete process.env.NEXT_PUBLIC_SINGLE_CODE_RESOLVE;
});
