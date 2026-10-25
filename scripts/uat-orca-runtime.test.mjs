import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverUatRuntime,
  probeBuildFromHttp,
  selectServiceEndpoint,
  resolveOrcaExecutable,
} from "./lib/uat-orca-runtime.mjs";

function fakeOrca(dir, handler) {
  const bin = join(dir, "orca");
  writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs=require('node:fs');
const a=process.argv.slice(2);
const payload=process.env.FIX_PORTS_JSON;
if(a[0]!=='ports'){console.log(JSON.stringify({ok:false,error:{code:'bad'}}));process.exit(1);}
const data=payload?JSON.parse(payload):{executionHostId:'fixture',scannedAt:Date.now(),ports:[]};
console.log(JSON.stringify({ok:true,result:data}));
`,
    { mode: 0o700 },
  );
  return bin;
}

test("resolveOrcaExecutable honors ORCA_CLI_COMMAND", () => {
  const prev = process.env.ORCA_CLI_COMMAND;
  process.env.ORCA_CLI_COMMAND = "/tmp/fake-orca";
  const r = resolveOrcaExecutable();
  assert.equal(r.command, "/tmp/fake-orca");
  assert.equal(r.source, "env");
  if (prev === undefined) delete process.env.ORCA_CLI_COMMAND;
  else process.env.ORCA_CLI_COMMAND = prev;
});

test("unknown protocol does not guess http without probe success", async () => {
  const rows = [
    {
      port: 3025,
      pid: 1,
      protocol: "unknown",
      kind: "workspace",
      connectHost: "127.0.0.1",
      owner: { path: "/wt", confidence: "cwd" },
    },
  ];
  const r = await selectServiceEndpoint(rows, "web", {
    allMode: false,
    probeHttp: false,
  });
  assert.equal(r.selected, null);
  assert.ok(r.attempts.some((a) => a.skipped === "protocol_unknown_no_guess"));
});

test("prefers http workspace port and records owner confidence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uat-ports-"));
  try {
    const ports = {
      executionHostId: "fixture-host",
      scannedAt: Date.now(),
      ports: [
        {
          port: 3025,
          pid: 2,
          protocol: "unknown",
          kind: "workspace",
          connectHost: "127.0.0.1",
          owner: { path: dir, confidence: "cwd" },
        },
        {
          port: 3000,
          pid: 3,
          protocol: "http",
          kind: "workspace",
          connectHost: "127.0.0.1",
          owner: { path: dir, confidence: "cwd" },
        },
      ],
    };
    const orca = fakeOrca(dir);
    process.env.FIX_PORTS_JSON = JSON.stringify(ports);
    const r = await discoverUatRuntime({
      worktreeRoot: dir,
      service: "web",
      orcaBin: orca,
      probeHttp: false,
    });
    delete process.env.FIX_PORTS_JSON;
    assert.equal(r.executionHostId, "fixture-host");
    assert.equal(r.endpoint.port, 3000);
    assert.equal(r.endpoint.owner.confidence, "cwd");
    assert.equal(r.build.status, "skipped");
    assert.equal(r.limits.portDoesNotProveSha, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unavailableReason and empty ports yield unknown runtime", async () => {
  const dir = mkdtempSync(join(tmpdir(), "uat-ports-"));
  try {
    const orca = fakeOrca(dir);
    process.env.FIX_PORTS_JSON = JSON.stringify({
      executionHostId: "x",
      scannedAt: Date.now(),
      unavailableReason: "ssh_workspace",
      ports: [],
    });
    const r = await discoverUatRuntime({
      worktreeRoot: dir,
      orcaBin: orca,
      probeHttp: false,
    });
    assert.equal(r.runtimeStatus, "unknown");
    assert.equal(r.unavailableReason, "ssh_workspace");
    assert.equal(r.ok, false);
    delete process.env.FIX_PORTS_JSON;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("all mode does not treat command-only ownership as proven", async () => {
  const rows = [
    {
      port: 3000,
      pid: 1,
      protocol: "http",
      kind: "workspace",
      connectHost: "127.0.0.1",
      owner: { path: "/wt", confidence: "command" },
    },
  ];
  const r = await selectServiceEndpoint(rows, "web", {
    allMode: true,
    probeHttp: false,
  });
  assert.equal(r.selected.port, 3000);
  assert.equal(r.selected.owner.confidence, "command");
});

test("probeBuildFromHttp parses git-commit meta", async () => {
  const html =
    '<html><head><meta name="git-commit" content="abc123def4567890123456789012345678901234"></head></html>';
  const prev = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => "text/html" },
    text: async () => html,
  });
  const p = await probeBuildFromHttp("http://127.0.0.1:3000");
  assert.equal(p.status, "ok");
  assert.equal(p.build.commit, "abc123def4567890123456789012345678901234");
  assert.equal(p.provenance, "http_probe");
  global.fetch = prev;
});
