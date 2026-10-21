/** Guest-facing ticket state label for wallet / detail chrome. */
export function ticketStateLabel(state: string): string {
  switch (state) {
    case 'ACTIVE':
      return 'Sẵn sàng';
    case 'USED':
      return 'Đã dùng';
    case 'CHECKED_IN':
      return 'Đã check-in';
    case 'REVOKED':
      return 'Đã thu hồi';
    case 'EXPIRED':
      return 'Hết hạn';
    default:
      return state;
  }
}

export function ticketStateTagClass(state: string): string {
  if (state === 'ACTIVE') return 'ticket-tag ticket-tag--ready';
  if (state === 'USED' || state === 'CHECKED_IN') {
    return 'ticket-tag ticket-tag--used';
  }
  if (state === 'REVOKED' || state === 'EXPIRED') {
    return 'ticket-tag ticket-tag--blocked';
  }
  return 'ticket-tag';
}
