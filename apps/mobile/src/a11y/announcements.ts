export const REDEEM_ACTION_LABEL = 'Redeem code';
export const REDEEM_RECONCILE_LABEL = 'Reconcile the same redeem attempt';
export const GATE_CHECK_IN_LABEL = 'Check in ticket';
export const GATE_RECONCILE_LABEL = 'Reconcile unknown result';

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
      accessibilityLabel: `${input.title}. ${input.detail} Not an issued ticket.`,
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
    accessibilityLabel: 'Refresh redemption status',
  };
}

export function termsConsentAnnouncement(accepted: boolean): Announcement {
  return {
    accessibilityRole: 'button',
    accessibilityLabel: accepted
      ? 'Terms accepted. Double tap to withdraw consent.'
      : 'Accept published terms. Required before redeem.',
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
      accessibilityLabel: `${input.title}. ${input.message} Do not admit.`,
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
    accessibilityLabel: `${input.label}. ${input.message} Not an admission.`,
  };
}
