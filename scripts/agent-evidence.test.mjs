import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./agent-evidence.mjs", import.meta.url));

function run(args, env = {}, cwd) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
    cwd,
  });
}

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@t",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@t",
};

function git(dir, a) {
  return spawnSync("git", a, { cwd: dir, encoding: "utf8", env: gitEnv });
}

function initRepo(dir) {
  git(dir, ["init", "-b", "main"]);
  git(dir, ["config", "user.email", "t@t"]);
  git(dir, ["config", "user.name", "t"]);
  writeFileSync(join(dir, "a.txt"), "v1\n");
  git(dir, ["add", "a.txt"]);
  git(dir, ["commit", "-m", "base"]);
  writeFileSync(join(dir, "a.txt"), "v2\n");
  writeFileSync(join(dir, "b.txt"), "new\n");
  git(dir, ["add", "a.txt", "b.txt"]);
  git(dir, ["commit", "-m", "head"]);
  return git(dir, ["rev-parse", "HEAD"]).stdout.trim();
}

function makeFakeGh(ghDir, handlers) {
  const gh = join(ghDir, "gh");
  writeFileSync(join(ghDir, "map.json"), JSON.stringify(handlers));
  writeFileSync(
    gh,
    `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const map = JSON.parse(readFileSync(join(${JSON.stringify(ghDir)}, "map.json"), "utf8"));
const ep = (process.argv[3] ?? "").replace(/^\\/+/, "");
const out = map[ep];
if (out === undefined) { console.error("SECRET_TOKEN_LEAK no handler: " + ep); process.exit(1); }
console.log(JSON.stringify(out));
`,
    { mode: 0o700 },
  );
  return gh;
}

test("F01: shortstat numeric summary and CI counts not unbounded name lists", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    const headSha = initRepo(dir);
    const rGit = run(["--base", "HEAD~1", "--head", "HEAD"], {}, dir);
    assert.equal(rGit.status, 0);
    const jg = JSON.parse(rGit.stdout);
    assert.ok(jg.git.shortstat);
    assert.equal(typeof jg.git.shortstat.summary, "string");
    assert.equal(typeof jg.git.shortstat.filesChanged, "number");
    assert.ok(!("diffstat" in jg.git));

    const repo = "o/r";
    const runs = [];
    for (let i = 0; i < 5; i++) {
      runs.push({ name: `chk-${i}`, status: "completed", conclusion: "success" });
    }
    const handlers = {
      [`repos/${repo}/pulls/3`]: { head: { sha: headSha }, state: "open" },
      [`repos/${repo}/commits/${headSha}/check-runs?per_page=100&page=1`]: {
        total_count: 5,
        check_runs: runs,
      },
    };
    const ghDir = mkdtempSync(join(tmpdir(), "agent-evidence-gh-"));
    makeFakeGh(ghDir, handlers);
    const r = run(
      ["--base", "HEAD~1", "--head", "HEAD", "--pr", "3", "--repo", repo],
      { PATH: `${ghDir}:${process.env.PATH}`, AGENT_EVIDENCE_MAX_CHECKS: "2" },
      dir,
    );
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.pr.checks.length, 2);
    assert.equal(j.pr.checksOmitted, 3);
    assert.equal(j.pr.ciCounts.success, 5);
    assert.ok(!("ci" in j.pr) || !Array.isArray(j.pr.ci?.failed));
    assert.equal(j.pr.ciCounts.failed, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("F02: zero check-runs absent; neutral counted separately from success", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    const headSha = initRepo(dir);
    const repo = "o/r";
    const handlers = {
      [`repos/${repo}/pulls/10`]: { head: { sha: headSha }, state: "open" },
      [`repos/${repo}/commits/${headSha}/check-runs?per_page=100&page=1`]: {
        total_count: 0,
        check_runs: [],
      },
    };
    const ghDir = mkdtempSync(join(tmpdir(), "agent-evidence-gh-"));
    makeFakeGh(ghDir, handlers);
    const rEmpty = run(
      ["--base", "HEAD~1", "--pr", "10", "--repo", repo],
      { PATH: `${ghDir}:${process.env.PATH}` },
      dir,
    );
    assert.equal(rEmpty.status, 0);
    const je = JSON.parse(rEmpty.stdout);
    assert.equal(je.pr.checkRunsAbsent, true);
    assert.equal(je.pr.checksTotal, 0);

    const handlers2 = {
      [`repos/${repo}/pulls/11`]: { head: { sha: headSha }, state: "open" },
      [`repos/${repo}/commits/${headSha}/check-runs?per_page=100&page=1`]: {
        total_count: 2,
        check_runs: [
          { name: "ok", status: "completed", conclusion: "success" },
          { name: "note", status: "completed", conclusion: "neutral" },
        ],
      },
    };
    const ghDir2 = mkdtempSync(join(tmpdir(), "agent-evidence-gh-"));
    makeFakeGh(ghDir2, handlers2);
    const rMix = run(
      ["--base", "HEAD~1", "--pr", "11", "--repo", repo],
      { PATH: `${ghDir2}:${process.env.PATH}` },
      dir,
    );
    const jm = JSON.parse(rMix.stdout);
    assert.equal(jm.pr.ciCounts.success, 1);
    assert.equal(jm.pr.ciCounts.neutral, 1);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("F03: gh failure exposes errorCode only, not stderr secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    initRepo(dir);
    const ghDir = mkdtempSync(join(tmpdir(), "agent-evidence-gh-"));
    const gh = join(ghDir, "gh");
    writeFileSync(
      gh,
      "#!/usr/bin/env node\nconsole.error('SECRET_TOKEN_LEAK'); process.exit(1);\n",
      { mode: 0o700 },
    );
    const r = run(
      ["--base", "HEAD~1", "--pr", "1", "--repo", "o/r"],
      { PATH: `${ghDir}:${process.env.PATH}` },
      dir,
    );
    assert.equal(r.status, 3);
    const j = JSON.parse(r.stdout);
    assert.equal(j.pr.unavailable, true);
    assert.equal(j.pr.errorCode, "gh_api_failed");
    assert.ok(!("error" in j.pr));
    assert.ok(!r.stdout.includes("SECRET_TOKEN_LEAK"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("F04: capturedAt UTC and artifact commitProvenance false", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    initRepo(dir);
    const art = join(dir, "note.md");
    writeFileSync(art, "hello");
    const r = run(["--base", "HEAD~1", "--artifact", art], {}, dir);
    const j = JSON.parse(r.stdout);
    assert.match(j.capturedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(j.artifacts[0].commitProvenance, false);
    assert.equal(j.artifacts[0].provenance, "local-file-only");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("F05: invalid cap rejected; -z rename paths preserve whitespace", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    initRepo(dir);
    const bad = run(["--base", "HEAD~1"], { AGENT_EVIDENCE_MAX_CHANGED_FILES: "0" }, dir);
    assert.equal(bad.status, 1);

    const bad2 = run(["--base", "HEAD~1"], { AGENT_EVIDENCE_MAX_CHECKS: "99999" }, dir);
    assert.equal(bad2.status, 1);

    writeFileSync(join(dir, "old name.txt"), "x\n");
    git(dir, ["add", "old name.txt"]);
    git(dir, ["commit", "-m", "ws"]);
    git(dir, ["mv", "old name.txt", "new name.txt"]);
    git(dir, ["commit", "-m", "rename"]);

    const r = run(["--base", "HEAD~1", "--head", "HEAD"], {}, dir);
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    const renamed = j.git.changedFiles.find((f) => f.status.startsWith("R"));
    assert.ok(renamed);
    assert.equal(renamed.path, "new name.txt");
    assert.equal(renamed.oldPath, "old name.txt");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("resolves full SHAs and base..head changed files", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    const headSha = initRepo(dir);
    const baseSha = git(dir, ["rev-parse", "HEAD~1"]).stdout.trim();
    const r = run(["--base", "HEAD~1", "--head", "HEAD"], {}, dir);
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.git.base.sha, baseSha);
    assert.equal(j.git.head.sha, headSha);
    assert.equal(j.git.dirty, false);
    assert.ok(j.git.changedFiles.some((f) => f.path === "a.txt"));
    assert.ok(j.git.shortstat.summary.length > 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("dirty working tree is reported separately from committed range", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    initRepo(dir);
    writeFileSync(join(dir, "dirty.txt"), "x\n");
    const r = run(["--base", "HEAD~1"], {}, dir);
    assert.equal(r.status, 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.git.dirty, true);
    assert.ok(!j.git.changedFiles.some((f) => f.path === "dirty.txt"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("invalid ref exits 2", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    initRepo(dir);
    const r = run(["--base", "not-a-ref"], {}, dir);
    assert.equal(r.status, 2);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("PR head match pagination and mismatch", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    const headSha = initRepo(dir);
    const repo = "o/r";
    const page1 = {
      total_count: 3,
      check_runs: [
        { name: "ci-a", status: "completed", conclusion: "success" },
        { name: "ci-b", status: "completed", conclusion: "failure" },
      ],
    };
    const page2 = {
      total_count: 3,
      check_runs: [{ name: "ci-c", status: "in_progress", conclusion: null }],
    };
    const handlers = {
      [`repos/${repo}/pulls/9`]: { head: { sha: headSha }, state: "open", mergeable: true },
      [`repos/${repo}/commits/${headSha}/check-runs?per_page=100&page=1`]: page1,
      [`repos/${repo}/commits/${headSha}/check-runs?per_page=100&page=2`]: page2,
    };
    const ghDir = mkdtempSync(join(tmpdir(), "agent-evidence-gh-"));
    makeFakeGh(ghDir, handlers);
    const r = run(
      ["--base", "HEAD~1", "--head", "HEAD", "--pr", "9", "--repo", repo],
      { PATH: `${ghDir}:${process.env.PATH}` },
      dir,
    );
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.equal(j.pr.ciCounts.success, 1);
    assert.equal(j.pr.ciCounts.failed, 1);
    assert.equal(j.pr.ciCounts.pending, 1);

    const ghDir2 = mkdtempSync(join(tmpdir(), "agent-evidence-gh-"));
    makeFakeGh(ghDir2, {
      [`repos/${repo}/pulls/1`]: { head: { sha: "deadbeef".repeat(5) }, state: "open" },
    });
    const r2 = run(
      ["--base", "HEAD~1", "--pr", "1", "--repo", repo],
      { PATH: `${ghDir2}:${process.env.PATH}` },
      dir,
    );
    assert.equal(r2.status, 2);
    assert.equal(JSON.parse(r2.stdout).pr.headMatch, false);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("--out exists exits 4 not gh failure", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-evidence-"));
  try {
    initRepo(dir);
    const out = join(dir, "out.json");
    const r1 = run(["--base", "HEAD~1", "--out", out], {}, dir);
    assert.equal(r1.status, 0);
    const r2 = run(["--base", "HEAD~1", "--out", out], {}, dir);
    assert.equal(r2.status, 4);
    assert.match(r2.stderr, /already exists/);
    const parsed = JSON.parse(r2.stdout);
    assert.equal(parsed.schema, "agent-evidence/v1");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("--help exits 0", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--base/);
});
