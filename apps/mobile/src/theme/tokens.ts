import type { ViewStyle } from 'react-native';

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

/** Spacing scale — single source for padding/margin/gap (PD may tune in #789). */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/** Corner radius — provisional values; adjust in one place when PD locks tokens. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

const shadowInk = brand.ink;

/** iOS shadow + Android elevation presets. */
export const elevation: Record<'none' | 'card' | 'sheet', ViewStyle> = {
  none: {
    shadowOpacity: 0,
    elevation: 0,
  },
  card: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sheet: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};
