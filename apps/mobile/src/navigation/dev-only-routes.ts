/**
 * Dev / local-UAT routes must not be reachable in Release store builds unless explicitly opted in.
 * See IOS-AUDIT B2 (uat/session, events/fixture).
 */

import { getApsEnvironment, getRetailBakeCaps } from '../identity/config.ts';

export const UAT_SESSION_ENV_FLAG = 'EXPO_PUBLIC_ALLOW_UAT_SESSION';
export const FIXTURE_EVENTS_ENV_FLAG = 'EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS';

function isDevBundle(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export type RouteBakeCaps = {
  allowUatSessionRoutes?: boolean;
  allowFixtureEventRoutes?: boolean;
};

/** UAT session deep link (`/uat/session`). */
export function uatSessionRouteAllowedWithCaps(
  caps: RouteBakeCaps,
  devBundle: boolean,
  productionAps = getApsEnvironment() === 'production',
): boolean {
  if (productionAps) return false;
  if (devBundle) return true;
  return caps.allowUatSessionRoutes === true;
}

export function uatSessionRouteAllowed(): boolean {
  const caps = getRetailBakeCaps();
  return uatSessionRouteAllowedWithCaps(
    { allowUatSessionRoutes: caps.allowUatSessionRoutes },
    isDevBundle(),
  );
}

/** Demo fixture event detail (`/events/fixture/[eventId]`). */
export function fixtureEventRouteAllowedWithCaps(
  caps: RouteBakeCaps,
  devBundle: boolean,
  productionAps = getApsEnvironment() === 'production',
): boolean {
  if (productionAps) return false;
  if (devBundle) return true;
  return caps.allowFixtureEventRoutes === true;
}

export function fixtureEventRouteAllowed(): boolean {
  const caps = getRetailBakeCaps();
  return fixtureEventRouteAllowedWithCaps(
    { allowFixtureEventRoutes: caps.allowFixtureEventRoutes },
    isDevBundle(),
  );
}
