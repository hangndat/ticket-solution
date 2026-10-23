import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  decideAdminToPortalRedirect,
  filterMigrationSearch,
  isAdminToPortalRedirectEnabled,
  isDualRunBannerEnabled,
  LEGACY_ADMIN_GUEST_TABS,
  LEGACY_ADMIN_JOBS,
  mapLegacyAdminToPortalPath,
  portalHref,
  portalMigrationLocation,
  portalOriginFromEnv,
} from '../src/portal/dual-run';

const portal = 'http://127.0.0.1:3013';
const envOn = { PORTAL_ORIGIN: portal, PORTAL_ADMIN_REDIRECT: '1' };

describe('portal dual-run redirect (ADR-20 §8 / D-7 #846)', () => {
  test('redirect ON when PORTAL_ORIGIN valid (no flag)', () => {
    assert.equal(
      isAdminToPortalRedirectEnabled({ PORTAL_ORIGIN: portal }),
      true,
    );
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/admin',
        search: '?tenantId=t1',
        env: { PORTAL_ORIGIN: portal },
      }),
      {
        type: 'redirect',
        location: `${portal}/t/t1`,
        status: 302,
      },
    );
  });

  test('missing PORTAL_ORIGIN → not_found for /admin GET', () => {
    assert.equal(isAdminToPortalRedirectEnabled({}), false);
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/admin',
        env: {},
      }),
      { type: 'not_found' },
    );
  });

  test('T1: flag ON GET /admin maps allowlisted query to portal paths', () => {
    assert.equal(isAdminToPortalRedirectEnabled(envOn), true);
    assert.deepEqual(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/admin',
        search: '?tenantId=org1&eventId=ev2&evil=https://x',
        env: envOn,
      }),
      {
        type: 'redirect',
        location: `${portal}/t/org1/e/ev2`,
        status: 302,
      },
    );
    assert.equal(
      portalMigrationLocation(portal, '/admin', '?tenantId=tenant-a'),
      `${portal}/t/tenant-a`,
    );
    assert.equal(
      mapLegacyAdminToPortalPath({ pathname: '/admin' }),
      '/',
    );
  });

  test('T1 (#845): each legacy admin job maps to portal event route', () => {
    const base = '?tenantId=t1&eventId=e1';
    const cases: { job: string; path: string }[] = [
      { job: 'setup', path: '/t/t1/e/e1/setup' },
      { job: 'guests', path: '/t/t1/e/e1/guests' },
      { job: 'gate', path: '/t/t1/e/e1/gate' },
      { job: 'support', path: '/t/t1/e/e1/support' },
    ];
    for (const { job, path } of cases) {
      assert.equal(
        mapLegacyAdminToPortalPath({
          pathname: '/admin',
          search: `${base}&job=${job}`,
        }),
        path,
      );
      const d = decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/admin',
        search: `${base}&job=${job}`,
        env: envOn,
      });
      assert.equal(d.type, 'redirect');
      if (d.type === 'redirect') {
        assert.equal(d.location, `${portal}${path}`);
      }
    }
    assert.deepEqual([...LEGACY_ADMIN_JOBS], [
      'setup',
      'guests',
      'gate',
      'support',
    ]);
  });

  test('T1 (#845): guest tabs → portal guests hash', () => {
    for (const tab of LEGACY_ADMIN_GUEST_TABS) {
      const path = mapLegacyAdminToPortalPath({
        pathname: '/admin',
        search: `?tenantId=t1&eventId=e1&job=guests&tab=${tab}`,
      });
      assert.equal(path, `/t/t1/e/e1/guests#${tab}`);
    }
  });

  test('T1 (#845): setup tabs and tenant tabs', () => {
    assert.equal(
      mapLegacyAdminToPortalPath({
        pathname: '/admin',
        search: '?tenantId=t1&eventId=e1&job=setup&tab=config',
      }),
      '/t/t1/e/e1/config',
    );
    assert.equal(
      mapLegacyAdminToPortalPath({
        pathname: '/admin',
        search: '?tenantId=t1&tab=members',
      }),
      '/t/t1/members',
    );
    assert.equal(
      mapLegacyAdminToPortalPath({
        pathname: '/admin',
        search: '?tenantId=t1&intent=create-event',
      }),
      '/t/t1/events/new',
    );
    assert.equal(
      mapLegacyAdminToPortalPath({
        pathname: '/admin',
        search: '?tenantId=t1&intent=onboarding',
      }),
      '/onboarding/t1',
    );
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

  test('explicit enabled:false overrides (tests only)', () => {
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
        env: envOn,
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
    assert.equal(
      isAdminToPortalRedirectEnabled({
        PORTAL_ADMIN_REDIRECT: '1',
        PORTAL_ORIGIN: 'javascript:alert(1)',
      }),
      false,
    );
    assert.equal(
      mapLegacyAdminToPortalPath({
        pathname: '/admin',
        search: '?tenantId=ok&job=not-a-real-job',
      }),
      '/t/ok',
    );
    assert.equal(
      decideAdminToPortalRedirect({
        method: 'GET',
        pathname: '/admin',
        search: '?return=https://evil.test',
        env: envOn,
      }).type,
      'redirect',
    );
    const badHost = decideAdminToPortalRedirect({
      method: 'GET',
      pathname: '/admin',
      env: envOn,
      portalOrigin: 'https://evil.test',
    });
    if (badHost.type === 'redirect') {
      assert.ok(badHost.location.startsWith('https://evil.test/'));
      assert.ok(!badHost.location.includes('return='));
    }
  });

  test('banner independent of redirect flag', () => {
    assert.equal(isDualRunBannerEnabled({ PORTAL_ORIGIN: portal }), true);
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
      `${portal}/t/t1`,
    );
  });
});
