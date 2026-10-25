import { colorMixInSrgb } from './color-mix.ts';
import { colors } from './colors.ts';

/** DEC-01 / web `attendeePrimary` — signal → color-mix(signal 88%, ink). */
export const attendeePrimaryGradient = {
  start: colors.signal,
  end: colorMixInSrgb(colors.signal, colors.ink, 0.88),
} as const;
