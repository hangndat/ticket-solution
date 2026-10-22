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
