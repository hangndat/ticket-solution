import * as jose from 'jose';
import { IDENTITY_ERROR_CODES } from '@ticket/contracts';
import { IdentityError } from './identity-error';
import {
  assertAccessTokenBounds,
  JOSE_ACCESS_TOKEN_VERIFY_EXTRAS,
} from './access-token-bounds';

export type OidcConfig = {
  issuer: string;
  audience: string;
  jwksUrl: string;
};

export type VerifiedIdentity = {
  issuer: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
};

export type OidcVerifier = {
  verifyBearerToken(
    authorizationHeader: string | undefined,
  ): Promise<VerifiedIdentity>;
};

const ALLOWED_ALGORITHMS: jose.JWTVerifyOptions['algorithms'] = [
  'RS256',
  'ES256',
];

/** Fail closed when OIDC env is incomplete or invalid. */
export function readOidcEnvironment(env: NodeJS.ProcessEnv): OidcConfig {
  const issuer = env['OIDC_ISSUER']?.trim() ?? '';
  const audience = env['OIDC_AUDIENCE']?.trim() ?? '';
  const jwksUrl = env['OIDC_JWKS_URL']?.trim() ?? '';
  if (!issuer || !audience || !jwksUrl) {
    throw new IdentityError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC_ISSUER, OIDC_AUDIENCE, and OIDC_JWKS_URL are required',
    );
  }
  try {
    const url = new URL(jwksUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }
  } catch {
    throw new IdentityError(
      IDENTITY_ERROR_CODES.OIDC_MISCONFIGURED,
      'OIDC_JWKS_URL must be an http(s) URL',
    );
  }
  return { issuer, audience, jwksUrl };
}

export type CreateOidcVerifierOptions = {
  /** Inject local JWKS for tests; production uses remote JWKS from config. */
  jwks?: jose.JWTVerifyGetKey;
};

export function createOidcVerifier(
  config: OidcConfig,
  options: CreateOidcVerifierOptions = {},
): OidcVerifier {
  const jwks =
    options.jwks ?? jose.createRemoteJWKSet(new URL(config.jwksUrl));

  return {
    async verifyBearerToken(authorizationHeader) {
      if (
        typeof authorizationHeader !== 'string' ||
        !authorizationHeader.startsWith('Bearer ')
      ) {
        throw new IdentityError(
          IDENTITY_ERROR_CODES.UNAUTHENTICATED,
          'Bearer token required',
        );
      }
      const token = authorizationHeader.slice('Bearer '.length).trim();
      if (!token) {
        throw new IdentityError(
          IDENTITY_ERROR_CODES.UNAUTHENTICATED,
          'Bearer token required',
        );
      }

      let payload: jose.JWTPayload;
      try {
        ({ payload } = await jose.jwtVerify(token, jwks, {
          issuer: config.issuer,
          audience: config.audience,
          algorithms: ALLOWED_ALGORITHMS,
          maxTokenAge: JOSE_ACCESS_TOKEN_VERIFY_EXTRAS.maxTokenAge,
          clockTolerance: JOSE_ACCESS_TOKEN_VERIFY_EXTRAS.clockTolerance,
        }));
      } catch {
        throw new IdentityError(
          IDENTITY_ERROR_CODES.UNAUTHENTICATED,
          'Invalid or expired token',
        );
      }

      if (assertAccessTokenBounds(payload) !== null) {
        throw new IdentityError(
          IDENTITY_ERROR_CODES.UNAUTHENTICATED,
          'Invalid or expired token',
        );
      }

      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        throw new IdentityError(
          IDENTITY_ERROR_CODES.UNAUTHENTICATED,
          'Token subject missing',
        );
      }

      const email =
        typeof payload.email === 'string' && payload.email.length > 0
          ? payload.email
          : null;
      const emailVerified = payload.email_verified === true;

      return {
        issuer:
          typeof payload.iss === 'string' && payload.iss.length > 0
            ? payload.iss
            : config.issuer,
        subject: payload.sub,
        email,
        emailVerified,
      };
    },
  };
}

/** Test helper: build a local JWKS key set from an exported public JWK. */
export function createLocalJwks(
  publicJwk: jose.JWK | jose.JWK[],
): jose.JWTVerifyGetKey {
  const keys = Array.isArray(publicJwk) ? publicJwk : [publicJwk];
  return jose.createLocalJWKSet({ keys });
}
