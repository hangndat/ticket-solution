/** Dispatch reserve, not an estimate of the cost of the next task. */
export const QUOTA_POLICY = Object.freeze({ reservePercent: 20, maxAgeMs: 5 * 60 * 1000 });

export function assessCodexQuota(snapshot, { limitIds, essential = false, now = Date.now() } = {}) {
  const result = (state, extra = {}) => ({
    enforced: true, provider: 'codex', state, allowed: state === 'available' || state === 'reserve_for_essential',
    reservePercent: QUOTA_POLICY.reservePercent, ...extra,
  });
  if (!snapshot || snapshot.source !== 'codex.app-server.account/rateLimits/read' || !snapshot.accountIdHash) return result('unknown');
  const captured = Date.parse(snapshot.timestamp);
  if (!Number.isFinite(captured) || captured > now || now - captured > QUOTA_POLICY.maxAgeMs) return result('stale');
  if (!Array.isArray(limitIds) || !limitIds.length || !Array.isArray(snapshot.buckets)) return result('unknown');

  const windows = [];
  let incomplete = false;
  for (const id of limitIds) {
    const matches = snapshot.buckets.filter(bucket => bucket?.limitId === id);
    if (matches.length !== 1) { incomplete = true; continue; }
    const bucket = matches[0];
    if (bucket.rateLimitReachedType != null) return result('exhausted', { limitId: id });
    let present = 0;
    for (const name of ['primary', 'secondary']) {
      const window = bucket[name];
      if (window == null) continue;
      present++;
      if (typeof window.usedPercent !== 'number' || !Number.isFinite(window.usedPercent) || window.usedPercent < 0 || window.usedPercent > 100 ||
          typeof window.windowDurationMins !== 'number' || !Number.isFinite(window.windowDurationMins) || window.windowDurationMins <= 0 ||
          typeof window.resetsAt !== 'number' || !Number.isFinite(window.resetsAt)) {
        incomplete = true; continue;
      }
      if (window.resetsAt * 1000 <= now) return result('stale', { limitId: id });
      if (window.usedPercent >= 100) return result('exhausted', { limitId: id, window: name });
      windows.push({ limitId: id, window: name, remainingPercent: 100 - window.usedPercent, resetsAt: window.resetsAt });
    }
    if (!present) incomplete = true;
  }
  if (incomplete || !windows.length) return result('unknown');
  const remainingPercent = Math.min(...windows.map(window => window.remainingPercent));
  const state = remainingPercent <= QUOTA_POLICY.reservePercent ? (essential ? 'reserve_for_essential' : 'reserved') : 'available';
  return result(state, { remainingPercent, windows, accountIdHash: snapshot.accountIdHash, capturedAt: snapshot.timestamp });
}
