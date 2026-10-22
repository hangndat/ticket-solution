const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;

const hits = new Map<string, number[]>();

export function clientKeyFromRequest(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local'
  );
}

export function isAnalyticsRateLimited(key: string): boolean {
  const now = Date.now();
  const prev = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    hits.set(key, prev);
    return true;
  }
  prev.push(now);
  hits.set(key, prev);
  return false;
}

/** Test helper — reset in-memory window. */
export function __resetAnalyticsRateLimitForTests() {
  hits.clear();
}
