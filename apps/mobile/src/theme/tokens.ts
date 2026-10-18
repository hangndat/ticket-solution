/**
 * Canonical platform brand from `brand/vemoki/tokens.json` (Live Pulse v2).
 * Pure data — safe for node tests (no expo-router / Color.ios).
 *
 * Derived paperDeep / inkMuted match web CSS color-mix in visual-identity-v2
 * (paper 88%+ink 12% · ink 62%+paper 38%) — no invent of a 5th required token.
 */
export const brand = {
  ink: '#0B1220',
  paper: '#F4F6F8',
  signal: '#E11D48',
  focus: '#2563EB',
  /** paper → ink mix for soft depth / card fill */
  paperDeep: '#D8DBDE',
  /** secondary text on paper */
  inkMuted: '#646972',
  /** hairline / divider (ink @ ~18% opacity) */
  inkFaint: 'rgba(11, 18, 32, 0.18)',
  wordmark: 'vemoki',
  signalMark: '↗',
} as const;
