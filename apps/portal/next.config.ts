import type { NextConfig } from 'next';

/**
 * Portal CSP (ADR-20): separate from apps/web.
 * AntD css-in-js needs style-src 'unsafe-inline' until StyleProvider nonce is wired;
 * scripts stay strict (no unsafe-eval).
 */
function contentSecurityPolicy(): string {
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
    // Next.js / React dev + Turbopack HMR (ws same-origin).
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
  // Next 16 blocks dev assets/HMR from 127.0.0.1 unless explicitly allowed.
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
