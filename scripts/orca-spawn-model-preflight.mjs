#!/usr/bin/env node
/**
 * Wave E — reject spawn argv without a cost-catalog --model pin.
 *
 * Usage (coordinator, before worker-start):
 *   node scripts/orca-spawn-model-preflight.mjs -- --agent cursor --model composer-2.5 ...
 *   node scripts/orca-spawn-model-preflight.mjs --check-args '--agent' 'cursor' '--model' 'composer-2.5'
 *
 * Exit 0 = ok; 2 = missing/invalid model; 1 = usage error.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FALLBACK_PINS = [
  "composer-2.5",
  "claude-sonnet-5-thinking-low",
  "grok-4.7-low",
  "gemini-3.7-flash-low",
];

const CODEX_PINS = new Set(["gpt-6-sol"]);

function loadPins(agent) {
  const allowed = agent === "cursor" ? FALLBACK_PINS : agent === "codex" ? [...CODEX_PINS] : [];
  const md = readFileSync(join(ROOT, "docs/agents/cost-catalog.md"), "utf8");
  return new Set(allowed.filter((pin) => md.includes("`" + pin + "`")));
}

function parseArgs(argv) {
  const out = { model: null, agent: null, terminal: null, effort: null };
  for (let i = 0; i < argv.length; i++) {
    const match = /^--(model|agent|terminal|effort)(?:=(.*))?$/.exec(argv[i]);
    if (!match) continue;
    const key = match[1];
    const value = match[2] ?? argv[++i];
    if (out[key] !== null || !value || value.startsWith("--")) {
      console.error(`FAIL: --${key} thiếu giá trị hoặc lặp lại.`);
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
    "usage: node scripts/orca-spawn-model-preflight.mjs -- --agent cursor --model <pin> …",
  );
  process.exit(1);
}

const parsed = parseArgs(argv);

if (parsed.terminal && (parsed.agent || parsed.model || parsed.effort)) {
  console.error("FAIL: --terminal không kết hợp agent/model/effort.");
  process.exit(2);
}
if (parsed.terminal) {
  console.log("preflight: reuse --terminal (model flags N/A) · ok");
  process.exit(0);
}

if (!parsed.model || parsed.model === "auto") {
  console.error(
    "FAIL Wave E: worker-start thiếu --model (hoặc --model auto). Pin từ docs/agents/cost-catalog.md — cấm inherit UI.",
  );
  process.exit(2);
}

const pins = loadPins(parsed.agent);
if ((parsed.agent === "codex" && !["low", "medium"].includes(parsed.effort)) || (parsed.agent !== "codex" && parsed.effort)) {
  console.error("FAIL: effort chỉ low|medium cho Codex; Cursor dùng effort trong pin.");
  process.exit(2);
}
if (!pins.has(parsed.model)) {
  console.error(
    `FAIL Wave E: --model ${parsed.model} không hợp lệ (trần standard / cost-catalog). Refresh agent models / cập nhật cost-catalog.`,
  );
  process.exit(2);
}

console.log(
  `preflight: --model ${parsed.model} · agent=${parsed.agent || "?"} · ok`,
);
process.exit(0);
