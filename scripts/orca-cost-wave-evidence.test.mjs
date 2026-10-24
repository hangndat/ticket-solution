import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./orca-cost-wave-evidence.mjs", import.meta.url));
const cases = [
  { name: "structured active without fleet status" },
  { name: "focused counted separately", tier: "focused" },
  { name: "high counted separately", tier: "high" },
  { name: "cheap counted separately", tier: "cheap", effective: "composer-2.5" },
  { name: "standard counted separately", tier: "standard", effective: "composer-2.5" },
  { name: "legacy heavy still counts as standard", tier: "heavy", expectedTier: "standard" },
  { name: "legacy codex-low reports focused", tier: "codex-low", expectedTier: "focused" },
  { name: "legacy codex-medium reports advanced", tier: "codex-medium", expectedTier: "advanced" },
  { name: "task tier overrides stale worktree comment", tier: "high", comment: "Cost standard; model composer-2.5" },
  { name: "task tier overrides title", tier: "focused", title: "James · Cost high" },
  { name: "plain prose does not declare a tier", spec: "Review high risk per task instructions", expectedTier: "unknown" },
  { name: "explicit title used when task has no declaration", spec: "Review contract", title: "James · Cost focused", expectedTier: "focused" },
  { name: "requested does not prove effective", effective: null, expectedPinned: 0, expectedExit: 2 },
  { name: "auto is inherited", effective: "auto", expectedPinned: 0, expectedExit: 2 },
  { name: "no active workers does not scan unrelated comments", active: false, expectedPinned: 0 },
];
for (const options of cases) {
  const { name, effective = "gpt-6-sol", active = true, tier = "advanced", expectedTier = tier, expectedPinned = 1, expectedExit = 0, spec = `Cost tier: ${tier}`, comment = "model composer-2.5", title = "" } = options;
  test(name, () => {
    const dir = mkdtempSync(join(tmpdir(), "orca-wave-test-"));
    const cli = join(dir, "orca-fixture");
    writeFileSync(cli, `#!/usr/bin/env node
const a = process.argv.slice(2);
let result = {};
if (a[1] === 'worker-list') result = {workers: ${JSON.stringify(active ? [{dispatchId:"dispatch",taskId:"task",taskTitle:title,runId:"run",terminalState:"active",resource:{worktreeId:"repo::/fixture"},projection:{liveness:{verdict:"unverifiable"}}}] : [])}};
if (a[1] === 'task-list') result = {tasks:[{id:'task',spec:${JSON.stringify(spec)}}]};
if (a[0] === 'worktree') result = {worktrees:[{path:'/fixture',comment:${JSON.stringify(comment)},isMainWorktree:false}]};
if (a[1] === 'worker-show') result = {worker:{startOptions:{launch:{requested:{model:'gpt-6-sol'},effective:{model:${JSON.stringify(effective)}}}}}};
console.log(JSON.stringify({ok:true,result}));
`, { mode: 0o700 });
    try {
      const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, ORCA_CLI_COMMAND: cli } });
      assert.equal(result.status, expectedExit, result.stderr);
      assert.match(result.stdout, new RegExp(`pinned=${expectedPinned} inherit=`));
      assert.match(result.stdout, new RegExp(`n=${active ? 1 : 0} active`));
      if (active) assert.match(result.stdout, new RegExp(`(?:\\s|\\|)${expectedTier}=1(?:\\s|\\|)`));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
}
