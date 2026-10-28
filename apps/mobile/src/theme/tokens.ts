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

export const space = {
  none: 0,
  ...spaceGenerated,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  ...radiusGenerated,
} as const;

export const elevation: Record<'none' | 'card' | 'sheet', ViewStyle> =
  elevationGenerated;
