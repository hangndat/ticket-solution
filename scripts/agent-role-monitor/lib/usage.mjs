/**
 * Telemetry usage collection: Orca worker-read, provider JSONL tokens, reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repoRoot, readEvents } from './ledger.mjs';
import {
  appendTelemetryEvent,
  defaultTelemetryLedgerPath,
  readTelemetryEvents,
  upsertTelemetryCollectEvent,
  newestCollectByDispatch,
  orderedAccountSnapshots,
  writeSecureFile,
  TELEMETRY_SCHEMA_VERSION,
} from './telemetry-ledger.mjs';
import {
  assertNoForbiddenSnapshotKeys,
  readAccountRateLimitsRaw,
  readAccountUsageRaw,
  whitelistAccountSnapshot,
  whitelistAccountUsage,
} from './codex-app-server.mjs';
import { TelemetryError } from './errors.mjs';
import { providerFileMetadata, providerPrefixHash } from './provider-file.mjs';
import {
  assertMonotonicCumulative,
  buildProviderBaseline,
  loadProviderBaseline,
  validateBaselineIdentity,
  writeProviderBaseline,
} from './provider-baseline.mjs';
import { sanitizeOrchestrationBlock } from './transcript-sanitize.mjs';

export { providerFileMetadata } from './provider-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_MAX_WORKER_READ_PAGES = 50;
export const DEFAULT_WORKER_READ_LIMIT = 100;

/**
 * @param {string[]} args
 * @param {Record<string, string>} [env]
 */
export function orcaJson(args, env = process.env) {
  const cmd = env.ORCA_CLI_COMMAND || 'orca';
  const out = execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 25e6, env });
  const parsed = JSON.parse(out);
  if (parsed.ok === false) {
    throw new TelemetryError('orca_failed', parsed.error?.message || 'orca command failed');
  }
  return parsed;
}

function resolvedWorkspacePath(workspaceId) {
  const raw = String(workspaceId || '');
  const pathPart = raw.includes('::') ? raw.slice(raw.lastIndexOf('::') + 2) : raw;
  return path.resolve(pathPart);
}

export function listActiveWorkersOnWorktree(worktreePath, env = process.env) {
  const resolved = path.resolve(worktreePath);
  const wl = orcaJson(['orchestration', 'worker-list', '--include-remote', '--json'], env);
  const workers = wl.result?.workers ?? [];
  return workers.filter((w) => {
    if (w.terminalState !== 'active') return false;
    const ws = w.projection?.workspace?.id || '';
    return resolvedWorkspacePath(ws) === resolved;
  });
}

export function isWorktreeDispatchAmbiguous(worktreePath, env = process.env, expectedDispatchId = null) {
  try {
    const active = listActiveWorkersOnWorktree(worktreePath, env);
    return active.length !== 1 || Boolean(expectedDispatchId && active[0].dispatchId !== expectedDispatchId);
  } catch {
    return true;
  }
}

export function resolveGitSha(root, env = process.env) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function pickFinite(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTokenBreakdown(b) {
  if (!b || typeof b !== 'object') return null;
  const inputTokens = pickFinite(b.inputTokens ?? b.input_tokens);
  const cachedInputTokens = pickFinite(
    b.cachedInputTokens ?? b.cached_input_tokens ?? b.cache_read_tokens ?? b.cache_read,
  );
  const outputTokens = pickFinite(b.outputTokens ?? b.output_tokens);
  const reasoningOutputTokens = pickFinite(
    b.reasoningOutputTokens ?? b.reasoning_output_tokens ?? b.reasoning_tokens,
  );
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
  };
}

function subtractBreakdown(end, start) {
  if (!end) return null;
  if (!start) return end;
  const out = {};
  for (const k of [
    'inputTokens',
    'cachedInputTokens',
    'outputTokens',
    'reasoningOutputTokens',
  ]) {
    const a = end[k];
    const b = start[k];
    if (typeof a !== 'number' || typeof b !== 'number') {
      out[k] = null;
    } else {
      out[k] = a - b;
    }
  }
  return out;
}

function breakdownToPublicTokens(b) {
  if (!b) {
    return { input: null, cachedInput: null, output: null, reasoning: null };
  }
  return {
    input: b.inputTokens,
    cachedInput: b.cachedInputTokens,
    output: b.outputTokens,
    reasoning: b.reasoningOutputTokens,
  };
}

function subtractPublicTokens(end, start) {
  if (!end || !start) return null;
  const out = { input: null, cachedInput: null, output: null, reasoning: null };
  for (const k of Object.keys(out)) {
    if (typeof end[k] === 'number' && typeof start[k] === 'number') out[k] = end[k] - start[k];
  }
  return out;
}

export function cacheInputRatio(tokens) {
  if (!tokens || typeof tokens.input !== 'number' || tokens.input <= 0) return null;
  if (typeof tokens.cachedInput !== 'number') return null;
  return tokens.cachedInput / tokens.input;
}

function extractSessionThreadFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.thread_id != null) return String(row.thread_id);
  if (row.threadId != null) return String(row.threadId);
  if (row.type === 'session_meta' && row.payload?.id) return String(row.payload.id);
  const sm = row.session_meta ?? row.sessionMeta;
  if (sm && typeof sm === 'object') {
    if (sm.thread_id != null) return String(sm.thread_id);
    if (sm.threadId != null) return String(sm.threadId);
  }
  return null;
}

/**
 * Extract token_count rows from actual Codex JSONL shapes.
 * @param {object} row
 */
function extractTokenCountFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const topType = row.type || row.method || null;
  if (topType === 'event_msg' && row.payload && typeof row.payload === 'object') {
    const p = row.payload;
    if (p.type === 'token_count' && p.info && typeof p.info === 'object') {
      return {
        kind: 'token_count',
        last: normalizeTokenBreakdown(p.info.last_token_usage || p.info.lastTokenUsage),
        total: normalizeTokenBreakdown(p.info.total_token_usage || p.info.totalTokenUsage),
      };
    }
  }
  if (topType === 'token_count' || row.kind === 'token_count') {
    return {
      kind: 'token_count',
      last: normalizeTokenBreakdown(row.last_token_usage || row.lastTokenUsage || row.last),
      total: normalizeTokenBreakdown(
        row.total_token_usage || row.totalTokenUsage || row.total || row.cumulative,
      ),
    };
  }
  if (topType === 'token_usage_record') {
    const info = row.info || row.payload?.info || row.record || row;
    return {
      kind: 'token_usage_record',
      last: normalizeTokenBreakdown(info?.last_token_usage || info?.last),
      total: normalizeTokenBreakdown(info?.total_token_usage || info?.total),
    };
  }
  if (topType === 'tokenUsage' || topType === 'thread/tokenUsage/updated' || row.tokenUsage) {
    const tu = row.tokenUsage || row.params?.tokenUsage;
    return {
      kind: 'tokenUsage_notification',
      last: tu?.last ? normalizeTokenBreakdown(tu.last) : null,
      total: tu?.total ? normalizeTokenBreakdown(tu.total) : null,
    };
  }
  return null;
}

/**
 * @param {string} filePath
 * @param {{ threadId?: string|null }} [opts]
 */
export function parseProviderTokenJsonl(filePath, opts = {}) {
  const meta = providerFileMetadata(filePath);
  const text = fs.readFileSync(path.resolve(filePath), 'utf8');
  const lines = text.split('\n').filter((l) => l.trim());

  let sessionBaseline = null;
  let sessionLatest = null;
  let lastBreakdown = null;
  let totalBreakdown = null;
  let notificationCount = 0;
  let rawEventCount = 0;
  const seenTotalFingerprints = new Set();
  let sessionThreadFromFile = null;
  const models = new Set();

  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.type === 'turn_context' && typeof row.payload?.model === 'string') models.add(row.payload.model);
    const rowThread = extractSessionThreadFromRow(row);
    if (rowThread) {
      if (!sessionThreadFromFile) sessionThreadFromFile = rowThread;
      else if (sessionThreadFromFile !== rowThread) {
        throw new TelemetryError('thread_meta_conflict', 'conflicting thread_id in provider JSONL');
      }
      if (opts.threadId && rowThread !== opts.threadId) {
        throw new TelemetryError('thread_id_mismatch', 'provider JSONL thread_id does not match --thread-id');
      }
    }
    const extracted = extractTokenCountFromRow(row);
    if (!extracted) continue;

    const totalFp = extracted.total ? JSON.stringify(extracted.total) : null;
    if (extracted.kind === 'token_usage_record' && totalFp && seenTotalFingerprints.has(totalFp)) {
      continue;
    }
    if (totalFp) seenTotalFingerprints.add(totalFp);

    rawEventCount += 1;
    if (extracted.kind === 'tokenUsage_notification') notificationCount += 1;

    if (extracted.last) lastBreakdown = extracted.last;
    if (extracted.total) {
      totalBreakdown = extracted.total;
      if (!sessionBaseline) sessionBaseline = extracted.total;
      sessionLatest = extracted.total;
    }
  }

  const chosenTotal = totalBreakdown || lastBreakdown;
  const rangeInternal = subtractBreakdown(sessionLatest, sessionBaseline);
  const sessionLatestPublic = breakdownToPublicTokens(sessionLatest);
  const sessionBaselinePublic = breakdownToPublicTokens(sessionBaseline);
  const dedupeStrategy = totalBreakdown
    ? 'cumulative_total'
    : lastBreakdown
      ? 'last_token_usage'
      : 'none';

  const sessionRangeDelta =
    sessionBaseline && sessionLatest && rangeInternal
      ? breakdownToPublicTokens(rangeInternal)
      : null;

  return {
    source: 'provider_jsonl',
    model: models.size === 1 ? [...models][0] : null,
    modelCoverage: models.size > 1 ? 'mixed_session' : models.size === 1 ? 'session_single_model' : 'missing',
    provenance: {
      thread_id: opts.threadId ?? sessionThreadFromFile ?? null,
      provider_session: true,
      file: meta,
    },
    dedupeStrategy,
    notificationCount,
    rawEventCount,
    session_baseline: sessionBaselinePublic,
    session_latest: sessionLatestPublic,
    session_range_delta: sessionRangeDelta,
    task_delta: null,
    cache_input_ratio: cacheInputRatio(sessionLatestPublic),
    tokens: breakdownToPublicTokens(chosenTotal),
    completeness: chosenTotal ? (totalBreakdown ? 'cumulative_session' : 'last_only') : 'missing',
    note: 'task_delta requires --baseline-file boundary; session_range_delta is whole-file span only',
  };
}

/**
 * Apply baseline boundary → task_delta on parsed provider stats.
 * @param {object} parsed parseProviderTokenJsonl result
 * @param {string} baselinePath
 * @param {string} threadId
 * @param {object} meta
 */
export function applyProviderBaseline(parsed, baselinePath, threadId, meta, providerFile) {
  const baseline = loadProviderBaseline(baselinePath);
  const errors = [
    ...validateBaselineIdentity(baseline, meta, threadId),
    ...assertMonotonicCumulative(baseline.cumulative, parsed.session_latest),
  ];
  if (errors.length) {
    throw new TelemetryError(errors[0].code || 'baseline_invalid', errors[0].message);
  }
  if (!providerFile || !baseline.file?.prefixSha256 ||
      providerPrefixHash(providerFile, baseline.byte_offset) !== baseline.file.prefixSha256) {
    throw new TelemetryError('baseline_prefix_mismatch', 'provider file boundary cannot be verified');
  }
  const taskDelta = subtractPublicTokens(parsed.session_latest, baseline.cumulative);
  return {
    ...parsed,
    task_delta: taskDelta,
    task_delta_source: 'baseline_boundary',
    baseline: {
      capturedAt: baseline.capturedAt,
      file_identity: baseline.file?.identity ?? null,
      byte_offset: baseline.byte_offset ?? null,
      model: baseline.model ?? null,
    },
    cache_input_ratio: cacheInputRatio(taskDelta) ?? parsed.cache_input_ratio,
  };
}

export function snapshotProviderBaseline(opts) {
  const providerFile = opts.providerFile;
  const threadId = opts.threadId;
  const out = opts.out;
  if (!providerFile || !threadId || !out) {
    throw new TelemetryError('snapshot_provider_args', '--provider-file, --thread-id, --out required');
  }
  const meta = providerFileMetadata(providerFile);
  const parsed = parseProviderTokenJsonl(providerFile, { threadId });
  const baseline = buildProviderBaseline(meta, threadId, parsed.session_latest, {
    model: opts.model ?? parsed.model ?? null,
    prefixSha256: providerPrefixHash(providerFile, meta.byteSize),
    provider: opts.provider ?? 'codex',
  });
  writeProviderBaseline(out, baseline, { overwrite: Boolean(opts.overwrite) });
  return { ok: true, out, baseline, session_latest: parsed.session_latest };
}

export function extractStructuralTranscriptEvents(page) {
  const events = [];
  const messages = page?.transcript?.messages;
  if (!Array.isArray(messages)) return events;
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const blockTypes = [];
    if (Array.isArray(msg.blocks)) {
      for (const b of msg.blocks) {
        if (!b || typeof b !== 'object') continue;
        blockTypes.push(b.type != null ? String(b.type) : 'unknown');
      }
    }
    events.push({
      kind: 'transcript.message',
      id: msg.id != null ? String(msg.id).slice(0, 120) : null,
      timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : null,
      role: msg.role != null ? String(msg.role) : null,
      blockTypes,
      textBlockCount: Array.isArray(msg.blocks)
        ? msg.blocks.filter((b) => b?.type === 'text').length
        : 0,
      orchestration: sanitizeOrchestrationBlock(msg.from?.orchestration),
    });
  }
  return events;
}

export function dedupeStructuralEvents(events) {
  const seen = new Set();
  const out = [];
  for (const e of events) {
    const key =
      e.kind === 'transcript.message'
        ? `msg:${e.id}:${e.timestamp}`
        : `other:${e.kind}:${e.returnedLineCount}:${e.truncated}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function readWorkerTranscriptMetadata(dispatchId, options = {}) {
  const env = options.env || process.env;
  const maxPages = options.maxPages ?? DEFAULT_MAX_WORKER_READ_PAGES;
  const pageLimit = options.pageLimit ?? DEFAULT_WORKER_READ_LIMIT;
  const preferSource = options.source || 'auto';

  let cursor;
  const structuralEvents = [];
  const clipping = new Set();
  let sourceExact = null;
  let contentComplete = null;
  let pagesRead = 0;
  let lastSource = null;
  let provider = null;
  let fallbackReason = null;
  let terminalLineCount = 0;
  const seenCursors = new Set();
  let hitMaxPages = false;
  let sourceChanged = false;
  let lastSourceIdentity = null;

  for (let page = 0; page < maxPages; page++) {
    const args = [
      'orchestration',
      'worker-read',
      '--dispatch',
      dispatchId,
      '--limit',
      String(pageLimit),
      '--json',
    ];
    if (preferSource !== 'auto') args.push('--source', preferSource);
    if (cursor) args.push('--cursor', cursor);

    const resp = orcaJson(args, env);
    const r = resp.result;
    if (!r) break;
    pagesRead += 1;
    lastSource = r.source ?? lastSource;
    provider = r.provider ?? r.projection?.provider?.id ?? provider;
    fallbackReason = r.fallbackReason ?? fallbackReason;

    if (r.sourceIdentity && lastSourceIdentity && r.sourceIdentity !== lastSourceIdentity) {
      sourceChanged = true;
    }
    lastSourceIdentity = r.sourceIdentity ?? lastSourceIdentity;

    if (r.sourceExact === true) sourceExact = true;
    else if (r.sourceExact === false) sourceExact = false;

    if (r.contentComplete === true) contentComplete = true;
    else if (r.contentComplete === false) contentComplete = false;

    if (Array.isArray(r.clipping)) {
      for (const c of r.clipping) clipping.add(String(c));
    }

    if (r.source === 'transcript') {
      structuralEvents.push(...extractStructuralTranscriptEvents(r));
    } else if (r.terminal?.tail && Array.isArray(r.terminal.tail)) {
      terminalLineCount += r.terminal.tail.length;
      structuralEvents.push({
        kind: 'terminal.tail',
        returnedLineCount: r.terminal.returnedLineCount ?? r.terminal.tail.length,
        truncated: Boolean(r.terminal.truncated),
        limited: Boolean(r.terminal.limited),
      });
    }

    const next = r.cursor ?? r.terminal?.nextCursor;
    if (next) {
      if (seenCursors.has(next)) {
        clipping.add('cursor_cycle');
        break;
      }
      seenCursors.add(next);
    }
    if (!next || next === cursor) break;
    cursor = next;
    if (page + 1 >= maxPages) hitMaxPages = true;
  }

  if (hitMaxPages) clipping.add('max_pages');
  if (sourceChanged) clipping.add('source_changed');

  if (lastSource === 'terminal' || fallbackReason === 'provider_unsupported') {
    sourceExact = false;
    contentComplete = false;
    clipping.add('terminal_fallback');
  }

  const deduped = dedupeStructuralEvents(structuralEvents);

  return {
    dispatchId,
    provider,
    source: lastSource,
    fallbackReason,
    pagesRead,
    terminalLineCount,
    structuralEvents: deduped,
    sourceExact,
    contentComplete,
    clipping: [...clipping],
  };
}

export function summarizeCursorHookTokens(ledgerPath, dispatchId) {
  const events = readEvents(ledgerPath);
  let inSum = null;
  let outSum = null;
  let cacheRead = null;
  let cacheWrite = null;
  let turns = 0;
  const generationIds = new Set();

  for (const e of events) {
    if (e.event !== 'cursor.turn' || e.dispatch_id !== dispatchId) continue;
    if (e.attrs?.token_source !== 'hooks') continue;
    const gid = e.attrs?.generation_id;
    if (gid && generationIds.has(gid)) continue;
    if (gid) generationIds.add(gid);
    turns += 1;
    inSum = addNullable(inSum, e.attrs?.input_tokens);
    outSum = addNullable(outSum, e.attrs?.output_tokens);
    cacheRead = addNullable(cacheRead, e.attrs?.cache_read_tokens);
    cacheWrite = addNullable(cacheWrite, e.attrs?.cache_write_tokens);
  }

  return {
    provenance: 'cursor.hooks',
    turns,
    tokens: {
      input: inSum,
      output: outSum,
      cacheRead,
      cacheWrite,
    },
  };
}

function addNullable(sum, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return sum;
  if (sum == null) return value;
  return sum + value;
}

function workerShowProvenance(dispatchId, env) {
  try {
    const show = orcaJson(['orchestration', 'worker-show', '--dispatch', dispatchId, '--json'], env);
    const w = show.result?.worker;
    const launch = w?.startOptions?.launch;
    return {
      model: launch?.effective?.model ?? show.result?.projection?.provider?.model ?? null,
      provider: w?.projection?.provider?.id ?? show.result?.projection?.provider?.id ?? null,
      taskId: w?.projection?.taskId ?? show.result?.projection?.taskId ?? null,
      runId: w?.projection?.runId ?? show.result?.projection?.runId ?? null,
      archive:
        show.result?.terminalResource?.archive ??
        w?.terminalResource?.archive ??
        null,
    };
  } catch {
    return { model: null, provider: null, taskId: null, runId: null, archive: null };
  }
}

export function buildCollectKey(opts) {
  const parts = [
    opts.dispatchId || 'provider-only',
    opts.threadId || '',
    opts.providerMeta?.basename || '',
    String(opts.providerMeta?.byteSize ?? ''),
    opts.transcriptSource || 'none',
    opts.comparisonKey || '',
    opts.baselineIdentity || '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

export function buildWorkloadFingerprint(attrs) {
  const parts = [
    attrs?.comparison_key ?? '',
    attrs?.model ?? '',
    attrs?.provider ?? '',
    attrs?.tokens_provider?.task_delta_source ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

/**
 * @param {object} opts
 */
export function collectTelemetry(opts) {
  const root = opts.root || repoRoot(__dirname);
  const telemetryLedger = opts.telemetryLedger || defaultTelemetryLedgerPath(root);
  const metricsLedger = opts.metricsLedger || path.join(root, '.orca-metrics', 'role-dispatch.jsonl');
  const env = opts.env || process.env;
  const dispatchId = opts.dispatchId || null;
  const roleId = opts.roleId;
  const runId = opts.runId || null;
  const threadId = opts.threadId || null;

  if (!roleId) throw new TelemetryError('missing_role', '--role-id is required');
  if (!dispatchId && !opts.providerFile) {
    throw new TelemetryError('missing_source', '--dispatch-id or --provider-file is required');
  }
  if (!dispatchId && opts.providerFile && !threadId) {
    throw new TelemetryError('missing_thread', '--thread-id is required with --provider-file without dispatch');
  }

  let joinAmbiguous = false;
  let transcript = null;
  let provenance = {
    model: null,
    provider: null,
    taskId: null,
    runId: null,
    archive: null,
  };

  if (dispatchId) {
    joinAmbiguous = isWorktreeDispatchAmbiguous(root, env, dispatchId);
    transcript = readWorkerTranscriptMetadata(dispatchId, { env });
    provenance = workerShowProvenance(dispatchId, env);
  }

  const gitSha = resolveGitSha(root, env);

  let providerTokens = null;
  let providerMeta = null;
  if (opts.providerFile) {
    providerMeta = providerFileMetadata(opts.providerFile);
    providerTokens = parseProviderTokenJsonl(opts.providerFile, { threadId });
    if (opts.baselineFile) {
      providerTokens = applyProviderBaseline(
        providerTokens,
        opts.baselineFile,
        threadId,
        providerMeta,
        opts.providerFile,
      );
    }
  }

  if (providerTokens && !dispatchId) {
    provenance.provider = 'codex';
    provenance.model = providerTokens.model;
  }
  const cursorHooks = dispatchId ? summarizeCursorHookTokens(metricsLedger, dispatchId) : null;

  const baselineIdentity = providerTokens?.baseline?.file_identity ?? null;
  const collectKey = buildCollectKey({
    dispatchId,
    threadId,
    providerMeta,
    transcriptSource: transcript?.source ?? null,
    comparisonKey: opts.comparisonKey ?? null,
    baselineIdentity,
  });
  const workloadFingerprint = buildWorkloadFingerprint({
    comparison_key: opts.comparisonKey ?? null,
    thread_id: threadId,
    model: provenance.model,
    provider: provenance.provider || (providerTokens ? 'codex' : null),
    tokens_provider: providerTokens,
  });

  const ts = new Date().toISOString();
  const event = {
    v: TELEMETRY_SCHEMA_VERSION,
    ts,
    event: 'telemetry.collect',
    run_id: runId || provenance.runId,
    task_id: provenance.taskId,
    dispatch_id: dispatchId,
    role_id: roleId,
    agent: provenance.provider || (providerTokens ? 'codex' : 'unknown'),
    attrs: {
      collect_key: collectKey,
      comparison_key: opts.comparisonKey ?? null,
      workload_fingerprint: workloadFingerprint,
      git_sha: gitSha,
      thread_id: threadId,
      join_ambiguous: joinAmbiguous,
      model: provenance.model,
      provider: provenance.provider,
      archive: provenance.archive
        ? {
            source: provenance.archive.source ?? null,
            status: provenance.archive.status ?? null,
          }
        : null,
      transcript: transcript
        ? {
            source: transcript.source,
            provider: transcript.provider,
            fallbackReason: transcript.fallbackReason,
            pagesRead: transcript.pagesRead,
            sourceExact: transcript.sourceExact,
            contentComplete: transcript.contentComplete,
            clipping: transcript.clipping,
            structuralEventCount: transcript.structuralEvents.length,
            structuralEvents: transcript.structuralEvents,
          }
        : null,
      tokens_provider: providerTokens,
      tokens_cursor_hooks: cursorHooks,
      orca_cli_command: env.ORCA_CLI_COMMAND || 'orca',
    },
  };

  const upsert = upsertTelemetryCollectEvent(telemetryLedger, event);
  return { ok: true, ledger: telemetryLedger, event, joinAmbiguous, idempotent: upsert.replaced };
}

export async function snapshotAccountRateLimits(opts = {}) {
  const root = opts.root || repoRoot(__dirname);
  const telemetryLedger = opts.telemetryLedger || defaultTelemetryLedgerPath(root);
  const env = opts.env || process.env;
  const outPath = opts.out ? path.resolve(opts.out) : null;
  const overwrite = Boolean(opts.overwrite);

  const raw = await readAccountRateLimitsRaw(env);
  const snap = whitelistAccountSnapshot(raw);
  assertNoForbiddenSnapshotKeys(snap);

  let usageRaw = null;
  let usageSafe = null;
  try {
    usageRaw = await readAccountUsageRaw(env);
    usageSafe = whitelistAccountUsage(usageRaw);
    if (usageSafe) {
      assertNoForbiddenSnapshotKeys(usageSafe);
      snap.accountUsage = usageSafe;
    }
  } catch {
    usageRaw = null;
    usageSafe = null;
  }

  if (outPath) {
    const text = `${JSON.stringify(snap, null, 2)}\n`;
    writeSecureFile(outPath, text, { mode: 0o600, overwrite });
  }

  const event = {
    v: TELEMETRY_SCHEMA_VERSION,
    ts: snap.timestamp,
    event: 'telemetry.account_snapshot',
    run_id: opts.runId || null,
    task_id: opts.taskId || null,
    dispatch_id: opts.dispatchId || null,
    role_id: opts.roleId || null,
    agent: 'codex',
    attrs: {
      snapshot: snap,
      usage_read_supported: usageSafe != null,
      account_usage: usageSafe,
    },
  };
  appendTelemetryEvent(telemetryLedger, event);

  return { ok: true, snapshot: snap, ledger: telemetryLedger, outPath };
}

function parseSnapshotTime(ts) {
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

export function snapshotsComparable(a, b) {
  if (!a || !b) return { compatible: false, reason: 'missing_snapshot' };
  if (!a.accountIdHash || !b.accountIdHash || a.accountIdHash !== b.accountIdHash) {
    return { compatible: false, reason: 'account_identity_unknown_or_mismatch' };
  }
  if (!a.limitId || !b.limitId || a.limitId !== b.limitId) {
    return { compatible: false, reason: 'limit_id_missing_or_mismatch' };
  }
  if (!a.plan || !b.plan || a.plan !== b.plan) {
    return { compatible: false, reason: 'plan_missing_or_mismatch' };
  }
  if (
    typeof a.windowDurationMins !== 'number' ||
    typeof b.windowDurationMins !== 'number' ||
    a.windowDurationMins <= 0 ||
    b.windowDurationMins <= 0 ||
    a.windowDurationMins !== b.windowDurationMins
  ) {
    return { compatible: false, reason: 'window_missing_or_mismatch' };
  }
  if (
    typeof a.resetsAt !== 'number' ||
    typeof b.resetsAt !== 'number' ||
    a.resetsAt <= 0 ||
    b.resetsAt <= 0 ||
    a.resetsAt !== b.resetsAt
  ) {
    return { compatible: false, reason: 'reset_missing_or_mismatch' };
  }
  if (
    typeof a.usedPercent !== 'number' ||
    typeof b.usedPercent !== 'number' ||
    a.usedPercent < 0 ||
    a.usedPercent > 100 ||
    b.usedPercent < 0 ||
    b.usedPercent > 100
  ) {
    return { compatible: false, reason: 'used_percent_invalid' };
  }
  const ta = parseSnapshotTime(a.timestamp);
  const tb = parseSnapshotTime(b.timestamp);
  if (ta == null || tb == null || ta >= tb) {
    return { compatible: false, reason: 'timestamps_not_ordered' };
  }
  return { compatible: true, reason: null };
}

function taskDeltaMeasurable(delta) {
  return (
    delta &&
    typeof delta.input === 'number' &&
    typeof delta.output === 'number' &&
    delta.input >= 0 &&
    delta.output >= 0
  );
}

export function buildTelemetryReport(opts = {}) {
  const telemetryLedger = opts.telemetryLedger || defaultTelemetryLedgerPath(opts.root);
  const runId = opts.runId || null;
  const baselineRunId = opts.baselineRunId || null;
  const comparisonKey = opts.comparisonKey ?? null;

  const events = readTelemetryEvents(telemetryLedger);
  const collects = newestCollectByDispatch(
    events.filter((e) => e.event === 'telemetry.collect' && (!runId || e.run_id === runId)),
  );
  const baselineCollects = baselineRunId
    ? newestCollectByDispatch(
        events.filter((e) => e.event === 'telemetry.collect' && e.run_id === baselineRunId),
      )
    : [];

  const report = {
    schema_version: TELEMETRY_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    run_id: runId,
    baseline_run_id: baselineRunId,
    dispatches: collects.map((e) => ({
      dispatch_id: e.dispatch_id,
      role_id: e.role_id,
      thread_id: e.attrs?.thread_id ?? null,
      git_sha: e.attrs?.git_sha,
      model: e.attrs?.model ?? null,
      provider: e.attrs?.provider ?? null,
      transcript: e.attrs?.transcript
        ? {
            sourceExact: e.attrs.transcript.sourceExact,
            contentComplete: e.attrs.transcript.contentComplete,
            clipping: e.attrs.transcript.clipping,
          }
        : null,
      comparison_key: e.attrs?.comparison_key ?? null,
      workload_fingerprint: e.attrs?.workload_fingerprint ?? null,
      tokens_task_delta: e.attrs?.tokens_provider?.task_delta ?? null,
      tokens_session_range_delta: e.attrs?.tokens_provider?.session_range_delta ?? null,
      tokens_provider_session: e.attrs?.tokens_provider?.session_latest ?? null,
      cache_input_ratio: e.attrs?.tokens_provider?.cache_input_ratio ?? null,
      tokens_cursor_hooks: e.attrs?.tokens_cursor_hooks?.tokens ?? null,
      coverage: {
        provider: e.attrs?.tokens_provider?.completeness ?? 'missing',
        task_delta: e.attrs?.tokens_provider?.task_delta_source ?? 'missing',
        cursor_hooks: e.attrs?.tokens_cursor_hooks?.turns ? 'partial' : 'missing',
      },
    })),
    account: {
      shared_allowance: true,
      per_dispatch_attribution: false,
      note: 'Account quota is shared; deltas require matching account hash and rate-limit window.',
    },
    comparison: null,
  };

  const snapPrimary = orderedAccountSnapshots(events, runId);
  const snapBaseline = baselineRunId ? orderedAccountSnapshots(events, baselineRunId) : [];

  if (snapPrimary.length >= 2) {
    const first = snapPrimary[0].attrs?.snapshot;
    const last = snapPrimary[snapPrimary.length - 1].attrs?.snapshot;
    const cmp = snapshotsComparable(first, last);
    if (cmp.compatible) {
      report.account.within_run_deltaUsedPercentPoints = last.usedPercent - first.usedPercent;
      report.account.within_run_compatible = true;
    } else {
      report.account.within_run_compatible = false;
      report.account.within_run_incompatibleReason = cmp.reason;
    }
  }

  if (snapPrimary.length && snapBaseline.length) {
    const lastPrimary = snapPrimary[snapPrimary.length - 1].attrs?.snapshot;
    const lastBaseline = snapBaseline[snapBaseline.length - 1].attrs?.snapshot;
    const cmp = snapshotsComparable(lastBaseline, lastPrimary);
    if (cmp.compatible) {
      report.account.deltaUsedPercentPoints = lastPrimary.usedPercent - lastBaseline.usedPercent;
      report.account.compatible = true;
    } else {
      report.account.compatible = false;
      report.account.incompatibleReason = cmp.reason;
    }
  }

  if (baselineRunId) {
    const primary = collects[0];
    const base = baselineCollects[0];
    const keyMatch =
      Boolean(comparisonKey) &&
      (primary?.attrs?.comparison_key === comparisonKey &&
        base?.attrs?.comparison_key === comparisonKey);
    const fingerprintMatch =
      primary?.attrs?.workload_fingerprint &&
      base?.attrs?.workload_fingerprint &&
      primary.attrs.workload_fingerprint === base.attrs.workload_fingerprint;

    const pDelta = primary?.attrs?.tokens_provider?.task_delta;
    const bDelta = base?.attrs?.tokens_provider?.task_delta;
    const taskMeasured = taskDeltaMeasurable(pDelta) && taskDeltaMeasurable(bDelta);
    const modelMatch =
      primary?.attrs?.model &&
      base?.attrs?.model &&
      primary.attrs.model === base.attrs.model;
    const providerMatch =
      Boolean(primary?.attrs?.provider) &&
      Boolean(base?.attrs?.provider) &&
      primary.attrs.provider === base.attrs.provider;

    const compatible =
      collects.length === 1 && baselineCollects.length === 1 &&
      keyMatch && fingerprintMatch && taskMeasured && modelMatch && providerMatch;

    let tokenSavingsPercent = null;
    if (compatible && typeof bDelta.input === 'number' && bDelta.input > 0) {
      tokenSavingsPercent = ((bDelta.input - pDelta.input) / bDelta.input) * 100;
    }

    report.comparison = {
      compatible,
      comparison_key: comparisonKey,
      workload_fingerprint_match: fingerprintMatch,
      token_savings_percent: tokenSavingsPercent,
      savings_invented: false,
      note: compatible
        ? 'Comparable workload key + baseline-bound task_delta; token % is measured input delta only.'
        : 'Not comparable — missing comparison key/fingerprint/boundary task_delta/model; no savings claim.',
    };
  }

  return report;
}
