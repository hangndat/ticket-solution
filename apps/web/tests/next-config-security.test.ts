import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import config from '../next.config';
import { contentSecurityPolicy } from '../next.config';

const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;
const originalApi = env.API_BASE_URL;
const originalIssuer = env.OIDC_ISSUER;

afterEach(() => {
  if (originalNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = originalNodeEnv;
  if (originalApi === undefined) delete env.API_BASE_URL;
  else env.API_BASE_URL = originalApi;
  if (originalIssuer === undefined) delete env.OIDC_ISSUER;
  else env.OIDC_ISSUER = originalIssuer;
});

describe('contentSecurityPolicy', () => {
  it('disables shared caching for host-dependent routes', async () => {
    const rules = await config.headers?.();
    for (const source of [
      '/',
      '/auth',
      '/api/auth/:path*',
      '/robots.txt',
      '/sitemap.xml',
      '/api/marketing/events',
    ]) {
      const rule = rules?.find((entry) => entry.source === source);
      assert.equal(
        rule?.headers.find((header) => header.key.toLowerCase() === 'cache-control')?.value,
        'private, no-store',
        source,
      );
    }
  });

  it('includes frame-ancestors none and nosniff-related directives', () => {
    env.NODE_ENV = 'production';
    const csp = contentSecurityPolicy();
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.doesNotMatch(csp, /unsafe-eval/);
  });

  it('allows unsafe-eval only in development', () => {
    env.NODE_ENV = 'development';
    assert.match(contentSecurityPolicy(), /unsafe-eval/);
  });

  it('adds API and OIDC origins to connect-src when configured', () => {
    env.NODE_ENV = 'production';
    env.API_BASE_URL = 'https://api.vemoki.com/v1';
    env.OIDC_ISSUER = 'https://auth.vemoki.com/realms/vemoki';
    const csp = contentSecurityPolicy();
    assert.match(csp, /connect-src[^;]*https:\/\/api\.vemoki\.com/);
    assert.match(csp, /connect-src[^;]*https:\/\/auth\.vemoki\.com/);
  });
});

describe('next.config headers()', () => {
  it('emits static security headers (CSP is runtime via proxy.ts)', async () => {
    const routes = await config.headers!();
    const security = routes.find((route) => route.source === '/:path*');
    assert.ok(security);
    const keys = new Set(security.headers.map((h) => h.key));
    assert.ok(!keys.has('Content-Security-Policy'));
    assert.ok(keys.has('X-Content-Type-Options'));
    assert.ok(keys.has('Referrer-Policy'));
    assert.ok(keys.has('Permissions-Policy'));
    for (const source of ['/wallet', '/t/:tenantSlug/tickets/:ticketId']) {
      const route = routes.find((entry) => entry.source === source);
      assert.ok(route);
      assert.match(route.headers.find((header) => header.key === 'Cache-Control')?.value ?? '', /private, no-store/);
    }
  });
});
