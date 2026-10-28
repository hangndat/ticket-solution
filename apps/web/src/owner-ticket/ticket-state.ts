import { attendeeTicketStateTag } from '../attendee-detail-surface';
import { dual, pickDual } from '../i18n/dual';
import {
  DEFAULT_ATTENDEE_LOCALE,
  type AttendeeLocale,
} from '../i18n/locale';

const STATE_LABELS = {
  ACTIVE: dual('Sẵn sàng', 'Ready'),
  USED: dual('Đã dùng', 'Used'),
  CHECKED_IN: dual('Đã vào cổng', 'Checked in'),
  REVOKED: dual('Đã thu hồi', 'Revoked'),
  EXPIRED: dual('Hết hạn', 'Expired'),
} as const;

/** Guest-facing ticket state label for wallet / detail chrome. */
export function ticketStateLabel(
  state: string,
  locale: AttendeeLocale = DEFAULT_ATTENDEE_LOCALE,
): string {
  const mapped = STATE_LABELS[state as keyof typeof STATE_LABELS];
  return mapped ? pickDual(mapped, locale) : state;
}

export function ticketStateTagClass(state: string): string {
  return attendeeTicketStateTag(state);
}
