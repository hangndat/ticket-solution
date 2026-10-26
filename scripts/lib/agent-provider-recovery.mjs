/** Provider recovery checks: Codex via telemetry snapshot; Claude via bounded CLI probe. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessCodexQuota } from './agent-quota-policy.mjs';
import { COST_TIER_ROUTES } from './agent-cost-tiers.mjs';

const ISO_INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;

export function parseIsoInstant(value, field = 'instant') {
  const parts = typeof value === 'string' ? ISO_INSTANT_RE.exec(value) : null;
  if (!parts) {
    throw new Error(`invalid_${field}_iso`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 || month > 12 ||
    day < 1 || day > daysInMonth[month - 1] ||
    Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59 ||
    (offsetHourText !== undefined && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59))
  ) {
    throw new Error(`invalid_${field}_iso`);
  }
  const t = Date.parse(value);
  if (!Number.isFinite(t)) throw new Error(`invalid_${field}_iso`);
  return t;
}

export function assertRegisteredProviderRoute({ provider, model, effort = null }) {
  const routes = Object.values(COST_TIER_ROUTES).flat();
  const ok = routes.some(
    (route) =>
      route.agent === provider &&
      route.models.includes(model) &&
      (effort ?? null) === (route.effort ?? null),
  );
  if (!ok) throw new Error('model_effort_not_registered');
}
import {
  recoveryRoot,
  stateKey,
  readState,
  writeState,
  deleteState,
  hashIdentity,
  tryAcquireProbeLock,
  releaseProbeLock,
  isFresh,
  inBackoff,
  beforeKnownReset,
  BACKOFF_MS,
  PROBE_TIMEOUT_MS,
  MAX_PROBE_STDOUT,
  STATE_TTL_MS,
} from './agent-provider-state.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const RATE_LIMIT_RE = /rate.?limit|overloaded|too many requests/i;
const USAGE_LIMIT_RE = /session limit|usage limit|you've hit your/i;

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function baseRecord({ provider, identityHash, model, effort, now }) {
  return {
    provider,
    identityHash,
    model,
    effort: effort ?? null,
    checkedAt: nowIso(now),
    nextCheckAt: nowIso(now),
    resetAt: null,
    limitedAt: null,
    availability: 'unknown',
    serviceAvailable: false,
    remainingPercent: null,
    reason: null,
    probeSkipped: false,
    identityBinding: 'cli_only',
  };
}

export function parseClaudeAuth(stdout) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    return { ok: false, reason: 'auth_malformed' };
  }
  if (!data?.loggedIn) return { ok: false, reason: 'auth_logged_out' };
  if (data.authMethod !== 'claude.ai' || data.apiProvider !== 'firstParty') {
    return { ok: false, reason: 'auth_not_first_party_subscription' };
  }
  const accountUuid = data.accountUuid ?? data.account_uuid ?? null;
  const profileId = data.profileId ?? data.profile_id ?? null;
  const orgId = data.orgId ?? data.organizationId ?? null;
  const email = data.email ?? null;
  const configDir = data.configDir ?? data.config_dir ?? null;
  if (!email && !accountUuid) {
    return { ok: false, reason: 'auth_identity_unknown' };
  }
  const identityHash = hashIdentity({
    provider: 'claude',
    authMethod: data.authMethod,
    apiProvider: data.apiProvider,
    email,
    orgId,
    accountUuid,
    profileId,
    configDir,
  });
  return { ok: true, identityHash, authMethod: data.authMethod, apiProvider: data.apiProvider };
}

export function runClaudeAuth(deps) {
  const bin = deps.claudeAuthBin || process.env.AGENT_PROVIDER_CLAUDE_AUTH_BIN || 'claude';
  const r = spawnSync(bin, ['auth', 'status', '--json'], {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: MAX_PROBE_STDOUT,
    shell: false,
  });
  if (r.error || r.status !== 0) return { ok: false, reason: 'auth_exec_failed' };
  return parseClaudeAuth(r.stdout);
}

export function runClaudeProbe({ model, effort, deps, now = Date.now() }) {
  const bin = deps.claudeBin || process.env.AGENT_PROVIDER_CLAUDE_BIN || 'claude';
  const cwd = mkdtempSync(join(tmpdir(), 'claude-probe-'));
  const args = [
    '--print',
    '--output-format',
    'json',
    '--no-session-persistence',
    '--tools',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
    '--permission-mode',
    'dontAsk',
    '--model',
    model,
    '--effort',
    effort,
    '--system-prompt',
    'Reply exactly OK.',
    'Reply exactly OK.',
  ];
  const r = spawnSync(bin, args, {
    cwd,
    encoding: 'utf8',
    timeout: PROBE_TIMEOUT_MS,
    maxBuffer: MAX_PROBE_STDOUT,
    shell: false,
    env: { ...process.env },
  });
  try {
    rmSync(cwd, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  if (r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM') {
    return { ok: false, reason: 'probe_timeout', availability: 'unknown' };
  }
  const blob = `${r.stdout || ''}\n${r.stderr || ''}`;
  if (USAGE_LIMIT_RE.test(blob)) {
    return { ok: false, reason: 'probe_usage_limited', availability: 'limited' };
  }
  if (RATE_LIMIT_RE.test(blob)) {
    return { ok: false, reason: 'probe_rate_limited', availability: 'limited' };
  }
  if (r.status !== 0) {
    return { ok: false, reason: 'probe_exit_nonzero', availability: 'unknown' };
  }
  let payload;
  try {
    payload = JSON.parse(r.stdout);
  } catch {
    return { ok: false, reason: 'probe_malformed', availability: 'unknown' };
  }
  if (
    payload.is_error !== false ||
    payload.success === false ||
    payload.type !== 'result' ||
    payload.subtype !== 'success'
  ) {
    const err = String(payload.error || payload.result || '');
    if (USAGE_LIMIT_RE.test(err)) return { ok: false, reason: 'probe_usage_limited', availability: 'limited' };
    if (RATE_LIMIT_RE.test(err)) return { ok: false, reason: 'probe_rate_limited', availability: 'limited' };
    if (/auth|login|credential/i.test(err)) return { ok: false, reason: 'probe_auth', availability: 'limited' };
    return { ok: false, reason: 'probe_not_success_envelope', availability: 'unknown' };
  }
  const text = typeof payload.result === 'string' ? payload.result.trim() : '';
  if (text !== 'OK') return { ok: false, reason: 'probe_unexpected_body', availability: 'unknown' };
  return {
    ok: true,
    availability: 'available',
    serviceAvailable: true,
    remainingPercent: null,
    reason: 'probe_ok',
    checkedAt: nowIso(now),
  };
}

export function assessCodexFromSnapshot(snapshot, { limitIds, essential, now = Date.now() }) {
  const q = assessCodexQuota(snapshot, { limitIds, essential, now });
  let availability = 'unknown';
  let serviceAvailable = false;
  if (q.state === 'available' || q.state === 'reserve_for_essential') {
    availability = 'available';
    serviceAvailable = true;
  } else if (q.state === 'reserved' || q.state === 'exhausted' || q.state === 'stale') {
    availability = 'limited';
  }
  const identityHash = snapshot?.accountIdHash
    ? hashIdentity({ provider: 'codex', accountIdHash: snapshot.accountIdHash })
    : null;
  return {
    quota: q,
    identityHash,
    availability,
    serviceAvailable,
    remainingPercent: q.remainingPercent ?? null,
    reason: q.state,
  };
}

function mergeOutcome(record, patch, now = Date.now()) {
  const next = { ...record, ...patch, checkedAt: patch.checkedAt || nowIso(now) };
  const limited = next.availability === 'limited' || next.availability === 'unknown';
  if (limited && !patch.nextCheckAt) {
    next.nextCheckAt = nowIso(now + BACKOFF_MS);
  }
  if (next.availability === 'available' && next.serviceAvailable) {
    next.nextCheckAt = nowIso(now + STATE_TTL_MS);
    next.limitedAt = null;
  }
  return next;
}

function completeCodexProviderCheck(
  { model, effort, identityHash, codexSnapshot, limitIds, essential, root, key, record, now },
) {
  const assessed = assessCodexFromSnapshot(codexSnapshot, { limitIds, essential, now });
  const base = baseRecord({ provider: 'codex', identityHash, model, effort, now });
  const next = mergeOutcome(
    record || base,
    {
      identityHash,
      availability: assessed.availability,
      serviceAvailable: assessed.serviceAvailable,
      remainingPercent: assessed.remainingPercent,
      reason: assessed.reason,
      quotaState: assessed.quota?.state,
      resetAt: null,
    },
    now,
  );
  writeState(root, key, next);
  return {
    ok: true,
    provider: 'codex',
    model,
    effort,
    availability: next.availability,
    serviceAvailable: next.serviceAvailable,
    remainingPercent: next.remainingPercent,
    reason: next.reason,
    probed: false,
    record: next,
    quota: assessed.quota,
  };
}

export function recordProviderLimit(
  {
    provider,
    model,
    effort = null,
    limitedAt,
    resetAt = null,
    reason = 'manual_limit',
    identityHash = null,
  },
  { root = recoveryRoot(), deps = {}, now = Date.now() } = {},
) {
  assertRegisteredProviderRoute({ provider, model, effort });
  const at = parseIsoInstant(limitedAt, 'limited_at');
  const resetParsed = resetAt === null ? NaN : parseIsoInstant(resetAt, 'reset_at');
  let idHash = identityHash;
  if (!idHash && provider === 'claude') {
    const auth = runClaudeAuth(deps);
    if (!auth.ok) throw new Error(auth.reason);
    idHash = auth.identityHash;
  }
  if (!idHash && provider === 'codex') {
    const assessed = assessCodexFromSnapshot(deps.codexSnapshot ?? null, {
      limitIds: ['codex'],
      essential: false,
      now,
    });
    idHash = assessed.identityHash;
  }
  if (!idHash) throw new Error('identity_required');
  const key = stateKey({ provider, identityHash: idHash, model, effort });
  const nextCheck =
    Number.isFinite(resetParsed) && resetParsed > now
      ? resetParsed
      : now + BACKOFF_MS;
  const record = mergeOutcome(
    baseRecord({ provider, identityHash: idHash, model, effort, now }),
    {
      availability: 'limited',
      serviceAvailable: false,
      limitedAt: new Date(at).toISOString(),
      resetAt: Number.isFinite(resetParsed) ? new Date(resetParsed).toISOString() : null,
      nextCheckAt: new Date(nextCheck).toISOString(),
      reason,
      remainingPercent: null,
    },
    now,
  );
  writeState(root, key, record);
  return { key, record };
}

export function getProviderStatus(
  { provider, model, effort = null, identityHash },
  { root = recoveryRoot(), now = Date.now() } = {},
) {
  const key = stateKey({ provider, identityHash, model, effort });
  const record = readState(root, key);
  if (!record) {
    return { key, record: null, fresh: false, due: true, inCooldown: false, beforeReset: false };
  }
  return {
    key,
    record,
    fresh: isFresh(record, now),
    due: !inBackoff(record, now),
    inCooldown: inBackoff(record, now),
    beforeReset: beforeKnownReset(record, now),
  };
}

export function checkProvider(
  {
    provider,
    model,
    effort = null,
    force = false,
    essential = false,
    codexSnapshot = null,
    limitIds = ['codex'],
  },
  { root = recoveryRoot(), deps = {}, now = Date.now() } = {},
) {
  let identityHash = null;
  if (provider === 'claude') {
    const auth = runClaudeAuth(deps);
    if (!auth.ok) {
      return {
        ok: false,
        provider,
        model,
        effort,
        availability: 'unknown',
        serviceAvailable: false,
        reason: auth.reason,
        probed: false,
      };
    }
    identityHash = auth.identityHash;
  } else if (provider === 'codex') {
    const assessed = assessCodexFromSnapshot(codexSnapshot, { limitIds, essential, now });
    if (!assessed.identityHash) {
      return {
        ok: false,
        provider,
        model,
        effort,
        availability: 'unknown',
        serviceAvailable: false,
        reason: 'codex_snapshot_missing',
        probed: false,
        quota: assessed.quota,
      };
    }
    identityHash = assessed.identityHash;
  } else {
    return {
      ok: true,
      provider,
      model,
      effort,
      availability: 'unknown',
      serviceAvailable: false,
      reason: 'provider_not_tracked',
      probed: false,
    };
  }

  const key = stateKey({ provider, identityHash, model, effort });
  const existing = readState(root, key);
  if (existing && existing.identityHash && existing.identityHash !== identityHash) {
    deleteState(root, key);
  }
  const cached = readState(root, key);
  if (cached?.identityHash && cached.identityHash !== identityHash) deleteState(root, key);

  const status = getProviderStatus({ provider, identityHash, model, effort }, { root, now });
  let record = status.record;

  if (record && record.identityHash !== identityHash) {
    deleteState(root, key);
    record = null;
  }

  if (provider === 'codex') {
    return completeCodexProviderCheck({
      model,
      effort,
      identityHash,
      codexSnapshot,
      limitIds,
      essential,
      root,
      key,
      record,
      now,
    });
  }

  if (record && beforeKnownReset(record, now)) {
    return {
      ok: true,
      provider,
      model,
      effort,
      availability: record.availability,
      serviceAvailable: false,
      reason: 'before_known_reset',
      probed: false,
      probeSkipped: true,
      record,
      fresh: isFresh(record, now),
    };
  }

  if (!force && record) {
    if (inBackoff(record, now) && isFresh(record, now)) {
      return {
        ok: true,
        provider,
        model,
        effort,
        availability: record.availability,
        serviceAvailable: record.serviceAvailable,
        reason: 'cooldown_cached',
        probed: false,
        probeSkipped: true,
        record,
        fresh: true,
      };
    }
    if (inBackoff(record, now) && !force) {
      return {
        ok: true,
        provider,
        model,
        effort,
        availability: record.availability,
        serviceAvailable: record.serviceAvailable,
        reason: 'cooldown',
        probed: false,
        probeSkipped: true,
        record,
        fresh: false,
      };
    }
  }

  const lock = tryAcquireProbeLock(root, { now });
  if (!lock.acquired) {
    const fallback = record || baseRecord({ provider, identityHash, model, effort, now });
    return {
      ok: true,
      provider,
      model,
      effort,
      availability: record?.availability ?? 'unknown',
      serviceAvailable: false,
      reason: 'probe_lock_busy',
      probed: false,
      probeSkipped: true,
      record: fallback,
      fresh: !!(record && isFresh(record, now)),
    };
  }

  try {
    const reread = readState(root, key);
    if (reread?.identityHash === identityHash) record = reread;
    const freshAuthoritative =
      !force &&
      record &&
      isFresh(record, now) &&
      record.availability === 'available' &&
      record.serviceAvailable;
    if (freshAuthoritative) {
      return {
        ok: true,
        provider,
        model,
        effort,
        availability: record.availability,
        serviceAvailable: record.serviceAvailable,
        remainingPercent: record.remainingPercent,
        reason: record.reason,
        probed: false,
        probeSkipped: true,
        record,
        fresh: true,
      };
    }
    const outcome = runClaudeProbe({ model, effort, deps, now });
    const base = baseRecord({ provider, identityHash, model, effort, now });
    record = mergeOutcome(
      record || base,
      {
        identityHash,
        availability: outcome.availability || (outcome.ok ? 'available' : 'unknown'),
        serviceAvailable: !!outcome.serviceAvailable,
        remainingPercent: null,
        reason: outcome.reason,
        limitedAt: outcome.ok ? null : record?.limitedAt || nowIso(now),
      },
      now,
    );
    writeState(root, key, record);
    return {
      ok: true,
      provider,
      model,
      effort,
      availability: record.availability,
      serviceAvailable: record.serviceAvailable,
      remainingPercent: record.remainingPercent,
      reason: record.reason,
      probed: true,
      record,
    };
  } finally {
    releaseProbeLock(lock.lockPath, lock.ownerToken);
  }
}

const HEAVY_TIERS = new Set(['focused', 'advanced', 'high']);

export function recommendRoute(
  { costTier, essential = false, codexSnapshot = null, force = false },
  { root = recoveryRoot(), deps = {}, now = Date.now() } = {},
) {
  if (!HEAVY_TIERS.has(costTier)) {
    return { costTier, routes: COST_TIER_ROUTES[costTier] || [], recommendation: null, reason: 'tier_not_preflighted' };
  }
  const routes = COST_TIER_ROUTES[costTier] || [];
  const evaluated = [];
  for (const route of routes) {
    const check = checkProvider(
      {
        provider: route.agent,
        model: route.models[0],
        effort: route.effort,
        force,
        essential,
        codexSnapshot,
        limitIds: route.quotaLimitIds || ['codex'],
      },
      { root, deps, now },
    );
    evaluated.push({
      route,
      check,
      preferred: route.agent === 'claude' && check.serviceAvailable,
    });
  }
  const claude = evaluated.find((e) => e.route.agent === 'claude');
  const codex = evaluated.find((e) => e.route.agent === 'codex');
  let recommendation = null;
  let reason = 'no_route_available';
  if (claude?.check.serviceAvailable) {
    recommendation = claude.route;
    reason = 'claude_recovered';
  } else if (codex?.check.serviceAvailable) {
    recommendation = codex.route;
    reason = 'codex_available';
  } else if (claude?.check.availability === 'unknown' || codex?.check.availability === 'unknown') {
    reason = 'route_unknown';
  }
  return { costTier, routes: evaluated, recommendation, reason };
}

export function recoveryTelemetryPath() {
  return join(ROOT, 'scripts/agent-role-monitor/telemetry.mjs');
}
