/**
 * UAT runtime discovery via Orca CLI (ports scan + optional HTTP build probe).
 * Port ownership does not prove git SHA; build meta comes from HTTP probe only.
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { resolveOrcaBin } from "./workflow-observation.mjs";

const STALE_SCAN_MS = 5 * 60 * 1000;
const SERVICE_DEFAULT_PORTS = { web: [3000, 3002], api: [3001], mobile: [8081] };

export function resolveOrcaExecutable() {
  const command = resolveOrcaBin();
  let resolvedPath = command;
  if (!process.env.ORCA_CLI_COMMAND && command === "orca") {
    try {
      resolvedPath = execFileSync("command", ["-v", command], {
        encoding: "utf8",
      }).trim();
    } catch {
      resolvedPath = command;
    }
  }
  return {
    command,
    resolvedPath,
    resolvedAt: new Date().toISOString(),
    source: process.env.ORCA_CLI_COMMAND
      ? "env"
      : process.env.ORCA_DEV_REPO_ROOT
        ? "orca-dev"
        : "default",
  };
}

function runOrcaPorts(orcaBin, worktreeAbs, { all = false } = {}) {
  const wt = `path:${resolve(worktreeAbs)}`;
  const args = ["ports", "--worktree", wt, "--json"];
  if (all) args.push("--all");
  try {
    const out = execFileSync(orcaBin, args, {
      encoding: "utf8",
      maxBuffer: 8e6,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(out);
    if (!parsed.ok) {
      return {
        ok: false,
        code: parsed.error?.code ?? "ports_failed",
        message: parsed.error?.message,
      };
    }
    return { ok: true, data: parsed.result ?? {} };
  } catch (e) {
    return { ok: false, code: "HOST_EXEC_FAILED", message: String(e?.message ?? e) };
  }
}

function normalizePortRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    port: row.port,
    pid: row.pid,
    kind: row.kind ?? "unknown",
    protocol: row.protocol ?? "unknown",
    processName: row.processName ?? null,
    connectHost: row.connectHost ?? row.bindHost ?? "127.0.0.1",
    advertisedUrl: row.advertisedUrl ?? null,
    owner: row.owner
      ? {
          path: row.owner.path ?? null,
          confidence: row.owner.confidence ?? null,
          worktreeId: row.owner.worktreeId ?? null,
        }
      : null,
  };
}

function scanFreshness(scannedAt) {
  if (scannedAt == null) return { fresh: false, reason: "scan_time_missing" };
  const ms =
    typeof scannedAt === "number"
      ? scannedAt
      : Date.parse(String(scannedAt));
  if (!Number.isFinite(ms)) return { fresh: false, reason: "scan_time_invalid" };
  const age = Date.now() - ms;
  if (age < 0 || age > STALE_SCAN_MS) {
    return { fresh: false, reason: "scan_stale", ageMs: age };
  }
  return { fresh: true, ageMs: age };
}

function ownershipProven(row, { allMode }) {
  if (!row?.owner?.path) return false;
  if (allMode && row.owner.confidence !== "cwd") return false;
  if (row.kind !== "workspace") return false;
  return true;
}

function httpBaseFromRow(row) {
  if (row.advertisedUrl) {
    try {
      const u = new URL(row.advertisedUrl);
      return u.origin;
    } catch {
      /* ignore */
    }
  }
  if (row.protocol === "http" || row.protocol === "https") {
    const host = row.connectHost === "*" ? "127.0.0.1" : row.connectHost;
    return `${row.protocol}://${host}:${row.port}`;
  }
  return null;
}

export async function probeBuildFromHttp(baseUrl) {
  if (!baseUrl) return { status: "skipped", reason: "no_http_base" };
  let res;
  try {
    res = await fetch(baseUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
      headers: { accept: "text/html" },
    });
  } catch {
    return { status: "unknown", reason: "fetch_failed" };
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/json")) {
    return { status: "unknown", httpStatus: res.status, reason: "not_html" };
  }
  const body = await res.text();
  const commit =
    body.match(/name="git-commit"\s+content="([^"]+)"/)?.[1] ??
    body.match(/"gitCommit"\s*:\s*"([^"]+)"/)?.[1] ??
    null;
  const id =
    body.match(/name="build-id"\s+content="([^"]+)"/)?.[1] ??
    body.match(/"buildId"\s*:\s*"([^"]+)"/)?.[1] ??
    null;
  return {
    status: res.ok ? "ok" : "http_error",
    httpStatus: res.status,
    build: { commit, id },
    provenance: "http_probe",
    note: "port_scan_does_not_prove_sha",
  };
}

function rankPort(row, service) {
  const ports = SERVICE_DEFAULT_PORTS[service] ?? [];
  const idx = ports.indexOf(row.port);
  const portRank = idx >= 0 ? idx : ports.length + 1;
  const protocolRank = row.protocol === "http" ? 0 : row.protocol === "https" ? 1 : 5;
  const confRank =
    row.owner?.confidence === "cwd" ? 0 : row.owner?.confidence === "command" ? 2 : 4;
  return portRank * 100 + protocolRank * 10 + confRank;
}

export async function selectServiceEndpoint(rows, service, { allMode, probeHttp = true }) {
  const normalized = rows.map(normalizePortRow).filter(Boolean);
  const owned = normalized.filter((r) => ownershipProven(r, { allMode }));
  const pool = owned.length ? owned : normalized;
  const ranked = [...pool].sort((a, b) => rankPort(a, service) - rankPort(b, service));
  const attempts = [];
  for (const row of ranked) {
    let base = httpBaseFromRow(row);
    if (!base && probeHttp) {
      for (const scheme of ["http", "https"]) {
        const host = row.connectHost === "*" ? "127.0.0.1" : row.connectHost;
        const candidate = `${scheme}://${host}:${row.port}`;
        const probe = await probeBuildFromHttp(candidate);
        attempts.push({ candidate, probe });
        if (probe.status === "ok" || probe.httpStatus) {
          base = candidate;
          break;
        }
      }
    }
    if (!base) {
      attempts.push({ row, skipped: "protocol_unknown_no_guess" });
      continue;
    }
    const build =
      probeHttp && base
        ? await probeBuildFromHttp(base)
        : { status: "skipped", reason: "probe_disabled" };
    return {
      selected: { ...row, baseUrl: base },
      build,
      attempts,
    };
  }
  return { selected: null, build: { status: "unknown" }, attempts };
}

export async function discoverUatRuntime({
  worktreeRoot,
  service = "web",
  all = false,
  orcaBin = resolveOrcaBin(),
  probeHttp = true,
} = {}) {
  const executable = resolveOrcaExecutable();
  const scan = runOrcaPorts(orcaBin, worktreeRoot, { all });
  if (!scan.ok) {
    return {
      schema: "uat-orca-runtime/v1",
      ok: false,
      executable,
      runtimeStatus: "unknown",
      unavailableReason: scan.code,
      message: scan.message,
    };
  }
  const data = scan.data;
  const freshness = scanFreshness(data.scannedAt);
  const unavailableReason = data.unavailableReason ?? null;
  const rows = Array.isArray(data.ports) ? data.ports : [];
  let runtimeStatus = "ok";
  if (unavailableReason) runtimeStatus = "unknown";
  else if (!rows.length) runtimeStatus = "unknown";
  else if (!freshness.fresh) runtimeStatus = "unknown";

  const endpoint =
    runtimeStatus === "ok"
      ? await selectServiceEndpoint(rows, service, { allMode: all, probeHttp })
      : { selected: null, build: { status: "unknown" }, attempts: [] };

  return {
    schema: "uat-orca-runtime/v1",
    ok: runtimeStatus === "ok" && !!endpoint.selected,
    executable,
    executionHostId: data.executionHostId ?? null,
    scannedAt: data.scannedAt ?? null,
    scanFreshness: freshness,
    unavailableReason,
    allMode: all,
    ports: rows.map(normalizePortRow).filter(Boolean),
    service,
    endpoint: endpoint.selected,
    build: endpoint.build,
    attempts: endpoint.attempts,
    runtimeStatus,
    limits: {
      portDoesNotProveSha: true,
      allModeOwnership: all
        ? "folder_scan_does_not_auto_prove_ownership"
        : "workspace_tied_rows_only",
    },
  };
}
