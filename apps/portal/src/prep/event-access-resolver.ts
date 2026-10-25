import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import {
  buildEventMenuItems,
  type PortalTranslate,
} from '../nav/capabilities';

/** Event sider / route keys aligned with `buildEventMenuItems`. */
export type EventPageMenuKey =
  | 'overview'
  | 'setup'
  | 'types'
  | 'sources'
  | 'quota'
  | 'config'
  | 'guests'
  | 'gate'
  | 'audit'
  | 'support';

const menuTranslateStub: PortalTranslate = (key) => key;

/** Membership only — event must appear in MeEvents; no tenant admin chrome. */
export function isEventAssigned(
  tenant: MeTenantItem | null | undefined,
  event: MeEventItem | null | undefined,
): boolean {
  return tenant != null && event != null;
}

/**
 * Page gate from server event permissions — same rules as event nav menu.
 * Overview is allowed whenever the user is assigned to the event.
 */
export function isEventPagePermitted(
  pageKey: EventPageMenuKey,
  permissions: readonly string[],
): boolean {
  if (pageKey === 'overview') return true;
  const items = buildEventMenuItems(
    '_tenant',
    '_event',
    permissions,
    menuTranslateStub,
  );
  return items.some((item) => item.key === pageKey);
}
