import * as jose from 'jose';
import type { OidcConfig } from './oidc';
import { IdentityError } from './identity-error';
import { PlatformError, PLATFORM_ERROR_CODES } from './platform-error';
import type { PlatformSecurityConfig } from './platform-config';

export type PlatformVerifiedIdentity = {
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  authTime: number;
  acr: string;
};

export type PlatformOidcVerifier = {
  verifyBearerToken(
    authorizationHeader: string | undefined,
  ): Promise<PlatformVerifiedIdentity>;
};

const ALLOWED_ALGORITHMS: jose.JWTVerifyOptions['algorithms'] = [
  'RS256',
  'ES256',
];

/**
 * Platform verifier: issuer + platform audience + MFA ACR + fresh auth_time.
 * No fallback to emailVerified / acr=1 / role claims.
 */
export function createPlatformOidcVerifier(
  oidc: OidcConfig,
  security: PlatformSecurityConfig,
  options: { jwks?: jose.JWTVerifyGetKey } = {},
): PlatformOidcVerifier {
  const jwks =
    options.jwks ?? jose.createRemoteJWKSet(new URL(oidc.jwksUrl));

  return {
    async verifyBearerToken(authorizationHeader) {
      if (
        typeof authorizationHeader !== 'string' ||
        !authorizationHeader.startsWith('Bearer ')
      ) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.UNAUTHENTICATED,
          'Bearer token required',
        );
      }
      const token = authorizationHeader.slice('Bearer '.length).trim();
      if (!token) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.UNAUTHENTICATED,
          'Bearer token required',
        );
      }

      let payload: jose.JWTPayload;
      try {
        ({ payload } = await jose.jwtVerify(token, jwks, {
          issuer: oidc.issuer,
          audience: security.platformAudience,
          algorithms: ALLOWED_ALGORITHMS,
        }));
      } catch {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.UNAUTHENTICATED,
          'Invalid or expired token',
        );
      }

      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.UNAUTHENTICATED,
          'Token subject missing',
        );
      }

      const acr =
        typeof payload.acr === 'string'
          ? payload.acr
          : Array.isArray(payload.acr)
            ? String(payload.acr[0] ?? '')
            : '';
      if (!security.mfaAcrValues.includes(acr)) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.MFA_REQUIRED,
          'MFA assurance required',
        );
      }

      const authTime =
        typeof payload.auth_time === 'number'
          ? payload.auth_time
          : typeof payload.auth_time === 'string'
            ? Number(payload.auth_time)
            : NaN;
      if (!Number.isFinite(authTime)) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.MFA_REQUIRED,
          'auth_time required for MFA step-up',
        );
      }
      const age = Math.floor(Date.now() / 1000) - authTime;
      if (age < 0 || age > security.mfaAuthTimeMaxSeconds) {
        throw new PlatformError(
          PLATFORM_ERROR_CODES.MFA_REQUIRED,
          'MFA step-up expired',
        );
      }

      return {
        issuer:
          typeof payload.iss === 'string' && payload.iss
            ? payload.iss
            : oidc.issuer,
        subject: payload.sub,
        email:
          typeof payload.email === 'string' && payload.email
            ? payload.email
            : null,
        emailVerified: payload.email_verified === true,
        authTime,
        acr,
      };
    },
  };
}

/** Optional MFA check for Owner/admin tenant management on attendee audience tokens. */
export function requireMfaClaims(
  payload: jose.JWTPayload,
  security: PlatformSecurityConfig,
): void {
  const acr =
    typeof payload.acr === 'string'
      ? payload.acr
      : Array.isArray(payload.acr)
        ? String(payload.acr[0] ?? '')
        : '';
  if (!security.mfaAcrValues.includes(acr)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.MFA_REQUIRED,
      'MFA assurance required',
    );
  }
  const authTime =
    typeof payload.auth_time === 'number' ? payload.auth_time : NaN;
  if (!Number.isFinite(authTime)) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.MFA_REQUIRED,
      'auth_time required',
    );
  }
  const age = Math.floor(Date.now() / 1000) - authTime;
  if (age < 0 || age > security.mfaAuthTimeMaxSeconds) {
    throw new PlatformError(
      PLATFORM_ERROR_CODES.MFA_REQUIRED,
      'MFA step-up expired',
    );
  }
}

export function toIdentityError(error: unknown): never {
  if (error instanceof PlatformError) {
    throw new IdentityError(
      error.code === PLATFORM_ERROR_CODES.MFA_REQUIRED
        ? ('MFA_REQUIRED' as never)
        : ('UNAUTHENTICATED' as never),
      error.message,
    );
  }
  throw error;
}
