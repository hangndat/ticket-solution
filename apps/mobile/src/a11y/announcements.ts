export const REDEEM_ACTION_LABEL = 'Đổi mã';
export const REDEEM_RECONCILE_LABEL = 'Đối soát cùng lần đổi mã';
export const GATE_CHECK_IN_LABEL = 'Check-in vé';
export const GATE_RECONCILE_LABEL = 'Đối soát kết quả chưa rõ';

export type AnnouncementRole = 'button' | 'alert' | 'summary' | 'list' | 'text';

export type Announcement = {
  accessibilityRole: AnnouncementRole;
  accessibilityLabel: string;
};

export function redeemActionAnnouncement(): Announcement {
  return { accessibilityRole: 'button', accessibilityLabel: REDEEM_ACTION_LABEL };
}

export function redeemReconcileAnnouncement(): Announcement {
  return {
    accessibilityRole: 'button',
    accessibilityLabel: REDEEM_RECONCILE_LABEL,
  };
}

/** Unknown / pending redeem results are alerts and are not tickets. */
export function redeemDecisionAnnouncement(input: {
  kind: 'issued' | 'denied' | 'unknown' | 'pending' | 'stale';
  title: string;
  detail: string;
}): Announcement {
  if (input.kind === 'unknown' || input.kind === 'pending') {
    return {
      accessibilityRole: 'alert',
      accessibilityLabel: `${input.title}. ${input.detail} Đây không phải vé đã phát hành.`,
    };
  }
  return {
    accessibilityRole: 'summary',
    accessibilityLabel: `${input.title}. ${input.detail}`,
  };
}

export function redeemStatusRefreshAnnouncement(): Announcement {
  return {
    accessibilityRole: 'button',
    accessibilityLabel: 'Làm mới trạng thái đổi mã',
  };
}

export function termsConsentAnnouncement(accepted: boolean): Announcement {
  return {
    accessibilityRole: 'button',
    accessibilityLabel: accepted
      ? 'Đã chấp nhận điều khoản. Chạm đúp để rút đồng ý.'
      : 'Chấp nhận điều khoản đã công bố. Bắt buộc trước khi đổi mã.',
  };
}

export function gateCheckInAnnouncement(): Announcement {
  return { accessibilityRole: 'button', accessibilityLabel: GATE_CHECK_IN_LABEL };
}

export function gateReconcileAnnouncement(): Announcement {
  return {
    accessibilityRole: 'button',
    accessibilityLabel: GATE_RECONCILE_LABEL,
  };
}

export function gateOutcomeAnnouncement(input: {
  phase: 'admitted' | 'unknown' | 'denied' | 'confirming' | 'holding' | string;
  title: string;
  message: string;
}): Announcement {
  if (input.phase === 'unknown') {
    return {
      accessibilityRole: 'alert',
      accessibilityLabel: `${input.title}. ${input.message} Không cho vào.`,
    };
  }
  return {
    accessibilityRole: 'summary',
    accessibilityLabel: `${input.title}. ${input.message}`,
  };
}

export function supervisorListAnnouncement(warning: string): Announcement {
  return { accessibilityRole: 'list', accessibilityLabel: warning };
}

export function supervisorUnknownItemAnnouncement(input: {
  label: string;
  message: string;
}): Announcement {
  return {
    accessibilityRole: 'text',
    accessibilityLabel: `${input.label}. ${input.message} Không phải lượt vào.`,
  };
}
