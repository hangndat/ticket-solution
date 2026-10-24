/**
 * Guest invitation claim login-return intent (C-I).
 * Token in sessionStorage only — never query string, analytics, or console logs.
 * Cleared on successful claim or explicit drop.
 */

export type GuestClaimIntent = {
  /** Opaque claim token — do not log. */
  token: string;
  tenantId: string;
  eventId: string;
  tenantSlug?: string;
  eventSlug?: string;
  formVersion?: string;
  termsVersion?: string;
  createdAt: number;
};

const STORAGE_KEY = 'vemoki_guest_claim_intent';

/** In-memory fallback when sessionStorage is unavailable (Node tests / SSR). */
let memoryIntent: GuestClaimIntent | null = null;

function readRaw(): GuestClaimIntent | null {
  if (typeof sessionStorage === 'undefined') return memoryIntent;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryIntent;
    const parsed = JSON.parse(raw) as GuestClaimIntent;
    if (
      typeof parsed?.token !== 'string' ||
      typeof parsed?.tenantId !== 'string' ||
      typeof parsed?.eventId !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return memoryIntent;
  }
}

function writeRaw(intent: GuestClaimIntent | null): void {
  memoryIntent = intent;
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (!intent) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    /* ignore quota — memoryIntent still holds value for this tab session */
  }
}

export function peekGuestClaimIntent(): GuestClaimIntent | null {
  return readRaw();
}

export function clearGuestClaimIntent(): void {
  writeRaw(null);
}

export function parkGuestClaimIntent(
  intent: Omit<GuestClaimIntent, 'createdAt'>,
): GuestClaimIntent {
  const next: GuestClaimIntent = { ...intent, createdAt: Date.now() };
  writeRaw(next);
  return next;
}

export type ClaimIntentResume =
  | { ok: true; intent: GuestClaimIntent }
  | {
      ok: false;
      reason: 'none' | 'missing-scope' | 'missing-token';
    };

export function resumeGuestClaimIntent(): ClaimIntentResume {
  const intent = readRaw();
  if (!intent) return { ok: false, reason: 'none' };
  if (!intent.token.trim()) {
    clearGuestClaimIntent();
    return { ok: false, reason: 'missing-token' };
  }
  if (!intent.tenantId.trim() || !intent.eventId.trim()) {
    clearGuestClaimIntent();
    return { ok: false, reason: 'missing-scope' };
  }
  return { ok: true, intent };
}

/** Redacted debug view — never includes token. */
export function redactGuestClaimIntent(
  intent: GuestClaimIntent | null,
): Record<string, unknown> | null {
  if (!intent) return null;
  return {
    tenantId: intent.tenantId,
    eventId: intent.eventId,
    tenantSlug: intent.tenantSlug ?? null,
    eventSlug: intent.eventSlug ?? null,
    formVersion: intent.formVersion ?? null,
    termsVersion: intent.termsVersion ?? null,
    hasToken: intent.token.length > 0,
    tokenLength: intent.token.length,
    createdAt: intent.createdAt,
  };
}

/**
 * Read claim token from URL fragment (#token=…) then parked intent.
 * Never from query (Referrer / server logs / analytics).
 */
export function readClaimTokenFromLocation(): {
  token: string;
  tenantId: string;
  eventId: string;
  tenantSlug: string;
  eventSlug: string;
} {
  const empty = {
    token: '',
    tenantId: '',
    eventId: '',
    tenantSlug: '',
    eventSlug: '',
  };
  if (typeof window === 'undefined') return empty;

  const hash = window.location.hash.replace(/^#/, '');
  let token = '';
  let tenantId = '';
  let eventId = '';
  let tenantSlug = '';
  let eventSlug = '';
  if (hash) {
    const params = new URLSearchParams(hash);
    token =
      params.get('token')?.trim() ||
      (hash.includes('=') ? '' : hash.trim());
    tenantId = params.get('tenantId')?.trim() ?? '';
    eventId = params.get('eventId')?.trim() ?? '';
    tenantSlug = params.get('tenantSlug')?.trim() ?? '';
    eventSlug = params.get('eventSlug')?.trim() ?? '';
    // A new fragment is one invitation. Never fill its missing fields from an
    // older parked invitation, even when the new fragment is incomplete.
    return { token, tenantId, eventId, tenantSlug, eventSlug };
  }

  const parked = readRaw();
  return {
    token: parked?.token || '',
    tenantId: parked?.tenantId || '',
    eventId: parked?.eventId || '',
    tenantSlug: parked?.tenantSlug || '',
    eventSlug: parked?.eventSlug || '',
  };
}

/** Clear fragment from address bar without reload (keeps token out of history share). */
export function clearClaimHashFromLocation(): void {
  if (typeof window === 'undefined') return;
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
