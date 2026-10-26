#!/usr/bin/env node
/**
 * Wave D + E — cost-wave evidence.
 *
 * Default (Wave E): prefer launch.requested / launch.effective from
 * `worker-show` receipts on live dispatches. Fall back to wt comment only
 * when receipt model is null and comment has an explicit pin (mixed).
 *
 * Usage:
 *   node scripts/orca-cost-wave-evidence.mjs --run RUN --dispatch DISPATCH [--dispatch DISPATCH ...]
 *     [--receipt-file .orca-metrics/lifecycle/.../start-receipt.json ...]
 *   node scripts/orca-cost-wave-evidence.mjs --run RUN --comments-only
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { COST_TIERS, LEGACY_COST_TIERS } from "./lib/agent-cost-tiers.mjs";

const commentsOnly = process.argv.includes("--comments-only");
const values = (flag) => process.argv.flatMap((arg, index, argv) => arg === flag ? [argv[index + 1]] : []);
const run = values("--run")[0];
const dispatchIds = values("--dispatch");
const receiptFiles = values("--receipt-file");
if (!run || !/^run_[\w-]+$/.test(run) || values("--run").length !== 1 ||
    dispatchIds.some((id) => !/^(?:ctx|dispatch)_[\w-]+$/.test(id)) ||
    new Set(dispatchIds).size !== dispatchIds.length ||
    (!commentsOnly && dispatchIds.length === 0) ||
    (commentsOnly && (dispatchIds.length || receiptFiles.length))) {
  console.error("Usage: orca-cost-wave-evidence.mjs --run RUN --dispatch DISPATCH [--dispatch DISPATCH ...] [--receipt-file PATH ...] | --run RUN --comments-only");
  process.exit(1);
}
const receipts = new Map();
for (const file of receiptFiles) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const receipt = data.result ?? data.receipt?.result ?? data;
  if (receipt.runId !== run || !dispatchIds.includes(receipt.dispatchId) ||
      !receipt.taskId || !receipt.launch || receipts.has(receipt.dispatchId)) {
    throw Error(`Receipt scope mismatch or duplicate: ${file}`);
  }
  receipts.set(receipt.dispatchId, receipt);
}

function orcaJson(args) {
  const out = execFileSync(process.env.ORCA_CLI_COMMAND || "orca", args, { encoding: "utf8", maxBuffer: 20e6 });
  return JSON.parse(out);
}

const PIN_RE =
  /\bmodel\s+(gpt-6-sol|composer-2\.5|claude-sonnet-5-thinking-low|grok-4\.7-low|gemini-3\.7-flash-low)\b/i;
const TIER_VALUES = [...COST_TIERS, ...Object.keys(LEGACY_COST_TIERS)].join("|");
const TIER_RE = new RegExp(`\\bCost(?:\\s+tier)?[\\s:*\x60]*(?:=\\s*)?(${TIER_VALUES})(?![\\w-])`, "i");
const TIER_DN_RE = new RegExp(`(?:^|[\\s·|])(${TIER_VALUES})(?=$|[\\s·|])`, "i");
const INHERIT_RE = /\binherit\b|\bmodel\s+auto\b/i;

function tierFromBlob(blob) {
  const m = blob.match(TIER_RE);
  return m?.[1]?.toLowerCase() || null;
}

function tierFromName(name) {
  return tierFromBlob(name) || name.match(TIER_DN_RE)?.[1]?.toLowerCase() || null;
}

function commentPin(blob) {
  if (INHERIT_RE.test(blob)) return { kind: "inherit", model: "inherit?" };
  const pm = blob.match(PIN_RE);
  if (pm) return { kind: "pinned", model: pm[1] };
  return { kind: "unpinned", model: "unpinned" };
}

const wl = orcaJson(["orchestration", "worker-list", "--run", run, "--include-remote", "--json"]);
const workers = wl.result?.workers ?? [];
// A missing structured-session status does not mean the dispatch stopped.
const live = workers.filter((w) => w.terminalState === "active" || w.projection?.liveness?.verdict === "live");
const selected = commentsOnly ? live : workers.filter((w) => dispatchIds.includes(w.dispatchId));
if (!commentsOnly && selected.length !== dispatchIds.length) {
  throw Error(`Missing dispatches in Run ${run}: ${dispatchIds.filter((id) => !selected.some((w) => w.dispatchId === id)).join(", ")}`);
}
if (new Set(selected.map((w) => w.dispatchId)).size !== selected.length ||
    selected.some((w) => w.runId !== run || (receipts.has(w.dispatchId) && receipts.get(w.dispatchId).taskId !== w.taskId))) {
  throw Error(`Worker-list or receipt identity mismatch in Run ${run}`);
}
const tasks = orcaJson(["orchestration", "task-list", "--run", run, "--json"]).result?.tasks ?? [];
const taskById = new Map(tasks.map((t) => [t.id, t]));

const list = orcaJson(["worktree", "list", "--json"]);
const wtByPath = new Map();
for (const w of list.result?.worktrees ?? []) {
  if (!w.isArchived) {
    wtByPath.set(w.path, w);
  }
}

const tiers = Object.fromEntries(COST_TIERS.map((tier) => [tier, 0]));
let unknown = 0,
  pinned = 0,
  inherit = 0;
const models = [];
let receiptRows = 0;
let commentRows = 0;
let mixedRows = 0;

function bumpTier(tier) {
  if (Object.hasOwn(LEGACY_COST_TIERS, tier)) tier = LEGACY_COST_TIERS[tier];
  if (Object.hasOwn(tiers, tier)) tiers[tier]++;
  else unknown++;
}

function classifyReceipt(launch, wtBlob) {
  const eff = launch?.effective?.model ?? null;
  const claim = eff;
  if (claim && claim !== "auto") {
    receiptRows++;
    return {
      kind: "pinned",
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

if (commentsOnly) {
  const paths = new Set();
  for (const w of selected) {
    const id = w.resource?.worktreeId ?? "";
    const path = id.includes("::") ? id.split("::").pop() : id;
    if (path) paths.add(path);
  }
  const scan = [...paths].map((p) => wtByPath.get(p)).filter(Boolean);

  for (const w of scan) {
    if (!w || w.isMainWorktree) continue;
    if (live.length && !paths.has(w.path)) continue;
    const blob = `${w.comment || ""}\n${w.displayName || ""}`;
    bumpTier(tierFromBlob(blob) || tierFromName(w.displayName || ""));
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
  for (const w of selected) {
    const id = w.resource?.worktreeId ?? "";
    const path = id.includes("::") ? id.split("::").pop() : id;
    const wt = path ? wtByPath.get(path) : null;
    const spec = taskById.get(w.taskId)?.spec || "";
    const title = w.taskTitle || "";
    const wtBlob = `${wt?.comment || ""}\n${wt?.displayName || ""}`;
    const blob = `${wtBlob}\n${title}\n${spec}`;
    // Task declarations take precedence over stale worktree comments.
    bumpTier(tierFromBlob(spec) || tierFromName(title) || tierFromBlob(wtBlob) || tierFromName(wt?.displayName || ""));

    let launch = receipts.get(w.dispatchId)?.launch ?? null;
    if (!launch) {
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
    }

    const row = launch
      ? classifyReceipt(launch, blob)
      : (() => {
          commentRows++;
          const c = commentPin(blob);
          return {
            kind: "inherit",
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

const n = Object.values(tiers).reduce((sum, count) => sum + count, 0) + unknown;
const inheritPct = n ? Math.round((inherit * 1000) / n) / 10 : 0;
let source = "wt-comment-estimate";
if (!commentsOnly && selected.length) {
  if (receiptRows && !mixedRows && !commentRows) source = "receipt";
  else if (receiptRows || mixedRows) source = "receipt+mixed";
  else source = "wt-comment-estimate";
}

const line = `cost-wave | run=${run} | scope=${commentsOnly ? "run-active" : "wave"} | n=${n} ${commentsOnly ? "active" : "dispatches"} | ${Object.entries(tiers).map(([tier, count]) => `${tier}=${count}`).join(" ")} unknown=${unknown} | pinned=${pinned} inherit=${inherit} | inherit%=${inheritPct} | models=${[...new Set(models)].join(",") || "-"} | source=${source}`;

console.log(line);
if (inheritPct > 20) {
  console.error(
    `WARN inherit%=${inheritPct} > 20 — refresh agent models / pass --model on worker-start (Wave E)`,
  );
  process.exitCode = 2;
}
