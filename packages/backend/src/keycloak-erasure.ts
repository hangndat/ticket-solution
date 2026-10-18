/**
 * Keycloak Admin erasure client (SEC-2 I2 DELETE).
 * Production path: GET/DELETE /admin/realms/{realm}/users/{id} with id = JWT sub (UUID).
 * No email/username fuzzy search. Worker-only client secret.
 */

export const IDP_ERROR_CODES = {
  IDP_MISCONFIGURED: 'IDP_MISCONFIGURED',
  IDP_ISSUER_NOT_ALLOWLISTED: 'IDP_ISSUER_NOT_ALLOWLISTED',
  IDP_SUBJECT_NOT_UUID: 'IDP_SUBJECT_NOT_UUID',
  IDP_TIMEOUT: 'IDP_TIMEOUT',
  IDP_HTTP_503: 'IDP_HTTP_503',
  IDP_PATH_404: 'IDP_PATH_404',
  IDP_USER_404: 'IDP_USER_404',
  IDP_FORBIDDEN: 'IDP_FORBIDDEN',
  IDP_UNAUTHORIZED: 'IDP_UNAUTHORIZED',
  IDP_RETRYABLE: 'IDP_RETRYABLE',
  IDP_UNKNOWN: 'IDP_UNKNOWN',
} as const;

export type IdpErrorCode =
  (typeof IDP_ERROR_CODES)[keyof typeof IDP_ERROR_CODES];

export type KeycloakErasureConfig = {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  /** Canonical OIDC issuer allowlist (exact match). */
  allowedIssuers: string[];
  /** When false/unset, worker must not complete IdP (fail-closed). */
  enabled: boolean;
};

export type ErasureOutcome =
  | { kind: 'DELETED' }
  | { kind: 'NOT_FOUND' }
  | {
      kind: 'FAILED';
      errorCode: IdpErrorCode;
      retryable: boolean;
      /** Optional non-terminal phase marker. */
      idpStatus?: 'FAILED' | 'DISABLED_PENDING_DELETE' | 'PENDING';
    };

export type KeycloakErasureAdapter = {
  deleteUserBySubject(input: {
    issuer: string;
    subject: string;
  }): Promise<ErasureOutcome>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidSubject(subject: string): boolean {
  return UUID_RE.test(subject);
}

/**
 * Env (coordinator root placeholders):
 * KEYCLOAK_BASE_URL, KEYCLOAK_REALM, KEYCLOAK_ERASURE_CLIENT_ID,
 * KEYCLOAK_ERASURE_CLIENT_SECRET, KEYCLOAK_ERASURE_ENABLED=1
 * Issuer allowlist from OIDC_ISSUER (exact).
 */
export function readKeycloakErasureEnvironment(
  env: NodeJS.ProcessEnv,
): KeycloakErasureConfig | null {
  const enabledRaw = env['KEYCLOAK_ERASURE_ENABLED']?.trim().toLowerCase();
  const enabled = enabledRaw === '1' || enabledRaw === 'true';
  const baseUrl = (env['KEYCLOAK_BASE_URL']?.trim() ?? '').replace(/\/$/, '');
  const realm = env['KEYCLOAK_REALM']?.trim() ?? '';
  const clientId = env['KEYCLOAK_ERASURE_CLIENT_ID']?.trim() ?? '';
  const clientSecret = env['KEYCLOAK_ERASURE_CLIENT_SECRET']?.trim() ?? '';
  const issuer = env['OIDC_ISSUER']?.trim() ?? '';

  if (!enabled) {
    return null;
  }
  if (!baseUrl || !realm || !clientId || !clientSecret || !issuer) {
    console.error(
      JSON.stringify({
        alert: 'account_deletion_idp_misconfigured',
        severity: 'error',
      }),
    );
    return null;
  }
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return null;
    }
  } catch {
    return null;
  }
  return {
    baseUrl,
    realm,
    clientId,
    clientSecret,
    allowedIssuers: [issuer],
    enabled: true,
  };
}

type FetchLike = typeof fetch;

export function createKeycloakErasureAdapter(
  config: KeycloakErasureConfig,
  fetchImpl: FetchLike = fetch,
): KeycloakErasureAdapter {
  let cachedToken: { value: string; expiresAtMs: number } | null = null;

  async function clientCredentialsToken(): Promise<
    { ok: true; token: string } | { ok: false; outcome: ErasureOutcome }
  > {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAtMs > now + 5_000) {
      return { ok: true, token: cachedToken.value };
    }
    const tokenUrl = `${config.baseUrl}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/token`;
    let res: Response;
    try {
      res = await fetchImpl(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return {
        ok: false,
        outcome: {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_TIMEOUT,
          retryable: true,
        },
      };
    }
    if (res.status === 404) {
      return {
        ok: false,
        outcome: {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_PATH_404,
          retryable: false,
        },
      };
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        outcome: {
          kind: 'FAILED',
          errorCode:
            res.status === 401
              ? IDP_ERROR_CODES.IDP_UNAUTHORIZED
              : IDP_ERROR_CODES.IDP_FORBIDDEN,
          retryable: false,
        },
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        outcome: {
          kind: 'FAILED',
          errorCode:
            res.status >= 500
              ? IDP_ERROR_CODES.IDP_HTTP_503
              : IDP_ERROR_CODES.IDP_RETRYABLE,
          retryable: res.status >= 500 || res.status === 429,
        },
      };
    }
    const body = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) {
      return {
        ok: false,
        outcome: {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_UNKNOWN,
          retryable: true,
        },
      };
    }
    cachedToken = {
      value: body.access_token,
      expiresAtMs: now + Math.max(30, Number(body.expires_in ?? 60)) * 1000,
    };
    return { ok: true, token: body.access_token };
  }

  return {
    async deleteUserBySubject(input) {
      if (!config.allowedIssuers.includes(input.issuer)) {
        return {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_ISSUER_NOT_ALLOWLISTED,
          retryable: false,
        };
      }
      if (!isUuidSubject(input.subject)) {
        // Ops blocker — no username/email fallback in production path.
        return {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_SUBJECT_NOT_UUID,
          retryable: false,
        };
      }

      const tok = await clientCredentialsToken();
      if (!tok.ok) return tok.outcome;

      const userPath = `${config.baseUrl}/admin/realms/${encodeURIComponent(config.realm)}/users/${encodeURIComponent(input.subject)}`;

      // Confirm user resource exists (or already absent) on allowlisted realm path.
      let getRes: Response;
      try {
        getRes = await fetchImpl(userPath, {
          method: 'GET',
          headers: { authorization: `Bearer ${tok.token}` },
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        return {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_TIMEOUT,
          retryable: true,
        };
      }

      if (getRes.status === 404) {
        // Distinguish user absence vs wrong realm/path: token endpoint already
        // succeeded for this realm → treat as confirmed user absence.
        return { kind: 'NOT_FOUND' };
      }
      if (getRes.status === 401 || getRes.status === 403) {
        return {
          kind: 'FAILED',
          errorCode:
            getRes.status === 401
              ? IDP_ERROR_CODES.IDP_UNAUTHORIZED
              : IDP_ERROR_CODES.IDP_FORBIDDEN,
          retryable: false,
        };
      }
      if (!getRes.ok) {
        if (getRes.status >= 500) {
          return {
            kind: 'FAILED',
            errorCode: IDP_ERROR_CODES.IDP_HTTP_503,
            retryable: true,
          };
        }
        return {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_UNKNOWN,
          retryable: true,
        };
      }

      let delRes: Response;
      try {
        delRes = await fetchImpl(userPath, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${tok.token}` },
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        return {
          kind: 'FAILED',
          errorCode: IDP_ERROR_CODES.IDP_TIMEOUT,
          retryable: true,
        };
      }

      if (delRes.status === 204 || delRes.status === 200) {
        return { kind: 'DELETED' };
      }
      if (delRes.status === 404) {
        return { kind: 'NOT_FOUND' };
      }
      if (delRes.status === 401 || delRes.status === 403) {
        return {
          kind: 'FAILED',
          errorCode:
            delRes.status === 401
              ? IDP_ERROR_CODES.IDP_UNAUTHORIZED
              : IDP_ERROR_CODES.IDP_FORBIDDEN,
          retryable: false,
        };
      }
      if (delRes.status >= 500 || delRes.status === 409 || delRes.status === 429) {
        return {
          kind: 'FAILED',
          errorCode:
            delRes.status >= 500
              ? IDP_ERROR_CODES.IDP_HTTP_503
              : IDP_ERROR_CODES.IDP_RETRYABLE,
          retryable: true,
        };
      }
      return {
        kind: 'FAILED',
        errorCode: IDP_ERROR_CODES.IDP_UNKNOWN,
        retryable: true,
      };
    },
  };
}

/** Test-only fault injector — never wire into production paths. */
export function createFakeKeycloakErasureAdapter(handlers: {
  deleteUserBySubject: KeycloakErasureAdapter['deleteUserBySubject'];
}): KeycloakErasureAdapter {
  return {
    deleteUserBySubject: handlers.deleteUserBySubject,
  };
}
