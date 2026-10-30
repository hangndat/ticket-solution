import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const COMMIT_RE = /^[0-9a-f]{40}$/;
const FINGERPRINT_RE = /^[0-9a-f]{64}$/;

export const NON_EVIDENCE_DIRTY = 'NON_EVIDENCE_DIRTY';

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitBytes(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function fingerprintWorkingTree(root) {
  const hash = createHash('sha256');
  hash.update(gitBytes(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'));
  hash.update('\0tracked-diff\0');
  hash.update(gitBytes(root, 'diff', '--no-ext-diff', '--no-textconv', '--binary', 'HEAD', '--'));
  hash.update('\0untracked-content\0');
  const untracked = gitBytes(root, 'ls-files', '--others', '--exclude-standard', '-z');
  for (const path of untracked.toString('utf8').split('\0').filter(Boolean)) {
    const file = resolve(root, path);
    const stat = lstatSync(file);
    hash.update(path);
    hash.update('\0');
    hash.update(String(stat.mode));
    hash.update('\0');
    if (stat.isSymbolicLink()) hash.update(readlinkSync(file));
    else if (stat.isFile()) hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function evidenceFields(workingTreeDirty) {
  if (workingTreeDirty) {
    return {
      evidenceEligible: false,
      nonEvidenceReason: NON_EVIDENCE_DIRTY,
    };
  }
  return { evidenceEligible: true };
}

/** Snapshot checkout identity at E2E run start (repo root, not run artifact dir). */
export function captureSourceProvenance(root) {
  const gitCommit = git(root, 'rev-parse', 'HEAD');
  if (!COMMIT_RE.test(gitCommit)) {
    throw new Error('BLOCKED: git rev-parse HEAD did not return a full SHA');
  }
  let gitBranch = 'HEAD';
  try {
    gitBranch = git(root, 'branch', '--show-current') || 'HEAD';
  } catch {
    gitBranch = 'HEAD';
  }
  const porcelain = git(root, 'status', '--porcelain');
  const lines = porcelain ? porcelain.split('\n').filter(Boolean) : [];
  const workingTreeDirty = lines.length > 0;
  const workingTreeFingerprint = fingerprintWorkingTree(root);
  const preview = lines
    .slice(0, 10)
    .map((line) => line.slice(3).slice(0, 120))
    .join('; ');
  const workingTreeNote = workingTreeDirty
    ? `${lines.length} path(s)${preview ? `: ${preview}${lines.length > 10 ? '…' : ''}` : ''}`
    : 'clean';
  return {
    gitCommit,
    gitBranch,
    workingTreeDirty,
    workingTreeFingerprint,
    workingTreeNote,
    ...evidenceFields(workingTreeDirty),
    capturedAt: new Date().toISOString(),
  };
}

export function sourceEvidenceEligibility(provenance) {
  const item = validateSourceProvenance(provenance);
  if (item.workingTreeDirty) {
    return {
      evidenceEligible: false,
      nonEvidenceReason: NON_EVIDENCE_DIRTY,
    };
  }
  return { evidenceEligible: true };
}

/** Fail closed if HEAD, dirty flag, or fingerprint changes mid-run. */
export function assertSourceProvenanceStable(root, recorded) {
  if (!recorded || typeof recorded !== 'object') {
    throw new Error('BLOCKED: missing source provenance recorded at run start');
  }
  validateSourceProvenance(recorded);
  const end = captureSourceProvenance(root);
  if (end.gitCommit !== recorded.gitCommit) {
    throw new Error(
      `BLOCKED: git commit changed during E2E run (${recorded.gitCommit.slice(0, 12)} → ${end.gitCommit.slice(0, 12)})`,
    );
  }
  if (end.workingTreeDirty !== recorded.workingTreeDirty) {
    throw new Error('BLOCKED: working tree dirty flag changed during E2E run');
  }
  if (end.workingTreeFingerprint !== recorded.workingTreeFingerprint) {
    throw new Error('BLOCKED: working tree fingerprint changed during E2E run');
  }
  const evidenceExactShaEligible =
    recorded.evidenceEligible &&
    end.evidenceEligible &&
    end.gitCommit === recorded.gitCommit;
  return {
    endCommit: end.gitCommit,
    endWorkingTreeFingerprint: end.workingTreeFingerprint,
    stable: true,
    evidenceExactShaEligible,
  };
}

export function validateSourceProvenance(value, field = 'runtime.sourceProvenance') {
  const item = value;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error(`BLOCKED: ${field} must be an object`);
  }
  if (typeof item.gitCommit !== 'string' || !COMMIT_RE.test(item.gitCommit)) {
    throw new Error(`BLOCKED: ${field}.gitCommit must be a full git SHA`);
  }
  if (typeof item.gitBranch !== 'string' || !item.gitBranch.trim()) {
    throw new Error(`BLOCKED: ${field}.gitBranch must be a nonempty string`);
  }
  if (typeof item.workingTreeDirty !== 'boolean') {
    throw new Error(`BLOCKED: ${field}.workingTreeDirty must be boolean`);
  }
  if (
    typeof item.workingTreeFingerprint !== 'string' ||
    !FINGERPRINT_RE.test(item.workingTreeFingerprint)
  ) {
    throw new Error(
      `BLOCKED: ${field}.workingTreeFingerprint must be a sha256 hex digest`,
    );
  }
  if (
    typeof item.workingTreeNote !== 'string' ||
    item.workingTreeNote.length > 4096
  ) {
    throw new Error(`BLOCKED: ${field}.workingTreeNote must be a short string`);
  }
  if (typeof item.evidenceEligible !== 'boolean') {
    throw new Error(`BLOCKED: ${field}.evidenceEligible must be boolean`);
  }
  if (item.evidenceEligible !== !item.workingTreeDirty) {
    throw new Error(
      `BLOCKED: ${field}.evidenceEligible must match workingTreeDirty`,
    );
  }
  if (!item.evidenceEligible) {
    if (item.nonEvidenceReason !== NON_EVIDENCE_DIRTY) {
      throw new Error(
        `BLOCKED: ${field}.nonEvidenceReason must be ${NON_EVIDENCE_DIRTY} when dirty`,
      );
    }
  } else if (item.nonEvidenceReason !== undefined) {
    throw new Error(
      `BLOCKED: ${field}.nonEvidenceReason must be omitted when evidence eligible`,
    );
  }
  if (
    item.capturedAt !== undefined &&
    (typeof item.capturedAt !== 'string' || !item.capturedAt.trim())
  ) {
    throw new Error(`BLOCKED: ${field}.capturedAt must be an ISO timestamp string`);
  }
  return item;
}
