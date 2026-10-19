import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FIXTURE_EVENTS_ENV_FLAG,
  UAT_SESSION_ENV_FLAG,
  fixtureEventRouteAllowed,
  uatSessionRouteAllowed,
} from './dev-only-routes.ts';

test('uat and fixture routes blocked in Release without env opt-in', () => {
  assert.equal(uatSessionRouteAllowed(), false);
  assert.equal(fixtureEventRouteAllowed(), false);
});

test('uat and fixture routes allow explicit local sim-uat flags', () => {
  const prevUat = process.env[UAT_SESSION_ENV_FLAG];
  const prevFixture = process.env[FIXTURE_EVENTS_ENV_FLAG];
  process.env[UAT_SESSION_ENV_FLAG] = '1';
  process.env[FIXTURE_EVENTS_ENV_FLAG] = '1';
  try {
    assert.equal(uatSessionRouteAllowed(), true);
    assert.equal(fixtureEventRouteAllowed(), true);
  } finally {
    if (prevUat === undefined) delete process.env[UAT_SESSION_ENV_FLAG];
    else process.env[UAT_SESSION_ENV_FLAG] = prevUat;
    if (prevFixture === undefined) delete process.env[FIXTURE_EVENTS_ENV_FLAG];
    else process.env[FIXTURE_EVENTS_ENV_FLAG] = prevFixture;
  }
});
