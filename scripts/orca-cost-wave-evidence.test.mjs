import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./orca-cost-wave-evidence.mjs", import.meta.url));
for (const [name, effective, active, expectedPinned, expectedExit] of [
  ["structured active without fleet status", "gpt-6-sol", true, 1, 0],
  ["requested does not prove effective", null, true, 0, 2],
  ["auto is inherited", "auto", true, 0, 2],
  ["no active workers does not scan unrelated comments", "gpt-6-sol", false, 0, 0],
]) {
  test(name, () => {
    const dir = mkdtempSync(join(tmpdir(), "orca-wave-test-"));
    const cli = join(dir, "orca-fixture");
    writeFileSync(cli, `#!/usr/bin/env node
const a = process.argv.slice(2);
let result = {};
if (a[1] === 'worker-list') result = {workers: ${JSON.stringify(active ? [{dispatchId:"dispatch",taskId:"task",runId:"run",terminalState:"active",resource:{worktreeId:"repo::/fixture"},projection:{liveness:{verdict:"unverifiable"}}}] : [])}};
if (a[1] === 'task-list') result = {tasks:[{id:'task',spec:'Cost tier: standard'}]};
if (a[0] === 'worktree') result = {worktrees:[{path:'/fixture',comment:'model composer-2.5',isMainWorktree:false}]};
if (a[1] === 'worker-show') result = {worker:{startOptions:{launch:{requested:{model:'gpt-6-sol'},effective:{model:${JSON.stringify(effective)}}}}}};
console.log(JSON.stringify({ok:true,result}));
`, { mode: 0o700 });
    try {
      const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, ORCA_CLI_COMMAND: cli } });
      assert.equal(result.status, expectedExit, result.stderr);
      assert.match(result.stdout, new RegExp(`pinned=${expectedPinned} inherit=`));
      assert.match(result.stdout, new RegExp(`n=${active ? 1 : 0} active`));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
}
