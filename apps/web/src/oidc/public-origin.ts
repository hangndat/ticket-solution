/**
 * Canonical public origin helpers (no next/headers — safe for unit tests).
 * Prefer WEB_PUBLIC_ORIGIN over X-Forwarded-* / bind address (prod nginx).
 */

export function canonicalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host =
      url.hostname === '127.0.0.1' || url.hostname === '::1'
        ? 'localhost'
        : url.hostname;
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`;
  } catch {
    return null;
  }
}

/** First WEB_PUBLIC_ORIGIN entry as absolute origin, or null if unset/invalid. */
export function configuredPublicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const first = (env.WEB_PUBLIC_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .find(Boolean);
  if (!first) return null;
  try {
    return new URL(first).origin;
  } catch {
    return null;
  }
}

/** Canonical allowlist from WEB_PUBLIC_ORIGIN (comma-separated). */
export function webPublicOriginAllowlist(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return (env.WEB_PUBLIC_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => canonicalizeOrigin(raw))
    .filter((x): x is string => x != null);
}

/**
 * Origin for redirects / CSRF expected host behind nginx.
 * Order: WEB_PUBLIC_ORIGIN → X-Forwarded-Host/Proto → request.url.
 */
export function resolvePublicOrigin(
  request: { headers: Headers; url: string },
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = configuredPublicOrigin(env);
  if (fromEnv) return fromEnv;

  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwardedHost && proto && !forwardedHost.startsWith('0.0.0.0')) {
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}
