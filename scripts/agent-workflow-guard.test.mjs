import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  readFileSync,
  mkdirSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  computeProbeFingerprint,
  pathAllowed,
  resolveOrcaBin,
  runOrcaEval,
} from "./lib/workflow-observation.mjs";

const script = fileURLToPath(new URL("./agent-workflow-guard.mjs", import.meta.url));
const lib = fileURLToPath(new URL("./lib/workflow-observation.mjs", import.meta.url));

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
  mkdirSync(join(dir, "docs/reviews"), { recursive: true });
  writeFileSync(join(dir, "docs/reviews/note.md"), "base\n");
  git(dir, ["add", "docs/reviews/note.md"]);
  git(dir, ["commit", "-m", "base"]);
  return git(dir, ["rev-parse", "HEAD"]).stdout.trim();
}

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function writePng(path, tweak = 0) {
  const buf = tweak ? Buffer.concat([TINY_PNG, Buffer.from([tweak])]) : TINY_PNG;
  writeFileSync(path, buf);
}

function goodObserved(overrides = {}) {
  return {
    schema: "workflow-guard-observation/v1",
    route: { pathname: "/ops/dashboard" },
    htmlLang: "vi",
    viewport: { width: 1280, height: 720 },
    build: { commit: "abc123", id: "build-1", label: null },
    dom: { "[data-testid=shell]": { found: true, visible: true } },
    authProbe: {
      status: "ok",
      authenticated: true,
      operatorExact: true,
      mfaVerified: true,
    },
    ...overrides,
  };
}

function goodExpect(dir) {
  return {
    authMode: "protected",
    route: { pathPrefix: "/ops" },
    htmlLang: "vi",
    viewport: { width: 1280, height: 720 },
    authProbe: {
      url: "/api/auth/session",
      authenticated: true,
      operator: "platform",
      mfa: "verified",
    },
    dom: [{ selector: "[data-testid=shell]", visible: true }],
    build: { commit: "abc123", id: "build-1" },
    states: [
      { id: "a", screenshot: join(dir, "docs/reviews/a.png"), viewport: { width: 1, height: 1 } },
      {
        id: "b",
        screenshot: join(dir, "docs/reviews/b.png"),
        viewport: { width: 1, height: 1 },
      },
    ],
  };
}

function makeFakeOrca(dir, handler) {
  const bin = join(dir, "orca-fake");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const { readFileSync } = require("node:fs");
const payload = ${JSON.stringify(handler)};
const cmd = process.argv[2];
if (cmd !== "eval") {
  console.log(JSON.stringify({ ok: false, error: { code: "command_unknown" } }));
  process.exit(0);
}
const scripted = payload.eval;
if (scripted && scripted.ok === false) {
  console.log(JSON.stringify(scripted));
} else {
  const inner = scripted?.result ?? '{"schema":"workflow-guard-observation/v1","route":{"pathname":"/ops"},"htmlLang":"vi","viewport":{"width":1280,"height":720},"build":{"commit":"abc123"},"dom":{"[data-testid=shell]":{"found":true,"visible":true}},"authProbe":{"status":"pending"}}';
  console.log(JSON.stringify({ ok: true, result: inner }));
}
`,
    { mode: 0o700 },
  );
  return bin;
}

function treeSha(dir, ref = "HEAD") {
  return git(dir, ["rev-parse", `${ref}^{tree}`]).stdout.trim();
}

function fullGitBlock(dir, headSha) {
  return {
    commit: { ref: "HEAD", sha: headSha, dirty: false },
    sourceTree: { path: ".", sha: treeSha(dir, headSha) },
    build: { id: "build-1" },
    scope: { base: "HEAD~1", head: "HEAD", mode: "evidence-only" },
  };
}

function artifactEntry(path) {
  const buf = readFileSync(path);
  return {
    path,
    sha256: createHash("sha256").update(buf).digest("hex"),
    viewport: { width: 1, height: 1 },
  };
}

function manifestWithProbe(dir, headSha, expect, observations, preflightFp, extra = {}) {
  return {
    schema: "agent-workflow-guard/manifest/v1",
    capturedAt: new Date().toISOString(),
    preflight: {
      fingerprint: preflightFp,
      at: new Date(Date.now() - 1000).toISOString(),
      ok: true,
      kind: "integrity_expect_observation",
    },
    expect,
    observations,
    git: fullGitBlock(dir, headSha),
    artifacts: extra.artifacts ?? [],
    ...extra,
  };
}

test("G01: empty expect fails; fabricated preflight fingerprint rejected", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    const headSha = initRepo(dir);
    const expectPath = join(dir, "docs/reviews/expect-empty.json");
    writeFileSync(expectPath, JSON.stringify({ authMode: "public" }));
    const obsPath = join(dir, "docs/reviews/o.json");
    const r = run(["probe", "--expect", expectPath, "--observed", obsPath], {}, dir);
    writeFileSync(obsPath, JSON.stringify(goodObserved()));
    const r2 = run(["probe", "--expect", expectPath, "--observed", obsPath], {}, dir);
    assert.equal(r2.status, 2);
    assert.ok(JSON.parse(r2.stdout).findings.some((f) => f.code === "EXPECT_ROUTE_MISSING"));

    const expect = goodExpect(dir);
    mkdirSync(join(dir, "docs/reviews"), { recursive: true });
    writePng(join(dir, "docs/reviews/a.png"));
    writePng(join(dir, "docs/reviews/b.png"), 1);
    const obs = goodObserved();
    const fp = computeProbeFingerprint(expect, obs);
    const bad = manifestWithProbe(dir, headSha, expect, obs, "sha256:deadbeef");
    const mpath = join(dir, "docs/reviews/manifest.json");
    writeFileSync(mpath, JSON.stringify(bad));
    const ev = run(["evidence", "--manifest", mpath], {}, dir);
    assert.equal(ev.status, 2);
    assert.ok(JSON.parse(ev.stdout).findings.some((f) => f.code === "PREFLIGHT_FINGERPRINT_MISMATCH"));
    const arts = [
      artifactEntry(join(dir, "docs/reviews/a.png")),
      artifactEntry(join(dir, "docs/reviews/b.png")),
    ];
    const good = manifestWithProbe(dir, headSha, expect, obs, fp, { artifacts: arts });
    writeFileSync(mpath, JSON.stringify(good));
    const ev2 = run(["evidence", "--manifest", mpath], {}, dir);
    assert.equal(ev2.status, 0, ev2.stdout);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("G02: auth URL and operator exact; no secrets in stdout", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    const expect = goodExpect(dir);
    expect.authProbe.url = "//evil.example/session";
    const expectPath = join(dir, "expect.json");
    writeFileSync(expectPath, JSON.stringify(expect));
    const r = run(["probe", "--expect", expectPath, "--observed", join(dir, "o.json")], {}, dir);
    writeFileSync(join(dir, "o.json"), JSON.stringify(goodObserved()));
    const r2 = run(["probe", "--expect", expectPath, "--observed", join(dir, "o.json")], {}, dir);
    assert.equal(r2.status, 2);
    assert.ok(JSON.parse(r2.stdout).findings.some((f) => f.code === "AUTH_URL_INVALID"));

    const expect2 = goodExpect(dir);
    const obs = goodObserved({
      authProbe: { status: "ok", authenticated: true, operatorExact: false, mfaVerified: true },
    });
    writeFileSync(expectPath, JSON.stringify(expect2));
    writeFileSync(join(dir, "o2.json"), JSON.stringify(obs));
    const r3 = run(["probe", "--expect", expectPath, "--observed", join(dir, "o2.json")], {}, dir);
    assert.ok(JSON.parse(r3.stdout).findings.some((f) => f.code === "PERSONA_OPERATOR_MISMATCH"));
    assert.ok(!r3.stdout.includes("user@secret.com"));
    assert.ok(!r3.stdout.includes("href"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("G03: probe output sanitized pathname only", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    mkdirSync(join(dir, "docs/reviews"), { recursive: true });
    writePng(join(dir, "docs/reviews/a.png"));
    writePng(join(dir, "docs/reviews/b.png"), 2);
    const expect = goodExpect(dir);
    const expectPath = join(dir, "expect.json");
    writeFileSync(expectPath, JSON.stringify(expect));
    const obs = goodObserved({
      route: { pathname: "/ops", href: "http://x/callback?token=SECRET" },
      dom: { "[data-testid=shell]": { found: true, visible: true, text: "SECRET_PROMPT" } },
    });
    writeFileSync(join(dir, "obs.json"), JSON.stringify(obs));
    const r = run(["probe", "--expect", expectPath, "--observed", join(dir, "obs.json")], {}, dir);
    assert.ok(!r.stdout.includes("SECRET"));
    assert.ok(!r.stdout.includes("href"));
    const j = JSON.parse(r.stdout);
    assert.equal(j.observation.route.pathname, "/ops");
    assert.ok(j.fingerprint?.startsWith("sha256:"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("G04: allowlist boundary and package.json leak; rename porcelain", () => {
  assert.equal(pathAllowed("docs/reviews/x.md", ["docs/reviews"]), true);
  assert.equal(pathAllowed("docs/reviews-evil/x.md", ["docs/reviews"]), false);
  assert.equal(pathAllowed("docs/reviews/../package.json", ["docs/reviews"]), false);

  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    initRepo(dir);
    writeFileSync(join(dir, "package.json"), "{}\n");
    git(dir, ["add", "package.json"]);
    git(dir, ["commit", "-m", "pkg"]);
    const bad = run(["scope", "--base", "HEAD~1", "--head", "HEAD", "--mode", "evidence-only"], {}, dir);
    assert.equal(bad.status, 2);
    assert.ok(JSON.parse(bad.stdout).findings.some((f) => f.code === "EVIDENCE_ONLY_PATH_LEAK"));

    writeFileSync(join(dir, "docs/reviews/old name.txt"), "x\n");
    git(dir, ["add", "docs/reviews/old name.txt"]);
    git(dir, ["commit", "-m", "ws"]);
    git(dir, ["mv", "docs/reviews/old name.txt", "docs/reviews/new name.txt"]);
    git(dir, ["commit", "-m", "rename"]);
    const ok = run(["scope", "--base", "HEAD~1", "--head", "HEAD", "--mode", "evidence-only"], {}, dir);
    assert.equal(ok.status, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("G04: checkpoint content hash detects edit to same path", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    initRepo(dir);
    mkdirSync(join(dir, "apps/web"), { recursive: true });
    writeFileSync(join(dir, "apps/web/pre.ts"), "pre\n");
    const cp = join(dir, "cp.json");
    run(["scope", "--record-checkpoint", cp, "--base", "HEAD", "--mode", "evidence-only"], {}, dir);
    writeFileSync(join(dir, "apps/web/pre.ts"), "pre-edited\n");
    const r = run(
      ["scope", "--base", "HEAD", "--head", "HEAD", "--mode", "evidence-only", "--checkpoint", cp],
      {},
      dir,
    );
    assert.equal(r.status, 2);
    assert.ok(JSON.parse(r.stdout).findings.some((f) => f.code === "EVIDENCE_ONLY_PATH_LEAK"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("G05: PNG invalid and duplicate distinct states; sameVisualState allowed", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    mkdirSync(join(dir, "docs/reviews"), { recursive: true });
    const a = join(dir, "docs/reviews/a.png");
    writeFileSync(a, "not-a-png");
    const expect = goodExpect(dir);
    expect.states = [{ id: "x", screenshot: a, viewport: { width: 1, height: 1 } }];
    const expectPath = join(dir, "expect.json");
    writeFileSync(expectPath, JSON.stringify(expect));
    const r = run(["probe", "--expect", expectPath, "--observed", join(dir, "o.json")], {}, dir);
    writeFileSync(join(dir, "o.json"), JSON.stringify(goodObserved()));
    const r2 = run(["probe", "--expect", expectPath, "--observed", join(dir, "o.json")], {}, dir);
    assert.ok(JSON.parse(r2.stdout).findings.some((f) => f.code === "PNG_INVALID"));

    writePng(a);
    writePng(join(dir, "docs/reviews/b.png"));
    writeFileSync(expectPath, JSON.stringify(goodExpect(dir)));
    const r3 = run(["probe", "--expect", expectPath, "--observed", join(dir, "o.json")], {}, dir);
    assert.ok(JSON.parse(r3.stdout).findings.some((f) => f.code === "DUPLICATE_SCREENSHOT_STATES"));

    const expect2 = goodExpect(dir);
    expect2.states[1].sameVisualState = "a";
    writeFileSync(expectPath, JSON.stringify(expect2));
    const r4 = run(["probe", "--expect", expectPath, "--observed", join(dir, "o.json")], {}, dir);
    assert.ok(!JSON.parse(r4.stdout).findings.some((f) => f.code === "DUPLICATE_SCREENSHOT_STATES"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("G06: orca resolver and fake host fixtures", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    const fake = makeFakeOrca(dir, {
      eval: {
        ok: false,
        error: { code: "eval_unsupported", message: "token=callback_secret" },
      },
    });
    const r = runOrcaEval("1+1", { orcaBin: fake });
    assert.equal(r.ok, false);
    assert.equal(r.unavailable, true);
    assert.ok(!JSON.stringify(r).includes("callback_secret"));

    const fake2 = makeFakeOrca(dir, {
      eval: { ok: true, result: '{"route":{"pathname":"/ops"},"htmlLang":"vi"}' },
    });
    const r2 = runOrcaEval("1+1", { orcaBin: fake2 });
    assert.equal(r2.ok, true);

    const inner = JSON.stringify({
      route: { pathname: "/ready" },
      htmlLang: "vi",
      viewport: { width: 845, height: 973 },
    });
    const fake3 = makeFakeOrca(dir, {
      eval: { ok: true, result: { result: inner, origin: "http://127.0.0.1:58128/ready" } },
    });
    const r3 = runOrcaEval("1+1", { orcaBin: fake3 });
    assert.equal(r3.ok, true);
    assert.equal(r3.raw.viewport.width, 845);

    const saved = process.env.ORCA_CLI_COMMAND;
    process.env.ORCA_CLI_COMMAND = fake2;
    assert.equal(resolveOrcaBin(), fake2);
    process.env.ORCA_CLI_COMMAND = saved;
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("positive handoff with valid preflight fingerprint", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    const headSha = initRepo(dir);
    mkdirSync(join(dir, "docs/reviews"), { recursive: true });
    const a = join(dir, "docs/reviews/a.png");
    const b = join(dir, "docs/reviews/b.png");
    writePng(a);
    writePng(b, 3);
    const expect = goodExpect(dir);
    const obs = goodObserved();
    const fp = computeProbeFingerprint(expect, obs);
    const arts = [artifactEntry(a), artifactEntry(b)];
    const manifest = manifestWithProbe(dir, headSha, expect, obs, fp, { artifacts: arts });
    const mpath = join(dir, "docs/reviews/manifest.json");
    writeFileSync(mpath, JSON.stringify(manifest));
    git(dir, ["add", "docs/reviews/a.png", "docs/reviews/b.png", mpath]);
    git(dir, ["commit", "-m", "evidence"]);
    const head2 = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
    manifest.git = fullGitBlock(dir, head2);
    writeFileSync(mpath, JSON.stringify(manifest));
    git(dir, ["add", mpath]);
    git(dir, ["commit", "-m", "manifest"]);
    const head3 = git(dir, ["rev-parse", "HEAD"]).stdout.trim();
    manifest.git = fullGitBlock(dir, head3);
    writeFileSync(mpath, JSON.stringify(manifest));
    const ok = run(["handoff", "--manifest", mpath], {}, dir);
    assert.equal(ok.status, 0, ok.stdout);
    const checkBad = (edit, code, command = "evidence", args = []) => {
      const changed = JSON.parse(JSON.stringify(manifest)); edit(changed);
      writeFileSync(mpath, JSON.stringify(changed));
      const result = run([command,"--manifest",mpath,...args],{},dir);
      assert.notEqual(result.status,0,result.stdout);
      assert.ok(JSON.parse(result.stdout).findings.some(f=>f.code===code),result.stdout);
    };
    checkBad(m=>m.git.sourceTree.sha="a".repeat(40),"PROVENANCE_TREE_MISMATCH");
    checkBad(m=>m.git.build.id="wrong-build","BUILD_PROVENANCE_MISMATCH");
    checkBad(m=>delete m.artifacts[0].viewport,"ARTIFACT_VIEWPORT_REQUIRED");
    checkBad(m=>delete m.git.scope,"SCOPE_ARGS","handoff");
    checkBad(()=>{},"HANDOFF_ARG_UNKNOWN","handoff",["--unexpected","x"]);
    manifest.git.commit.dirty=true;
    writeFileSync(mpath,JSON.stringify(manifest));
    const checkpoint=join(dir,"checkpoint.json");
    writeFileSync(join(dir,"package.json"),"before");
    assert.equal(run(["scope","--base","HEAD","--mode","evidence-only","--record-checkpoint",checkpoint],{},dir).status,0);
    // Checkpoint outside allowlist is itself pre-existing at capture; place it in reviews instead.
    const moved=join(dir,"docs/reviews/checkpoint.json");
    writeFileSync(moved,readFileSync(checkpoint)); rmSync(checkpoint);
    const cpResult=run(["handoff","--manifest",mpath,"--checkpoint",moved],{},dir);
    assert.equal(cpResult.status,0,cpResult.stdout);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("public authMode rejects authenticated observation", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    mkdirSync(join(dir, "docs/reviews"), { recursive: true });
    writePng(join(dir, "docs/reviews/a.png"));
    writePng(join(dir, "docs/reviews/b.png"), 4);
    const expect = {
      authMode: "public",
      route: { exact: "/" },
      htmlLang: "en",
      viewport: { width: 800, height: 600 },
      build: { commit: "c", id: "b" },
      dom: [{ selector: "body", visible: true }],
      states: [
        { id: "a", screenshot: join(dir, "docs/reviews/a.png"), viewport: { width: 1, height: 1 } },
        { id: "b", screenshot: join(dir, "docs/reviews/b.png"), viewport: { width: 1, height: 1 } },
      ],
    };
    const expectPath = join(dir, "expect.json");
    writeFileSync(expectPath, JSON.stringify(expect));
    const obs = goodObserved({
      route: { pathname: "/" },
      htmlLang: "en",
      viewport: { width: 800, height: 600 },
      dom: { body: { found: true, visible: true } },
      authProbe: { status: "ok", authenticated: true },
    });
    writeFileSync(join(dir, "obs.json"), JSON.stringify(obs));
    const r = run(["probe", "--expect", expectPath, "--observed", join(dir, "obs.json")], {}, dir);
    assert.ok(JSON.parse(r.stdout).findings.some((f) => f.code === "AUTH_UNEXPECTED"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("batch2: protected without authenticated fails; allow cannot broaden runtime", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    mkdirSync(join(dir, "docs/reviews"), { recursive: true });
    writePng(join(dir, "docs/reviews/a.png"));
    writePng(join(dir, "docs/reviews/b.png"), 5);
    const expect = goodExpect(dir);
    delete expect.authProbe.authenticated;
    const expectPath = join(dir, "expect.json");
    writeFileSync(expectPath, JSON.stringify(expect));
    writeFileSync(join(dir, "o.json"), JSON.stringify(goodObserved()));
    const r = run(["probe", "--expect", expectPath, "--observed", join(dir, "o.json")], {}, dir);
    assert.ok(JSON.parse(r.stdout).findings.some((f) => f.code === "EXPECT_AUTH_REQUIRED"));

    initRepo(dir);
    const badAllow = run(
      ["scope", "--base", "HEAD", "--head", "HEAD", "--mode", "evidence-only", "--allow", "apps/web"],
      {},
      dir,
    );
    assert.equal(badAllow.status, 1);

    const cp = join(dir, "cp-v1.json");
    writeFileSync(cp, JSON.stringify({ paths: ["docs/reviews/note.md"] }) + "\n");
    const v1 = run(
      ["scope", "--base", "HEAD", "--head", "HEAD", "--mode", "evidence-only", "--checkpoint", cp],
      {},
      dir,
    );
    assert.ok(JSON.parse(v1.stdout).findings.some((f) => f.code === "CHECKPOINT_V1_REJECTED"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("batch2: dom textIncludes uses boolean match without leaking text", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    mkdirSync(join(dir, "docs/reviews"), { recursive: true });
    writePng(join(dir, "docs/reviews/a.png"));
    writePng(join(dir, "docs/reviews/b.png"), 6);
    const expect = goodExpect(dir);
    expect.dom = [{ selector: "[data-testid=shell]", visible: true, textIncludes: "Ops" }];
    const expectPath = join(dir, "expect.json");
    writeFileSync(expectPath, JSON.stringify(expect));
    const obs = goodObserved({
      dom: { "[data-testid=shell]": { found: true, visible: true, textMatch: false } },
    });
    writeFileSync(join(dir, "obs.json"), JSON.stringify(obs));
    const r = run(["probe", "--expect", expectPath, "--observed", join(dir, "obs.json")], {}, dir);
    assert.ok(JSON.parse(r.stdout).findings.some((f) => f.code === "DOM_STATE_MISSING"));
    assert.ok(!r.stdout.includes("Ops"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("batch2: .cursor path blocked in evidence-only scope", () => {
  const dir = mkdtempSync(join(tmpdir(), "awg-"));
  try {
    initRepo(dir);
    mkdirSync(join(dir, ".cursor/rules"), { recursive: true });
    writeFileSync(join(dir, ".cursor/rules/x.mdc"), "x\n");
    git(dir, ["add", ".cursor/rules/x.mdc"]);
    git(dir, ["commit", "-m", "cursor"]);
    const r = run(["scope", "--base", "HEAD~1", "--head", "HEAD", "--mode", "evidence-only"], {}, dir);
    assert.equal(r.status, 2);
    assert.ok(JSON.parse(r.stdout).findings.some((f) => f.code === "EVIDENCE_ONLY_PATH_LEAK"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("--help exits 0", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
});
