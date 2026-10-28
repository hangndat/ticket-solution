import { eventsCopy, redeemCopy } from '../components/screen-state-copy.ts';

/** Bottom tab labels === native stack titles (attendee / guest). */
export const ATTENDEE_TAB_TITLES = {
  events: eventsCopy.listHeadline,
  redeem: redeemCopy.screenTitle,
  tickets: 'Vé của tôi',
} as const;
