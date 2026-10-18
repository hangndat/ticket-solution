import { createHash } from 'node:crypto';

/**
 * Per-process refresh single-flight + short result cache.
 *
 * Key = SHA-256(issuer \\0 clientId \\0 refreshToken) — never log the raw token.
 *
 * Multi-instance / multi-replica: this Map is NOT distributed. Concurrent
 * refresh across Node processes can still race at the IdP. Document before
 * production horizontal scale; do not claim distributed safety from this module.
 */

export type RefreshFlightGrant = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  subject: string;
};

export type RefreshFlightResult =
  | { ok: true; grant: RefreshFlightGrant }
  | {
      ok: false;
      reason: 'misconfigured' | 'missing_refresh' | 'rejected' | 'network';
    };

const inflight = new Map<string, Promise<RefreshFlightResult>>();
const recent = new Map<string, { result: RefreshFlightResult; until: number }>();

const MAX_RECENT = 64;
const RECENT_TTL_MS = 5_000;

export function staffRefreshFlightKey(
  refreshToken: string,
  issuer: string,
  clientId: string,
): string {
  return createHash('sha256')
    .update(`${issuer}\0${clientId}\0${refreshToken}`, 'utf8')
    .digest('hex');
}

function pruneRecent(now: number): void {
  for (const [key, entry] of recent) {
    if (entry.until <= now) recent.delete(key);
  }
  while (recent.size > MAX_RECENT) {
    const oldest = recent.keys().next().value;
    if (oldest === undefined) break;
    recent.delete(oldest);
  }
}

export function peekStaffRefreshFlight(
  key: string,
  now = Date.now(),
): RefreshFlightResult | null {
  pruneRecent(now);
  const hit = recent.get(key);
  if (!hit || hit.until <= now) return null;
  return hit.result;
}

export function rememberStaffRefreshFlight(
  key: string,
  result: RefreshFlightResult,
  now = Date.now(),
): void {
  pruneRecent(now);
  recent.set(key, { result, until: now + RECENT_TTL_MS });
  pruneRecent(now);
}

/**
 * Coalesce concurrent refresh work for the same key.
 * All waiters receive the same result; each caller must apply cookies to its
 * own jar so losers never clear a winner mid-flight.
 */
export async function singleFlightStaffRefresh(
  key: string,
  work: () => Promise<RefreshFlightResult>,
): Promise<RefreshFlightResult> {
  const cached = peekStaffRefreshFlight(key);
  if (cached) return cached;

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const result = await work();
        rememberStaffRefreshFlight(key, result);
        return result;
      } catch {
        const failed: RefreshFlightResult = { ok: false, reason: 'network' };
        rememberStaffRefreshFlight(key, failed);
        return failed;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, pending);
  }
  return pending;
}

export function clearStaffRefreshFlightCache(): void {
  inflight.clear();
  recent.clear();
}

/** Test helper — inspect cache sizes without exposing keys/tokens. */
export function staffRefreshFlightStatsForTests(): {
  inflight: number;
  recent: number;
} {
  return { inflight: inflight.size, recent: recent.size };
}
