export { cn } from './cn.js';

/** Live Pulse v2 canonical colors — mirrors brand/vemoki/tokens.json (no runtime JSON import). */
export const VEMOKI_BRAND_COLORS = {
  ink: '#0B1220',
  paper: '#F4F6F8',
  signal: '#E11D48',
  focus: '#2563EB',
} as const;

export type VemokiBrandColorKey = keyof typeof VEMOKI_BRAND_COLORS;
