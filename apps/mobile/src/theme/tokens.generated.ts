// Auto-generated — do not edit
// Source: brand/vemoki/tokens.json — regenerate: node apps/mobile/scripts/sync-tokens.mjs

import type { ViewStyle } from 'react-native';

export const brandGenerated = {
  ink: '#0B1220',
  paper: '#F4F6F8',
  signal: '#E11D48',
  focus: '#2563EB',
  line: '#D7DFE9',
  muted: '#5B687B',
  destructive: '#8A1F1F',
  admit: '#1B7F4A',
  unknown: '#8A6D3B',
  paperDeep: '#d8dbde',
  inkMuted: '#5B687B',
  inkFaint: 'rgba(11, 18, 32, 0.18)',
  wordmark: 'vemoki',
  signalMark: '↗',
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
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.12,
    shadowRadius: 64,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.22,
    shadowRadius: 80,
    elevation: 4,
  },
};
