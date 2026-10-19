/**
 * Dev / local-UAT routes must not be reachable in Release store builds unless explicitly opted in.
 * See IOS-AUDIT B2 (uat/session, events/fixture).
 */

export const UAT_SESSION_ENV_FLAG = 'EXPO_PUBLIC_ALLOW_UAT_SESSION';
export const FIXTURE_EVENTS_ENV_FLAG = 'EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS';

function isDevBundle(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function envOptIn(flagName: string): boolean {
  return process.env[flagName] === '1';
}

/** UAT session deep link (`/uat/session`). */
export function uatSessionRouteAllowed(): boolean {
  if (isDevBundle()) return true;
  return envOptIn(UAT_SESSION_ENV_FLAG);
}

/** Demo fixture event detail (`/events/fixture/[eventId]`). */
export function fixtureEventRouteAllowed(): boolean {
  if (isDevBundle()) return true;
  return envOptIn(FIXTURE_EVENTS_ENV_FLAG);
}
