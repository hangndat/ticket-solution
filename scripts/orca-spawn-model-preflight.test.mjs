import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { COST_TIER_ROUTES, routingError } from "./lib/agent-cost-tiers.mjs";

const script = fileURLToPath(new URL("./orca-spawn-model-preflight.mjs", import.meta.url));
const cases = [
  ["--cost-tier standard --agent opencode --model opencode-go/deepseek-v4.1-flash", 0],
  ["--cost-tier focused --agent opencode --model opencode-go/deepseek-v4-pro", 0],
  ["--cost-tier high --agent opencode --model opencode-go/deepseek-v4-pro --tier-reason tenant-isolation", 0],
  ["--cost-tier high --agent opencode --model opencode-go/deepseek-v4-pro", 2],
  ["--cost-tier high --agent opencode --model opencode-go/deepseek-v4.1-flash --tier-reason tenant-isolation", 2],
  ["--cost-tier standard --agent opencode --model opencode-go/deepseek-v4-pro", 2],
  ["--cost-tier high --agent opencode --model opencode-go/deepseek-v4-pro --effort high --tier-reason tenant-isolation", 2],
  ["--cost-tier focused --agent claude --model claude-sonnet-5 --effort low", 0],
  ["--cost-tier advanced --agent claude --model claude-sonnet-5 --effort medium", 0],
  ["--cost-tier high --agent claude --model claude-sonnet-5 --effort high --tier-reason tenant-isolation", 0],
  ["--cost-tier high --agent claude --model claude-sonnet-5 --effort high", 2],
  ["--cost-tier high --agent claude --model claude-sonnet-5 --effort medium --tier-reason tenant-isolation", 2],
  ["--cost-tier advanced --agent claude --model claude-sonnet-5 --effort high", 2],
  ["--cost-tier advanced --agent claude --model claude-opus-5 --effort medium", 2],
  ["--cost-tier high --agent claude --model claude-opus-5 --effort high --tier-reason tenant-isolation", 2],
  ["--cost-tier standard --agent claude --model claude-sonnet-5 --effort low", 2],
  ["--cost-tier focused --agent claude --model claude-sonnet-5-thinking-low --effort low", 2],
  ["--cost-tier high --agent cursor --model claude-sonnet-5 --effort high --tier-reason tenant-isolation", 2],
  ["--cost-tier high --agent claude --model opus --effort high --tier-reason tenant-isolation", 2],
  ["--cost-tier high --agent claude --model claude-sonnet-5 --effort max --tier-reason tenant-isolation", 2],
  ["--cost-tier focused --agent claude --model claude-sonnet-5", 2],
  ["--cost-tier cheap --agent cursor --model composer-2.5", 0],
  ["--cost-tier standard --agent cursor --model composer-2.5", 0],
  ["--cost-tier standard --agent cursor --model claude-sonnet-5-thinking-low", 2],
  ["--cost-tier standard --agent cursor --model grok-4.7-low", 0],
  ["--cost-tier cheap --agent cursor --model grok-4.7-low", 0],
  ["--cost-tier cheap --agent cursor --model gemini-3.7-flash-low", 0],
  ["--cost-tier advanced --agent codex --model gpt-6-sol --effort medium", 0],
  ["--cost-tier=focused --agent=codex --model=gpt-6-sol --effort=low", 0],
  ["--cost-tier codex-low --agent codex --model gpt-6-sol --effort low", 2],
  ["--cost-tier codex-medium --agent codex --model gpt-6-sol --effort medium", 2],
  ["--cost-tier high --agent codex --model gpt-6-sol --effort high --tier-reason tenant-isolation", 0],
  ["--cost-tier high --agent codex --model gpt-6-sol --effort high", 2],
  ["--cost-tier high --agent codex --model gpt-6-sol --effort medium", 2],
  ["--cost-tier high --agent cursor --model composer-2.5", 2],
  ["--cost-tier advanced --agent codex --model gpt-6-sol --effort high", 2],
  ["--cost-tier focused --agent codex --model gpt-6-sol --effort medium", 2],
  ["--cost-tier standard --agent codex --model gpt-6-sol --effort medium", 2],
  ["--cost-tier cheap --agent cursor --model claude-sonnet-5-thinking-low", 2],
  ["--cost-tier heavy --agent codex --model gpt-6-sol --effort high", 2],
  ["--agent cursor --model composer-2.5", 2],
  ["--cost-tier high --agent codex --model gpt-6-sol", 2],
  ["--cost-tier high --agent codex --model composer-2.5 --effort high", 2],
  ["--cost-tier standard --agent cursor --model gpt-6-sol", 2],
  ["--cost-tier high --agent codex --model gpt-6-sol --effort xhigh", 2],
  ["--cost-tier standard --agent cursor --model composer-2.5-fast", 2],
  ["--cost-tier standard --agent cursor --model auto", 2],
  ["--cost-tier standard --model composer-2.5", 2],
  ["--cost-tier standard --agent cursor --model", 2],
  ["--cost-tier standard --agent cursor --model composer-2.5 --model grok-4.7-low", 2],
  ["--cost-tier standard --cost-tier high --agent cursor --model composer-2.5", 2],
  ["--terminal=sample", 0],
  ["--terminal sample --model composer-2.5", 2],
  ["--terminal sample --cost-tier high", 2],
  ["--cost-tier standard --agent cursor --model composer-2.5 --effort low", 2],
];
for (const [args, expected] of cases) {
  test(args, () => {
    const result = spawnSync(process.execPath, [script, "--", ...args.split(" ")], { encoding: "utf8" });
    assert.equal(result.status, expected, result.stderr);
  });
}

test("one tier accepts multiple registered providers and keeps each route's effort", () => {
  const extra = { agent: "fixture-provider", models: ["fixture-model"], effort: "fixture-effort" };
  COST_TIER_ROUTES.advanced.push(extra);
  try {
    assert.equal(routingError({ costTier: "advanced", agent: "fixture-provider", model: "fixture-model", effort: "fixture-effort" }), null);
    assert.equal(routingError({ costTier: "advanced", agent: "codex", model: "gpt-6-sol", effort: "medium" }), null);
    assert.ok(routingError({ costTier: "advanced", agent: "fixture-provider", model: "fixture-model", effort: "medium" }));
    assert.ok(routingError({ costTier: "advanced", agent: "unregistered-provider", model: "fixture-model", effort: "fixture-effort" }));
  } finally {
    COST_TIER_ROUTES.advanced.pop();
  }
});
