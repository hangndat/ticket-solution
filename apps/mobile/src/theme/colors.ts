import { Color } from 'expo-router';
import { brand } from './tokens.ts';

export { brand };

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
