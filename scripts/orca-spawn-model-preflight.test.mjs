import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./orca-spawn-model-preflight.mjs", import.meta.url));
const cases = [
  ["--agent cursor --model composer-2.5", 0],
  ["--agent cursor --model claude-sonnet-5-thinking-low", 0],
  ["--agent cursor --model grok-4.7-low", 0],
  ["--agent cursor --model gemini-3.7-flash-low", 0],
  ["--agent codex --model gpt-6-sol --effort medium", 0],
  ["--agent=codex --model=gpt-6-sol --effort=low", 0],
  ["--agent codex --model gpt-6-sol", 2],
  ["--agent codex --model composer-2.5", 2],
  ["--agent cursor --model gpt-6-sol", 2],
  ["--agent codex --model gpt-6-sol --effort high", 2],
  ["--agent cursor --model composer-2.5-fast", 2],
  ["--agent cursor --model auto", 2],
  ["--model composer-2.5", 2],
  ["--agent cursor --model", 2],
  ["--agent cursor --model composer-2.5 --model grok-4.7-low", 2],
  ["--terminal=sample", 0],
  ["--terminal sample --model composer-2.5", 2],
  ["--agent cursor --model composer-2.5 --effort low", 2],
];
for (const [args, expected] of cases) {
  test(args, () => {
    const result = spawnSync(process.execPath, [script, "--", ...args.split(" ")], { encoding: "utf8" });
    assert.equal(result.status, expected, result.stderr);
  });
}
