import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fixtureEventRouteAllowedWithCaps,
  fixtureEventRouteAllowed,
  uatSessionRouteAllowedWithCaps,
  uatSessionRouteAllowed,
} from './dev-only-routes.ts';
import { getApiBaseUrl, getRetailBakeCaps } from '../identity/config.ts';

test('uat and fixture routes blocked in Release without baked caps', () => {
  assert.equal(uatSessionRouteAllowedWithCaps({}, false), false);
  assert.equal(fixtureEventRouteAllowedWithCaps({}, false), false);
});

test('uat and fixture routes follow baked caps (not raw env at runtime)', () => {
  assert.equal(
    uatSessionRouteAllowedWithCaps({ allowUatSessionRoutes: true }, false),
    true,
  );
  assert.equal(
    fixtureEventRouteAllowedWithCaps({ allowFixtureEventRoutes: true }, false),
    true,
  );
});

test('dev bundle always allows uat and fixture routes', () => {
  assert.equal(uatSessionRouteAllowedWithCaps({}, true), true);
  assert.equal(fixtureEventRouteAllowedWithCaps({}, true), true);
});

test('production APS blocks both routes before Debug and forged baked caps', () => {
  for (const devBundle of [true, false]) {
    assert.equal(uatSessionRouteAllowedWithCaps({ allowUatSessionRoutes: true }, devBundle, true), false);
    assert.equal(fixtureEventRouteAllowedWithCaps({ allowFixtureEventRoutes: true }, devBundle, true), false);
  }
  assert.equal(uatSessionRouteAllowedWithCaps({}, true, false), true);
  assert.equal(fixtureEventRouteAllowedWithCaps({}, true, false), true);
});

test('runtime production APS rejects routes in a Debug bundle', () => {
  const keys = ['EXPO_PUBLIC_APS_ENVIRONMENT', 'APS_ENVIRONMENT', 'APP_VARIANT', 'EXPO_PUBLIC_ALLOW_UAT_SESSION', 'EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS', 'EXPO_PUBLIC_API_BASE_URL'] as const;
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const priorDev = (globalThis as { __DEV__?: boolean }).__DEV__;
  try {
    process.env.EXPO_PUBLIC_APS_ENVIRONMENT = 'production';
    process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION = 'true';
    process.env.EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS = '1';
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://127.0.0.1:3009';
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    assert.equal(getApiBaseUrl(), 'https://api.vemoki.com');
    assert.deepEqual(getRetailBakeCaps(), {
      allowLocalFixtureApi: false,
      allowUatSessionRoutes: false,
      allowFixtureEventRoutes: false,
    });
    assert.equal(uatSessionRouteAllowed(), false);
    assert.equal(fixtureEventRouteAllowed(), false);
    process.env.EXPO_PUBLIC_APS_ENVIRONMENT = 'development';
    process.env.APP_VARIANT = 'production';
    assert.equal(getApiBaseUrl(), 'https://api.vemoki.com');
    assert.equal(uatSessionRouteAllowed(), false);
    assert.equal(fixtureEventRouteAllowed(), false);
  } finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key];
      else process.env[key] = prior[key];
    }
    (globalThis as { __DEV__?: boolean }).__DEV__ = priorDev;
  }
});
