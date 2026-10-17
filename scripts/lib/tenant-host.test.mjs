import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTenantHostAllowlist,
  resolveTenantHost,
  publicContentCacheKey,
  hostOnlySessionCookieOptions,
  assertHostOnlyCookie,
  assertPathTenantMatchesHost,
  tenantSubdomainPattern,
} from './tenant-host.mjs';

const ROOT = 'vemoki.com';

describe('tenant-host allowlist', () => {
  const allow = buildTenantHostAllowlist({
    rootDomain: ROOT,
    tenantSlugs: ['mfest', 'northline'],
  });

  it('resolves canonical subdomain', () => {
    const r = resolveTenantHost('mfest.vemoki.com', allow, { rootDomain: ROOT });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.tenantSlug, 'mfest');
      assert.equal(r.canonicalHost, 'mfest.vemoki.com');
    }
  });

  it('strips port for local-style hosts on allowlist', () => {
    const local = buildTenantHostAllowlist({
      rootDomain: 'localhost',
      tenantSlugs: [],
      extraBindings: [{ tenantSlug: 'mfest', canonicalHost: 'mfest.localhost' }],
    });
    const r = resolveTenantHost('mfest.localhost:3000', local, { rootDomain: 'localhost' });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.tenantSlug, 'mfest');
  });

  it('rejects apex and unknown host (no Host spoof)', () => {
    assert.equal(
      resolveTenantHost('vemoki.com', allow, { rootDomain: ROOT }).ok,
      false,
    );
    assert.equal(
      resolveTenantHost('evil.example.com', allow, { rootDomain: ROOT }).reason,
      'host_not_allowlisted',
    );
    assert.equal(
      resolveTenantHost('not-a-tenant.vemoki.com', allow, { rootDomain: ROOT }).ok,
      false,
    );
  });

  it('pattern matches only single-label subdomain', () => {
    const re = tenantSubdomainPattern(ROOT);
    assert.ok(re.test('acme.vemoki.com'));
    assert.equal(re.test('a.b.vemoki.com'), false);
  });
});

describe('public cache key isolation', () => {
  it('differs by tenant, version, locale, host', () => {
    const base = {
      canonicalHost: 'mfest.vemoki.com',
      tenantSlug: 'mfest',
      eventSlug: 'gala',
      publishedVersion: 3,
      schemaVersion: 1,
      locale: 'vi',
    };
    const a = publicContentCacheKey(base);
    const b = publicContentCacheKey({ ...base, tenantSlug: 'northline', canonicalHost: 'northline.vemoki.com' });
    const c = publicContentCacheKey({ ...base, publishedVersion: 4 });
    const d = publicContentCacheKey({ ...base, locale: 'en' });
    assert.notEqual(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
    assert.equal(a.includes('cookie'), false);
  });
});

describe('host-only cookies', () => {
  it('omits Domain so session is not tenant-wide', () => {
    const opts = hostOnlySessionCookieOptions({ secure: true });
    assert.equal(Object.hasOwn(opts, 'domain'), false);
    assert.deepEqual(assertHostOnlyCookie(opts), { ok: true });
  });

  it('rejects shared parent Domain', () => {
    const bad = { ...hostOnlySessionCookieOptions(), domain: '.vemoki.com' };
    assert.equal(assertHostOnlyCookie(bad).reason, 'domain_attribute_forbidden');
  });
});

describe('path vs host tenant', () => {
  it('blocks cross-tenant path under wrong host', () => {
    assert.equal(
      assertPathTenantMatchesHost('northline', 'mfest').ok,
      false,
    );
    assert.deepEqual(assertPathTenantMatchesHost('mfest', 'mfest'), {
      ok: true,
    });
  });
});
