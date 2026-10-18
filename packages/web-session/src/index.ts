/** Pure browser-session policy. Never imports Next.js or holds per-user state. */
export type SessionEnvironment = Readonly<Record<string, string | undefined>>;
export type BrowserRequest = { method: string; url: string; headers: Headers };

export const SESSION_COOKIES = {
  access: 'oidc_access_token',
  refresh: 'oidc_refresh_token',
  idToken: 'oidc_id_token',
  pkce: 'oidc_pkce_verifier',
  state: 'oidc_oauth_state',
  returnPath: 'vemoki_post_login_path',
} as const;

export const PLATFORM_SESSION_COOKIES = {
  access: 'platform_oidc_access',
  refresh: 'platform_oidc_refresh',
  pkce: 'platform_oidc_pkce',
  state: 'platform_oidc_state',
} as const;

/** Accept actual HTTP(S) origins, never credentials, opaque URLs or URL paths. */
export function canonicalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    const host = ['127.0.0.1', '[::1]'].includes(url.hostname)
      ? 'localhost'
      : url.hostname;
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return null;
  }
}

function configuredOrigins(env: SessionEnvironment): string[] | null {
  const raw = env.WEB_PUBLIC_ORIGIN?.trim();
  if (!raw) return env.NODE_ENV === 'production' ? null : [];
  const entries = raw.split(',').map((s) => s.trim());
  const origins = entries.map(canonicalizeOrigin);
  // A configured but malformed allowlist must never fall back to a request Host.
  return origins.every((o): o is string => o !== null) ? origins : null;
}

/** Configured public URL first; forwarded headers are never a trust source. */
export function resolvePublicOrigin(
  request: Pick<BrowserRequest, 'url'>,
  env: SessionEnvironment = process.env,
): string | null {
  const list = configuredOrigins(env);
  if (list === null) return null;
  if (list.length) {
    try {
      return new URL(env.WEB_PUBLIC_ORIGIN!.split(',')[0]!.trim()).origin;
    } catch {
      return null;
    }
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return null;
  }
}

export type OriginViolation = {
  code:
    | 'CSRF_ORIGIN_REQUIRED'
    | 'CSRF_ORIGIN_MISMATCH'
    | 'ORIGIN_NOT_CONFIGURED'
    | 'INVALID_REQUEST_URL';
  status: 400 | 403 | 503;
};

/** Route adapters turn this result into their normal API error envelope. */
export function checkRequestOrigin(
  request: BrowserRequest,
  env: SessionEnvironment = process.env,
): OriginViolation | null {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase()))
    return null;
  const raw = request.headers.get('origin');
  if (!raw) return { code: 'CSRF_ORIGIN_REQUIRED', status: 403 };
  const actual = canonicalizeOrigin(raw);
  if (!actual) return { code: 'INVALID_REQUEST_URL', status: 400 };
  const list = configuredOrigins(env);
  if (list === null) return { code: 'ORIGIN_NOT_CONFIGURED', status: 503 };
  if (list.length)
    return list.includes(actual)
      ? null
      : { code: 'CSRF_ORIGIN_MISMATCH', status: 403 };
  const publicOrigin = resolvePublicOrigin(request, env);
  const expected = publicOrigin ? canonicalizeOrigin(publicOrigin) : null;
  if (!expected) return { code: 'INVALID_REQUEST_URL', status: 400 };
  return actual === expected
    ? null
    : { code: 'CSRF_ORIGIN_MISMATCH', status: 403 };
}

/** Domain is deliberately absent: app and portal have independent cookie jars. */
export function sessionCookieOptions(
  maxAge: number,
  env: SessionEnvironment = process.env,
) {
  if (!Number.isFinite(maxAge) || maxAge < 0)
    throw new RangeError('Invalid cookie lifetime');
  return {
    httpOnly: true as const,
    secure: env.NODE_ENV === 'production' || env.AUTH_COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/' as const,
    maxAge: Math.floor(maxAge),
  };
}

export const PORTAL_RETURN_PREFIXES = [
  '/',
  '/admin',
  '/tenants',
  '/platform',
  '/auth',
  '/invite',
] as const;

/** Path-only post-login navigation. Drop query/fragment and reject encoded redirects. */
export function sanitizePostLoginPath(
  raw: string | null | undefined,
  allowedPrefixes: readonly string[] = PORTAL_RETURN_PREFIXES,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(trimmed)
  )
    return null;
  const path = trimmed.split(/[?#]/, 1)[0]!;
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (
    decoded.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(decoded) ||
    decoded.includes('://') ||
    decoded.includes('%')
  )
    return null;
  // Reject dot segments before routing can normalize them into a different area.
  if (decoded.split('/').some((segment) => segment === '.' || segment === '..'))
    return null;
  return allowedPrefixes.some(
    (prefix) =>
      decoded === prefix ||
      (prefix !== '/' && decoded.startsWith(`${prefix}/`)),
  )
    ? path
    : null;
}
