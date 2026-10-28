import type { ViewStyle } from 'react-native';
import {
  brandGenerated,
  elevationGenerated,
  radiusGenerated,
  spaceGenerated,
} from './tokens.generated.ts';

/**
 * Live Pulse brand + layout tokens — sourced from `brand/vemoki/tokens.json`
 * via `apps/mobile/scripts/sync-tokens.mjs`.
 */
export const brand = brandGenerated;

export const space = spaceGenerated;

export const radius = radiusGenerated;

export const elevation: Record<'none' | 'card' | 'sheet', ViewStyle> =
  elevationGenerated;

/** Mobile-only layout zeros — not in brand JSON; keeps ui-budget free of numeric style literals. */
export const layout = {
  none: 0,
} as const;
