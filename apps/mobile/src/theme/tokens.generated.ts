// Auto-generated — do not edit
// Source: brand/vemoki/tokens.json — regenerate: node apps/mobile/scripts/sync-tokens.mjs

import type { ViewStyle } from 'react-native';

export const brandGenerated = {
  ink: '#141020',
  paper: '#FFFFFF',
  signal: '#6C35FF',
  primary: '#6C35FF',
  focus: '#5B22F0',
  line: '#D7D6E0',
  muted: '#5C5774',
  destructive: '#8A1F1F',
  admit: '#1B7F4A',
  unknown: '#8A6D3B',
  paperDeep: '#e3e2e4',
  inkMuted: '#5C5774',
  inkFaint: 'rgba(20, 16, 32, 0.18)',
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
    shadowColor: '#141020',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.12,
    shadowRadius: 64,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#141020',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.22,
    shadowRadius: 80,
    elevation: 4,
  },
};
