// Auto-generated — do not edit
// Source: brand/vemoki/tokens.json — regenerate: node apps/mobile/scripts/sync-tokens.mjs

import type { ViewStyle } from 'react-native';

export const brandGenerated = {
  ink: '#17151F',
  paper: '#FFFFFF',
  signal: '#7038FF',
  primary: '#7038FF',
  focus: '#7038FF',
  line: '#DEDCE6',
  muted: '#625E70',
  destructive: '#BE263B',
  admit: '#137A4B',
  unknown: '#8A5700',
  info: '#2459BA',
  paperDeep: '#e3e3e4',
  inkMuted: '#625E70',
  inkFaint: 'rgba(23, 21, 31, 0.18)',
  wordmark: 'Vemoki',
  signalMark: '',
} as const;

export const spaceGenerated = {
  "xxs": 2,
  "xs": 4,
  "sm": 8,
  "md": 12,
  "lg": 16,
  "xl": 20,
  "xxl": 24,
  "xxxl": 32,
  "huge": 48
} as const;

export const radiusGenerated = {
  "sm": 8,
  "md": 12,
  "lg": 18,
  "xl": 24,
  "pill": 999
} as const;

/** iOS shadow + Android elevation — shadow.soft → card, shadow.frame → sheet (TOKENS.md). */
export const elevationGenerated: Record<'none' | 'card' | 'sheet', ViewStyle> = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#17151F',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.12,
    shadowRadius: 64,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#17151F',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.22,
    shadowRadius: 80,
    elevation: 4,
  },
};
