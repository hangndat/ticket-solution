#!/usr/bin/env node
/**
 * agent-workflow-guard — mechanical UAT/evidence/scope gates (fail closed).
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  writeSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  buildAuthFetchExpression,
  buildProbeExpression,
  computeProbeFingerprint,
  forbidManifestScriptFields,
  hashFile,
  mergeAuthObservation,
  pathAllowed,
  readPngDimensions,
  runOrcaEval,
  sanitizeObservation,
  validateExpectMeaningful,
  validateExpectVsObserved,
  validateScreenshotStates,
  allowPrefixPermitted,
  isRuntimePath,
} from "./lib/workflow-observation.mjs";

const HELP = `agent-workflow-guard — probe, evidence manifest, scope, handoff

Commands:
  probe     Browser DOM/auth observation (orca eval) or validate --observed JSON
  evidence  Validate capture manifest (expectations, artifacts, provenance)
  scope     Git range guard for evidence-only vs implementation
  handoff   evidence + manifest preflight + scope (required for evidence-only)

Global: --help

Exit: 0 ok · 1 usage · 2 findings · 3 probe host unavailable
`;

const DEFAULT_ALLOW = ["docs/reviews"];
const FULL_SHA = /^[0-9a-f]{40}$/;

function usage(msg) {
  if (msg) console.error(msg);
  console.error(HELP);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function emit(payload, code) {
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(code);
}

function gitText(args, cwd) {
  return execFileSync("git", args, { encoding: "utf8", cwd, maxBuffer: 50e6 }).trimEnd();
}

function resolveSha(ref, cwd) {
  try {
    return gitText(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], cwd);
  } catch {
    return null;
  }
}

function resolveTreeSha(commitSha, cwd, treePath = ".") {
  try {
    if (treePath !== "." && (!treePath || treePath.startsWith("/") || treePath.split("/").some(p => p === ".." || p === "."))) return null;
    const ref = treePath === "." ? `${commitSha}^{tree}` : `${commitSha}:${treePath}`;
    if (gitText(["cat-file", "-t", ref], cwd) !== "tree") return null;
    return gitText(["rev-parse", "--verify", ref], cwd);
  } catch {
    return null;
  }
}

/** Parse git status --porcelain -z (rename uses consecutive path tokens). */
export function porcelainEntries(cwd) {
  const raw = gitText(["status", "--porcelain", "-z", "-uall"], cwd);
  if (!raw) return [];
  const tokens = raw.split("\0").filter((t) => t.length > 0);
  const entries = [];
  for (let i = 0; i < tokens.length; i++) {
    const line = tokens[i];
    if (line.length < 4) continue;
    const status = line.slice(0, 2);
    const firstPath = line.slice(3);
    if (status[0] === "R" || status[0] === "C") {
      const dest = tokens[++i];
      if (!dest) continue;
      entries.push({ status, path: dest, oldPath: firstPath });
      entries.push({ status: `${status[0]}_src`, path: firstPath });
    } else {
      entries.push({ status, path: firstPath });
    }
  }
  return entries;
}

function indexBlobHash(cwd, relPath) {
  try {
    const out = gitText(["ls-files", "-s", "--", relPath], cwd);
    const line = out.split("\n").find((l) => l.trim().length > 0);
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    return parts[2] ?? null;
  } catch {
    return null;
  }
}

function fileContentHash(cwd, relPath) {
  const abs = resolve(cwd, relPath);
  if (!existsSync(abs)) return null;
  try {
    if (statSync(abs).isDirectory()) return "dir";
    return hashFile(abs);
  } catch {
    return null;
  }
}

function loadCheckpoint(path) {
  if (!path || !existsSync(path)) return { entries: new Map(), rejected: false };
  const data = readJson(path);
  if (data.schema !== "workflow-guard-checkpoint/v2" || !Array.isArray(data.entries)) {
    return { entries: new Map(), rejected: true, reason: "CHECKPOINT_V1_REJECTED" };
  }
  const map = new Map();
  for (const e of data.entries) {
    map.set(e.path, {
      status: e.status,
      sha256: e.sha256,
      indexSha: e.indexSha ?? null,
    });
  }
  return { entries: map, rejected: false };
}

function saveCheckpoint(path, cwd) {
  const entries = porcelainEntries(cwd).map((e) => ({
    path: e.path,
    status: e.status,
    sha256: fileContentHash(cwd, e.path),
    indexSha: indexBlobHash(cwd, e.path),
  }));
  const payload = {
    schema: "workflow-guard-checkpoint/v2",
    capturedAt: new Date().toISOString(),
    entries,
  };
  const abs = resolve(path);
  const fd = openSync(abs, "wx");
  try {
    writeSync(fd, Buffer.from(JSON.stringify(payload) + "\n", "utf8"));
  } finally {
    closeSync(fd);
  }
}

function isBaselineEntry(entry, baseline, cwd) {
  const prev = baseline.get(entry.path);
  if (!prev) return false;
  const hash = fileContentHash(cwd, entry.path);
  const indexSha = indexBlobHash(cwd, entry.path);
  return (
    prev.status === entry.status &&
    prev.sha256 === hash &&
    (prev.indexSha ?? null) === (indexSha ?? null)
  );
}

function changedPathsInRange(baseSha, headSha, cwd) {
  const buf = execFileSync(
    "git",
    ["diff", "--name-status", "-z", "--end-of-options", `${baseSha}..${headSha}`],
    { cwd, maxBuffer: 50e6 },
  );
  const paths = new Set();
  let start = 0;
  const tokens = [];
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0) {
      if (i > start) tokens.push(buf.subarray(start, i).toString("utf8"));
      start = i + 1;
    }
  }
  for (let t = 0; t < tokens.length; ) {
    const status = tokens[t++];
    if (!status) break;
    if (status[0] === "R" || status[0] === "C") {
      const oldP = tokens[t++];
      const newP = tokens[t++];
      if (oldP) paths.add(oldP);
      if (newP) paths.add(newP);
    } else {
      const p = tokens[t++];
      if (p) paths.add(p);
    }
  }
  return [...paths];
}

function normalizeAllowList(extra) {
  const list = [...DEFAULT_ALLOW];
  for (const p of extra) {
    if (!allowPrefixPermitted(p)) {
      throw new Error(`allow prefix not permitted: ${p}`);
    }
    list.push(p);
  }
  return list;
}

function scopeEvidenceViolations(changed, porcelain, allowList, baseline, cwd, checkpointRejected) {
  const findings = [];
  if (checkpointRejected) {
    findings.push({ code: "CHECKPOINT_V1_REJECTED", message: "checkpoint v1 not supported" });
  }
  for (const p of changed) {
    if (!pathAllowed(p, allowList)) {
      findings.push({
        code: "EVIDENCE_ONLY_PATH_LEAK",
        message: `committed path outside allowlist: ${p}`,
      });
    }
  }
  for (const entry of porcelain) {
    if (isBaselineEntry(entry, baseline, cwd)) continue;
    if (!pathAllowed(entry.path, allowList)) {
      findings.push({
        code: "EVIDENCE_ONLY_PATH_LEAK",
        message: `dirty path outside allowlist: ${entry.path}`,
      });
    }
  }
  return findings;
}

function cmdProbe(argv) {
  let tab = null;
  let expectPath = null;
  let worktree = null;
  let printProbe = false;
  let observedPath = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tab") tab = argv[++i];
    else if (a === "--expect") expectPath = argv[++i];
    else if (a === "--worktree") worktree = argv[++i];
    else if (a === "--print-probe") printProbe = true;
    else if (a === "--observed") observedPath = argv[++i];
    else usage(`FAIL: unknown probe arg: ${a}`);
  }
  if (!expectPath) usage("FAIL: probe requires --expect <json>");
  const expect = readJson(expectPath);
  const preflightFindings = [];
  validateExpectMeaningful(expect, preflightFindings);
  if (preflightFindings.length) {
    emit({ schema: "workflow-guard-probe/v1", ok: false, findings: preflightFindings }, 2);
  }
  const expr = buildProbeExpression(expect);
  if (printProbe) {
    emit(
      {
        schema: "workflow-guard-probe/v1",
        host: "orca eval --expression",
        expression: expr,
        authExpression:
          expect.authMode === "protected" && expect.authProbe?.url
            ? buildAuthFetchExpression(expect.authProbe.url, expect.authProbe)
            : null,
        label: "print-probe",
      },
      0,
    );
  }

  let observation;
  let hostObservation = null;
  if (observedPath) {
    observation = readJson(observedPath);
  } else {
    const domResult = runOrcaEval(expr, { pageId: tab, worktree });
    if (!domResult.ok) {
      emit(
        {
          schema: "workflow-guard-probe/v1",
          ok: false,
          host: "unavailable",
          code: domResult.code,
          findings: [{ code: domResult.unavailable ? "HOST_UNAVAILABLE" : "ORCA_EVAL_FAILED" }],
        },
        domResult.unavailable ? 3 : 2,
      );
    }
    observation = domResult.raw;
    if (expect.authMode === "protected" && expect.authProbe?.url) {
      const authExpr = buildAuthFetchExpression(expect.authProbe.url, expect.authProbe);
      const authResult = runOrcaEval(authExpr, { pageId: tab, worktree });
      if (authResult.ok) {
        const parsed =
          typeof authResult.raw === "string" ? JSON.parse(authResult.raw) : authResult.raw;
        observation = mergeAuthObservation(observation, parsed);
      } else {
        observation = mergeAuthObservation(observation, { status: "fetch_failed" });
      }
    }
    hostObservation = sanitizeObservation(observation);
  }

  const safe = sanitizeObservation(observation);
  const findings = validateExpectVsObserved(expect, safe);
  validateScreenshotStates(expect?.states, findings, {
    globalViewport: expect?.viewport,
    artifactsByPath: new Map(),
    requireArtifacts: false,
  });
  const fingerprint = computeProbeFingerprint(expect, safe);
  emit(
    {
      schema: "workflow-guard-probe/v1",
      ok: findings.length === 0,
      fingerprint,
      fingerprintKind: "integrity_expect_observation",
      fingerprintNote: "integrity hash of normalized expect+observation; not independent host proof",
      hostObservation,
      observation: safe,
      findings,
    },
    findings.length ? 2 : 0,
  );
}

function validateManifestProvenance(manifest, cwd, findings) {
  const git = manifest.git ?? {};
  const head = git.commit ?? {};
  if (!head.sha || !FULL_SHA.test(head.sha)) {
    findings.push({ code: "PROVENANCE_SHA_MISSING", message: "git.commit.sha full hash required" });
  }
  if (head.ref === undefined) {
    findings.push({ code: "PROVENANCE_REF_MISSING", message: "git.commit.ref required" });
  }
  if (typeof head.dirty !== "boolean") {
    findings.push({ code: "PROVENANCE_DIRTY_MISSING", message: "git.commit.dirty boolean required" });
  }
  const treePath = git.sourceTree?.path ?? ".";
  const treeSha = git.sourceTree?.sha ?? git.tree?.sha;
  if (!treeSha || !FULL_SHA.test(treeSha)) {
    findings.push({ code: "PROVENANCE_TREE_MISSING", message: "git.sourceTree.sha required" });
  }
  const buildId = git.build?.id ?? manifest.expect?.build?.id;
  if (!buildId || String(buildId).trim() === "") {
    findings.push({ code: "PROVENANCE_BUILD_MISSING", message: "build id required" });
  }
  if (head.sha && FULL_SHA.test(head.sha)) {
    const resolved = resolveSha(head.ref ?? "HEAD", cwd);
    if (!resolved) {
      findings.push({ code: "GIT_REF_INVALID", message: "cannot resolve commit ref" });
    } else if (resolved !== head.sha) {
      findings.push({ code: "DIRTY_PROVENANCE_FALSE_HEAD", message: "commit sha mismatch" });
    }
    const actualTree = resolveTreeSha(head.sha, cwd, treePath);
    if (!actualTree || (treeSha && actualTree !== treeSha)) {
      findings.push({ code: "PROVENANCE_TREE_MISMATCH", message: "sourceTree.sha mismatch at commit" });
    }
    const outside = porcelainEntries(cwd)
      .map((e) => e.path)
      .filter((p) => !pathAllowed(p, DEFAULT_ALLOW));
    if (head.dirty === false && outside.length > 0) {
      findings.push({ code: "DIRTY_PROVENANCE_FALSE_HEAD", message: "non-evidence dirty paths" });
    }
  }
  const obsBuild = manifest.observations?.build ?? {};
  const expBuild = manifest.expect?.build ?? {};
  if (expBuild.commit && obsBuild.commit && expBuild.commit !== obsBuild.commit) {
    findings.push({ code: "BUILD_OBSERVED_MISMATCH", message: "observed build commit mismatch" });
  }
  if (expBuild.id && obsBuild.id && expBuild.id !== obsBuild.id) {
    findings.push({ code: "BUILD_OBSERVED_MISMATCH", message: "observed build id mismatch" });
  }
  const gitBuildId = git.build?.id;
  if (gitBuildId && expBuild.id && gitBuildId !== expBuild.id) {
    findings.push({ code: "BUILD_PROVENANCE_MISMATCH", message: "git.build.id mismatch expect.build.id" });
  }
  if (gitBuildId && obsBuild.id && gitBuildId !== obsBuild.id) {
    findings.push({ code: "BUILD_PROVENANCE_MISMATCH", message: "git.build.id mismatch observations.build.id" });
  }
}

function validatePreflight(manifest, findings) {
  const pf = manifest.preflight;
  if (!pf?.fingerprint || !pf?.at) {
    findings.push({ code: "PREFLIGHT_MISSING", message: "preflight fingerprint and at required" });
    return;
  }
  if (pf.ok !== true) {
    findings.push({ code: "PREFLIGHT_FAILED", message: "preflight ok must be true" });
    return;
  }
  if (pf.claim === "independent_proof") {
    findings.push({ code: "PREFLIGHT_CLAIM_INVALID", message: "fingerprint is integrity only" });
  }
  if (!manifest.expect || !manifest.observations) {
    findings.push({ code: "MANIFEST_INCOMPLETE", message: "expect and observations required for fingerprint" });
    return;
  }
  const expectedFp = computeProbeFingerprint(manifest.expect, manifest.observations);
  if (pf.fingerprint !== expectedFp) {
    findings.push({ code: "PREFLIGHT_FINGERPRINT_MISMATCH", message: "preflight fingerprint mismatch" });
  }
  const captured = manifest.capturedAt ? Date.parse(manifest.capturedAt) : NaN;
  const prefAt = Date.parse(pf.at);
  if (!Number.isFinite(captured) || !Number.isFinite(prefAt) || prefAt > captured) {
    findings.push({ code: "PREFLIGHT_TIME_INVALID", message: "preflight.at must be <= capturedAt" });
  }
}

function buildArtifactsMap(arts, cwd) {
  const m = new Map();
  for (const a of arts) {
    if (!a?.path) continue;
    m.set(a.path, a);
    m.set(resolve(cwd, a.path), a);
    m.set(resolve(a.path), a);
  }
  return m;
}

function validateArtifacts(manifest, findings) {
  const arts = manifest.artifacts ?? [];
  const states = manifest.expect?.states ?? [];
  if (states.length > 0 && arts.length === 0) {
    findings.push({ code: "ARTIFACTS_REQUIRED", message: "artifacts required when states configured" });
  }
  const byPath = buildArtifactsMap(arts, process.cwd());
  const statesByShot = new Map();
  for (const st of states) {
    if (st?.screenshot) statesByShot.set(resolve(st.screenshot), st);
    if (st?.screenshot) statesByShot.set(st.screenshot, st);
  }
  const globalVp = manifest.expect?.viewport;
  for (const art of arts) {
    if (!art?.path) {
      findings.push({ code: "ARTIFACT_INVALID", message: "artifact path required" });
      continue;
    }
    if (!art.sha256 || !/^[0-9a-f]{64}$/.test(art.sha256)) {
      findings.push({ code: "ARTIFACT_HASH_REQUIRED", message: "artifact sha256 required" });
      continue;
    }
    if (!art.viewport || !Number(art.viewport.width) || !Number(art.viewport.height)) {
      findings.push({ code: "ARTIFACT_VIEWPORT_REQUIRED", message: "artifact viewport required" });
      continue;
    }
    const st = statesByShot.get(resolve(art.path)) ?? statesByShot.get(art.path);
    const expectedVp = st?.viewport ?? globalVp;
    if (
      expectedVp &&
      (Number(art.viewport.width) !== Number(expectedVp.width) ||
        Number(art.viewport.height) !== Number(expectedVp.height))
    ) {
      findings.push({
        code: "ARTIFACT_VIEWPORT_MISMATCH",
        message: `artifact viewport mismatch expect: ${art.path}`,
      });
    }
    try {
      const h = hashFile(art.path);
      if (h !== art.sha256) {
        findings.push({ code: "ARTIFACT_HASH_MISMATCH", message: `hash mismatch: ${art.path}` });
      }
      const dims = readPngDimensions(art.path);
      if (!dims.ok) {
        findings.push({ code: "PNG_INVALID", message: `invalid png: ${art.path}` });
      } else if (
        Number(art.viewport.width) !== dims.width ||
        Number(art.viewport.height) !== dims.height
      ) {
        findings.push({ code: "PNG_VIEWPORT_MISMATCH", message: `ihdr mismatch: ${art.path}` });
      }
    } catch {
      findings.push({ code: "ARTIFACT_MISSING", message: `missing: ${art.path}` });
    }
  }
  validateScreenshotStates(states, findings, {
    globalViewport: manifest.expect?.viewport,
    artifactsByPath: byPath,
  });
}

function cmdEvidence(argv) {
  let manifestPath = null;
  let extraAllow = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--manifest") manifestPath = argv[++i];
    else if (argv[i] === "--allow") extraAllow.push(argv[++i]);
    else usage(`FAIL: unknown evidence arg: ${argv[i]}`);
  }
  if (!manifestPath) usage("FAIL: evidence requires --manifest");
  try {
    normalizeAllowList(extraAllow);
  } catch (e) {
    usage(`FAIL: ${e.message}`);
  }
  const manifest = readJson(manifestPath);
  const findings = [];
  if (manifest.schema !== "agent-workflow-guard/manifest/v1") {
    findings.push({ code: "MANIFEST_SCHEMA", message: "unexpected schema" });
  }
  forbidManifestScriptFields(manifest, "", findings);
  if (!manifest.expect || !manifest.observations) {
    findings.push({ code: "MANIFEST_INCOMPLETE", message: "expect and observations required" });
  } else {
    findings.push(...validateExpectVsObserved(manifest.expect, manifest.observations));
  }
  validateManifestProvenance(manifest, process.cwd(), findings);
  validatePreflight(manifest, findings);
  validateArtifacts(manifest, findings);
  emit({ schema: "workflow-guard-evidence/v1", ok: findings.length === 0, findings }, findings.length ? 2 : 0);
}

function cmdScope(argv) {
  let base = null;
  let head = "HEAD";
  let mode = null;
  let checkpoint = null;
  let recordCheckpoint = null;
  const extraAllow = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") base = argv[++i];
    else if (a === "--head") head = argv[++i];
    else if (a === "--mode") mode = argv[++i];
    else if (a === "--checkpoint") checkpoint = argv[++i];
    else if (a === "--record-checkpoint") recordCheckpoint = argv[++i];
    else if (a === "--allow") extraAllow.push(argv[++i]);
    else usage(`FAIL: unknown scope arg: ${a}`);
  }
  if (!base || !mode) usage("FAIL: scope requires --base and --mode");
  let allowList;
  try {
    allowList = normalizeAllowList(extraAllow);
  } catch (e) {
    usage(`FAIL: ${e.message}`);
  }
  const cwd = process.cwd();
  if (recordCheckpoint) {
    saveCheckpoint(recordCheckpoint, cwd);
    emit({ schema: "workflow-guard-scope/v1", ok: true, recorded: resolve(recordCheckpoint) }, 0);
  }
  const baseSha = resolveSha(base, cwd);
  const headSha = resolveSha(head, cwd);
  const findings = [];
  if (mode !== "evidence-only" && mode !== "implementation") {
    findings.push({ code: "SCOPE_MODE_INVALID", message: "unknown scope mode" });
    emit({ schema: "workflow-guard-scope/v1", ok: false, findings }, 2);
  }
  if (!baseSha || !headSha) {
    findings.push({ code: "GIT_REF_INVALID", message: "invalid base or head ref" });
    emit({ schema: "workflow-guard-scope/v1", ok: false, findings }, 2);
  }
  const cp = loadCheckpoint(checkpoint);
  const changed = changedPathsInRange(baseSha, headSha, cwd);
  const porcelain = porcelainEntries(cwd);

  if (mode === "evidence-only") {
    findings.push(
      ...scopeEvidenceViolations(
        changed,
        porcelain,
        allowList,
        cp.entries,
        cwd,
        cp.rejected,
      ),
    );
  }

  emit(
    {
      schema: "workflow-guard-scope/v1",
      ok: findings.length === 0,
      mode,
      base: { ref: base, sha: baseSha },
      head: { ref: head, sha: headSha },
      changedCount: changed.length,
      findings,
    },
    findings.length ? 2 : 0,
  );
}

function manifestHasScope(manifest) {
  const s = manifest.git?.scope;
  return !!(s?.base && s?.head);
}

function cmdHandoff(argv) {
  let manifestPath = null;
  const scopeArgs = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") manifestPath = argv[++i];
    else scopeArgs.push(a);
  }
  if (!manifestPath) usage("FAIL: handoff requires --manifest");
  const manifest = readJson(manifestPath);
  const findings = [];
  forbidManifestScriptFields(manifest, "", findings);
  validatePreflight(manifest, findings);
  if (manifest.expect && manifest.observations) {
    findings.push(...validateExpectVsObserved(manifest.expect, manifest.observations));
  } else {
    findings.push({ code: "MANIFEST_INCOMPLETE", message: "expect and observations required" });
  }
  validateManifestProvenance(manifest, process.cwd(), findings);
  validateArtifacts(manifest, findings);

  const defaults = manifestHasScope(manifest) ? [
    "--base", manifest.git.scope.base, "--head", manifest.git.scope.head,
    "--mode", manifest.git.scope.mode ?? "evidence-only",
  ] : [];
  // Parse every supplied argument; preserve checkpoint even with refs in manifest.
  try {
    findings.push(...runScopeCapture([...defaults, ...scopeArgs]).findings);
  } catch (e) {
    findings.push({ code: "SCOPE_ALLOW_INVALID", message: String(e.message) });
  }

  emit({ schema: "workflow-guard-handoff/v1", ok: findings.length === 0, findings }, findings.length ? 2 : 0);
}

function runScopeCapture(argv) {
  const findings = [];
  let base = null;
  let head = "HEAD";
  let mode = "evidence-only";
  const extraAllow = [];
  let checkpoint = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") base = argv[++i];
    else if (a === "--head") head = argv[++i];
    else if (a === "--mode") mode = argv[++i];
    else if (a === "--allow") extraAllow.push(argv[++i]);
    else if (a === "--checkpoint") checkpoint = argv[++i];
    else {
      return { findings: [{ code: "HANDOFF_ARG_UNKNOWN", message: `unknown handoff scope arg: ${a}` }] };
    }
  }
  if (!base) return { findings: [{ code: "SCOPE_ARGS", message: "handoff scope missing --base" }] };
  if (mode !== "evidence-only" && mode !== "implementation") {
    findings.push({ code: "SCOPE_MODE_INVALID", message: "unknown scope mode" });
    return { findings };
  }
  let allowList;
  try {
    allowList = normalizeAllowList(extraAllow);
  } catch (e) {
    throw e;
  }
  const cwd = process.cwd();
  const baseSha = resolveSha(base, cwd);
  const headSha = resolveSha(head, cwd);
  if (!baseSha || !headSha) {
    findings.push({ code: "GIT_REF_INVALID", message: "invalid scope refs" });
    return { findings };
  }
  const cp = loadCheckpoint(checkpoint);
  const changed = changedPathsInRange(baseSha, headSha, cwd);
  const porcelain = porcelainEntries(cwd);
  if (mode === "evidence-only") {
    findings.push(
      ...scopeEvidenceViolations(
        changed,
        porcelain,
        allowList,
        cp.entries,
        cwd,
        cp.rejected,
      ),
    );
  }
  return { findings };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP);
    process.exit(0);
  }
  const cmd = argv[0];
  const rest = argv.slice(1);
  if (cmd === "probe") cmdProbe(rest);
  else if (cmd === "evidence") cmdEvidence(rest);
  else if (cmd === "scope") cmdScope(rest);
  else if (cmd === "handoff") cmdHandoff(rest);
  else usage(`FAIL: unknown command: ${cmd}`);
}

main();
