/**
 * Journey plate manifest (runtime). Provenance, licence and byte sizes are
 * documented in docs/design/cinematic-journey/asset-manifest.md.
 * Files: public/marketing/journey/<file>-<width>.{avif,webp}
 */
export const JOURNEY_PLATES = {
  'ticket-night': { file: 'ticket-night', width: 1536, height: 1024, widths: [960, 1536], focus: { x: 0.5, y: 0.5 } },
  'gateway-closed': { file: 'gateway-closed', width: 1536, height: 1024, widths: [960, 1536], focus: { x: 0.5, y: 0.5 } },
  'gateway-open': { file: 'gateway-open', width: 1536, height: 1024, widths: [960, 1536], focus: { x: 0.5, y: 0.5 } },
  'stage-main': { file: 'stage-main', width: 1536, height: 1024, widths: [960, 1536], focus: { x: 0.5, y: 0.5 } },
} as const;

export type JourneyPlateId = keyof typeof JOURNEY_PLATES;

/** Progress window in which each plate can be visible (mount/preload gating). */
export const PLATE_WINDOWS: Record<JourneyPlateId, readonly [number, number]> = {
  'ticket-night': [0, 0.24],
  'gateway-closed': [0.14, 0.74],
  'gateway-open': [0.54, 0.74],
  'stage-main': [0.6, 1],
};
