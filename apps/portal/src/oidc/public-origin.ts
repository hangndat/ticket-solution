import { NextResponse } from 'next/server';
import { resolvePublicOrigin } from '@ticket/web-session';

/**
 * Fail-closed public origin for redirect Location headers.
 * Never fall back to request Host when WEB_PUBLIC_ORIGIN is missing/malformed
 * in production (resolvePublicOrigin → null). Dev loopback (empty allowlist)
 * still resolves via the helper.
 */
export function requirePublicOrigin(request: { url: string }):
  | { ok: true; origin: string }
  | { ok: false; response: NextResponse } {
  const origin = resolvePublicOrigin({ url: request.url });
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
