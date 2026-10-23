#!/usr/bin/env node
/**
 * Agent evidence collector — bounded JSON summary (git range, artifacts, optional PR CI).
 *
 * Usage:
 *   node scripts/agent-evidence.mjs --base main
 *   node scripts/agent-evidence.mjs --base main --head HEAD --pr 850 --repo hangndat/ticket-solution
 *   node scripts/agent-evidence.mjs --help
 *
 * Exit: 0 ok · 1 usage · 2 git/ref/head-mismatch · 3 gh unavailable · 4 --out exists
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { openSync, readFileSync, closeSync, writeSync } from "node:fs";
import { resolve } from "node:path";

const CAP_UPPER = 10_000;

function parseCap(raw, fallback) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > CAP_UPPER) {
    console.error(`FAIL: cap must be integer 1..${CAP_UPPER}`);
    process.exit(1);
  }
  return n;
}

const MAX_CHANGED_FILES = parseCap(process.env.AGENT_EVIDENCE_MAX_CHANGED_FILES, 60);
const MAX_CHECKS = parseCap(process.env.AGENT_EVIDENCE_MAX_CHECKS, 20);

const HELP = `agent-evidence — bounded JSON evidence (no secrets, no raw diffs)

Required:
  --base <ref>          Base ref for explicit base..head compare (not merge-base)

Optional:
  --head <ref>          Head ref (default: HEAD)
  --pr <number>         Fetch PR head + check-runs via gh (network)
  --repo <owner/name>   Repository for --pr (required with --pr)
  --artifact <path>     Repeatable; local file metadata only (not commit provenance)
  --out <path>          Also write JSON (create-only wx; never overwrites)

Environment (explicit override; omitted counts remain visible):
  AGENT_EVIDENCE_MAX_CHANGED_FILES  Cap changed-path list (1..10000, default 60)
  AGENT_EVIDENCE_MAX_CHECKS         Cap check-run list (1..10000, default 20)

Exit codes: 0 success · 1 usage · 2 git/ref/head-mismatch · 3 gh error when --pr · 4 --out exists
`;

function usage(msg) {
  if (msg) console.error(msg);
  console.error(HELP);
  process.exit(1);
}

function parseArgv(argv) {
  const out = {
    base: null,
    head: "HEAD",
    pr: null,
    repo: null,
    artifacts: [],
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(HELP);
      process.exit(0);
    }
    if (a === "--base") {
      out.base = argv[++i];
      if (!out.base) usage("FAIL: --base requires a ref");
      continue;
    }
    if (a === "--head") {
      out.head = argv[++i];
      if (!out.head) usage("FAIL: --head requires a ref");
      continue;
    }
    if (a === "--pr") {
      out.pr = argv[++i];
      if (!out.pr || !/^\d+$/.test(out.pr)) usage("FAIL: --pr requires a numeric PR id");
      continue;
    }
    if (a === "--repo") {
      out.repo = argv[++i];
      if (!out.repo || !out.repo.includes("/")) usage("FAIL: --repo requires owner/name");
      continue;
    }
    if (a === "--artifact") {
      const p = argv[++i];
      if (!p) usage("FAIL: --artifact requires a path");
      out.artifacts.push(p);
      continue;
    }
    if (a === "--out") {
      out.out = argv[++i];
      if (!out.out) usage("FAIL: --out requires a path");
      continue;
    }
    usage(`FAIL: unknown argument: ${a}`);
  }
  if (!out.base) usage("FAIL: --base is required");
  if (out.pr && !out.repo) usage("FAIL: --repo is required with --pr");
  return out;
}

function gitText(args, cwd) {
  return execFileSync("git", args, { encoding: "utf8", cwd, maxBuffer: 50e6 }).trimEnd();
}

function gitBytes(args, cwd) {
  return execFileSync("git", args, { cwd, maxBuffer: 50e6 });
}

function resolveSha(ref, cwd) {
  try {
    return gitText(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`], cwd);
  } catch {
    return null;
  }
}

function isDirty(cwd) {
  const porcelain = gitText(["status", "--porcelain"], cwd);
  return porcelain.length > 0;
}

function parseNameStatusZ(buf) {
  const tokens = [];
  let start = 0;
  for (let j = 0; j <= buf.length; j++) {
    if (j === buf.length || buf[j] === 0) {
      if (j > start) tokens.push(buf.subarray(start, j).toString("utf8"));
      start = j + 1;
    }
  }
  const files = [];
  let t = 0;
  while (t < tokens.length) {
    const status = tokens[t++];
    if (!status) continue;
    if (status[0] === "R" || status[0] === "C") {
      const oldPath = tokens[t++];
      const path = tokens[t++];
      if (path !== undefined) files.push({ status, path, oldPath });
    } else {
      const path = tokens[t++];
      if (path !== undefined) files.push({ status, path });
    }
  }
  return files;
}

function parseShortstat(text) {
  const line = text.trim();
  if (!line) {
    return { summary: "", filesChanged: 0, insertions: 0, deletions: 0 };
  }
  const filesChanged = Number(line.match(/(\d+) files? changed/)?.[1] ?? 0);
  const insertions = Number(line.match(/(\d+) insertions?\(\+\)/)?.[1] ?? 0);
  const deletions = Number(line.match(/(\d+) deletions?\(-\)/)?.[1] ?? 0);
  return { summary: line, filesChanged, insertions, deletions };
}

function artifactMeta(path) {
  const abs = resolve(path);
  try {
    const buf = readFileSync(abs);
    const sha256 = createHash("sha256").update(buf).digest("hex");
    return {
      path,
      bytes: buf.length,
      sha256,
      provenance: "local-file-only",
      commitProvenance: false,
    };
  } catch (e) {
    if (e?.code === "ENOENT") return { path, missing: true, commitProvenance: false };
    throw e;
  }
}

function ghApiJson(endpoint) {
  try {
    const out = execFileSync("gh", ["api", endpoint], {
      encoding: "utf8",
      maxBuffer: 50e6,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out);
  } catch {
    const err = new Error("gh_api_failed");
    err.code = "GH_API_FAILED";
    throw err;
  }
}

function fetchCheckRuns(repo, sha) {
  const all = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const resp = ghApiJson(
      `repos/${repo}/commits/${sha}/check-runs?per_page=${perPage}&page=${page}`,
    );
    const batch = resp.check_runs ?? [];
    all.push(...batch);
    const total = resp.total_count ?? all.length;
    if (all.length >= total || batch.length === 0) break;
    page += 1;
  }
  return all;
}

function checkEntry(run) {
  return {
    name: run.name ?? "(unnamed)",
    status: run.status ?? "unknown",
    conclusion: run.conclusion ?? null,
  };
}

function ciCategory(entry) {
  const { status, conclusion } = entry;
  if (status !== "completed") return "pending";
  if (conclusion === "skipped") return "skipped";
  if (
    conclusion === "failure" ||
    conclusion === "timed_out" ||
    conclusion === "cancelled" ||
    conclusion === "action_required"
  ) {
    return "failed";
  }
  if (conclusion === "success") return "success";
  if (conclusion === "neutral") return "neutral";
  return "missingConclusion";
}

function emptyCiCounts() {
  return {
    success: 0,
    neutral: 0,
    failed: 0,
    pending: 0,
    skipped: 0,
    missingConclusion: 0,
  };
}

function capList(list, max) {
  if (list.length <= max) {
    return { listed: list, total: list.length, omitted: 0 };
  }
  return { listed: list.slice(0, max), total: list.length, omitted: list.length - max };
}

function writeOutExclusive(absPath, text) {
  try {
    const fd = openSync(absPath, "wx");
    try {
      writeSync(fd, Buffer.from(text + "\n", "utf8"));
    } finally {
      closeSync(fd);
    }
  } catch (e) {
    if (e?.code === "EEXIST") {
      console.error("FAIL: --out file already exists");
      process.exit(4);
    }
    throw e;
  }
}

function emitAndExit(payload, code, outPathAbs) {
  const json = JSON.stringify(payload);
  process.stdout.write(json + "\n");
  if (outPathAbs) writeOutExclusive(outPathAbs, json);
  process.exit(code);
}

function main() {
  const opts = parseArgv(process.argv.slice(2));
  const cwd = process.cwd();
  const capturedAt = new Date().toISOString();

  const baseSha = resolveSha(opts.base, cwd);
  const headSha = resolveSha(opts.head, cwd);
  if (!baseSha || !headSha) {
    console.error("FAIL: invalid git ref for --base or --head");
    process.exit(2);
  }

  let nameStatusBuf;
  let shortstatText = "";
  try {
    nameStatusBuf = gitBytes(["diff", "--name-status", "-z", `${baseSha}..${headSha}`], cwd);
    shortstatText = gitText(["diff", "--shortstat", `${baseSha}..${headSha}`], cwd);
  } catch {
    console.error("FAIL: git diff between base and head");
    process.exit(2);
  }

  const allFiles = parseNameStatusZ(nameStatusBuf);
  const filesCap = capList(allFiles, MAX_CHANGED_FILES);
  const dirty = isDirty(cwd);
  const shortstat = parseShortstat(shortstatText);

  const artifacts = opts.artifacts.map((p) => artifactMeta(p));

  const outPathAbs = opts.out ? resolve(opts.out) : null;
  if (outPathAbs) {
    for (const p of opts.artifacts) {
      if (resolve(p) === outPathAbs) usage("FAIL: --out must not target an --artifact path");
    }
  }

  const payload = {
    schema: "agent-evidence/v1",
    capturedAt,
    git: {
      base: { ref: opts.base, sha: baseSha },
      head: { ref: opts.head, sha: headSha },
      range: `${opts.base}..${opts.head}`,
      dirty,
      shortstat,
      changedFiles: filesCap.listed,
      changedFilesTotal: filesCap.total,
      changedFilesOmitted: filesCap.omitted,
    },
    artifacts,
  };

  if (opts.pr) {
    try {
      const pr = ghApiJson(`repos/${opts.repo}/pulls/${opts.pr}`);
      const prHead = pr.head?.sha ?? null;
      const headMatch = prHead === headSha;
      const runs = prHead && headMatch ? fetchCheckRuns(opts.repo, prHead) : [];
      const allEntries = runs.map((r) => checkEntry(r));
      const checksCap = capList(allEntries, MAX_CHECKS);
      const ciCounts = emptyCiCounts();

      for (const entry of allEntries) {
        const cat = ciCategory(entry);
        ciCounts[cat] += 1;
      }

      const checkRunsAbsent = headMatch && runs.length === 0;

      payload.pr = {
        number: Number(opts.pr),
        repo: opts.repo,
        prHeadSha: prHead,
        localHeadSha: headSha,
        headMatch,
        state: pr.state ?? null,
        mergeable: pr.mergeable ?? null,
        checks: checksCap.listed,
        checksTotal: checksCap.total,
        checksOmitted: checksCap.omitted,
        checkRunsAbsent,
        ciCounts,
        acceptanceInferred: false,
      };
      if (!headMatch) emitAndExit(payload, 2, outPathAbs);
    } catch (e) {
      if (e?.code === "GH_API_FAILED") {
        payload.pr = {
          number: Number(opts.pr),
          repo: opts.repo,
          unavailable: true,
          errorCode: "gh_api_failed",
          acceptanceInferred: false,
        };
        emitAndExit(payload, 3, outPathAbs);
      }
      throw e;
    }
  }

  emitAndExit(payload, 0, outPathAbs);
}

main();
