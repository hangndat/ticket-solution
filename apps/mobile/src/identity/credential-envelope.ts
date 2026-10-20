/**
 * SecureStore still holds a single string. Production sessions use a JSON
 * envelope so refresh tokens travel with the access token without changing
 * CredentialStore. Legacy plain access-token strings remain readable.
 */

export const CREDENTIAL_ENVELOPE_VERSION = 1 as const;

/** Refresh this many ms before expiresAt to absorb minor clock skew. */
export const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

/** When Keycloak omits expires_in, assume realm default (300s). */
export const DEFAULT_ACCESS_TOKEN_LIFESPAN_SECONDS = 300;

export type CredentialEnvelope = {
  v: typeof CREDENTIAL_ENVELOPE_VERSION;
  accessToken: string;
  refreshToken: string | null;
  /** Client-computed wall time (ms) when the access token should be treated as expired. */
  expiresAt: number | null;
};

export type SessionTokenParts = {
  accessToken: string;
  refreshToken?: string | null;
  /** Seconds until access-token expiry from issuance (OIDC expires_in). */
  expiresIn?: number | null;
};

export function expiresAtFromExpiresIn(
  expiresInSeconds: number | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (expiresInSeconds == null || !Number.isFinite(expiresInSeconds)) {
    return nowMs + DEFAULT_ACCESS_TOKEN_LIFESPAN_SECONDS * 1000;
  }
  if (expiresInSeconds <= 0) return nowMs;
  return nowMs + Math.floor(expiresInSeconds) * 1000;
}

export function encodeCredentialEnvelope(parts: SessionTokenParts): string {
  const envelope: CredentialEnvelope = {
    v: CREDENTIAL_ENVELOPE_VERSION,
    accessToken: parts.accessToken,
    refreshToken: parts.refreshToken ?? null,
    expiresAt: expiresAtFromExpiresIn(parts.expiresIn),
  };
  return JSON.stringify(envelope);
}

/**
 * Persist shape for SessionBoundary:
 * - with refreshToken → JSON envelope
 * - access-only (tests / UAT deep link) → plain string (legacy)
 */
export function encodeStoredCredential(parts: SessionTokenParts): string {
  if (parts.refreshToken) {
    return encodeCredentialEnvelope(parts);
  }
  return parts.accessToken;
}

export function parseStoredCredential(raw: string): CredentialEnvelope {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const value: unknown = JSON.parse(trimmed);
      if (value && typeof value === 'object') {
        const body = value as Record<string, unknown>;
        if (
          body.v === CREDENTIAL_ENVELOPE_VERSION &&
          typeof body.accessToken === 'string' &&
          body.accessToken.length > 0
        ) {
          return {
            v: CREDENTIAL_ENVELOPE_VERSION,
            accessToken: body.accessToken,
            refreshToken:
              typeof body.refreshToken === 'string' && body.refreshToken.length > 0
                ? body.refreshToken
                : null,
            expiresAt:
              typeof body.expiresAt === 'number' && Number.isFinite(body.expiresAt)
                ? body.expiresAt
                : null,
          };
        }
      }
    } catch {
      /* fall through to legacy plain bearer */
    }
  }
  return {
    v: CREDENTIAL_ENVELOPE_VERSION,
    accessToken: raw,
    refreshToken: null,
    expiresAt: null,
  };
}

export function accessTokenFromStored(raw: string): string {
  return parseStoredCredential(raw).accessToken;
}

export function accessTokenNeedsRefresh(
  envelope: CredentialEnvelope,
  nowMs: number = Date.now(),
): boolean {
  if (!envelope.refreshToken) return false;
  if (envelope.expiresAt == null) return true;
  return envelope.expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS <= nowMs;
}
