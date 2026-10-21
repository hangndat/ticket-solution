/** Attendee redeem entry — B26 mock uses single global code flow (`/redeem-global`). */
export const ATTENDEE_REDEEM_PATH = '/redeem-global' as const;

export const REDEEM_CODE_QUERY_PARAM = 'code' as const;

/** Opaque redemption code from marketing links — bounded; never log raw values. */
const REDEEM_CODE_MAX_LEN = 128;

/** Legacy `/redeem` (scoped operator UI) must not surface on attendee paths. */
export function normalizeAttendeeRedeemPath(pathname: string): string {
  return pathname === '/redeem' ? ATTENDEE_REDEEM_PATH : pathname;
}

export function sanitizeRedeemCodeParam(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || trimmed.length > REDEEM_CODE_MAX_LEN) return null;
  return trimmed;
}

/** Extract `?code=` from deep-link input before router rewrite (memory-only downstream). */
export function extractRedeemCodeFromLinkInput(raw: string): string | null {
  try {
    let url: URL;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      url = new URL(raw);
    } else {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      url = new URL(`ticketsolution://host${path}`);
    }
    return sanitizeRedeemCodeParam(
      url.searchParams.get(REDEEM_CODE_QUERY_PARAM),
    );
  } catch {
    return null;
  }
}

export function attendeeRedeemHref(code: string | null | undefined): string {
  const safe = sanitizeRedeemCodeParam(code ?? null);
  if (!safe) return ATTENDEE_REDEEM_PATH;
  return `${ATTENDEE_REDEEM_PATH}?${REDEEM_CODE_QUERY_PARAM}=${encodeURIComponent(safe)}`;
}
