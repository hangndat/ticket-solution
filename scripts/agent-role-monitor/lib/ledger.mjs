/**
 * Append-only JSONL ledger for Role × Dispatch metrics (schema v1).
 * SoT path: .orca-metrics/role-dispatch.jsonl (gitignored).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root: scripts/agent-role-monitor/lib → ../../.. */
export function repoRoot(from = __dirname) {
  return path.resolve(from, '../../..');
}

export function defaultLedgerPath(root = repoRoot()) {
  return path.join(root, '.orca-metrics', 'role-dispatch.jsonl');
}

export function activeDispatchPath(root = repoRoot()) {
  return path.join(root, '.orca-metrics', 'active-dispatch.json');
}

export const SCHEMA_VERSION = 1;

/** Events that are idempotent on (dispatch_id, event). */
const IDEMPOTENT_EVENTS = new Set(['dispatch.opened', 'dispatch.settled']);

export function isIdempotentEvent(event) {
  return IDEMPOTENT_EVENTS.has(event);
}

/**
 * Find join.conversation for a Cursor conversation_id (most recent wins).
 * @param {object[]} events
 * @param {string} conversationId
 */
export function findJoinByConversation(events, conversationId) {
  if (!conversationId) return null;
  let found = null;
  for (const e of events) {
    if (e?.event !== 'join.conversation') continue;
    if (e.attrs?.conversation_id === conversationId) found = e;
  }
  return found;
}

/**
 * Find join.conversation by dispatch_id (most recent wins).
 * @param {object[]} events
 * @param {string} dispatchId
 */
export function findJoinByDispatch(events, dispatchId) {
  if (!dispatchId) return null;
  let found = null;
  for (const e of events) {
    if (e?.event !== 'join.conversation') continue;
    if (e.dispatch_id === dispatchId) found = e;
  }
  return found;
}

/**
 * Resolve join row for a Cursor hook payload.
 * Lookup: conversation_id → join; else attrs.dispatch_id / dispatch_id → join.
 * @returns {{ join: object, conversation_id: string|null } | null}
 */
export function resolveJoinForHook(events, hookPayload) {
  if (!hookPayload || typeof hookPayload !== 'object') return null;
  const conversationId = pickStr(hookPayload, ['conversation_id', 'conversationId']) || null;
  const attrs =
    hookPayload.attrs && typeof hookPayload.attrs === 'object' && !Array.isArray(hookPayload.attrs)
      ? hookPayload.attrs
      : null;
  const dispatchFromPayload =
    pickStr(hookPayload, ['dispatch_id', 'dispatchId']) ||
    (attrs ? pickStr(attrs, ['dispatch_id', 'dispatchId']) : undefined) ||
    null;

  if (conversationId) {
    const join = findJoinByConversation(events, conversationId);
    if (join) return { join, conversation_id: conversationId };
  }
  if (dispatchFromPayload) {
    const join = findJoinByDispatch(events, dispatchFromPayload);
    if (join) {
      return {
        join,
        conversation_id: conversationId || join.attrs?.conversation_id || null,
      };
    }
  }
  return null;
}

/**
 * Fallback attribution from `.orca-metrics/active-dispatch.json` (gitignored).
 * Used when hook fires before record-join — removes IDE race.
 * @param {string} [root]
 * @returns {object|null} join-shaped row
 */
export function loadActiveDispatchJoin(root = repoRoot()) {
  const activePath = path.join(root, '.orca-metrics', 'active-dispatch.json');
  if (!fs.existsSync(activePath)) return null;
  let active;
  try {
    active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
  } catch {
    return null;
  }
  if (!active || typeof active !== 'object') return null;
  const dispatchId = pickStr(active, ['dispatch_id', 'dispatchId']);
  const roleId = pickStr(active, ['role_id', 'roleId']);
  if (!dispatchId || !roleId) return null;
  return {
    v: SCHEMA_VERSION,
    ts: new Date().toISOString(),
    event: 'join.conversation',
    run_id: pickStr(active, ['run_id', 'runId']) || null,
    task_id: pickStr(active, ['task_id', 'taskId']) || null,
    dispatch_id: dispatchId,
    role_id: roleId,
    agent: pickStr(active, ['agent']) || 'cursor',
    issue: active.issue != null ? Number(active.issue) : null,
    attrs: {
      conversation_id: null,
      source: 'active-dispatch',
    },
  };
}

export function buildJoinEvent(opts) {
  const conversationId = opts.conversation_id || opts.conversationId;
  const dispatchId = opts.dispatch_id || opts.dispatchId;
  const roleId = opts.role_id || opts.roleId;
  if (!conversationId) throw new Error('--conversation-id is required');
  if (!dispatchId) throw new Error('--dispatch-id is required');
  if (!roleId) throw new Error('--role-id is required');

  return {
    v: SCHEMA_VERSION,
    ts: opts.ts || new Date().toISOString(),
    event: 'join.conversation',
    run_id: opts.run_id || opts.runId || null,
    task_id: opts.task_id || opts.taskId || null,
    dispatch_id: dispatchId,
    role_id: roleId,
    agent: opts.agent || 'cursor',
    issue: opts.issue != null ? Number(opts.issue) : null,
    attrs: {
      conversation_id: String(conversationId),
    },
  };
}

/**
 * Optional token field: missing/invalid → null (never coerce to 0).
 * @param {Record<string, unknown>} obj
 * @param {string[]} keys
 * @returns {number|null}
 */
export function pickOptionalToken(obj, keys) {
  for (const k of keys) {
    if (obj[k] == null || obj[k] === '') continue;
    const n = Number(obj[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Build cursor.turn from Cursor stop|afterAgentResponse hook JSON + join row.
 * Never copies text/prompt/transcript fields (privacy).
 * @param {Record<string, unknown>} hookPayload
 * @param {object} join
 * @param {{ conversation_id?: string|null }} [resolved]
 */
export function buildCursorTurnEvent(hookPayload, join, resolved = {}) {
  if (!hookPayload || typeof hookPayload !== 'object') {
    throw new Error('cursor turn input must be a JSON object');
  }
  if (!join?.dispatch_id) throw new Error('join.dispatch_id is required');

  const hookEvent =
    pickStr(hookPayload, ['hook_event_name', 'hookEventName']) || 'stop';
  const conversationId =
    resolved.conversation_id ||
    pickStr(hookPayload, ['conversation_id', 'conversationId']) ||
    join.attrs?.conversation_id ||
    null;
  const generationId = pickStr(hookPayload, ['generation_id', 'generationId']) || null;
  if (!generationId) throw new Error('generation_id is required for cursor.turn');

  const model =
    pickStr(hookPayload, ['model_id', 'modelId', 'model']) || null;
  const status = pickStr(hookPayload, ['status']) || null;

  return {
    v: SCHEMA_VERSION,
    ts: pickStr(hookPayload, ['ts', 'timestamp']) || new Date().toISOString(),
    event: 'cursor.turn',
    run_id: join.run_id || null,
    task_id: join.task_id || null,
    dispatch_id: join.dispatch_id,
    role_id: join.role_id || null,
    agent: join.agent || 'cursor',
    issue: join.issue ?? null,
    attrs: {
      conversation_id: conversationId,
      generation_id: generationId,
      model,
      input_tokens: pickOptionalToken(hookPayload, ['input_tokens', 'inputTokens']),
      output_tokens: pickOptionalToken(hookPayload, ['output_tokens', 'outputTokens']),
      cache_read_tokens: pickOptionalToken(hookPayload, [
        'cache_read_tokens',
        'cacheReadTokens',
      ]),
      cache_write_tokens: pickOptionalToken(hookPayload, [
        'cache_write_tokens',
        'cacheWriteTokens',
      ]),
      token_source: 'hooks',
      hook_event_name: hookEvent,
      ...(status ? { status } : {}),
    },
  };
}

export function hasJoinDuplicate(events, conversationId, dispatchId) {
  return events.some(
    (e) =>
      e?.event === 'join.conversation' &&
      e.dispatch_id === dispatchId &&
      e.attrs?.conversation_id === conversationId,
  );
}

export function hasGenerationDuplicate(events, generationId) {
  if (!generationId) return false;
  return events.some(
    (e) => e?.event === 'cursor.turn' && e.attrs?.generation_id === generationId,
  );
}

/**
 * Normalize camelCase / snake_case worker_done-ish payload into ledger fields.
 * @param {Record<string, unknown>} input
 */
export function normalizeSettlementInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('settlement input must be a JSON object');
  }
  const dispatchId = pickStr(input, ['dispatch_id', 'dispatchId']);
  const taskId = pickStr(input, ['task_id', 'taskId']);
  const runId = pickStr(input, ['run_id', 'runId']);
  const roleId = pickStr(input, ['role_id', 'roleId']);
  if (!dispatchId) throw new Error('dispatch_id / dispatchId is required');
  if (!roleId) throw new Error('role_id / roleId is required');

  const outcome = pickStr(input, ['outcome']) || 'unknown';
  const subject = pickStr(input, ['subject']) ?? null;
  const agent = pickStr(input, ['agent']) || 'cursor';
  const issue = pickInt(input, ['issue', 'issueNumber', 'issue_number']);
  const filesModified = pickFilesModified(input);
  const reportPath = pickStr(input, ['report_path', 'reportPath']);
  const body = pickStr(input, ['body']);
  const endedAt = pickStr(input, ['ended_at', 'endedAt', 'ts']) || new Date().toISOString();

  const attrs = {
    outcome: normalizeOutcome(outcome),
  };
  if (subject != null) attrs.subject = String(subject).slice(0, 240);
  if (filesModified != null) attrs.files_modified_count = filesModified;
  if (reportPath) attrs.report_path = reportPath;
  if (body) {
    attrs.body_length = body.length;
    attrs.body_sha256_12 = createHash('sha256').update(body).digest('hex').slice(0, 12);
  }
  const source = pickStr(input, ['source']) || 'mailbox.worker_done';
  attrs.source = source;

  return {
    v: SCHEMA_VERSION,
    ts: endedAt,
    event: 'dispatch.settled',
    run_id: runId || null,
    task_id: taskId || null,
    dispatch_id: dispatchId,
    role_id: roleId,
    agent,
    issue: issue ?? null,
    attrs,
  };
}

export function buildOpenedEvent(opts) {
  const dispatchId = opts.dispatch_id || opts.dispatchId;
  const roleId = opts.role_id || opts.roleId;
  if (!dispatchId) throw new Error('--dispatch-id is required');
  if (!roleId) throw new Error('--role-id is required');

  const attrs = {};
  if (opts.worktree) attrs.worktree = opts.worktree;
  if (opts.architecture_impact != null || opts.architectureImpact != null) {
    attrs.architecture_impact = opts.architecture_impact ?? opts.architectureImpact;
  }
  if (opts.spec_hash || opts.specHash) attrs.spec_hash = opts.spec_hash || opts.specHash;

  return {
    v: SCHEMA_VERSION,
    ts: opts.ts || new Date().toISOString(),
    event: 'dispatch.opened',
    run_id: opts.run_id || opts.runId || null,
    task_id: opts.task_id || opts.taskId || null,
    dispatch_id: dispatchId,
    role_id: roleId,
    agent: opts.agent || 'cursor',
    issue: opts.issue != null ? Number(opts.issue) : null,
    attrs,
  };
}

export function buildHeartbeatEvent(opts) {
  const dispatchId = opts.dispatch_id || opts.dispatchId;
  if (!dispatchId) throw new Error('dispatch_id is required');
  return {
    v: SCHEMA_VERSION,
    ts: opts.ts || new Date().toISOString(),
    event: 'dispatch.heartbeat',
    run_id: opts.run_id || opts.runId || null,
    task_id: opts.task_id || opts.taskId || null,
    dispatch_id: dispatchId,
    role_id: opts.role_id || opts.roleId || null,
    agent: opts.agent || 'cursor',
    issue: opts.issue != null ? Number(opts.issue) : null,
    attrs: { phase: opts.phase || 'unknown' },
  };
}

export function buildHostSampleEvent(opts) {
  const dispatchId = opts.dispatch_id || opts.dispatchId;
  if (!dispatchId) throw new Error('dispatch_id is required for host.sample');
  const pid = Number(opts.pid);
  if (!Number.isFinite(pid) || pid <= 0) throw new Error('--pid must be a positive integer');

  return {
    v: SCHEMA_VERSION,
    ts: opts.ts || new Date().toISOString(),
    event: 'host.sample',
    run_id: opts.run_id || opts.runId || null,
    task_id: opts.task_id || opts.taskId || null,
    dispatch_id: dispatchId,
    role_id: opts.role_id || opts.roleId || null,
    agent: opts.agent || 'cursor',
    issue: opts.issue != null ? Number(opts.issue) : null,
    attrs: {
      pid,
      cpu_pct: opts.cpu_pct ?? opts.cpuPct ?? null,
      rss_mb: opts.rss_mb ?? opts.rssMb ?? null,
    },
  };
}

export function ensureLedgerDir(ledgerPath) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
}

/**
 * Read all valid JSONL events (skip blank / comment lines).
 * @returns {object[]}
 */
export function readEvents(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return [];
  const text = fs.readFileSync(ledgerPath, 'utf8');
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // skip corrupt lines; rollup still works on valid rows
    }
  }
  return out;
}

export function hasIdempotentDuplicate(events, dispatchId, eventName) {
  if (!isIdempotentEvent(eventName)) return false;
  return events.some((e) => e.dispatch_id === dispatchId && e.event === eventName);
}

/**
 * Append one event. For opened/settled, skip if (dispatch_id, event) exists.
 * @returns {{ appended: boolean, event: object, reason?: string }}
 */
export function appendEvent(ledgerPath, event) {
  if (!event || event.v !== SCHEMA_VERSION) {
    throw new Error(`event.v must be ${SCHEMA_VERSION}`);
  }
  if (!event.event || !event.dispatch_id) {
    throw new Error('event.event and event.dispatch_id are required');
  }

  ensureLedgerDir(ledgerPath);
  const existing = readEvents(ledgerPath);
  if (hasIdempotentDuplicate(existing, event.dispatch_id, event.event)) {
    return { appended: false, event, reason: 'duplicate_dispatch_event' };
  }
  if (event.event === 'join.conversation') {
    const cid = event.attrs?.conversation_id;
    if (cid && hasJoinDuplicate(existing, cid, event.dispatch_id)) {
      return { appended: false, event, reason: 'duplicate_join' };
    }
  }
  if (event.event === 'cursor.turn') {
    const gid = event.attrs?.generation_id;
    if (gid && hasGenerationDuplicate(existing, gid)) {
      return { appended: false, event, reason: 'duplicate_generation' };
    }
  }

  const line = `${JSON.stringify(event)}\n`;
  fs.appendFileSync(ledgerPath, line, 'utf8');
  return { appended: true, event };
}

/**
 * Aggregate by role_id from settled (+ opened for counts) + cursor.turn tokens.
 * Token sums stay null when every contributing turn field is null.
 */
export function rollupByRole(events) {
  /** @type {Map<string, { role_id: string, dispatch_ids: Set<string>, settled: number, succeeded: number, failed: number, opened: number, durations: number[], rss_peaks: number[], tokens_in_sum: number|null, tokens_out_sum: number|null, tokens_cache_read_sum: number|null, tokens_cache_write_sum: number|null }>} */
  const map = new Map();

  function bucket(roleId) {
    const key = roleId || 'unknown';
    if (!map.has(key)) {
      map.set(key, {
        role_id: key,
        dispatch_ids: new Set(),
        settled: 0,
        succeeded: 0,
        failed: 0,
        opened: 0,
        durations: [],
        rss_peaks: [],
        tokens_in_sum: null,
        tokens_out_sum: null,
        tokens_cache_read_sum: null,
        tokens_cache_write_sum: null,
      });
    }
    return map.get(key);
  }

  /** @param {ReturnType<typeof bucket>} b @param {'tokens_in_sum'|'tokens_out_sum'|'tokens_cache_read_sum'|'tokens_cache_write_sum'} field @param {unknown} value */
  function addToken(b, field, value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    if (b[field] == null) b[field] = 0;
    b[field] += value;
  }

  /** @type {Map<string, { openedAt?: string, settledAt?: string, role_id?: string, rssPeak?: number }>} */
  const byDispatch = new Map();

  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const did = e.dispatch_id;
    if (!did) continue;
    if (!byDispatch.has(did)) byDispatch.set(did, {});
    const d = byDispatch.get(did);
    if (e.role_id) d.role_id = e.role_id;

    if (e.event === 'dispatch.opened') {
      d.openedAt = e.ts;
      const b = bucket(e.role_id);
      b.opened += 1;
      b.dispatch_ids.add(did);
    } else if (e.event === 'dispatch.settled') {
      d.settledAt = e.ts;
      const b = bucket(e.role_id);
      b.settled += 1;
      b.dispatch_ids.add(did);
      const outcome = e.attrs?.outcome || 'unknown';
      if (outcome === 'succeeded') b.succeeded += 1;
      else if (outcome === 'failed') b.failed += 1;
    } else if (e.event === 'host.sample') {
      const rss = e.attrs?.rss_mb;
      if (typeof rss === 'number' && Number.isFinite(rss)) {
        d.rssPeak = d.rssPeak == null ? rss : Math.max(d.rssPeak, rss);
      }
    } else if (e.event === 'cursor.turn') {
      const b = bucket(e.role_id);
      b.dispatch_ids.add(did);
      addToken(b, 'tokens_in_sum', e.attrs?.input_tokens);
      addToken(b, 'tokens_out_sum', e.attrs?.output_tokens);
      addToken(b, 'tokens_cache_read_sum', e.attrs?.cache_read_tokens);
      addToken(b, 'tokens_cache_write_sum', e.attrs?.cache_write_tokens);
    } else if (e.event === 'join.conversation') {
      const b = bucket(e.role_id);
      b.dispatch_ids.add(did);
    }
  }

  for (const [, d] of byDispatch) {
    if (d.openedAt && d.settledAt) {
      const ms = Date.parse(d.settledAt) - Date.parse(d.openedAt);
      if (Number.isFinite(ms) && ms >= 0) {
        const b = bucket(d.role_id);
        b.durations.push(ms);
      }
    }
    if (d.rssPeak != null) {
      const b = bucket(d.role_id);
      b.rss_peaks.push(d.rssPeak);
    }
  }

  const by_role = [...map.values()]
    .map((b) => {
      const success_rate = b.settled > 0 ? b.succeeded / b.settled : null;
      return {
        role_id: b.role_id,
        dispatch_count: b.dispatch_ids.size,
        opened_count: b.opened,
        settled_count: b.settled,
        succeeded_count: b.succeeded,
        failed_count: b.failed,
        success_rate,
        p50_duration_ms: percentile(b.durations, 0.5),
        mean_rss_mb_peak: b.rss_peaks.length
          ? b.rss_peaks.reduce((a, n) => a + n, 0) / b.rss_peaks.length
          : null,
        tokens_in_sum: b.tokens_in_sum,
        tokens_out_sum: b.tokens_out_sum,
        tokens_cache_read_sum: b.tokens_cache_read_sum,
        tokens_cache_write_sum: b.tokens_cache_write_sum,
      };
    })
    .sort((a, b) => a.role_id.localeCompare(b.role_id));

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    event_count: events.length,
    by_role,
  };
}

function percentile(sortedInput, p) {
  if (!sortedInput.length) return null;
  const sorted = [...sortedInput].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

function pickStr(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return String(obj[k]);
  }
  return undefined;
}

function pickInt(obj, keys) {
  for (const k of keys) {
    if (obj[k] == null || obj[k] === '') continue;
    const n = Number(obj[k]);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pickFilesModified(input) {
  if (Array.isArray(input.filesModified) || Array.isArray(input.files_modified)) {
    const arr = input.filesModified || input.files_modified;
    return arr.length;
  }
  const n = pickInt(input, ['files_modified_count', 'filesModifiedCount']);
  return n;
}

function normalizeOutcome(outcome) {
  const o = String(outcome).toLowerCase();
  if (['succeeded', 'failed', 'cancelled', 'unknown'].includes(o)) return o;
  return 'unknown';
}
