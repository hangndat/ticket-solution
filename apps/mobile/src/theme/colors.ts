import { brand } from './tokens.ts';

export { brand };

export const colors = {
  /** Primary text — brand ink (not adaptive system label on attendee paper). */
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
  signal: brand.primary,
  focus: brand.focus,
  /** Ticket QR canvas (brand paper/ink). */
  ticketCanvas: brand.paper,
  ticketInk: brand.ink,
  /** Gate scan outcome accents preserve their admission meaning. */
  admit: brand.admit,
  deny: brand.destructive,
  /** Gate "đã dùng / trùng vé" severity — amber, distinct from deny red (D12). */
  warning: brand.unknown,
  /** Gate "chưa xác minh / chờ đồng bộ" severity — info blue, not amber (D12). */
  unknown: brand.info,
  /** Form validation / material error red → semantic destructive (TOKENS.md). */
  destructive: brand.destructive,
  /** Hairline borders on inputs/cards. */
  line: brand.line,
  /** Success pill background (events / tickets). */
  admitSurface: '#edf5ef',
  /** Gate scan deny sticky panel, tinted from destructive red. */
  denySurface: '#f6eaea',
  /** Gate scan already-checked-in sticky panel (amber wash on paper). */
  warningSurface: '#fff6e8',
  /** Gate scan unknown/queued/recorded sticky panel (info-blue wash on paper). */
  unknownSurface: '#e8effb',
  /** Muted chrome surfaces. */
  surfaceMuted: '#efeef4',
  surfaceSubtle: '#f7f6fa',
  /** iOS shadowColor fallback. */
  shadow: brand.ink,
  /** Gate camera focus ring tint. */
  signalTint: brand.focus,
};
