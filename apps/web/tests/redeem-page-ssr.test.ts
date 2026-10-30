import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const redeemDir = join(process.cwd(), 'app/(consumer)/redeem');

test('redeem-auth-gate exposes stable SSR marker (PR #722 nit)', () => {
  const gate = readFileSync(join(redeemDir, 'redeem-auth-gate.tsx'), 'utf8');
  assert.match(gate, /data-testid="redeem-auth-gate"/);
  assert.match(gate, /data-testid="redeem-global-code"/);
  assert.match(gate, /copy\.oidcDownTitle/);
});

test('redeem page stays force-dynamic and wires guest auth gate', () => {
  const page = readFileSync(join(redeemDir, 'page.tsx'), 'utf8');
  assert.match(page, /export const dynamic = 'force-dynamic'/);
  assert.match(page, /readSubject\(\)/);
  assert.match(page, /<\s*RedeemAuthGate/);
  assert.match(page, /<\s*RedeemVerifiedBoundary/);
  assert.match(page, /tenantBound/);
});
