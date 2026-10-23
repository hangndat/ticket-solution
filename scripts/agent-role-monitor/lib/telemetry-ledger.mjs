/**
 * Private metadata ledger for telemetry (transcript structure, tokens, account snapshots).
 * Path: .orca-metrics/telemetry-metadata.jsonl (gitignored, mode 0600).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot } from './ledger.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TELEMETRY_SCHEMA_VERSION = 1;

export function defaultTelemetryLedgerPath(root = repoRoot(__dirname)) {
  return path.join(root, '.orca-metrics', 'telemetry-metadata.jsonl');
}

export function ensureTelemetryLedger(ledgerPath) {
  const dir = path.dirname(ledgerPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    // best-effort
  }
  if (!fs.existsSync(ledgerPath)) {
    fs.writeFileSync(ledgerPath, '', { mode: 0o600 });
  } else {
    try {
      fs.chmodSync(ledgerPath, 0o600);
    } catch {
      // best-effort
    }
  }
}

/**
 * @param {string} targetPath
 * @param {string} content
 * @param {{ mode?: number, overwrite?: boolean }} [opts]
 */
export function writeSecureFile(targetPath, content, opts = {}) {
  const mode = opts.mode ?? 0o600;
  const overwrite = opts.overwrite ?? false;
  const resolved = path.resolve(targetPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (!overwrite && fs.existsSync(resolved)) {
    const err = new Error(`refusing to overwrite existing file: ${resolved}`);
    err.code = 'EEXIST';
    throw err;
  }
  fs.writeFileSync(resolved, content, { mode, flag: overwrite ? 'w' : 'wx' });
  try {
    fs.chmodSync(resolved, mode);
  } catch {
    // best-effort
  }
}

export function readTelemetryEvents(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return [];
  const text = fs.readFileSync(ledgerPath, 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // skip corrupt
    }
  }
  return out;
}

/**
 * @param {string} ledgerPath
 * @param {object} event
 */
export function appendTelemetryEvent(ledgerPath, event) {
  if (!event?.event || event.v !== TELEMETRY_SCHEMA_VERSION) {
    throw new Error(`telemetry event must set v=${TELEMETRY_SCHEMA_VERSION} and event`);
  }
  ensureTelemetryLedger(ledgerPath);
  const line = `${JSON.stringify(event)}\n`;
  fs.appendFileSync(ledgerPath, line, { mode: 0o600 });
  try {
    fs.chmodSync(ledgerPath, 0o600);
  } catch {
    // best-effort
  }
  return { appended: true, event, replaced: false };
}

/**
 * Replace prior telemetry.collect with same collect_key (idempotent per dispatch+source).
 * @param {string} ledgerPath
 * @param {object} event
 */
export function upsertTelemetryCollectEvent(ledgerPath, event) {
  const key = event?.attrs?.collect_key;
  if (!key) return appendTelemetryEvent(ledgerPath, event);

  ensureTelemetryLedger(ledgerPath);
  const existing = readTelemetryEvents(ledgerPath);
  const replaced = existing.some(e => e.event === 'telemetry.collect' && e.attrs?.collect_key === key);
  // One append avoids losing another worker's snapshot during read/modify/write.
  appendTelemetryEvent(ledgerPath, event);
  return { appended: true, replaced, event };
}

/**
 * Newest telemetry.collect per dispatch_id (by ts).
 * @param {object[]} events
 */
export function newestCollectByDispatch(events) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const e of events) {
    if (e.event !== 'telemetry.collect') continue;
    const key = e.dispatch_id || (e.attrs?.thread_id ? `thread:${e.attrs.thread_id}` : null);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev || String(e.ts) >= String(prev.ts)) map.set(key, e);
  }
  return [...map.values()];
}

/**
 * Newest account snapshot per run_id (by ts).
 * @param {object[]} events
 * @param {string|null} runId
 */
export function orderedAccountSnapshots(events, runId = null) {
  return events
    .filter((e) => e.event === 'telemetry.account_snapshot')
    .filter((e) => !runId || e.run_id === runId)
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}
