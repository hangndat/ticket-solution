import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildPortalDeeplink,
  filterPortalDeeplinkSearch,
  isPortalDeeplinkPath,
  isPortalDualRunBannerEnabled,
  portalOriginFromEnv,
} from '../src/dual-run/allowlist';

const portal = 'http://127.0.0.1:3013';

describe('portal deep-link allowlist prep (#438)', () => {
  test('allowlists staff paths; rejects gate and api', () => {
    assert.equal(isPortalDeeplinkPath('/'), true);
    assert.equal(isPortalDeeplinkPath('/admin'), true);
    assert.equal(isPortalDeeplinkPath('/t/abc/e/def'), true);
    assert.equal(isPortalDeeplinkPath('/platform'), true);
    assert.equal(isPortalDeeplinkPath('/auth'), true);
    assert.equal(isPortalDeeplinkPath('/gate'), false);
    assert.equal(isPortalDeeplinkPath('/api/bff/me'), false);
    assert.equal(isPortalDeeplinkPath('//evil.test'), false);
    assert.equal(isPortalDeeplinkPath('/admin/../gate'), false);
  });

  test('filters query to business allowlist', () => {
    assert.equal(
      filterPortalDeeplinkSearch(
        '?tenantId=t1&eventId=e2&return=https://evil&token=x',
      ),
      '?tenantId=t1&eventId=e2',
    );
  });

  test('buildPortalDeeplink uses PORTAL_ORIGIN + allowlist', () => {
    assert.equal(
      buildPortalDeeplink('/admin', '?tenantId=org1&foo=bar', {
        PORTAL_ORIGIN: portal,
      }),
      `${portal}/admin?tenantId=org1`,
    );
    assert.equal(
      buildPortalDeeplink('/gate', undefined, { PORTAL_ORIGIN: portal }),
      null,
    );
    assert.equal(
      buildPortalDeeplink('https://evil.test/admin', undefined, {
        PORTAL_ORIGIN: portal,
      }),
      null,
    );
    assert.equal(portalOriginFromEnv({}), null);
  });

  test('dual-run banner defaults on when PRODUCT_ORIGIN set', () => {
    assert.equal(
      isPortalDualRunBannerEnabled({
        PRODUCT_ORIGIN: 'http://127.0.0.1:3000',
      }),
      true,
    );
    assert.equal(
      isPortalDualRunBannerEnabled({
        PRODUCT_ORIGIN: 'http://127.0.0.1:3000',
        PORTAL_DUAL_RUN_BANNER: '0',
      }),
      false,
    );
  });
});
