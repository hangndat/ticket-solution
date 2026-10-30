import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NON_EVIDENCE_DIRTY,
  assertSourceProvenanceStable,
  captureSourceProvenance,
  sourceEvidenceEligibility,
  validateSourceProvenance,
} from '../harness/source-provenance.mjs';
import { validateManifest } from './validate.mjs';

function validProvenance(overrides = {}) {
  const base = captureSourceProvenance(process.cwd());
  return { ...base, ...overrides };
}

test('captureSourceProvenance records HEAD SHA, fingerprint, and dirty note', () => {
  const recorded = captureSourceProvenance(process.cwd());
  assert.match(recorded.gitCommit, /^[0-9a-f]{40}$/);
  assert.match(recorded.workingTreeFingerprint, /^[0-9a-f]{64}$/);
  assert.equal(typeof recorded.workingTreeDirty, 'boolean');
  assert.equal(typeof recorded.workingTreeNote, 'string');
  assert.equal(typeof recorded.evidenceEligible, 'boolean');
  validateSourceProvenance(recorded);
  assert.doesNotThrow(() =>
    assertSourceProvenanceStable(process.cwd(), recorded),
  );
});

test('sourceEvidenceEligibility marks clean checkout eligible for exact SHA evidence', () => {
  const recorded = captureSourceProvenance(process.cwd());
  if (recorded.workingTreeDirty) {
    assert.deepEqual(sourceEvidenceEligibility(recorded), {
      evidenceEligible: false,
      nonEvidenceReason: NON_EVIDENCE_DIRTY,
    });
    return;
  }
  assert.deepEqual(sourceEvidenceEligibility(recorded), { evidenceEligible: true });
  const end = assertSourceProvenanceStable(process.cwd(), recorded);
  assert.equal(end.evidenceExactShaEligible, true);
});

test('sourceEvidenceEligibility marks dirty checkout NON_EVIDENCE_DIRTY', () => {
  const dirty = validProvenance({
    workingTreeDirty: true,
    workingTreeNote: '1 path(s): tests/e2e/harness/source-provenance.mjs',
    workingTreeFingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    evidenceEligible: false,
    nonEvidenceReason: NON_EVIDENCE_DIRTY,
  });
  validateSourceProvenance(dirty);
  assert.deepEqual(sourceEvidenceEligibility(dirty), {
    evidenceEligible: false,
    nonEvidenceReason: NON_EVIDENCE_DIRTY,
  });
});

test('assertSourceProvenanceStable rejects commit drift', () => {
  const recorded = captureSourceProvenance(process.cwd());
  assert.throws(
    () =>
      assertSourceProvenanceStable(process.cwd(), {
        ...recorded,
        gitCommit: '0'.repeat(40),
      }),
    /git commit changed during E2E run/,
  );
});

test('assertSourceProvenanceStable rejects working tree fingerprint drift', () => {
  const recorded = captureSourceProvenance(process.cwd());
  assert.throws(
    () =>
      assertSourceProvenanceStable(process.cwd(), {
        ...recorded,
        workingTreeFingerprint: 'b'.repeat(64),
      }),
    /working tree fingerprint changed during E2E run/,
  );
});

test('fingerprint detects changed content while dirty paths and statuses stay the same', () => {
  const root = mkdtempSync(join(tmpdir(), 'vemoki-source-provenance-'));
  try {
    execFileSync('git', ['init', '-q', root]);
    const tracked = join(root, 'tracked.txt');
    writeFileSync(tracked, 'initial');
    execFileSync('git', ['-C', root, 'add', 'tracked.txt']);
    execFileSync('git', [
      '-C', root, '-c', 'user.name=Test', '-c', 'user.email=test@example.test',
      'commit', '-qm', 'initial',
    ]);

    const clean = captureSourceProvenance(root);
    assert.equal(clean.evidenceEligible, true);
    writeFileSync(tracked, 'modified once');
    assert.throws(() => assertSourceProvenanceStable(root, clean), /dirty flag changed/);

    const dirtyTracked = captureSourceProvenance(root);
    writeFileSync(tracked, 'modified twice');
    assert.throws(
      () => assertSourceProvenanceStable(root, dirtyTracked),
      /working tree fingerprint changed/,
    );

    const untracked = join(root, 'untracked.txt');
    writeFileSync(untracked, 'first');
    const dirtyUntracked = captureSourceProvenance(root);
    writeFileSync(untracked, 'second');
    assert.throws(
      () => assertSourceProvenanceStable(root, dirtyUntracked),
      /working tree fingerprint changed/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('validateManifest accepts runtime.sourceProvenance on isolated manifest', () => {
  const runId = 'mhh4h7g2-a1b2c3';
  const suffix = `e2e-${runId}.test`;
  const provenance = captureSourceProvenance(process.cwd());
  const manifest = {
    schemaVersion: 1,
    runId,
    origins: {
      web: `https://app.${suffix}:4443`,
      portal: `https://portal.${suffix}:4443`,
      marketing: `https://${suffix}:4443`,
      api: `https://api.${suffix}:4443`,
      auth: `https://auth.${suffix}:4443`,
      mailpit: `https://mailpit.${suffix}:4443`,
    },
    accounts: Object.fromEntries(
      [
        'attendee',
        'otherAttendee',
        'unverified',
        'owner',
        'manager',
        'cs',
        'scanner',
        'supervisor',
        'operator',
      ].map((actor) => [
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
      },
    },
    runtime: {
      ownerRunId: runId,
      hostSuffix: suffix,
      sourceProvenance: provenance,
    },
  };
  assert.strictEqual(validateManifest(manifest), manifest);
});

test('validateManifest rejects malformed sourceProvenance', () => {
  const runId = 'mhh4h7g2-a1b2c3';
  const suffix = `e2e-${runId}.test`;
  const base = {
    schemaVersion: 1,
    runId,
    origins: {
      web: `https://app.${suffix}:4443`,
      portal: `https://portal.${suffix}:4443`,
      marketing: `https://${suffix}:4443`,
      api: `https://api.${suffix}:4443`,
      auth: `https://auth.${suffix}:4443`,
      mailpit: `https://mailpit.${suffix}:4443`,
    },
    accounts: {
      attendee: { username: 'a@example.test', password: 'x' },
      otherAttendee: { username: 'b@example.test', password: 'x' },
      unverified: { username: 'c@example.test', password: 'x' },
      owner: { username: 'd@example.test', password: 'x' },
      manager: { username: 'e@example.test', password: 'x' },
      cs: { username: 'f@example.test', password: 'x' },
      scanner: { username: 'g@example.test', password: 'x' },
      supervisor: { username: 'h@example.test', password: 'x' },
      operator: { username: 'i@example.test', password: 'x' },
    },
    cases: {
      'WEB-01': {
        tenantId: '9f755278-5ef9-4e72-8daa-a80fbfdc908f',
        tenantSlug: 'tenant-a',
        eventId: '5f66bc66-4ca7-48d7-90c2-2b46627da456',
        eventSlug: 'event-a',
      },
    },
    runtime: {
      ownerRunId: runId,
      hostSuffix: suffix,
      sourceProvenance: {
        gitCommit: 'short',
        gitBranch: 'main',
        workingTreeDirty: false,
        workingTreeFingerprint: 'bad',
        workingTreeNote: 'clean',
        evidenceEligible: true,
      },
    },
  };
  assert.throws(() => validateManifest(base), /gitCommit must be a full git SHA/);
});
