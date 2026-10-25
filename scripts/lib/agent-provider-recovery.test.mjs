import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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
import { fileURLToPath, pathToFileURL } from 'node:url';
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

test('parseClaudeAuth org-only without email or account uuid is unknown', () => {
  const r = parseClaudeAuth(
    JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      orgId: 'org-shared',
    }),
  );
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'auth_identity_unknown');
});

test('parseClaudeAuth rejects profile plus config dir without account identity', () => {
  const r = parseClaudeAuth(
    JSON.stringify({
      loggedIn: true,
      authMethod: 'claude.ai',
      apiProvider: 'firstParty',
      profileId: 'profile-a',
      configDir: '/tmp/claude-config-a',
    }),
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
  const missingIsError = fakeBins(dir, {
    probeBody: { type: 'result', subtype: 'success', result: 'OK' },
  });
  const loose = runClaudeProbe({ model: 'claude-sonnet-5', effort: 'medium', deps: missingIsError });
  assert.equal(loose.ok, false);
  assert.equal(loose.reason, 'probe_not_success_envelope');
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

test('Codex check ignores probe lock and re-applies reserve policy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  checkProvider(
    {
      provider: 'codex',
      model: 'gpt-6-sol',
      effort: 'medium',
      essential: true,
      codexSnapshot: codexSnapshot(85),
    },
    { root, now: Date.now() },
  );
  const lock = tryAcquireProbeLock(root);
  assert.equal(lock.acquired, true);
  const reserved = checkProvider(
    {
      provider: 'codex',
      model: 'gpt-6-sol',
      effort: 'medium',
      essential: false,
      codexSnapshot: codexSnapshot(85),
    },
    { root, now: Date.now() + 1000 },
  );
  assert.equal(reserved.serviceAvailable, false);
  assert.equal(reserved.reason, 'reserved');
  releaseProbeLock(lock.lockPath, lock.ownerToken);
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

test('Codex snapshot overrides manual reset and still applies reserve each invocation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  const now = Date.now();
  recordProviderLimit(
    { provider: 'codex', model: 'gpt-6-sol', effort: 'medium', limitedAt: new Date(now).toISOString(), resetAt: new Date(now + 3600000).toISOString() },
    { root, deps: { codexSnapshot: codexSnapshot(100) }, now },
  );
  const fresh = checkProvider(
    { provider: 'codex', model: 'gpt-6-sol', effort: 'medium', codexSnapshot: codexSnapshot(5) },
    { root, now: now + 1000 },
  );
  assert.equal(fresh.serviceAvailable, true);
  assert.equal(fresh.reason, 'available');
  assert.equal(fresh.record.resetAt, null);
  const reserved = checkProvider(
    { provider: 'codex', model: 'gpt-6-sol', effort: 'medium', codexSnapshot: codexSnapshot(85) },
    { root, now: now + 2000 },
  );
  assert.equal(reserved.serviceAvailable, false);
  assert.equal(reserved.reason, 'reserved');
  rmSync(dir, { recursive: true, force: true });
});

test('account switch with same profile uses new identity hash without reusing cache or persisting email', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  const a = fakeBins(dir, {
    authBody: { ...REAL_AUTH, email: 'a@example.com', profileId: 'same-profile', configDir: '/same/config' },
  });
  const first = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true },
    { root, deps: a },
  );
  const b = fakeBins(dir, {
    authBody: { ...REAL_AUTH, email: 'b@example.com', profileId: 'same-profile', configDir: '/same/config' },
  });
  const after = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low' },
    { root, deps: b },
  );
  assert.notEqual(first.record.identityHash, after.record.identityHash);
  assert.equal(after.probed, true);
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

test('two processes reading stale cache before lock reuse the first fresh probe', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-interleave-'));
  const root = recoveryRoot(dir);
  const bins = fakeBins(dir);
  const now = Date.now();
  const request = { provider: 'claude', model: 'claude-sonnet-5', effort: 'low' };
  checkProvider(request, { root, deps: bins, now: now - STATE_TTL_MS - 1000 });

  // The copy pauses process B after its initial state read and before lock acquisition.
  const sourcePath = join(WORKTREE, 'scripts/lib/agent-provider-recovery.mjs');
  const signal = join(dir, 'continue-b');
  const source = readFileSync(sourcePath, 'utf8')
    .replace("import { mkdtempSync, rmSync } from 'node:fs';", "import { mkdtempSync, rmSync, existsSync } from 'node:fs';")
    .replaceAll("from './", `from '${pathToFileURL(join(WORKTREE, 'scripts/lib') + '/').href}`)
    .replace(
      'const lock = tryAcquireProbeLock(root, { now });',
      `process.stdout.write('READY\\n'); while (!existsSync(${JSON.stringify(signal)})) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); const lock = tryAcquireProbeLock(root, { now });`,
    );
  const pausedModule = join(dir, 'paused-recovery.mjs');
  writeFileSync(pausedModule, source);
  const requestCode = `const result = checkProvider(${JSON.stringify(request)}, { root: ${JSON.stringify(root)}, deps: ${JSON.stringify(bins)}, now: ${now} }); console.log(JSON.stringify({probed:result.probed,reason:result.reason,serviceAvailable:result.serviceAvailable}));`;
  const b = spawn(process.execPath, ['--input-type=module', '-e', `import { checkProvider } from ${JSON.stringify(pathToFileURL(pausedModule).href)}; ${requestCode}`], { encoding: 'utf8' });
  let bOutput = '';
  let bError = '';
  b.stdout.on('data', (chunk) => { bOutput += chunk; });
  b.stderr.on('data', (chunk) => { bError += chunk; });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`process B did not reach the lock: ${bError}`)), 5000);
      b.stdout.on('data', () => {
        if (bOutput.includes('READY\n')) { clearTimeout(timer); resolve(); }
      });
      b.on('exit', () => { clearTimeout(timer); if (!bOutput.includes('READY\n')) reject(new Error(bError)); });
    });
    const a = spawnSync(process.execPath, ['--input-type=module', '-e', `import { checkProvider } from ${JSON.stringify(pathToFileURL(sourcePath).href)}; ${requestCode}`], { encoding: 'utf8', timeout: 5000 });
    assert.equal(a.status, 0, a.stderr);
    assert.equal(JSON.parse(a.stdout.trim()).probed, true);
    writeFileSync(signal, 'go');
    const bExit = await new Promise((resolve) => b.on('close', resolve));
    assert.equal(bExit, 0, bError);
    const result = JSON.parse(bOutput.trim().split('\n').at(-1));
    assert.equal(result.probed, false);
    assert.equal(result.serviceAvailable, true);
    assert.equal(result.reason, 'probe_ok');
  } finally {
    b.kill();
    rmSync(dir, { recursive: true, force: true });
  }
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

test('CLI rejects invalid routes and option values before auth, telemetry, or state writes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-cli-'));
  const cli = join(WORKTREE, 'scripts/agent-provider-recovery.mjs');
  const common = ['--root', join(dir, 'state')];
  const cases = [
    ['check', '--provider', 'unsupported', '--model', 'arbitrary'],
    ['check', '--provider', 'claude', '--model', 'arbitrary', '--effort', 'medium'],
    ['check', '--provider', 'codex', '--model', 'gpt-6-sol', '--effort', 'arbitrary'],
    ['check', '--provider', 'codex', '--model', 'gpt-6-sol', '--effort', 'medium', '--essential', 'maybe'],
    ['check', '--provider', 'codex', '--model', 'gpt-6-sol', '--effort', 'medium', '--force', '--force'],
    ['status', '--provider', 'unsupported', '--model', 'arbitrary'],
    ['status', '--provider', 'claude', '--model', 'arbitrary', '--effort', 'medium'],
    ['status', '--provider', 'claude', '--model', 'claude-sonnet-5', '--effort', 'medium', '--essential', 'true'],
    ['record-limit', '--provider', 'unsupported', '--model', 'arbitrary', '--limited-at', new Date().toISOString()],
    ['record-limit', '--provider', 'codex', '--model', 'gpt-6-sol', '--effort', 'arbitrary', '--limited-at', new Date().toISOString()],
    ['record-limit', '--provider', 'claude', '--model', 'claude-sonnet-5', '--effort', 'medium', '--limited-at', new Date().toISOString(), '--essential', 'true'],
    ['route', '--cost-tier', 'unsupported'],
    ['route', '--cost-tier', 'advanced', '--essential', 'maybe'],
    ['route', '--cost-tier', 'advanced', '--provider', 'claude'],
  ];
  for (const args of cases) {
    const result = spawnSync(process.execPath, [cli, ...args, ...common], {
      encoding: 'utf8',
      env: { ...process.env, AGENT_PROVIDER_CLAUDE_AUTH_BIN: join(dir, 'must-not-run'), AGENT_TELEMETRY_CLI: join(dir, 'must-not-run') },
    });
    assert.equal(result.status, 1, args.join(' '));
    const error = JSON.parse(result.stderr.trim());
    assert.equal(error.ok, false);
    assert.match(error.errorCode, /^[a-z_]+$/);
    assert.equal(result.stdout, '');
    assert.equal(existsSync(join(dir, 'state')), false);
  }
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
