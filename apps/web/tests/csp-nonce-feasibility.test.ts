import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { contentSecurityPolicy } from '../next.config';

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = originalNodeEnv;
});

/**
 * Issue #653 — evidence that nonce CSP is deferred (not a regression test).
 * Next 16 App Router emits inline scripts for hydration; static `headers()` CSP
 * cannot attach per-request nonces without rewriting `proxy.ts`, root layout,
 * and all script surfaces. Removing `'unsafe-inline'` without that wiring breaks prod.
 */
describe('CSP nonce feasibility (#653)', () => {
  it('keeps portal-aligned unsafe-inline until per-request nonce wiring exists', () => {
    env.NODE_ENV = 'production';
    const csp = contentSecurityPolicy();
    assert.match(csp, /script-src 'self' 'unsafe-inline'/);
    assert.match(csp, /style-src 'self' 'unsafe-inline'/);
    assert.doesNotMatch(csp, /nonce-/);
    assert.doesNotMatch(csp, /strict-dynamic/);
  });
});
