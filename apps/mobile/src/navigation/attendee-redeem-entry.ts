/** Attendee redeem entry — B26 mock uses single global code flow (`/redeem-global`). */
export const ATTENDEE_REDEEM_PATH = '/redeem-global' as const;

/** Legacy `/redeem` (scoped operator UI) must not surface on attendee paths. */
export function normalizeAttendeeRedeemPath(pathname: string): string {
  return pathname === '/redeem' ? ATTENDEE_REDEEM_PATH : pathname;
}
