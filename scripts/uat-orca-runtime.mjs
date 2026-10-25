#!/usr/bin/env node
/** CLI: Orca ports scan + service pick before UAT (read-only). */
import { discoverUatRuntime } from "./lib/uat-orca-runtime.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HELP = `uat-orca-runtime — discover dev server via Orca ports (read-only)

Usage:
  node scripts/uat-orca-runtime.mjs --worktree <abs-path> [--service web|api] [--all] [--no-probe] [--json]

Exit: 0 when a service endpoint is selected · 1 usage · 2 no endpoint / unknown runtime
`;

function usage(msg) {
  if (msg) console.error(msg);
  console.error(HELP);
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  let worktree = null;
  let service = "web";
  let all = false;
  let probeHttp = true;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--worktree") {
      worktree = argv[++i];
      continue;
    }
    if (a === "--service") {
      service = argv[++i];
      continue;
    }
    if (a === "--all") {
      all = true;
      continue;
    }
    if (a === "--no-probe") {
      probeHttp = false;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    usage(`unknown argument: ${a}`);
  }
  if (!worktree) usage("--worktree <abs-path> is required");
  const root = resolve(worktree);
  const result = await discoverUatRuntime({
    worktreeRoot: root,
    service,
    all,
    probeHttp,
  });
  const payload = json ? result : result;
  console.log(JSON.stringify(payload));
  if (!result.ok) process.exitCode = 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
    process.exitCode = 1;
  });
}
