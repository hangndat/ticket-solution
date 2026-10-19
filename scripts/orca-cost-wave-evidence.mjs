#!/usr/bin/env node
/**
 * Wave D — ước lượng cost-wave evidence từ Orca worktree comments + live workers.
 * Không thay launch.requested/effective trên receipt; coordinator vẫn phải ghi
 * dòng chính thức sau worker-start từ receipt.
 *
 * Usage: node scripts/orca-cost-wave-evidence.mjs
 */
import { execFileSync } from "node:child_process";

function orcaJson(args) {
  const out = execFileSync("orca", args, { encoding: "utf8", maxBuffer: 20e6 });
  return JSON.parse(out);
}

const PIN_RE =
  /\bmodel\s+(composer-2\.5(?:-fast)?|claude-sonnet-5-thinking-(?:low|medium|high)|gpt-5\.6-sol-high|grok-4\.7-low|gemini-3\.7-flash-low)\b/i;
const TIER_RE = /\bCost\s+(cheap|standard|heavy)\b/i;
const INHERIT_RE = /\binherit\b|\bmodel\s+auto\b/i;

const wl = orcaJson(["orchestration", "worker-list", "--include-remote", "--json"]);
const livePaths = new Set();
for (const w of wl.result?.workers ?? []) {
  if (w.projection?.liveness?.verdict !== "live") continue;
  const id = w.resource?.worktreeId ?? "";
  const path = id.includes("::") ? id.split("::").pop() : id;
  if (path) livePaths.add(path);
}

const list = orcaJson(["worktree", "list", "--json"]);
const wts = (list.result?.worktrees ?? []).filter(
  (w) =>
    (w.path || "").includes("ticket-solution") &&
    !w.isArchived &&
    !w.isMainWorktree,
);

let cheap = 0,
  standard = 0,
  heavy = 0,
  pinned = 0,
  inherit = 0,
  unknown = 0;
const models = [];

for (const w of wts) {
  if (!livePaths.has(w.path)) continue;
  const c = w.comment || "";
  const dn = w.displayName || "";
  const blob = `${c}\n${dn}`;
  const tierM = blob.match(TIER_RE);
  const tier = tierM?.[1]?.toLowerCase();
  if (tier === "cheap") cheap++;
  else if (tier === "standard") standard++;
  else if (tier === "heavy") heavy++;
  else unknown++;

  if (INHERIT_RE.test(blob)) {
    inherit++;
    models.push("inherit?");
  } else {
    const pm = blob.match(PIN_RE);
    if (pm) {
      pinned++;
      models.push(pm[1]);
    } else {
      inherit++; // no pin in comment → treat as inherit risk
      models.push("unpinned");
    }
  }
}

const n = cheap + standard + heavy + unknown;
const inheritPct = n ? Math.round((inherit * 1000) / n) / 10 : 0;
const run = wl.result?.workers?.[0]?.runId ?? "run_?";

const line = `cost-wave | run=${run} | n=${n} live-wt | cheap=${cheap} standard=${standard} heavy=${heavy} unknown=${unknown} | pinned=${pinned} inherit=${inherit} | inherit%=${inheritPct} | models=${[...new Set(models)].join(",") || "-"} | source=wt-comment-estimate`;

console.log(line);
if (inheritPct > 20) {
  console.error(
    `WARN inherit%=${inheritPct} > 20 — refresh agent models / fix pins before more heavy spawns`,
  );
  process.exitCode = 2;
}
