import { brand } from './tokens.ts';

export { brand };

export const colors = {
  /** Primary text — Live Pulse ink (not adaptive system label on attendee paper). */
  label: brand.ink,
  secondary: brand.inkMuted,
  /** Screen fill — paper; atmosphere wash layers on top via ScreenAtmosphere. */
  background: brand.paper,
  card: brand.paperDeep,
  separator: brand.inkFaint,
  /** Replaces systemBlue on product CTAs / links. */
  accent: brand.signal,
  onAccent: '#ffffff',
  ink: brand.ink,
  paper: brand.paper,
  paperDeep: brand.paperDeep,
  signal: brand.signal,
  focus: brand.focus,
  /** Ticket QR canvas (brand paper/ink). */
  ticketCanvas: brand.paper,
  ticketInk: brand.ink,
  /** Gate scan outcome accents — no purple/glow. */
  admit: '#1b7f4a',
  deny: brand.signal,
  unknown: '#8a6d3b',
  /** Form validation / material error red → semantic destructive (TOKENS.md). */
  destructive: '#8a1f1f',
  /** Hairline borders on inputs/cards (#D7DFE9). */
  line: '#d7dfe9',
  /** Success pill background (events / tickets). */
  admitSurface: '#edf5ef',
  /** Muted chrome surfaces. */
  surfaceMuted: '#e8ecf1',
  surfaceSubtle: '#f0f4f8',
  /** iOS shadowColor fallback. */
  shadow: '#000000',
  /** Gate camera focus ring tint (signal @ ~70%). */
  signalTint: '#fb7391',
};
