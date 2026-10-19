#!/usr/bin/env node
/**
 * Wave D + E — cost-wave evidence.
 *
 * Default (Wave E): prefer launch.requested / launch.effective from
 * `worker-show` receipts on live dispatches. Fall back to wt comment only
 * when receipt model is null and comment has an explicit pin (mixed).
 *
 * Usage:
 *   node scripts/orca-cost-wave-evidence.mjs
 *   node scripts/orca-cost-wave-evidence.mjs --comments-only
 */
import { execFileSync } from "node:child_process";

const commentsOnly = process.argv.includes("--comments-only");

function orcaJson(args) {
  const out = execFileSync("orca", args, { encoding: "utf8", maxBuffer: 20e6 });
  return JSON.parse(out);
}

const CATALOG_PINS = new Set([
  "composer-2.5-fast",
  "composer-2.5",
  "claude-sonnet-5-thinking-low",
  "claude-sonnet-5-thinking-medium",
  "claude-sonnet-5-thinking-high",
  "gpt-5.6-sol-high",
  "grok-4.7-low",
  "gemini-3.7-flash-low",
]);

const PIN_RE =
  /\bmodel\s+(composer-2\.5(?:-fast)?|claude-sonnet-5-thinking-(?:low|medium|high)|gpt-5\.6-sol-high|grok-4\.7-low|gemini-3\.7-flash-low)\b/i;
const TIER_RE = /\bCost\s+(cheap|standard|heavy)\b/i;
const TIER_DN_RE = /\b(cheap|standard|heavy)\b/i;
const INHERIT_RE = /\binherit\b|\bmodel\s+auto\b/i;

function tierFromBlob(blob) {
  const m = blob.match(TIER_RE) || blob.match(TIER_DN_RE);
  return m?.[1]?.toLowerCase() || null;
}

function commentPin(blob) {
  if (INHERIT_RE.test(blob)) return { kind: "inherit", model: "inherit?" };
  const pm = blob.match(PIN_RE);
  if (pm) return { kind: "pinned", model: pm[1] };
  return { kind: "unpinned", model: "unpinned" };
}

const wl = orcaJson(["orchestration", "worker-list", "--include-remote", "--json"]);
const workers = wl.result?.workers ?? [];
const live = workers.filter((w) => w.projection?.liveness?.verdict === "live");

const list = orcaJson(["worktree", "list", "--json"]);
const wtByPath = new Map();
for (const w of list.result?.worktrees ?? []) {
  if ((w.path || "").includes("ticket-solution") && !w.isArchived) {
    wtByPath.set(w.path, w);
  }
}

let cheap = 0,
  standard = 0,
  heavy = 0,
  unknown = 0,
  pinned = 0,
  inherit = 0;
const models = [];
let receiptRows = 0;
let commentRows = 0;
let mixedRows = 0;

function bumpTier(tier) {
  if (tier === "cheap") cheap++;
  else if (tier === "standard") standard++;
  else if (tier === "heavy") heavy++;
  else unknown++;
}

function classifyReceipt(launch, wtBlob) {
  const req = launch?.requested?.model ?? null;
  const eff = launch?.effective?.model ?? null;
  const claim = eff ?? req;
  if (claim && claim !== "auto") {
    receiptRows++;
    const ok = CATALOG_PINS.has(String(claim)) || Boolean(req);
    return {
      kind: ok ? "pinned" : "pinned",
      model: String(claim),
      source: "receipt",
    };
  }
  // null effective — try comment as soft signal (mixed / risk)
  const c = commentPin(wtBlob);
  if (c.kind === "pinned") {
    mixedRows++;
    return { kind: "inherit", model: `comment-only:${c.model}`, source: "mixed" };
  }
  receiptRows++;
  return { kind: "inherit", model: "null-effective", source: "receipt" };
}

if (commentsOnly || live.length === 0) {
  const paths = new Set();
  for (const w of live) {
    const id = w.resource?.worktreeId ?? "";
    const path = id.includes("::") ? id.split("::").pop() : id;
    if (path) paths.add(path);
  }
  const scan =
    live.length === 0
      ? [...wtByPath.values()].filter((w) => !w.isMainWorktree)
      : [...paths].map((p) => wtByPath.get(p)).filter(Boolean);

  for (const w of scan) {
    if (!w || w.isMainWorktree) continue;
    if (live.length && !paths.has(w.path)) continue;
    const blob = `${w.comment || ""}\n${w.displayName || ""}`;
    bumpTier(tierFromBlob(blob));
    const c = commentPin(blob);
    commentRows++;
    if (c.kind === "pinned") {
      pinned++;
      models.push(c.model);
    } else {
      inherit++;
      models.push(c.model);
    }
  }
} else {
  for (const w of live) {
    const id = w.resource?.worktreeId ?? "";
    const path = id.includes("::") ? id.split("::").pop() : id;
    const wt = path ? wtByPath.get(path) : null;
    const blob = `${wt?.comment || ""}\n${wt?.displayName || ""}\n${w.taskTitle || ""}`;
    bumpTier(tierFromBlob(blob) || tierFromBlob(w.taskTitle || ""));

    let launch = null;
    try {
      const show = orcaJson([
        "orchestration",
        "worker-show",
        "--dispatch",
        w.dispatchId,
        "--json",
      ]);
      launch = show.result?.worker?.startOptions?.launch ?? null;
    } catch {
      launch = null;
    }

    const row = launch
      ? classifyReceipt(launch, blob)
      : (() => {
          commentRows++;
          const c = commentPin(blob);
          return {
            kind: c.kind === "pinned" ? "pinned" : "inherit",
            model: c.model,
            source: "wt-comment",
          };
        })();

    if (row.kind === "pinned") {
      pinned++;
      models.push(row.model);
    } else {
      inherit++;
      models.push(row.model);
    }
  }
}

const n = cheap + standard + heavy + unknown;
const inheritPct = n ? Math.round((inherit * 1000) / n) / 10 : 0;
const run = live[0]?.runId ?? workers[0]?.runId ?? "run_?";

let source = "wt-comment-estimate";
if (!commentsOnly && live.length) {
  if (receiptRows && !mixedRows && !commentRows) source = "receipt";
  else if (receiptRows || mixedRows) source = "receipt+mixed";
  else source = "wt-comment-estimate";
}

const line = `cost-wave | run=${run} | n=${n} live | cheap=${cheap} standard=${standard} heavy=${heavy} unknown=${unknown} | pinned=${pinned} inherit=${inherit} | inherit%=${inheritPct} | models=${[...new Set(models)].join(",") || "-"} | source=${source}`;

console.log(line);
if (inheritPct > 20) {
  console.error(
    `WARN inherit%=${inheritPct} > 20 — refresh agent models / pass --model on worker-start (Wave E)`,
  );
  process.exitCode = 2;
}
