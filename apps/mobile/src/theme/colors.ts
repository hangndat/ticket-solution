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
};
