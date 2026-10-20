import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import config from '../next.config';
import { contentSecurityPolicy } from '../next.config';

const originalNodeEnv = process.env.NODE_ENV;
const originalApi = process.env.API_BASE_URL;
const originalIssuer = process.env.OIDC_ISSUER;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalApi === undefined) delete process.env.API_BASE_URL;
  else process.env.API_BASE_URL = originalApi;
  if (originalIssuer === undefined) delete process.env.OIDC_ISSUER;
  else process.env.OIDC_ISSUER = originalIssuer;
});

describe('contentSecurityPolicy', () => {
  it('includes frame-ancestors none and nosniff-related directives', () => {
    process.env.NODE_ENV = 'production';
    const csp = contentSecurityPolicy();
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-eval/);
  });

  it('allows unsafe-eval only in development', () => {
    process.env.NODE_ENV = 'development';
    assert.match(contentSecurityPolicy(), /unsafe-eval/);
  });

  it('adds API and OIDC origins to connect-src when configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.API_BASE_URL = 'https://api.vemoki.com/v1';
    process.env.OIDC_ISSUER = 'https://auth.vemoki.com/realms/vemoki';
    const csp = contentSecurityPolicy();
    assert.match(csp, /connect-src[^;]*https:\/\/api\.vemoki\.com/);
    assert.match(csp, /connect-src[^;]*https:\/\/auth\.vemoki\.com/);
  });
});

describe('next.config headers()', () => {
  it('emits CSP and X-Content-Type-Options on all paths', async () => {
    const routes = await config.headers!();
    assert.equal(routes.length, 1);
    assert.equal(routes[0]?.source, '/:path*');
    const keys = new Set(routes[0]?.headers.map((h) => h.key));
    assert.ok(keys.has('Content-Security-Policy'));
    assert.ok(keys.has('X-Content-Type-Options'));
    assert.ok(keys.has('Referrer-Policy'));
    assert.ok(keys.has('Permissions-Policy'));
  });
});
