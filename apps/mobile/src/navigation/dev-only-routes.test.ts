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
  const prevUat = process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION;
  const prevFixture = process.env.EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS;
  process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION = '1';
  process.env.EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS = '1';
  try {
    assert.equal(uatSessionRouteAllowed(), true);
    assert.equal(fixtureEventRouteAllowed(), true);
  } finally {
    if (prevUat === undefined) delete process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION;
    else process.env.EXPO_PUBLIC_ALLOW_UAT_SESSION = prevUat;
    if (prevFixture === undefined) delete process.env.EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS;
    else process.env.EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS = prevFixture;
  }
});
