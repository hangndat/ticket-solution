import { NextResponse } from 'next/server';
import {
  canonicalizeOrigin,
  resolvePublicOrigin as resolvePublicOriginFromSession,
} from '@ticket/web-session';

export { canonicalizeOrigin } from '@ticket/web-session';

/** First WEB_PUBLIC_ORIGIN entry as absolute origin, or null if unset/invalid. */
export function configuredPublicOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const first = (env.WEB_PUBLIC_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .find(Boolean);
  if (!first) return null;
  return canonicalizeOrigin(first);
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
 * Configured public URL first; forwarded headers are never a trust source
 * (@ticket/web-session).
 */
export function resolvePublicOrigin(
  request: { url: string },
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return resolvePublicOriginFromSession(request, env);
}

/**
 * Fail-closed public origin for redirect Location headers.
 * Never fall back to request Host when WEB_PUBLIC_ORIGIN is missing/malformed
 * in production (resolvePublicOrigin → null).
 */
export function requirePublicOrigin(request: { url: string }):
  | { ok: true; origin: string }
  | { ok: false; response: NextResponse } {
  const origin = resolvePublicOrigin(request);
  if (!origin) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: 'ORIGIN_NOT_CONFIGURED',
          message:
            'WEB_PUBLIC_ORIGIN is missing or invalid — refusing Host fallback for redirects.',
          requestId: crypto.randomUUID(),
          retryable: false,
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'private, no-store' },
        },
      ),
    };
  }
  return { ok: true, origin };
}
