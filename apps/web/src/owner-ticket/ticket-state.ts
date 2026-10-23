import { attendeeTicketStateTag } from '../attendee-detail-surface';

/** Guest-facing ticket state label for wallet / detail chrome. */
export function ticketStateLabel(state: string): string {
  switch (state) {
    case 'ACTIVE':
      return 'Sẵn sàng';
    case 'USED':
      return 'Đã dùng';
    case 'CHECKED_IN':
      return 'Đã vào cổng';
    case 'REVOKED':
      return 'Đã thu hồi';
    case 'EXPIRED':
      return 'Hết hạn';
    default:
      return state;
  }
}

export function ticketStateTagClass(state: string): string {
  return attendeeTicketStateTag(state);
}
