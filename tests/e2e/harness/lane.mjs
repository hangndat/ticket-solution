// Lane pool cho E2E: mỗi lane là một stack Docker dùng lại được với origin cố
// định, nên build Web/Portal còn hiệu lực giữa các run và nhiều run chạy song
// song trên các lane khác nhau. Isolation giữa hai run song song vẫn là hai
// host khác nhau; hai run trong cùng một lane bị lock ép tuần tự.
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const E2E = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = resolve(E2E, '../..');
export const LANES_DIR = resolve(E2E, '.lanes');

const MAX_LANES = 16;

function positive(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Số lane mặc định; giữ nhỏ vì mỗi lane là năm container. */
export function lanePool() {
  return Math.min(positive(process.env.E2E_LANES, 2), MAX_LANES);
}

function tlsPortBase() {
  return positive(process.env.E2E_LANE_TLS_PORT_BASE, 44300);
}

/** Mọi định danh của lane phải ổn định giữa các run thì build mới dùng lại được. */
export function laneConfig(value) {
  const laneId = Number(value);
  if (!Number.isInteger(laneId) || laneId < 1 || laneId > MAX_LANES) {
    throw new Error(`BLOCKED: lane phải là số nguyên 1..${MAX_LANES}`);
  }
  const name = `lane${laneId}`;
  const dir = resolve(LANES_DIR, name);
  return {
    laneId,
    name,
    dir,
    project: `e2e-${name}`,
    realm: `e2e-${name}`,
    suffix: `e2e-${name}.test`,
    tlsPort: tlsPortBase() + laneId,
    lockPath: resolve(dir, 'lane.lock'),
    secretsPath: resolve(dir, 'secrets.json'),
    composePath: resolve(dir, 'compose.json'),
    certPath: resolve(dir, 'tls.crt'),
    keyPath: resolve(dir, 'tls.key'),
    opensslPath: resolve(dir, 'openssl.cnf'),
    buildMarkerPath: resolve(dir, 'build.json'),
    logPath: resolve(dir, 'lane.log'),
  };
}

export function ensureLaneDir(lane) {
  mkdirSync(lane.dir, { recursive: true, mode: 0o700 });
  return lane.dir;
}

/**
 * Secret của hạ tầng phải sống cùng lane: container chỉ nhận env lúc khởi
 * động, nên không thể xoay chúng theo từng run mà vẫn dùng lại stack.
 */
export function laneSecrets(lane) {
  ensureLaneDir(lane);
  if (existsSync(lane.secretsPath)) {
    const stored = JSON.parse(readFileSync(lane.secretsPath, 'utf8'));
    if (stored.pg && stored.kc && stored.minio) return stored;
  }
  const secrets = {
    pg: randomBytes(24).toString('hex'),
    kc: randomBytes(24).toString('hex'),
    minio: randomBytes(24).toString('hex'),
  };
  writeFileSync(lane.secretsPath, JSON.stringify(secrets, null, 2) + '\n', {
    mode: 0o600,
  });
  return secrets;
}

function holderOf(lockPath) {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** Lock chết (process không còn) mới được thu hồi; không cướp lock đang sống. */
export function laneLockState(lane) {
  if (!existsSync(lane.lockPath)) return { free: true, holder: null };
  const holder = holderOf(lane.lockPath);
  if (!holder || !processAlive(holder.pid)) {
    return { free: true, holder, stale: true };
  }
  return { free: false, holder };
}

export function tryAcquireLaneLock(lane, runId) {
  ensureLaneDir(lane);
  const state = laneLockState(lane);
  if (!state.free) return null;
  if (state.stale) {
    try {
      unlinkSync(lane.lockPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  let fd;
  try {
    fd = openSync(lane.lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') return null;
    throw error;
  }
  try {
    writeFileSync(
      fd,
      JSON.stringify(
        { pid: process.pid, runId, acquiredAt: new Date().toISOString() },
        null,
        2,
      ) + '\n',
    );
  } finally {
    closeSync(fd);
  }
  return { ...lane, runId };
}

/**
 * Lấy lane cụ thể hoặc lane rảnh đầu tiên trong pool. Chờ tới deadline vì một
 * run tuần tự trong cùng lane là hành vi mong muốn, không phải lỗi.
 */
export async function acquireLane({
  lane: requested,
  pool = lanePool(),
  runId,
  timeoutMs = positive(process.env.E2E_LANE_WAIT_MS, 2_700_000),
  onWait,
} = {}) {
  const candidates = requested
    ? [laneConfig(requested)]
    : Array.from({ length: pool }, (_, index) => laneConfig(index + 1));
  const deadline = Date.now() + timeoutMs;
  let notified = false;
  for (;;) {
    for (const candidate of candidates) {
      const held = tryAcquireLaneLock(candidate, runId);
      if (held) return held;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `BLOCKED: không lấy được lane sau ${Math.round(timeoutMs / 1000)}s (${candidates
          .map((c) => c.name)
          .join(', ')} đang bận)`,
      );
    }
    if (!notified) {
      notified = true;
      onWait?.(candidates.map((c) => c.name));
    }
    await delay(2000);
  }
}

export function releaseLane(held) {
  if (!held?.lockPath) return;
  const holder = holderOf(held.lockPath);
  // Không xóa lock của run khác: lock có thể đã bị thu hồi và cấp lại.
  if (holder && holder.runId && held.runId && holder.runId !== held.runId)
    return;
  try {
    unlinkSync(held.lockPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function laneStatus(pool = lanePool()) {
  return Array.from({ length: pool }, (_, index) => {
    const lane = laneConfig(index + 1);
    const lock = laneLockState(lane);
    return {
      name: lane.name,
      tlsPort: lane.tlsPort,
      project: lane.project,
      provisioned: existsSync(lane.secretsPath),
      busy: !lock.free,
      holder: lock.free ? null : lock.holder,
      stale: Boolean(lock.stale),
    };
  });
}

/**
 * Template database chỉ dùng lại được khi schema không đổi, nên tên template
 * mang fingerprint của chính nội dung migration.
 */
export function migrationsFingerprint() {
  const requireBackend = createRequire(
    resolve(ROOT, 'packages/backend/package.json'),
  );
  const { migrationFiles } = requireBackend('./test/migration-files.cjs');
  const hash = createHash('sha256');
  for (const file of migrationFiles()) {
    hash.update(file.split('/').at(-1));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function templateDatabase(fingerprint = migrationsFingerprint()) {
  return `e2e_tpl_${fingerprint.slice(0, 16)}`;
}

/** Tên database phải là identifier hợp lệ; runId có dấu gạch ngang. */
export function runDatabase(runId) {
  const safe = String(runId)
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase();
  if (!safe || safe.length > 50) throw new Error('BLOCKED: runId không hợp lệ');
  return `e2e_${safe}`;
}

/**
 * Build Web/Portal chỉ dùng lại được khi cả source lẫn origin không đổi; origin
 * nằm trong key vì nó bị nướng vào trang prerender.
 */
export function buildKey(provenance, lane) {
  return createHash('sha256')
    .update(provenance.gitCommit)
    .update('\0')
    .update(provenance.workingTreeFingerprint)
    .update('\0')
    .update(lane.suffix)
    .update('\0')
    .update(String(lane.tlsPort))
    .digest('hex');
}

export function readBuildMarker(lane) {
  try {
    return JSON.parse(readFileSync(lane.buildMarkerPath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeBuildMarker(lane, key, extra = {}) {
  ensureLaneDir(lane);
  writeFileSync(
    lane.buildMarkerPath,
    JSON.stringify(
      { key, builtAt: new Date().toISOString(), ...extra },
      null,
      2,
    ) + '\n',
    { mode: 0o600 },
  );
}

export function clearBuildMarker(lane) {
  try {
    unlinkSync(lane.buildMarkerPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function removeLaneDir(lane) {
  rmSync(lane.dir, { recursive: true, force: true });
}
