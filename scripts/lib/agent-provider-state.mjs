/** Private provider recovery cache under .orca-metrics/provider-recovery (0600 / 0700). */
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  unlinkSync,
  openSync,
  closeSync,
  existsSync,
} from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const RECOVERY_DIR_NAME = 'provider-recovery';
export const STATE_TTL_MS = 5 * 60 * 1000;
export const BACKOFF_MS = 5 * 60 * 1000;
export const PROBE_TIMEOUT_MS = 30 * 1000;
export const MAX_PROBE_STDOUT = 64 * 1024;

export function recoveryRoot(cwd = process.cwd()) {
  return join(cwd, '.orca-metrics', RECOVERY_DIR_NAME);
}

export function ensureRecoveryDir(root) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  chmodSync(root, 0o700);
}

export function stateKey({ provider, identityHash, model, effort }) {
  const raw = [provider, identityHash, model, effort ?? ''].join('\0');
  return createHash('sha256').update(raw).digest('hex');
}

export function statePath(root, key) {
  return join(root, `${key}.json`);
}

export function readState(root, key) {
  const file = statePath(root, key);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeState(root, key, record) {
  ensureRecoveryDir(root);
  const file = statePath(root, key);
  writeFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'w' });
  chmodSync(file, 0o600);
}

export function deleteState(root, key) {
  const file = statePath(root, key);
  if (existsSync(file)) unlinkSync(file);
}

export function hashIdentity(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

const LOCK_NAME = '.probe.lock';

export function tryAcquireProbeLock(root, { staleMs = PROBE_TIMEOUT_MS + 5000, now = Date.now() } = {}) {
  ensureRecoveryDir(root);
  const lockPath = join(root, LOCK_NAME);
  if (existsSync(lockPath)) {
    try {
      const held = JSON.parse(readFileSync(lockPath, 'utf8'));
      const since = held?.since ? Date.parse(held.since) : NaN;
      if (Number.isFinite(since) && now - since < staleMs) return { acquired: false, lockPath };
      if (Number.isFinite(since)) {
        try {
          unlinkSync(lockPath);
        } catch {
          return { acquired: false, lockPath };
        }
      } else {
        return { acquired: false, lockPath };
      }
    } catch {
      return { acquired: false, lockPath };
    }
  }
  const ownerToken = randomUUID();
  try {
    const fd = openSync(lockPath, 'wx', 0o600);
    writeFileSync(
      fd,
      `${JSON.stringify({ since: new Date(now).toISOString(), pid: process.pid, owner: ownerToken })}\n`,
    );
    closeSync(fd);
    chmodSync(lockPath, 0o600);
    return { acquired: true, lockPath, ownerToken };
  } catch {
    return { acquired: false, lockPath };
  }
}

export function releaseProbeLock(lockPath, ownerToken) {
  if (!lockPath || !ownerToken) return;
  try {
    const held = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (held?.owner !== ownerToken) return;
    unlinkSync(lockPath);
  } catch {
    /* best-effort */
  }
}

export function isFresh(record, now = Date.now()) {
  if (!record?.checkedAt) return false;
  const t = Date.parse(record.checkedAt);
  return Number.isFinite(t) && now - t <= STATE_TTL_MS && now >= t;
}

export function inBackoff(record, now = Date.now()) {
  if (!record?.nextCheckAt) return false;
  const t = Date.parse(record.nextCheckAt);
  return Number.isFinite(t) && now < t;
}

export function beforeKnownReset(record, now = Date.now()) {
  if (!record?.resetAt) return false;
  const t = Date.parse(record.resetAt);
  return Number.isFinite(t) && now < t;
}
