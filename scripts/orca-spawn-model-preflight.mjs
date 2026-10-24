#!/usr/bin/env node
/**
 * Wave E — require cost tier and matching agent/model/effort before spawn.
 *
 * Usage (coordinator, before worker-start):
 *   node scripts/orca-spawn-model-preflight.mjs -- --cost-tier standard --agent cursor --model composer-2.5 ...
 *   --cost-tier is local preflight metadata; do not pass it to Orca worker-start.
 *
 * Exit 0 = ok; 2 = missing/invalid model; 1 = usage error.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COST_TIER_ROUTES, routingError } from "./lib/agent-cost-tiers.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadPins(agent) {
  const allowed = Object.values(COST_TIER_ROUTES).flat().filter((route) => route.agent === agent).flatMap((route) => route.models);
  const md = readFileSync(join(ROOT, "docs/agents/cost-catalog.md"), "utf8");
  return new Set(allowed.filter((pin) => md.includes("`" + pin + "`")));
}

function parseArgs(argv) {
  const out = { model: null, agent: null, terminal: null, effort: null, costTier: null, tierReason: null };
  for (let i = 0; i < argv.length; i++) {
    const match = /^--(model|agent|terminal|effort|cost-tier|tier-reason)(?:=(.*))?$/.exec(argv[i]);
    if (!match) continue;
    const key = match[1] === "cost-tier" ? "costTier" : match[1] === "tier-reason" ? "tierReason" : match[1];
    const value = match[2] ?? argv[++i];
    if (out[key] !== null || !value || value.startsWith("--")) {
      console.error(`FAIL: --${match[1]} thiếu giá trị hoặc lặp lại.`);
      process.exit(2);
    }
    out[key] = value;
  }
  return out;
}

let argv = process.argv.slice(2);
if (argv[0] === "--") argv = argv.slice(1);
if (argv[0] === "--check-args") argv = argv.slice(1);
if (argv.length === 0) {
  console.error(
    "usage: node scripts/orca-spawn-model-preflight.mjs -- --cost-tier <tier> --agent <agent> --model <pin> …",
  );
  process.exit(1);
}

const parsed = parseArgs(argv);

if (parsed.terminal && (parsed.agent || parsed.model || parsed.effort || parsed.costTier || parsed.tierReason)) {
  console.error("FAIL: --terminal không kết hợp cost-tier/agent/model/effort; kiểm receipt khi reuse.");
  process.exit(2);
}
if (parsed.terminal) {
  console.log("preflight: reuse --terminal (model flags N/A); coordinator phải đối chiếu tier với receipt · ok");
  process.exit(0);
}

if (!parsed.model || parsed.model === "auto") {
  console.error(
    "FAIL Wave E: worker-start thiếu --model (hoặc --model auto). Pin từ docs/agents/cost-catalog.md — cấm inherit UI.",
  );
  process.exit(2);
}

const error = routingError(parsed);
if (error) {
  console.error(`FAIL: ${error}`);
  process.exit(2);
}
if (parsed.costTier === "high" && !parsed.tierReason?.trim()) {
  console.error("FAIL: tier high cần --tier-reason nêu rủi ro hoặc quyết định kiến trúc còn mở; việc khó nhưng scope rõ dùng advanced.");
  process.exit(2);
}
const pins = loadPins(parsed.agent);
if (!pins.has(parsed.model)) {
  console.error(
    `FAIL Wave E: --model ${parsed.model} không hợp lệ theo cost-catalog. Refresh agent models / cập nhật cost-catalog.`,
  );
  process.exit(2);
}

console.log(
  `preflight: tier=${parsed.costTier} · agent=${parsed.agent} · model=${parsed.model} · effort=${parsed.effort || "pin"} · ok`,
);
process.exit(0);
