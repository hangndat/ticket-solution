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
  accent: brand.primary,
  onAccent: '#ffffff',
  ink: brand.ink,
  paper: brand.paper,
  paperDeep: brand.paperDeep,
  /** Product accent (solid primary violet); marketing signal stays on `brand.signal`. */
  signal: brand.primary,
  focus: brand.focus,
  /** Ticket QR canvas (brand paper/ink). */
  ticketCanvas: brand.paper,
  ticketInk: brand.ink,
  /** Gate scan outcome accents — no purple/glow. */
  admit: brand.admit,
  /** Gate deny / destructive CTA — product deny red (#B3213A), not Live Pulse signal. */
  deny: '#B3213A',
  unknown: brand.unknown,
  /** Form validation / material error red → semantic destructive (TOKENS.md). */
  destructive: brand.destructive,
  /** Hairline borders on inputs/cards (#D7DFE9). */
  line: brand.line,
  /** Success pill background (events / tickets). */
  admitSurface: '#edf5ef',
  /** Gate scan deny sticky panel (brand denyBg tint). */
  denySurface: '#fde8ec',
  /** Gate scan unknown/queued sticky panel (amber wash on paper). */
  unknownSurface: '#fff6e8',
  /** Muted chrome surfaces. */
  surfaceMuted: '#e8ecf1',
  surfaceSubtle: '#f0f4f8',
  /** iOS shadowColor fallback. */
  shadow: '#000000',
  /** Gate camera focus ring tint (primary @ ~70% on paper). */
  signalTint: '#b8a4f5',
};
