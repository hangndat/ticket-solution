import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import {
  canAccessEventRoute,
  type EVENT_ROUTES,
} from '../nav/capability-policy';

/** Event sider / route keys aligned with `buildEventMenuItems`. */
export type EventPageMenuKey = keyof typeof EVENT_ROUTES;

/** Membership only — event must appear in MeEvents; no tenant admin chrome. */
export function isEventAssigned(
  tenant: MeTenantItem | null | undefined,
  event: MeEventItem | null | undefined,
): boolean {
  return tenant != null && event != null;
}

/**
 * Page gate from server event permissions — same policy as event nav menu.
 */
export function isEventPagePermitted(
  pageKey: EventPageMenuKey,
  permissions: readonly string[],
): boolean {
  return canAccessEventRoute(pageKey, permissions);
}
