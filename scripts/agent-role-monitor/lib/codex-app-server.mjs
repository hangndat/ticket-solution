/**
 * Codex app-server JSON-RPC client (async stdio handshake).
 * Tests: CODEX_TELEMETRY_APP_SERVER_FIXTURE or CODEX_TELEMETRY_APP_SERVER_SCRIPT.
 */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { TelemetryError } from './errors.mjs';

const FORBIDDEN_OUTPUT_KEYS = new Set([
  'accountId',
  'auth',
  'token',
  'apiKey',
  'codexHome',
  'userAgent',
]);

const DEFAULT_RPC_TIMEOUT_MS = 30_000;

/**
 * @param {Record<string, unknown>} raw
 * @param {string} [capturedAt]
 */
export function whitelistAccountSnapshot(raw, capturedAt = new Date().toISOString()) {
  if (!raw || typeof raw !== 'object') {
    throw new TelemetryError('snapshot_empty', 'account snapshot: empty response');
  }
  const rl = raw.rateLimits && typeof raw.rateLimits === 'object' ? raw.rateLimits : {};
  const primary = rl.primary && typeof rl.primary === 'object' ? rl.primary : {};
  const plan = rl.planType != null ? String(rl.planType) : null;
  const limitId = rl.limitId != null ? String(rl.limitId) : null;
  const usedPercent =
    typeof primary.usedPercent === 'number' && Number.isFinite(primary.usedPercent)
      ? primary.usedPercent
      : null;
  const windowMins =
    typeof primary.windowDurationMins === 'number' && Number.isFinite(primary.windowDurationMins)
      ? primary.windowDurationMins
      : null;
  const resetAt =
    typeof primary.resetsAt === 'number' && Number.isFinite(primary.resetsAt)
      ? primary.resetsAt
      : null;

  const snap = {
    timestamp: capturedAt,
    plan,
    limitId,
    usedPercent,
    windowDurationMins: windowMins,
    resetsAt: resetAt,
    source: 'codex.app-server.account/rateLimits/read',
  };

  if (raw.accountId != null && String(raw.accountId).length > 0) {
    snap.accountIdHash = createHash('sha256')
      .update(String(raw.accountId))
      .digest('hex')
      .slice(0, 16);
  }

  return snap;
}

/**
 * Whitelist account/usage/read (numeric summaries only).
 * @param {Record<string, unknown>|null} raw
 */
export function whitelistAccountUsage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  if (raw.summary && typeof raw.summary === 'object') {
    out.summary = {};
    for (const key of ['lifetimeTokens','peakDailyTokens','longestRunningTurnSec','currentStreakDays','longestStreakDays']) {
      const v = raw.summary[key];
      out.summary[key] = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    }
  }
  if (Array.isArray(raw.dailyUsageBuckets)) {
    out.dailyUsageBuckets = raw.dailyUsageBuckets.slice(0, 31).filter(row =>
      row && typeof row.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.startDate) &&
      typeof row.tokens === 'number' && Number.isFinite(row.tokens) && row.tokens >= 0
    ).map(({startDate,tokens}) => ({startDate,tokens}));
  }
  return Object.keys(out).length ? out : null;
}

/** @param {unknown} value */
export function assertNoForbiddenSnapshotKeys(value) {
  if (!value || typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_OUTPUT_KEYS.has(k)) {
      throw new TelemetryError('snapshot_forbidden_key', `forbidden snapshot key: ${k}`);
    }
    if (v && typeof v === 'object') assertNoForbiddenSnapshotKeys(v);
  }
}

/**
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} child
 * @param {number} expectId
 * @param {number} timeoutMs
 */
function waitForJsonRpcResponse(child, expectId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new TelemetryError('rpc_timeout', `app-server RPC timed out waiting for id ${expectId}`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.stderr.off('data', onErr);
    }

    function onErr() {
      // stderr ignored — may contain paths; never forward
    }

    function onData(chunk) {
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.id === expectId) {
            cleanup();
            if (msg.error) {
              reject(
                new TelemetryError(
                  'rpc_error',
                  String(msg.error.message || 'app-server RPC error').slice(0, 200),
                ),
              );
            } else {
              resolve(msg.result);
            }
            return;
          }
        } catch {
          // skip non-json noise
        }
      }
    }

    child.stdout.on('data', onData);
    child.stderr.on('data', onErr);
  });
}

function writeLine(child, obj) {
  child.stdin.write(`${JSON.stringify(obj)}\n`);
}

/**
 * @param {string[]} methods RPC methods after handshake
 * @param {Record<string, string>} env
 */
export async function invokeAppServer(methods, env = process.env) {
  const fixture = env.CODEX_TELEMETRY_APP_SERVER_FIXTURE;
  if (fixture) {
    const parsed = JSON.parse(fs.readFileSync(fixture, 'utf8'));
    const out = {};
    for (const m of methods) {
      out[m] = parsed.results?.[m] ?? parsed.result ?? parsed;
    }
    return out;
  }

  const script = env.CODEX_TELEMETRY_APP_SERVER_SCRIPT;
  const cmd = script ? env.CODEX_CLI_COMMAND || process.execPath : env.CODEX_CLI_COMMAND || 'codex';
  const args = script ? [script] : ['app-server'];
  const timeoutMs = Number(env.CODEX_TELEMETRY_RPC_TIMEOUT_MS) || DEFAULT_RPC_TIMEOUT_MS;

  const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env });

  const results = {};
  try {
    writeLine(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        clientInfo: { name: 'agent-role-monitor-telemetry', version: '1' },
        capabilities: {},
      },
    });
    await waitForJsonRpcResponse(child, 1, timeoutMs);
    writeLine(child, { jsonrpc: '2.0', method: 'initialized', params: {} });

    let id = 2;
    for (const method of methods) {
      writeLine(child, { jsonrpc: '2.0', id, method, params: {} });
      results[method] = await waitForJsonRpcResponse(child, id, timeoutMs);
      id += 1;
    }
  } finally {
    try {
      child.stdin.end();
    } catch {
      // ignore
    }
    await new Promise((resolve) => {
      const t = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
        resolve();
      }, 500);
      child.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
      try {
        child.kill('SIGTERM');
      } catch {
        clearTimeout(t);
        resolve();
      }
    });
  }

  return results;
}

/**
 * @param {Record<string, string>} [env]
 */
export async function readAccountRateLimitsRaw(env = process.env) {
  const res = await invokeAppServer(['account/rateLimits/read'], env);
  const raw = res['account/rateLimits/read'];
  if (!raw) {
    throw new TelemetryError('rate_limits_missing', 'account/rateLimits/read: no result');
  }
  return raw;
}

/**
 * Optional account/usage/read — returns null when unsupported.
 * @param {Record<string, string>} [env]
 */
export async function readAccountUsageRaw(env = process.env) {
  try {
    const res = await invokeAppServer(['account/usage/read'], env);
    return res['account/usage/read'] ?? null;
  } catch (err) {
    if (err instanceof TelemetryError && err.code === 'rpc_error') return null;
    throw err;
  }
}
