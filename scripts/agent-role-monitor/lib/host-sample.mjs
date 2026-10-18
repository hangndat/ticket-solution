/**
 * ps-based CPU% / RSS sample for a PID (macOS / Linux). No extra deps.
 */
import { execFileSync } from 'node:child_process';

/**
 * @param {number} pid
 * @returns {{ pid: number, cpu_pct: number|null, rss_mb: number|null }}
 */
export function samplePid(pid) {
  const n = Number(pid);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid pid: ${pid}`);
  }

  // macOS / Linux: rss in KB
  let out;
  try {
    out = execFileSync('ps', ['-o', 'pid=,pcpu=,rss=', '-p', String(n)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const msg = err?.stderr?.toString?.() || err?.message || String(err);
    throw new Error(`ps failed for pid ${n}: ${msg}`);
  }

  if (!out) {
    throw new Error(`pid ${n} not found`);
  }

  const parts = out.split(/\s+/).filter(Boolean);
  // formats: "123  1.2  45678" or sometimes pid on its own line quirks
  let cpu = null;
  let rssKb = null;
  if (parts.length >= 3) {
    cpu = Number(parts[1]);
    rssKb = Number(parts[2]);
  } else if (parts.length === 2) {
    // rare: pid missing from -o when dead; treat as cpu rss
    cpu = Number(parts[0]);
    rssKb = Number(parts[1]);
  }

  return {
    pid: n,
    cpu_pct: Number.isFinite(cpu) ? cpu : null,
    rss_mb: Number.isFinite(rssKb) ? Math.round((rssKb / 1024) * 1000) / 1000 : null,
  };
}
