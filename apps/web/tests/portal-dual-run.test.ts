import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  decideAdminToPortalRedirect,
  filterMigrationSearch,
  isAdminToPortalRedirectEnabled,
  isDualRunBannerEnabled,
  portalHref,
  portalOriginFromEnv,
} from '../src/portal/dual-run';

const portal = 'http://127.0.0.1:3013';

describe('portal dual-run redirect (ADR-20 §8 / #438)', () => {
  test('flag default OFF — legacy admin not redirected', () => {
    assert.equal(
      isAdminToPortalRedirectEnabled({ PORTAL_ORIGIN: portal }),
      false,
    );
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/admin',
        search: '?tenantId=t1',
        env: { PORTAL_ORIGIN: portal },
      }),
      { type: 'next' },
    );
  });

  test('T1: flag ON GET /admin keeps allowlisted query on portal host', () => {
    const env = {
      PORTAL_ORIGIN: portal,
      PORTAL_ADMIN_REDIRECT: '1',
    };
    assert.equal(isAdminToPortalRedirectEnabled(env), true);
    const d = decideAdminToPortalRedirect({
      method: 'GET',
      pathname: '/admin',
      search: '?tenantId=org1&eventId=ev2&evil=https://x',
      env,
    });
    assert.deepEqual(d, {
      type: 'redirect',
      location: `${portal}/admin?tenantId=org1&eventId=ev2`,
      status: 302,
    });
  });

  test('HEAD /platform also redirects when flag ON', () => {
    const d = decideAdminToPortalRedirect({
      method: 'HEAD',
      pathname: '/platform',
      env: { PORTAL_ORIGIN: portal, PORTAL_ADMIN_REDIRECT: 'true' },
    });
    assert.equal(d.type, 'redirect');
    if (d.type === 'redirect') {
      assert.equal(d.location, `${portal}/platform`);
    }
  });

  test('T2: flag OFF even with PORTAL_ORIGIN', () => {
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/admin',
        enabled: false,
        portalOrigin: portal,
      }),
      { type: 'next' },
    );
  });

  test('does not redirect POST/PUT/PATCH or BFF paths', () => {
    const env = { PORTAL_ORIGIN: portal, PORTAL_ADMIN_REDIRECT: '1' };
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.deepEqual(
        decideAdminToPortalRedirect({
          method,
          pathname: '/admin',
          env,
        }),
        { type: 'next' },
      );
    }
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/api/bff/admin/tickets',
        env,
      }),
      { type: 'next' },
    );
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'POST',
        pathname: '/api/bff/admin/publish',
        env,
      }),
      { type: 'next' },
    );
  });

  test('T8: /gate never redirects to portal', () => {
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/gate',
        search: '?tenantId=t1',
        env: { PORTAL_ORIGIN: portal, PORTAL_ADMIN_REDIRECT: '1' },
      }),
      { type: 'next' },
    );
  });

  test('T3: open-redirect / unsafe query dropped', () => {
    assert.equal(
      filterMigrationSearch('?return=https://evil&next=//evil&tenantId=ok'),
      '?tenantId=ok',
    );
    assert.equal(
      filterMigrationSearch('?tenantId=../x&eventId=good'),
      '?eventId=good',
    );
    assert.equal(portalOriginFromEnv({ PORTAL_ORIGIN: 'not a url' }), null);
    assert.equal(
      portalOriginFromEnv({ PORTAL_ORIGIN: 'https://user:pass@evil.test' }),
      null,
    );
    // Flag ON without valid origin → treat as disabled
    assert.equal(
      isAdminToPortalRedirectEnabled({
        PORTAL_ADMIN_REDIRECT: '1',
        PORTAL_ORIGIN: 'javascript:alert(1)',
      }),
      false,
    );
  });

  test('banner independent of redirect flag', () => {
    assert.equal(
      isDualRunBannerEnabled({ PORTAL_ORIGIN: portal }),
      true,
    );
    assert.equal(
      isDualRunBannerEnabled({
        PORTAL_ORIGIN: portal,
        PORTAL_DUAL_RUN_BANNER: '0',
      }),
      false,
    );
    assert.equal(isDualRunBannerEnabled({}), false);
    assert.equal(
      portalHref('/admin', '?tenantId=t1&token=secret', {
        PORTAL_ORIGIN: portal,
      }),
      `${portal}/admin?tenantId=t1`,
    );
  });
});
