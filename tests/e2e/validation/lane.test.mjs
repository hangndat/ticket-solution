import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  ROOT,
  buildKey,
  laneConfig,
  laneLockState,
  releaseLane,
  runDatabase,
  templateDatabase,
  tryAcquireLaneLock,
} from '../harness/lane.mjs';
import { validateManifest } from './validate.mjs';

function scratchLane(name = 'lane9') {
  const dir = mkdtempSync(resolve(tmpdir(), 'e2e-lane-'));
  return { name, dir, lockPath: resolve(dir, 'lane.lock') };
}

const provenance = {
  gitCommit: 'a'.repeat(40),
  workingTreeFingerprint: 'b'.repeat(64),
};

test('lane identity is stable and port-derived', () => {
  const first = laneConfig(1);
  assert.equal(first.name, 'lane1');
  assert.equal(first.suffix, 'e2e-lane1.test');
  assert.equal(first.realm, 'e2e-lane1');
  assert.equal(first.project, 'e2e-lane1');
  assert.deepEqual(laneConfig('1'), first);
  assert.equal(laneConfig(2).tlsPort - first.tlsPort, 1);
  for (const bad of [0, 17, -1, 1.5, 'x', null])
    assert.throws(() => laneConfig(bad), /BLOCKED: lane/);
});

test('lane state lives outside the checkout so worktrees share one lock', () => {
  const { dir, lockPath } = laneConfig(1);
  assert.equal(lockPath.startsWith(dir), true);
  // Container, port and realm of a lane are machine-wide; a path inside the repo
  // would give each worktree its own lock over the same resources.
  assert.equal(dir.startsWith(ROOT), false);
});

test('run database name is a safe identifier', () => {
  assert.equal(runDatabase('mvxomaja-f033ff'), 'e2e_mvxomaja_f033ff');
  assert.match(templateDatabase('f'.repeat(64)), /^e2e_tpl_f{16}$/);
  assert.throws(() => runDatabase('-'.repeat(60)), /BLOCKED: runId/);
});

test('build key changes with source or lane origin', () => {
  const lane = laneConfig(1);
  const base = buildKey(provenance, lane);
  assert.equal(base, buildKey({ ...provenance }, laneConfig(1)));
  assert.notEqual(base, buildKey(provenance, laneConfig(2)));
  assert.notEqual(
    base,
    buildKey({ ...provenance, gitCommit: 'c'.repeat(40) }, lane),
  );
  assert.notEqual(
    base,
    buildKey({ ...provenance, workingTreeFingerprint: 'd'.repeat(64) }, lane),
  );
});

test('lane lock is exclusive and released by its owner', () => {
  const lane = scratchLane();
  const held = tryAcquireLaneLock(lane, 'run-a');
  assert.ok(held);
  assert.equal(laneLockState(lane).free, false);
  assert.equal(tryAcquireLaneLock(lane, 'run-b'), null);
  // A different run must not drop a live lock.
  releaseLane({ ...lane, runId: 'run-b' });
  assert.equal(laneLockState(lane).free, false);
  releaseLane(held);
  assert.equal(laneLockState(lane).free, true);
  assert.equal(existsSync(lane.lockPath), false);
});

test('a dead holder leaves a stale lock that can be taken over', () => {
  const lane = scratchLane();
  // PID 2^22 is above the default pid_max on macOS and Linux.
  writeFileSync(
    lane.lockPath,
    JSON.stringify({ pid: 4194304, runId: 'gone' }),
    { mode: 0o600 },
  );
  const state = laneLockState(lane);
  assert.equal(state.free, true);
  assert.equal(state.stale, true);
  const held = tryAcquireLaneLock(lane, 'run-new');
  assert.ok(held);
  releaseLane(held);
});

test('manifest validation accepts lane hostnames and rejects bad lane names', () => {
  const runId = 'mhh4h7g2-a1b2c3';
  const suffix = 'e2e-lane1.test';
  const actors = [
    'attendee',
    'otherAttendee',
    'unverified',
    'owner',
    'manager',
    'cs',
    'scanner',
    'supervisor',
    'operator',
  ];
  const manifest = () => ({
    schemaVersion: 1,
    runId,
    lane: 'lane1',
    origins: {
      web: `https://app.${suffix}:44301`,
      portal: `https://portal.${suffix}:44301`,
      marketing: `https://${suffix}:44301`,
      api: `https://api.${suffix}:44301`,
      auth: `https://auth.${suffix}:44301`,
      mailpit: `https://mailpit.${suffix}:44301`,
    },
    accounts: Object.fromEntries(
      actors.map((actor) => [
        actor,
        { username: `${actor}@example.test`, password: 'private-secret' },
      ]),
    ),
    cases: {
      'WEB-01': {
        tenantId: '9f755278-5ef9-4e72-8daa-a80fbfdc908f',
        tenantSlug: 'tenant-a',
        eventId: '5f66bc66-4ca7-48d7-90c2-2b46627da456',
        eventSlug: 'event-a',
        accounts: {
          attendee: { username: 'case@example.test', password: 'case-secret' },
        },
      },
    },
    runtime: { ownerRunId: runId, hostSuffix: suffix },
  });
  assert.doesNotThrow(() => validateManifest(manifest()));
  const wrongName = manifest();
  wrongName.lane = 'lane0';
  assert.throws(() => validateManifest(wrongName), /BLOCKED: lane/);
  const mismatched = manifest();
  mismatched.runtime.hostSuffix = `e2e-${runId}.test`;
  assert.throws(
    () => validateManifest(mismatched),
    /BLOCKED: runtime.hostSuffix/,
  );
});
