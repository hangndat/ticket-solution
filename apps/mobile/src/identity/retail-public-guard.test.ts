import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertApsEnvironmentConsistency,
  assertRetailPublicEnv,
  isNonProductionApiOrigin,
  isTruthyUatSessionFlag,
  resolveApsEnvironment,
  resolveDevelopmentBakeFlags,
} from './retail-public-guard.ts';

test('UAT session flag truthy only for 1 and true', () => {
  assert.equal(isTruthyUatSessionFlag(undefined), false);
  assert.equal(isTruthyUatSessionFlag('0'), false);
  assert.equal(isTruthyUatSessionFlag('1'), true);
  assert.equal(isTruthyUatSessionFlag('true'), true);
});

test('non-production API detects localhost and custom hosts', () => {
  assert.equal(isNonProductionApiOrigin('https://api.vemoki.com'), false);
  assert.equal(isNonProductionApiOrigin('https://api.vemoki.com/'), false);
  assert.equal(isNonProductionApiOrigin('http://127.0.0.1:3001'), true);
});

test('production bake rejects UAT session flag', () => {
  assert.throws(
    () =>
      assertRetailPublicEnv('production', {
        ...process.env,
        EXPO_PUBLIC_ALLOW_UAT_SESSION: '1',
      }),
    /EXPO_PUBLIC_ALLOW_UAT_SESSION/,
  );
});

test('production bake rejects non-pinned API URL', () => {
  assert.throws(
    () =>
      assertRetailPublicEnv('production', {
        ...process.env,
        EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3001',
      }),
    /EXPO_PUBLIC_API_BASE_URL/,
  );
});

test('development bake does not assert retail env', () => {
  assert.doesNotThrow(() =>
    assertRetailPublicEnv('development', {
      ...process.env,
      EXPO_PUBLIC_ALLOW_UAT_SESSION: '1',
      EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3001',
    }),
  );
});

test('conflicting production and development APS indicators fail config', () => {
  const env = { ...process.env };
  assert.throws(
    () =>
      assertApsEnvironmentConsistency({
        ...env,
        APP_VARIANT: 'production',
        APS_ENVIRONMENT: 'development',
      }),
    /Conflicting APS environment/,
  );
  assert.throws(
    () =>
      assertApsEnvironmentConsistency({
        ...env,
        EXPO_PUBLIC_APS_ENVIRONMENT: 'production',
        APS_ENVIRONMENT: 'development',
      }),
    /Conflicting APS environment/,
  );
});

test('resolveApsEnvironment honors production intent without development override', () => {
  const env = { ...process.env };
  assert.equal(
    resolveApsEnvironment({ ...env, APP_VARIANT: 'production' }),
    'production',
  );
  assert.equal(
    resolveApsEnvironment({ ...env, APS_ENVIRONMENT: 'development' }),
    'development',
  );
});

test('development bake flags follow env at config time', () => {
  const flags = resolveDevelopmentBakeFlags({
    ...process.env,
    EXPO_PUBLIC_ALLOW_UAT_SESSION: '1',
    EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS: '1',
  });
  assert.equal(flags.allowLocalFixtureApi, true);
  assert.equal(flags.allowUatSessionRoutes, true);
  assert.equal(flags.allowFixtureEventRoutes, true);
});
