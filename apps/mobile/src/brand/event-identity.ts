/**
 * Pure per-event brand identity — shared by Events list, event detail,
 * and My Tickets (via re-export or direct import).
 *
 * Prefer API / published / demo `primaryColor` when it is a valid hex.
 * Else a deterministic palette color from `eventId` so the same event
 * always matches across surfaces. Demo catalog keeps authored colors
 * by passing them as `brandColor`.
 */

/** Deep, white-text-safe identity hues for events that ship no brand color. */
export const EVENT_IDENTITY_PALETTE = [
  '#245B47',
  '#59428A',
  '#8A3B2E',
  '#1F5A7A',
  '#7A5A12',
  '#8A2F5E',
] as const;

export function isEventBrandHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** Stable per-event accent: the event's own brand color, else a hash of its id. */
export function eventIdentityColor(
  eventId: string,
  brandColor?: string | null,
): string {
  const own = brandColor?.trim();
  if (own && isEventBrandHexColor(own)) return own;
  let h = 0;
  for (let i = 0; i < eventId.length; i += 1) {
    h = (h * 31 + eventId.charCodeAt(i)) >>> 0;
  }
  return EVENT_IDENTITY_PALETTE[h % EVENT_IDENTITY_PALETTE.length];
}

/** One-letter monogram for the identity block / banner fallback. */
export function eventInitial(eventName: string): string {
  const ch = [...eventName.trim()][0];
  return ch ? ch.toLocaleUpperCase('vi') : 'S';
}
