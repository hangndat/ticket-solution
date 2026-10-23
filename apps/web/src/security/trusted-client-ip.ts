/**
 * Client IP for rate limiting behind nginx (infra/deploy sets X-Forwarded-For / X-Real-IP).
 * Client-supplied X-Forwarded-For is not trusted unless TRUST_PROXY is enabled.
 */
type RateLimitEnv = Readonly<Record<string, string | undefined>>;

export function trustedClientIpForRateLimit(
  request: Request,
  env: RateLimitEnv = process.env,
): string {
  const trustProxy =
    env.TRUST_PROXY === 'true' || env.TRUST_PROXY === '1';

  if (trustProxy) {
    const realIp = request.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;

    const xff = request.headers.get('x-forwarded-for');
    if (xff) {
      const hops = xff
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (hops.length > 0) return hops[hops.length - 1]!;
    }
  }

  return 'untrusted';
}
