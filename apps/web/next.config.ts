import type { NextConfig } from 'next';

/**
 * Web app CSP (ADR-20): aligned with apps/portal — no AntD, same connect-src env.
 *
 * Issue #653: nonce-based script CSP is not enabled here — Next 16 still injects
 * inline hydration scripts unless every route wires per-request nonces through
 * `proxy.ts` + root layout; dropping `'unsafe-inline'` breaks the app. See
 * `tests/csp-nonce-feasibility.test.ts`.
 */
export function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV === 'development';
  const api = process.env.API_BASE_URL?.trim();
  const issuer = process.env.OIDC_ISSUER?.trim();
  const connect: string[] = ["'self'"];
  for (const raw of [api, issuer]) {
    if (!raw) continue;
    try {
      connect.push(new URL(raw).origin);
    } catch {
      /* ignore malformed env at build */
    }
  }
  if (dev) {
    connect.push('ws:', 'wss:');
  }
  const scriptSrc = dev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    `connect-src ${connect.join(' ')}`,
    "form-action 'self'",
  ].join('; ');
}

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy(),
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default config;
