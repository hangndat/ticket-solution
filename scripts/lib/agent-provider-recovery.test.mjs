import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  checkProvider,
  recordProviderLimit,
  recommendRoute,
  parseClaudeAuth,
  runClaudeProbe,
} from './agent-provider-recovery.mjs';
import { recoveryRoot, inBackoff, tryAcquireProbeLock, releaseProbeLock } from './agent-provider-state.mjs';
import { assessCodexQuota } from './agent-quota-policy.mjs';

function fakeBins(dir, { auth = 'ok', probe = 'ok', authBody = null, probeBody = null } = {}) {
  const authBin = join(dir, 'claude-auth');
  const probeBin = join(dir, 'claude-probe');
  const authOut =
    authBody ??
    (auth === 'ok'
      ? { loggedIn: true, authMethod: 'firstParty', apiProvider: 'claude.ai' }
      : { loggedIn: false });
  const probeOut =
    probeBody ??
    (probe === 'ok'
      ? { success: true, is_error: false, result: 'OK' }
      : probe === 'rate'
        ? { success: false, is_error: true, error: 'rate limit exceeded' }
        : { success: false, is_error: true, error: 'bad' });
  writeFileSync(
    authBin,
    `#!/usr/bin/env node\nconsole.log(JSON.stringify(${JSON.stringify(authOut)}));\n`,
    { mode: 0o700 },
  );
  writeFileSync(
    probeBin,
    `#!/usr/bin/env node\nconsole.log(JSON.stringify(${JSON.stringify(probeOut)}));\n`,
    { mode: 0o700 },
  );
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

test('parseClaudeAuth accepts firstParty claude.ai only', () => {
  assert.equal(parseClaudeAuth(JSON.stringify({ loggedIn: true, authMethod: 'firstParty', apiProvider: 'claude.ai' })).ok, true);
  assert.equal(parseClaudeAuth(JSON.stringify({ loggedIn: true, authMethod: 'apiKey', apiProvider: 'claude.ai' })).ok, false);
});

test('record-limit requires ISO limited-at and sets backoff', () => {
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

test('rate limit and malformed probe stay limited/unknown', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
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

test('account switch uses new identity hash without persisting email', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  const a = fakeBins(dir, {
    authBody: { loggedIn: true, authMethod: 'firstParty', apiProvider: 'claude.ai', email: 'a@example.com' },
  });
  const first = checkProvider({ provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true }, { root, deps: a });
  const b = fakeBins(dir, {
    authBody: { loggedIn: true, authMethod: 'firstParty', apiProvider: 'claude.ai', email: 'b@example.com' },
  });
  const after = checkProvider({ provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true }, { root, deps: b });
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

test('concurrent check: lock busy returns cached outcome', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const root = recoveryRoot(dir);
  const lock = tryAcquireProbeLock(root);
  assert.equal(lock.acquired, true);
  const bins = fakeBins(dir);
  const busy = checkProvider(
    { provider: 'claude', model: 'claude-sonnet-5', effort: 'low', force: true },
    { root, deps: bins },
  );
  assert.equal(busy.reason, 'probe_lock_busy');
  releaseProbeLock(lock.lockPath);
  rmSync(dir, { recursive: true, force: true });
});

test('Codex assess path unchanged reserve policy', () => {
  const q = assessCodexQuota(codexSnapshot(85), { limitIds: ['codex'] });
  assert.equal(q.state, 'reserved');
  assert.equal(q.reservePercent, 20);
});

test('recommendRoute prefers Claude when recovered', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prov-rec-'));
  const bins = fakeBins(dir);
  const root = recoveryRoot(dir);
  checkProvider({ provider: 'claude', model: 'claude-sonnet-5', effort: 'medium', force: true }, { root, deps: bins });
  const route = recommendRoute({ costTier: 'advanced', codexSnapshot: codexSnapshot(5) }, { root, deps: bins });
  assert.equal(route.recommendation?.agent, 'claude');
  assert.equal(route.reason, 'claude_recovered');
  rmSync(dir, { recursive: true, force: true });
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
