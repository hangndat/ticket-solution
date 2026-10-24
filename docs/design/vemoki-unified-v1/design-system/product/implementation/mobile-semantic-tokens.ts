/**
 * DESIGN REFERENCE. Map via existing apps/mobile/src/theme tokens and ThemeProvider.
 * Do not import this file directly in production before review.
 * Never replace scan business logic based on these colors.
 */
export const attendeeVisual = {
  background: '#060817',
  panel: '#0E1229',
  text: '#FAF9FF',
  textSecondary: '#C2C6DE',
  brandedAccent: '#9B4DFF',
  ticketPaper: '#FFFFFF',
  ticketInk: '#172039',
  hitTarget: 44,
  radiusCard: 16,
  radiusTicket: 24,
} as const;

export const gateOutcomeVisual = {
  ADMITTED: { foreground: '#127349', background: '#E5F6ED', canAdmit: true },
  DUPLICATE: { foreground: '#B3213A', background: '#FDE7ED', canAdmit: false },
  REJECTED: { foreground: '#B3213A', background: '#FDE7ED', canAdmit: false },
  OFFLINE_QUEUED: { foreground: '#8A5800', background: '#FFF1D4', canAdmit: false },
  PENDING: { foreground: '#8A5800', background: '#FFF1D4', canAdmit: false },
  CONFLICT: { foreground: '#B3213A', background: '#FDE7ED', canAdmit: false },
  UNKNOWN: { foreground: '#6753A0', background: '#EEE9FC', canAdmit: false },
} as const;

// NOTE: canAdmit here is a *design illustration*, NOT an authorization decision.
// Actual admission must use the existing authoritative Gate state machine.
