import { Color } from 'expo-router';

/**
 * Canonical platform brand from `brand/vemoki/tokens.json` (O09).
 * Do not invent a second palette — event (M04) themes override event surfaces only.
 */
export const brand = {
  ink: '#22241f',
  paper: '#f7f6f1',
  signal: '#9b3a18',
  focus: '#235fd0',
  wordmark: 'vemoki',
  signalMark: '↗',
} as const;

export const colors = {
  /** System semantics adapt to light/dark; product accent is Vemoki signal. */
  label: Color.ios.label,
  secondary: Color.ios.secondaryLabel,
  background: Color.ios.systemGroupedBackground,
  card: Color.ios.secondarySystemGroupedBackground,
  separator: Color.ios.separator,
  /** Replaces systemBlue on product CTAs / links. */
  accent: brand.signal,
  onAccent: '#ffffff',
  ink: brand.ink,
  paper: brand.paper,
  signal: brand.signal,
  focus: brand.focus,
  /** Ticket QR canvas (brand paper/ink). */
  ticketCanvas: brand.paper,
  ticketInk: brand.ink,
  /** Gate scan outcome accents — no purple/glow. */
  admit: '#1b7f4a',
  deny: brand.signal,
  unknown: '#8a6d3b',
};
