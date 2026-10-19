#!/usr/bin/env node
/**
 * Wave E — reject spawn argv without a cost-catalog --model pin.
 *
 * Usage (coordinator, before worker-start):
 *   node scripts/orca-spawn-model-preflight.mjs -- --model composer-2.5 ...
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

/** Trần standard — reject pins above cost-catalog band (Wave E). */
function isAllowedPin(id) {
  if (id === "composer-2.5-fast" || id === "claude-sonnet-5-thinking-medium") {
    return false;
  }
  if (
    !/^(composer-2\.5$|claude-sonnet-5-thinking-low$|grok-4\.7-low$|gemini-3\.7-flash-low$)/.test(
      id,
    )
  ) {
    return false;
  }
  if (
    id.includes("xhigh") ||
    id.includes("ultra") ||
    id.includes("max") ||
    id.includes("thinking-high") ||
    id.startsWith("gpt-")
  ) {
    return false;
  }
  return true;
}

function loadPins() {
  try {
    const md = readFileSync(join(ROOT, "docs/agents/cost-catalog.md"), "utf8");
    const found = [...md.matchAll(/`([a-z0-9][a-z0-9._-]*)`/gi)].map((m) => m[1]);
    const pins = found.filter(isAllowedPin);
    return new Set(pins.length ? pins : FALLBACK_PINS);
  } catch {
    return new Set(FALLBACK_PINS);
  }
}

function parseArgs(argv) {
  const out = { model: null, agent: null, terminal: null, auto: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--model" && argv[i + 1]) {
      out.model = argv[++i];
    } else if (a.startsWith("--model=")) {
      out.model = a.slice("--model=".length);
    } else if (a === "--agent" && argv[i + 1]) {
      out.agent = argv[++i];
    } else if (a === "--terminal" && argv[i + 1]) {
      out.terminal = argv[++i];
    }
  }
  if (out.model === "auto") out.auto = true;
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

const pins = loadPins();
const parsed = parseArgs(argv);

if (parsed.terminal) {
  console.log("preflight: reuse --terminal (model flags N/A) · ok");
  process.exit(0);
}

if (!parsed.model || parsed.auto) {
  console.error(
    "FAIL Wave E: worker-start thiếu --model (hoặc --model auto). Pin từ docs/agents/cost-catalog.md — cấm inherit UI.",
  );
  process.exit(2);
}

if (!isAllowedPin(parsed.model) || !pins.has(parsed.model)) {
  console.error(
    `FAIL Wave E: --model ${parsed.model} không hợp lệ (trần standard / cost-catalog). Refresh agent models / cập nhật cost-catalog.`,
  );
  process.exit(2);
}

console.log(
  `preflight: --model ${parsed.model} · agent=${parsed.agent || "?"} · ok`,
);
process.exit(0);
