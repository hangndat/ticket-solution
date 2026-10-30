/**
 * Scroll choreography (0 → 1 over the sticky track). One source of truth so
 * scenes, captions and reduced-motion key frames stay in sync.
 */
export const T = {
  ticketIn: [0.0, 0.13],
  arrival: [0.16, 0.4],
  gateNear: [0.38, 0.46],
  scan: [0.46, 0.52],
  verified: 0.52,
  ticketOut: [0.54, 0.6],
  doorsOpen: [0.55, 0.64],
  pushThrough: [0.64, 0.78],
  stageIn: [0.6, 0.86],
  brand: [0.86, 0.92],
} as const;

/** Caption fade windows: [in-start, in-end, out-start, out-end]. */
export const CAPTION = {
  invitation: [-0.1, 0, 0.14, 0.18],
  arrival: [0.2, 0.24, 0.34, 0.38],
  gateway: [0.41, 0.45, 0.57, 0.61],
  moment: [0.68, 0.72, 0.8, 0.84],
} as const;

/** Representative progress per chapter for reduced-motion still frames. */
export const KEY_FRAMES = {
  invitation: 0,
  arrival: 0.3,
  gateway: 0.53,
  moment: 0.84,
} as const;

/** Zero velocity at either end, identical forward/reverse and without a terminal snap. */
export function smoothProgress(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function doorInset(progress: number): number {
  return 50 * (1 - smoothProgress((progress - T.doorsOpen[0]) / (T.doorsOpen[1] - T.doorsOpen[0])));
}
