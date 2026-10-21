import * as jose from 'jose';

const ALLOWED_ALGORITHMS: jose.JWTVerifyOptions['algorithms'] = [
  'RS256',
  'ES256',
];

/** Match backend access-token skew; fail-closed on missing iat/exp. */
const CLOCK_TOLERANCE_SECONDS = 5 * 60;
const ACCESS_TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60;

export type VerifiedClaims = {
  subject: string;
  payload: jose.JWTPayload;
};

export type VerifyFailureReason =
  | 'invalid_signature'
  | 'issuer'
  | 'audience'
  | 'azp'
  | 'nonce'
  | 'expired'
  | 'subject'
  | 'acr'
  | 'auth_time'
  | 'bounds';

export class TokenVerifyError extends Error {
  readonly reason: VerifyFailureReason;
  constructor(reason: VerifyFailureReason, message: string) {
    super(message);
    this.name = 'TokenVerifyError';
    this.reason = reason;
  }
}

const remoteJwksCache = new Map<string, jose.JWTVerifyGetKey>();

export function getRemoteJwks(jwksUrl: string): jose.JWTVerifyGetKey {
  const existing = remoteJwksCache.get(jwksUrl);
  if (existing) return existing;
  const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
  remoteJwksCache.set(jwksUrl, jwks);
  return jwks;
}

/** Test helper: local JWKS from exported public JWK(s). */
export function createLocalJwks(
  publicJwk: jose.JWK | jose.JWK[],
): jose.JWTVerifyGetKey {
  const keys = Array.isArray(publicJwk) ? publicJwk : [publicJwk];
  return jose.createLocalJWKSet({ keys });
}

function assertAccessTokenBounds(payload: jose.JWTPayload): void {
  const now = Math.floor(Date.now() / 1000);
  const iat =
    typeof payload.iat === 'number'
      ? payload.iat
      : typeof payload.iat === 'string'
        ? Number(payload.iat)
        : NaN;
  const exp =
    typeof payload.exp === 'number'
      ? payload.exp
      : typeof payload.exp === 'string'
        ? Number(payload.exp)
        : NaN;
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) {
    throw new TokenVerifyError('bounds', 'iat/exp required');
  }
  if (exp - iat > ACCESS_TOKEN_MAX_AGE_SECONDS) {
    throw new TokenVerifyError('bounds', 'token lifetime exceeded');
  }
  if (
    now - iat >
    ACCESS_TOKEN_MAX_AGE_SECONDS + CLOCK_TOLERANCE_SECONDS
  ) {
    throw new TokenVerifyError('bounds', 'token age exceeded');
  }
}

function audienceValues(aud: jose.JWTPayload['aud']): string[] {
  if (typeof aud === 'string') return [aud];
  if (Array.isArray(aud)) {
    return aud.filter((v): v is string => typeof v === 'string' && v.length > 0);
  }
  return [];
}

/**
 * When aud has multiple values, OIDC Core requires azp === client_id.
 * Single-aud tokens may omit azp.
 */
function assertAzpWhenMultiAud(
  payload: jose.JWTPayload,
  clientId: string,
): void {
  const auds = audienceValues(payload.aud);
  if (auds.length <= 1) return;
  if (payload.azp !== clientId) {
    throw new TokenVerifyError('azp', 'azp must match client_id for multi-aud');
  }
}

function mapJoseVerifyError(error: unknown): TokenVerifyError {
  if (error instanceof TokenVerifyError) return error;
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : '';
  if (code === 'ERR_JWT_EXPIRED') {
    return new TokenVerifyError('expired', 'token expired');
  }
  if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
    const claim =
      error && typeof error === 'object' && 'claim' in error
        ? String((error as { claim?: string }).claim)
        : '';
    if (claim === 'iss') return new TokenVerifyError('issuer', 'issuer mismatch');
    if (claim === 'aud') {
      return new TokenVerifyError('audience', 'audience mismatch');
    }
    if (claim === 'nonce') return new TokenVerifyError('nonce', 'nonce mismatch');
  }
  return new TokenVerifyError('invalid_signature', 'JWT verify failed');
}

export async function verifyIdToken(
  token: string,
  options: {
    issuer: string;
    clientId: string;
    nonce: string;
    jwks: jose.JWTVerifyGetKey;
  },
): Promise<VerifiedClaims> {
  if (!token.trim() || !options.nonce.trim()) {
    throw new TokenVerifyError('nonce', 'id_token and nonce required');
  }
  let payload: jose.JWTPayload;
  try {
    ({ payload } = await jose.jwtVerify(token, options.jwks, {
      issuer: options.issuer,
      audience: options.clientId,
      algorithms: ALLOWED_ALGORITHMS,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    }));
  } catch (error) {
    throw mapJoseVerifyError(error);
  }

  if (payload.nonce !== options.nonce) {
    throw new TokenVerifyError('nonce', 'nonce mismatch');
  }
  assertAzpWhenMultiAud(payload, options.clientId);
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new TokenVerifyError('subject', 'subject missing');
  }
  return { subject: payload.sub, payload };
}

export async function verifyAccessToken(
  token: string,
  options: {
    issuer: string;
    audience: string;
    clientId: string;
    jwks: jose.JWTVerifyGetKey;
    /** Platform MFA: exact ACR string match + auth_time max age (default 900s). */
    platform?: {
      requiredAcr: string;
      maxAuthAgeSeconds: number;
    };
  },
): Promise<VerifiedClaims> {
  if (!token.trim()) {
    throw new TokenVerifyError('invalid_signature', 'access token required');
  }
  let payload: jose.JWTPayload;
  try {
    ({ payload } = await jose.jwtVerify(token, options.jwks, {
      issuer: options.issuer,
      audience: options.audience,
      algorithms: ALLOWED_ALGORITHMS,
      maxTokenAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    }));
  } catch (error) {
    throw mapJoseVerifyError(error);
  }

  assertAccessTokenBounds(payload);
  assertAzpWhenMultiAud(payload, options.clientId);

  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new TokenVerifyError('subject', 'subject missing');
  }

  if (options.platform) {
    const acr =
      typeof payload.acr === 'string'
        ? payload.acr
        : Array.isArray(payload.acr)
          ? String(payload.acr[0] ?? '')
          : '';
    // ACR is an opaque assurance string — exact match, never numeric >=.
    if (acr !== options.platform.requiredAcr) {
      throw new TokenVerifyError('acr', 'ACR mismatch');
    }
    const authTime =
      typeof payload.auth_time === 'number'
        ? payload.auth_time
        : typeof payload.auth_time === 'string'
          ? Number(payload.auth_time)
          : NaN;
    if (!Number.isFinite(authTime)) {
      throw new TokenVerifyError('auth_time', 'auth_time required');
    }
    const age = Math.floor(Date.now() / 1000) - authTime;
    if (age < 0 || age > options.platform.maxAuthAgeSeconds) {
      throw new TokenVerifyError('auth_time', 'auth_time age exceeded');
    }
  }

  return { subject: payload.sub, payload };
}

/**
 * Accept a token grant only after JWKS verification.
 * Never persist cookies from an unverified JWT decode.
 */
export async function acceptOidcTokenGrant(input: {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  issuer: string;
  clientId: string;
  accessAudience: string;
  jwks: jose.JWTVerifyGetKey;
  nonce?: string;
  expectedSubject?: string | null;
  platform?: {
    requiredAcr: string;
    maxAuthAgeSeconds: number;
  };
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  subject: string;
}> {
  const access = await verifyAccessToken(input.accessToken, {
    issuer: input.issuer,
    audience: input.accessAudience,
    clientId: input.clientId,
    jwks: input.jwks,
    platform: input.platform,
  });

  let idToken = input.idToken;
  if (input.nonce) {
    if (!idToken) {
      throw new TokenVerifyError('nonce', 'id_token required when nonce set');
    }
    const id = await verifyIdToken(idToken, {
      issuer: input.issuer,
      clientId: input.clientId,
      nonce: input.nonce,
      jwks: input.jwks,
    });
    if (id.subject !== access.subject) {
      throw new TokenVerifyError('subject', 'id_token/access subject mismatch');
    }
  } else if (idToken) {
    // Refresh may return id_token without a fresh nonce — still verify iss/aud/sig.
    const id = await verifyIdTokenWithoutNonce(idToken, {
      issuer: input.issuer,
      clientId: input.clientId,
      jwks: input.jwks,
    });
    if (id.subject !== access.subject) {
      throw new TokenVerifyError('subject', 'id_token/access subject mismatch');
    }
  } else {
    idToken = undefined;
  }

  if (input.expectedSubject && input.expectedSubject !== access.subject) {
    throw new TokenVerifyError('subject', 'subject binding mismatch');
  }

  return {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    idToken,
    expiresIn: Math.max(60, input.expiresIn ?? 300),
    subject: access.subject,
  };
}

async function verifyIdTokenWithoutNonce(
  token: string,
  options: {
    issuer: string;
    clientId: string;
    jwks: jose.JWTVerifyGetKey;
  },
): Promise<VerifiedClaims> {
  let payload: jose.JWTPayload;
  try {
    ({ payload } = await jose.jwtVerify(token, options.jwks, {
      issuer: options.issuer,
      audience: options.clientId,
      algorithms: ALLOWED_ALGORITHMS,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    }));
  } catch (error) {
    throw mapJoseVerifyError(error);
  }
  assertAzpWhenMultiAud(payload, options.clientId);
  if (typeof payload.sub !== 'string' || !payload.sub) {
    throw new TokenVerifyError('subject', 'subject missing');
  }
  return { subject: payload.sub, payload };
}
