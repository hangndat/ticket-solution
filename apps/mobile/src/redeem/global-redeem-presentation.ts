import { GUEST_HOME_HREF } from '../navigation/attendee-account-route.ts';

type RedeemIdentity = 'guest' | 'verified';

const ERROR_EXIT_BY_IDENTITY: Record<RedeemIdentity, typeof GUEST_HOME_HREF> = {
  guest: GUEST_HOME_HREF,
  verified: GUEST_HOME_HREF,
};

/** Redeem lookup errors return to Events for both guest and verified attendees. */
export function globalRedeemErrorExitHref(identity: RedeemIdentity) {
  return ERROR_EXIT_BY_IDENTITY[identity];
}
