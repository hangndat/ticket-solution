import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  checkProvider,
  recordProviderLimit,
  recommendRoute,
  parseClaudeAuth,
  runClaudeProbe,
  parseIsoInstant,
} from './agent-provider-recovery.mjs';
import {
  recoveryRoot,
  inBackoff,
  tryAcquireProbeLock,
  releaseProbeLock,
  STATE_TTL_MS,
} from './agent-provider-state.mjs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const WORKTREE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
import { assessCodexQuota } from './agent-quota-policy.mjs';

const REAL_AUTH = {
  loggedIn: true,
  authMethod: 'claude.ai',
  apiProvider: 'firstParty',
  email: 'user@example.com',
};

const PROBE_OK = { type: 'result', subtype: 'success', is_error: false, result: 'OK' };

function fakeBins(dir, { auth = 'ok', probe = 'ok', authBody = null, probeBody = null, probeExit = 0 } = {}) {
  const authBin = join(dir, 'claude-auth');
  const probeBin = join(dir, 'claude-probe');
  const authOut = authBody ?? (auth === 'ok' ? REAL_AUTH : { loggedIn: false });
  const probeOut =
    probeBody ??
    (probe === 'ok'
      ? PROBE_OK
      : probe === 'rate'
        ? { type: 'result', subtype: 'error', is_error: true, error: 'rate limit exceeded' }
        : { type: 'result', subtype: 'error', is_error: true, error: 'bad' });
  writeFileSync(
    authBin,
    `#!/usr/bin/env node\nconsole.log(JSON.stringify(${JSON.stringify(authOut)}));\n`,
    { mode: 0o700 },
  );
  const probeScript =
    probeExit === 0
      ? `#!/usr/bin/env node\nconsole.log(JSON.stringify(${JSON.stringify(probeOut)}));\n`
      : `#!/usr/bin/env node\nconsole.log(JSON.stringify(${JSON.stringify(probeOut)}));\nprocess.exit(${probeExit});\n`;
  writeFileSync(probeBin, probeScript, { mode: 0o700 });
  return {
    claudeAuthBin: authBin,
    claudeBin: probeBin,
  };
}

const codexSnapshot = (used = 10) => ({
  source: 'codex.app-server.account/rateLimits/read',
  timestamp: new Date().toISOString(),
  accountIdHash: 'fixture-account-hash',
  buckets: [
    {
      limitId: 'codex',
      primary: {
        usedPercent: used,
        windowDurationMins: 10080,
        resetsAt: Math.floor(Date.now() / 1000) + 3600,
      },
    },
  ],
});

test('parseClaudeAuth accepts claude.ai firstParty and rejects swapped legacy shape', () => {
  assert.equal(parseClaudeAuth(JSON.stringify(REAL_AUTH)).ok, true);
  assert.equal(
    parseClaudeAuth(JSON.stringify({ loggedIn: true, authMethod: 'firstParty', apiProvider: 'claude.ai' })).ok,
    false,
  );
  assert.equal(parseClaudeAuth(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' })).ok, false);
});

test('parseClaudeAuth missing identity is unknown', () => {
  const r = parseClaudeAuth(
    JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', apiProvider: 'firstParty' }),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'auth_identity_unknown');
});

test('parseIsoInstant requires timezone', () => {
  assert.throws(() => parseIsoInstant('2026-10-25T10:00:00'), /invalid_instant_iso/);
  assert.equal(parseIsoInstant('2026-10-25T10:00:00.000Z'), Date.parse('2026-10-25T10:00:00.000Z'));
});

test('record-limit requires ISO limited-at with timezone and registered route', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const bins = fakeBins(dir);
  const limitedAt = '2026-10-25T10:00:00.000Z';
  const { record } = recordProviderLimit(
    {
      provider: 'claude',
      model: 'claude-sonnet-5',
      effort: 'medium',
      limitedAt,
      reason: 'seed',
    },
    { root: recoveryRoot(dir), deps: bins },
  );
  assert.equal(record.availability, 'limited');
  assert.ok(inBackoff(record, Date.parse(limitedAt) + 1000));
  assert.throws(
    () =>
      recordProviderLimit(
        { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', limitedAt: '2026-10-25T10:00:00' },
        { root: recoveryRoot(dir), deps: bins },
      ),
    /invalid_limited_at_iso/,
  );
  rmSync(dir, { recursive: true, force: true });
});

test('cooldown skips probe', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const bins = fakeBins(dir);
  const root = recoveryRoot(dir);
  recordProviderLimit(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', limitedAt: new Date().toISOString() },
    { root, deps: bins },
  );
  const r = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low' },
    { root, deps: bins },
  );
  assert.equal(r.probeSkipped, true);
  assert.ok(['cooldown', 'cooldown_cached'].includes(r.reason));
  rmSync(dir, { recursive: true, force: true });
});

test('success probe marks service available without fake remaining percent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const bins = fakeBins(dir);
  const root = recoveryRoot(dir);
  const r = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium', force: true },
    { root, deps: bins },
  );
  assert.equal(r.serviceAvailable, true);
  assert.equal(r.remainingPercent, null);
  assert.equal(r.reason, 'probe_ok');
  rmSync(dir, { recursive: true, force: true });
});

test('probe rejects nonzero exit and error envelope even with OK body', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const bins = fakeBins(dir, { probeExit: 1, probeBody: PROBE_OK });
  const nonzero = runClaudeProbe({ model: 'claude-sonnet-5', effort: 'medium', deps: bins });
  assert.equal(nonzero.ok, false);
  assert.equal(nonzero.reason, 'probe_exit_nonzero');
  const badEnvelope = fakeBins(dir, {
    probeBody: { type: 'result', subtype: 'error', is_error: false, result: 'OK' },
  });
  const env = runClaudeProbe({ model: 'claude-sonnet-5', effort: 'medium', deps: badEnvelope });
  assert.equal(env.ok, false);
  assert.equal(env.reason, 'probe_not_success_envelope');
  rmSync(dir, { recursive: true, force: true });
});

test('session and rate limit probe messages are limited', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const sessionBin = join(dir, 'session-probe');
  writeFileSync(
    sessionBin,
    `#!/usr/bin/env node\nconsole.error("You've hit your session limit");\nprocess.exit(1);\n`,
    { mode: 0o700 },
  );
  const session = runClaudeProbe({
    model: 'claude-sonnet-5',
    effort: 'medium',
    deps: { claudeBin: sessionBin },
  });
  assert.equal(session.availability, 'limited');
  assert.equal(session.reason, 'probe_usage_limited');
  const bins = fakeBins(dir, { probe: 'rate' });
  const root = recoveryRoot(dir);
  const limited = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium', force: true },
    { root, deps: bins },
  );
  assert.equal(limited.serviceAvailable, false);
  assert.equal(limited.availability, 'limited');
  const badBin = join(dir, 'bad-probe');
  writeFileSync(badBin, `#!/usr/bin/env node\nconsole.log('not json');\n`, { mode: 0o700 });
  const unknown = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium', force: true },
    { root, deps: { ...bins, claudeBin: badBin } },
  );
  assert.equal(unknown.availability, 'unknown');
  rmSync(dir, { recursive: true, force: true });
});

test('Codex check re-assesses essential and usage within TTL', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  const essential = checkProvider(
    {
      provider: 'codex',
      model: 'gpt-6-sol',
      effort: 'medium',
      essential: true,
      codexSnapshot: codexSnapshot(85),
    },
    { root, now: Date.now() },
  );
  assert.equal(essential.serviceAvailable, true);
  const noEssential = checkProvider(
    {
      provider: 'codex',
      model: 'gpt-6-sol',
      effort: 'medium',
      essential: false,
      codexSnapshot: codexSnapshot(85),
    },
    { root, now: Date.now() + 1000 },
  );
  assert.equal(noEssential.serviceAvailable, false);
  assert.equal(noEssential.reason, 'reserved');
  const exhausted = checkProvider(
    {
      provider: 'codex',
      model: 'gpt-6-sol',
      effort: 'medium',
      essential: false,
      codexSnapshot: codexSnapshot(100),
    },
    { root, now: Date.now() + 2000 },
  );
  assert.equal(exhausted.serviceAvailable, false);
  assert.equal(exhausted.reason, 'exhausted');
  rmSync(dir, { recursive: true, force: true });
});

test('account switch uses new identity hash without persisting email', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  const a = fakeBins(dir, {
    authBody: { ...REAL_AUTH, email: 'a@example.com' },
  });
  const first = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true },
    { root, deps: a },
  );
  const b = fakeBins(dir, {
    authBody: { ...REAL_AUTH, email: 'b@example.com' },
  });
  const after = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true },
    { root, deps: b },
  );
  assert.notEqual(first.record.identityHash, after.record.identityHash);
  assert.equal(after.serviceAvailable, true);
  const all = readdirSync(root)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readFileSync(join(root, f), 'utf8'))
    .join('\n');
  assert.ok(!all.includes('a@example.com'));
  assert.ok(!all.includes('b@example.com'));
  rmSync(dir, { recursive: true, force: true });
});

test('concurrent check: lock busy never returns stale serviceAvailable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  const bins = fakeBins(dir);
  checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true },
    { root, deps: bins, now: Date.now() - STATE_TTL_MS - 1000 },
  );
  const lock = tryAcquireProbeLock(root);
  assert.equal(lock.acquired, true);
  const busy = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true },
    { root, deps: bins },
  );
  assert.equal(busy.reason, 'probe_lock_busy');
  assert.equal(busy.serviceAvailable, false);
  releaseProbeLock(lock.lockPath, lock.ownerToken);
  rmSync(dir, { recursive: true, force: true });
});

test('child process waits on probe lock without deleting malformed lock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, '.probe.lock'), '{not-json', { mode: 0o600 });
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { tryAcquireProbeLock } from ${JSON.stringify(join(WORKTREE, 'scripts/lib/agent-provider-state.mjs'))};
const r = tryAcquireProbeLock(${JSON.stringify(root)});
console.log(JSON.stringify(r));`,
    ],
    { encoding: 'utf8', timeout: 5000 },
  );
  const parsed = JSON.parse(child.stdout.trim());
  assert.equal(parsed.acquired, false);
  assert.ok(readFileSync(join(root, '.probe.lock'), 'utf8').includes('not-json'));
  rmSync(dir, { recursive: true, force: true });
});

test('Codex assess path unchanged reserve policy', () => {
  const q = assessCodexQuota(codexSnapshot(85), { limitIds: ['codex'] });
  assert.equal(q.state, 'reserved');
  assert.equal(q.reservePercent, 20);
});

test('recommendRoute prefers Claude when recovered and null when none available', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const bins = fakeBins(dir);
  const root = recoveryRoot(dir);
  checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium', force: true },
    { root, deps: bins },
  );
  const route = recommendRoute({ costTier: 'advanced', codexSnapshot: codexSnapshot(5) }, { root, deps: bins });
  assert.equal(route.recommendation?.agent, 'claude');
  assert.equal(route.reason, 'claude_recovered');
  const blockedDir = mkdtempSync(join(tmpdir(), 'prov-rec-blocked-'));
  const blockedRoot = recoveryRoot(blockedDir);
  const failBins = fakeBins(blockedDir, { probe: 'rate' });
  checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'medium', force: true },
    { root: blockedRoot, deps: failBins },
  );
  const blocked = recommendRoute(
    { costTier: 'advanced', codexSnapshot: codexSnapshot(100) },
    { root: blockedRoot, deps: failBins },
  );
  assert.equal(blocked.recommendation, null);
  assert.equal(blocked.reason, 'no_route_available');
  rmSync(dir, { recursive: true, force: true });
  rmSync(blockedDir, { recursive: true, force: true });
});

test('before known reset skips probe', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const bins = fakeBins(dir);
  const root = recoveryRoot(dir);
  const resetAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  recordProviderLimit(
    {
      provider: 'claude',
      model: 'claude-sonnet-5',
      effort: 'low',
      limitedAt: new Date().toISOString(),
      resetAt,
    },
    { root, deps: bins },
  );
  const r = checkProvider({ provider: 'claude', model: 'claude-sonnet-5', effort: 'low' }, { root, deps: bins });
  assert.equal(r.probeSkipped, true);
  assert.equal(r.reason, 'before_known_reset');
  rmSync(dir, { recursive: true, force: true });
});
