/**
 * Fixed browser probe helpers for agent-workflow-guard (no manifest-supplied eval).
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const MAX_FINDINGS = 40;
export const AUTH_URL_PATTERN = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%-/]*$/;
export const DOM_EXPECT_KEYS = new Set([
  "selector",
  "visible",
  "textIncludes",
  "attributeEquals",
]);
export const RUNTIME_PATH_PREFIXES = [
  "apps/",
  "packages/",
  "scripts/",
  ".github/",
  "infra/",
];

const PAGE_AUTH_KEYS = ["roles", "mfaVerified", "operator"];

export function resolveOrcaBin() {
  if (process.env.ORCA_CLI_COMMAND) return process.env.ORCA_CLI_COMMAND;
  if (process.env.ORCA_DEV_REPO_ROOT) return "orca-dev";
  return "orca";
}

export function validateAuthUrl(url) {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) {
    return { ok: false, code: "AUTH_URL_INVALID" };
  }
  if (/^https?:/i.test(url) || url.includes("://")) {
    return { ok: false, code: "AUTH_URL_INVALID" };
  }
  if (!AUTH_URL_PATTERN.test(url)) {
    return { ok: false, code: "AUTH_URL_INVALID" };
  }
  return { ok: true };
}

function isPositiveInt(n) {
  return Number.isInteger(n) && n > 0;
}

function pushFinding(findings, code, message) {
  if (findings.length >= MAX_FINDINGS) return;
  findings.push({ code, message });
}

export function validateDomExpectKeys(dom, findings) {
  if (!Array.isArray(dom)) return;
  for (const item of dom) {
    if (!item || typeof item !== "object") continue;
    for (const k of Object.keys(item)) {
      if (!DOM_EXPECT_KEYS.has(k)) {
        pushFinding(findings, "EXPECT_DOM_UNSUPPORTED", `unsupported dom key: ${k}`);
      }
    }
    if (item.visible !== undefined && typeof item.visible !== "boolean") {
      pushFinding(findings, "EXPECT_DOM_INVALID", "dom.visible must be boolean");
    }
    if (item.attributeEquals !== undefined) {
      const ae = item.attributeEquals;
      if (!ae || typeof ae !== "object" || typeof ae.name !== "string") {
        pushFinding(findings, "EXPECT_DOM_INVALID", "attributeEquals requires name");
      }
    }
  }
}

export function validateExpectMeaningful(expect, findings) {
  if (!expect || typeof expect !== "object") {
    pushFinding(findings, "EXPECT_EMPTY", "expect block required");
    return;
  }
  const route = expect.route;
  if (!route || (route.exact === undefined && route.pathPrefix === undefined)) {
    pushFinding(findings, "EXPECT_ROUTE_MISSING", "route exact or pathPrefix required");
  }
  if (expect.htmlLang === undefined || String(expect.htmlLang).trim() === "") {
    pushFinding(findings, "EXPECT_LANG_MISSING", "htmlLang required");
  }
  const vp = expect.viewport;
  if (!vp || !isPositiveInt(Number(vp.width)) || !isPositiveInt(Number(vp.height))) {
    pushFinding(findings, "EXPECT_VIEWPORT_MISSING", "viewport positive integers required");
  }
  const build = expect.build;
  if (!build?.commit || String(build.commit).trim() === "") {
    pushFinding(findings, "EXPECT_BUILD_MISSING", "build.commit required");
  }
  if (!build?.id || String(build.id).trim() === "") {
    pushFinding(findings, "EXPECT_BUILD_ID_MISSING", "build.id required");
  }
  if (!Array.isArray(expect.dom) || expect.dom.length === 0) {
    pushFinding(findings, "EXPECT_DOM_MISSING", "at least one dom expectation required");
  }
  validateDomExpectKeys(expect.dom, findings);
  const mode = expect.authMode;
  if (mode !== "protected" && mode !== "public") {
    pushFinding(findings, "EXPECT_AUTH_MODE", "authMode must be protected or public");
  }
  if (mode === "protected") {
    const ap = expect.authProbe ?? {};
    const urlCheck = validateAuthUrl(ap.url ?? "");
    if (!urlCheck.ok) {
      pushFinding(findings, "AUTH_URL_INVALID", "authProbe.url must be same-origin relative path");
    }
    if (ap.authenticated !== true) {
      pushFinding(findings, "EXPECT_AUTH_REQUIRED", "protected authMode requires authenticated:true");
    }
    if (ap.operator === undefined || String(ap.operator).trim() === "") {
      pushFinding(findings, "EXPECT_OPERATOR_REQUIRED", "protected authMode requires authProbe.operator");
    }
    if (ap.mfa !== undefined && ap.mfa !== "verified" && ap.mfa !== "none") {
      pushFinding(findings, "EXPECT_MFA_INVALID", "authProbe.mfa must be verified or none");
    }
    if (ap.whitelistKeys) {
      pushFinding(findings, "AUTH_WHITELIST_FORBIDDEN", "whitelistKeys not allowed in manifest");
    }
  }
  if (mode === "public" && expect.authProbe?.url) {
    pushFinding(findings, "AUTH_PUBLIC_WITH_PROBE", "public authMode must not configure authProbe.url");
  }
}

export function buildProbeExpression(expect) {
  const dom = Array.isArray(expect?.dom) ? expect.dom : [];
  const authUrl = expect?.authMode === "protected" ? (expect.authProbe?.url ?? null) : null;
  const operator = expect?.authProbe?.operator ?? null;
  const mfa = expect?.authProbe?.mfa ?? null;
  const payload = JSON.stringify({ dom, authUrl, operator, mfa });
  return `(() => {
  const cfg = ${payload};
  const route = { pathname: location.pathname };
  const htmlLang = (document.documentElement.getAttribute("lang") || "").trim();
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const build = {
    id: document.querySelector('meta[name="build-id"]')?.getAttribute("content") ?? null,
    commit: document.querySelector('meta[name="git-commit"]')?.getAttribute("content") ?? null,
    label: document.querySelector('meta[name="build-label"]')?.getAttribute("content") ?? null,
  };
  const dom = {};
  for (const item of cfg.dom) {
    const sel = item.selector;
    if (!sel || typeof sel !== "string") continue;
    const el = document.querySelector(sel);
    const visible = !!(el && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden");
    const row = { found: !!el, visible };
    if (item.visible === false) row.hiddenOk = !visible;
    if (item.textIncludes) {
      row.textMatch = !!(el && (el.textContent || "").includes(String(item.textIncludes)));
    }
    if (item.attributeEquals && item.attributeEquals.name) {
      const want = item.attributeEquals.value != null ? String(item.attributeEquals.value) : "";
      row.attrMatch = !!(el && el.getAttribute(item.attributeEquals.name) === want);
    }
    dom[sel] = row;
  }
  const authProbe = cfg.authUrl ? { status: "pending" } : { status: "skipped" };
  return JSON.stringify({
    schema: "workflow-guard-observation/v1",
    route,
    htmlLang,
    viewport,
    build,
    dom,
    authProbe,
    capturedAt: new Date().toISOString(),
  });
})()`;
}

export function buildAuthFetchExpression(authUrl, expectAuth) {
  const url = JSON.stringify(authUrl);
  const operator = JSON.stringify(expectAuth?.operator ?? null);
  const mfaWant = JSON.stringify(expectAuth?.mfa ?? null);
  const keys = JSON.stringify(PAGE_AUTH_KEYS);
  return `(async () => {
  const url = ${url};
  const keys = ${keys};
  const wantOp = ${operator};
  const wantMfa = ${mfaWant};
  try {
    const res = await fetch(url, { method: "GET", credentials: "include", cache: "no-store" });
    if (!res.ok) return JSON.stringify({ status: "http_error", httpStatus: res.status });
    const body = await res.json();
    const roles = Array.isArray(body.roles) ? body.roles.map(String) : [];
    const op = body.operator != null ? String(body.operator) : null;
    const mfaVerified = body.mfaVerified === true;
    const authenticated = body.authenticated === true;
    const operatorExact = wantOp === null ? true : roles.includes(wantOp) || op === wantOp;
    const mfaOk = wantMfa === "verified" ? mfaVerified : wantMfa === "none" ? !mfaVerified : true;
    return JSON.stringify({
      status: "ok",
      authenticated,
      operatorExact,
      mfaVerified: mfaOk,
      roleCount: roles.length,
    });
  } catch {
    return JSON.stringify({ status: "fetch_failed" });
  }
})()`;
}

function redactHostMessage(msg) {
  if (!msg || typeof msg !== "string") return undefined;
  if (/token|secret|callback|password|bearer/i.test(msg)) return "[redacted]";
  if (msg.length > 120) return msg.slice(0, 120);
  return msg;
}

export function runOrcaEval(expression, { pageId, worktree, orcaBin = resolveOrcaBin() } = {}) {
  const args = ["eval", "--expression", expression, "--json"];
  if (pageId) args.push("--page", pageId);
  if (worktree) args.push("--worktree", worktree);
  try {
    const out = execFileSync(orcaBin, args, {
      encoding: "utf8",
      maxBuffer: 20e6,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const parsed = JSON.parse(out);
    if (!parsed.ok) {
      const code = parsed.error?.code ?? "ORCA_EVAL_FAILED";
      const unavailable =
        code === "browser_no_tab" ||
        code === "command_unknown" ||
        code === "eval_unsupported";
      return {
        ok: false,
        code,
        message: redactHostMessage(parsed.error?.message),
        unavailable,
      };
    }
    let value = parsed.result;
    if (value && typeof value === "object") {
      if ("value" in value) value = value.value;
      else if (typeof value.result === "string") {
        try {
          value = JSON.parse(value.result);
        } catch {
          value = { raw: value.result };
        }
      } else if (value.result && typeof value.result === "object") {
        value = value.result;
      }
    }
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        value = { raw: value };
      }
    }
    return { ok: true, raw: value };
  } catch {
    return { ok: false, code: "HOST_EXEC_FAILED", unavailable: true };
  }
}

export function mergeAuthObservation(base, authResult) {
  const next = { ...base };
  if (authResult?.status === "ok") {
    next.authProbe = {
      status: "ok",
      authenticated: !!authResult.authenticated,
      operatorExact: !!authResult.operatorExact,
      mfaVerified: !!authResult.mfaVerified,
    };
  } else {
    next.authProbe = {
      status: authResult?.status ?? "unknown",
      httpStatus: authResult?.httpStatus ?? undefined,
    };
  }
  return next;
}

export function sanitizeObservation(observed) {
  if (!observed || typeof observed !== "object") return observed;
  const dom = {};
  for (const [sel, row] of Object.entries(observed.dom ?? {})) {
    dom[sel] = {
      found: !!row?.found,
      visible: !!row?.visible,
      ...(row?.textMatch !== undefined ? { textMatch: !!row.textMatch } : {}),
      ...(row?.attrMatch !== undefined ? { attrMatch: !!row.attrMatch } : {}),
      ...(row?.hiddenOk !== undefined ? { hiddenOk: !!row.hiddenOk } : {}),
    };
  }
  const auth = observed.authProbe ?? {};
  const safeAuth = {
    status: auth.status ?? "unknown",
    ...(auth.authenticated !== undefined ? { authenticated: !!auth.authenticated } : {}),
    ...(auth.operatorExact !== undefined ? { operatorExact: !!auth.operatorExact } : {}),
    ...(auth.mfaVerified !== undefined ? { mfaVerified: !!auth.mfaVerified } : {}),
    ...(auth.httpStatus !== undefined ? { httpStatus: auth.httpStatus } : {}),
  };
  return {
    schema: observed.schema ?? "workflow-guard-observation/v1",
    route: { pathname: observed.route?.pathname ?? "" },
    htmlLang: observed.htmlLang ?? "",
    viewport: observed.viewport ?? {},
    build: observed.build ?? {},
    dom,
    authProbe: safeAuth,
    capturedAt: observed.capturedAt,
  };
}

function normPath(p) {
  return p.replace(/\\/g, "/");
}

export function compareRoute(expected, observed, findings) {
  if (!expected) return;
  const path = observed?.route?.pathname ?? "";
  if (expected.exact !== undefined && normPath(path) !== normPath(expected.exact)) {
    pushFinding(findings, "ROUTE_MISMATCH", "route pathname mismatch");
  }
  if (expected.pathPrefix !== undefined) {
    const pref = normPath(expected.pathPrefix);
    const p = normPath(path);
    if (!(p === pref || p.startsWith(pref.endsWith("/") ? pref : `${pref}/`))) {
      pushFinding(findings, "ROUTE_MISMATCH", "route prefix mismatch");
    }
  }
}

export function compareHtmlLang(expected, observed, findings) {
  if (expected === undefined || expected === null) return;
  const obs = (observed?.htmlLang ?? "").trim();
  if (obs !== String(expected).trim()) {
    pushFinding(findings, "HTML_LANG_MISMATCH", "html lang mismatch");
  }
}

export function compareViewport(expected, observed, findings) {
  if (!expected) return;
  const vp = observed?.viewport ?? {};
  if (Number(vp.width) !== Number(expected.width) || Number(vp.height) !== Number(expected.height)) {
    pushFinding(findings, "VIEWPORT_MISMATCH", "viewport mismatch");
  }
}

export function compareDom(domExpects, observed, findings) {
  if (!Array.isArray(domExpects)) return;
  const dom = observed?.dom ?? {};
  for (const item of domExpects) {
    const row = dom[item.selector];
    if (!row?.found) {
      pushFinding(findings, "DOM_STATE_MISSING", `dom missing: ${item.selector}`);
      continue;
    }
    if (item.visible === true && !row.visible) {
      pushFinding(findings, "DOM_STATE_MISSING", `dom not visible: ${item.selector}`);
    }
    if (item.visible === false && !row.hiddenOk) {
      pushFinding(findings, "DOM_STATE_MISSING", `dom must be hidden: ${item.selector}`);
    }
    if (item.textIncludes && !row.textMatch) {
      pushFinding(findings, "DOM_STATE_MISSING", `dom textIncludes mismatch: ${item.selector}`);
    }
    if (item.attributeEquals && !row.attrMatch) {
      pushFinding(findings, "DOM_STATE_MISSING", `dom attribute mismatch: ${item.selector}`);
    }
  }
}

export function compareAuthProbe(expect, observed, findings) {
  const mode = expect?.authMode;
  const probe = observed?.authProbe;
  if (mode === "public") {
    if (probe?.status === "ok" && probe.authenticated) {
      pushFinding(findings, "AUTH_UNEXPECTED", "public page must not be authenticated");
    }
    return;
  }
  if (mode !== "protected") return;
  if (!probe || probe.status === "skipped" || probe.status === "pending") {
    pushFinding(findings, "AUTH_PROBE_MISSING", "auth probe missing");
    return;
  }
  if (probe.status !== "ok") {
    pushFinding(findings, "AUTH_PROBE_FAILED", "auth probe failed");
    return;
  }
  if (!probe.authenticated) {
    pushFinding(findings, "PERSONA_UNAUTHENTICATED", "session not authenticated");
  }
  if (!probe.operatorExact) {
    pushFinding(findings, "PERSONA_OPERATOR_MISMATCH", "operator role mismatch");
  }
  const mfa = expect.authProbe?.mfa;
  if (mfa === "verified" && !probe.mfaVerified) {
    pushFinding(findings, "MFA_MISSING", "mfa not verified");
  }
  if (mfa === "none" && probe.mfaVerified) {
    pushFinding(findings, "MFA_UNEXPECTED", "mfa must not be verified");
  }
}

export function compareBuild(expectBuild, observed, findings) {
  if (!expectBuild) return;
  const b = observed?.build ?? {};
  if (expectBuild.commit !== undefined && b.commit !== expectBuild.commit) {
    pushFinding(findings, "BUILD_PROVENANCE_MISMATCH", "build commit meta mismatch");
  }
  if (expectBuild.id !== undefined && b.id !== expectBuild.id) {
    pushFinding(findings, "BUILD_PROVENANCE_MISMATCH", "build id mismatch");
  }
}

export function detectStub(observed, findings) {
  const path = (observed?.route?.pathname ?? "").toLowerCase();
  if (path.includes("/stub")) {
    pushFinding(findings, "STUB_DETECTED", "stub route detected");
  }
}

export function hashFile(path) {
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
}

export function readPngDimensions(path) {
  const buf = readFileSync(path);
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(pngSig)) {
    return { ok: false, code: "PNG_INVALID" };
  }
  const chunkLen = buf.readUInt32BE(8);
  const chunkType = buf.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR" || chunkLen !== 13) {
    return { ok: false, code: "PNG_INVALID" };
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { ok: true, width, height };
}

export function validateScreenshotStates(
  states,
  findings,
  { globalViewport, artifactsByPath, requireArtifacts = true } = {},
) {
  if (!Array.isArray(states) || states.length === 0) return;
  const byHash = new Map();
  for (const st of states) {
    if (!st?.id) {
      pushFinding(findings, "STATE_INVALID", "state id required");
      continue;
    }
    if (!st.screenshot) {
      pushFinding(findings, "ARTIFACT_MISSING", `screenshot missing for state ${st.id}`);
      continue;
    }
    const art = artifactsByPath?.get(st.screenshot);
    if (requireArtifacts && !art) {
      pushFinding(findings, "ARTIFACT_NOT_LISTED", `state ${st.id} screenshot not in artifacts`);
      continue;
    }
    if (!existsSync(st.screenshot)) {
      pushFinding(findings, "ARTIFACT_MISSING", `screenshot file missing for state ${st.id}`);
      continue;
    }
    let h;
    let dims;
    try {
      h = hashFile(st.screenshot);
      dims = readPngDimensions(st.screenshot);
    } catch {
      pushFinding(findings, "PNG_INVALID", `invalid png for state ${st.id}`);
      continue;
    }
    if (!dims.ok) {
      pushFinding(findings, "PNG_INVALID", `png signature invalid for state ${st.id}`);
      continue;
    }
    if (art?.sha256 && art.sha256 !== h) {
      pushFinding(findings, "ARTIFACT_HASH_MISMATCH", `artifact hash mismatch for state ${st.id}`);
    }
    const vp = st.viewport ?? globalViewport;
    if (!vp) {
      pushFinding(findings, "PNG_VIEWPORT_MISSING", `viewport required for state ${st.id}`);
      continue;
    }
    if (Number(vp.width) !== dims.width || Number(vp.height) !== dims.height) {
      pushFinding(findings, "PNG_VIEWPORT_MISMATCH", `ihdr mismatch for state ${st.id}`);
    }
    const sameGroup = st.sameVisualState ?? st.id;
    const prev = byHash.get(h);
    if (prev && prev !== sameGroup) {
      pushFinding(findings, "DUPLICATE_SCREENSHOT_STATES", "distinct states share png hash");
    } else if (!prev) {
      byHash.set(h, sameGroup);
    }
  }
}

export function normalizeForFingerprint(expect, observation) {
  const e = {
    route: expect?.route,
    htmlLang: expect?.htmlLang,
    viewport: expect?.viewport,
    build: expect?.build,
    authMode: expect?.authMode,
    dom: expect?.dom,
    authProbe: expect?.authProbe
      ? {
          url: expect.authProbe.url,
          operator: expect.authProbe.operator,
          mfa: expect.authProbe.mfa,
          authenticated: expect.authProbe.authenticated,
        }
      : null,
  };
  const o = sanitizeObservation(observation);
  return { expect: e, observation: o };
}

export function computeProbeFingerprint(expect, observation) {
  const norm = normalizeForFingerprint(expect, observation);
  const hex = createHash("sha256").update(JSON.stringify(norm)).digest("hex");
  return `sha256:${hex}`;
}

export function validateExpectVsObserved(expect, observed) {
  const findings = [];
  validateExpectMeaningful(expect, findings);
  compareRoute(expect?.route, observed, findings);
  compareHtmlLang(expect?.htmlLang, observed, findings);
  compareViewport(expect?.viewport, observed, findings);
  compareDom(expect?.dom, observed, findings);
  compareAuthProbe(expect, observed, findings);
  compareBuild(expect?.build, observed, findings);
  detectStub(observed, findings);
  return findings;
}

export function forbidManifestScriptFields(obj, path = "", findings = []) {
  if (!obj || typeof obj !== "object") return findings;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) forbidManifestScriptFields(obj[i], `${path}[${i}]`, findings);
    return findings;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase();
    if (key === "eval" || key === "evaluate" || key === "script" || key === "expression") {
      pushFinding(findings, "MANIFEST_EVAL_FORBIDDEN", `forbidden key at ${path}.${k}`);
    }
    if (key === "whitelistkeys") {
      pushFinding(findings, "AUTH_WHITELIST_FORBIDDEN", "whitelistKeys forbidden");
    }
    if (v && typeof v === "object") forbidManifestScriptFields(v, `${path}.${k}`, findings);
  }
  return findings;
}

export function normalizeEvidencePath(p) {
  const parts = p.replace(/\\/g, "/").split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

export function pathAllowed(p, allowPrefixes) {
  const path = normalizeEvidencePath(p);
  if (!path) return false;
  for (const prefix of allowPrefixes) {
    const norm = prefix.replace(/\\/g, "/").replace(/\/$/, "");
    if (path === norm) return true;
    if (path.startsWith(`${norm}/`)) return true;
  }
  return false;
}

export function isRuntimePath(p) {
  const path = p.replace(/\\/g, "/");
  return RUNTIME_PATH_PREFIXES.some((pre) => path === pre.replace(/\/$/, "") || path.startsWith(pre));
}

export function allowPrefixPermitted(prefix) {
  const p = prefix.replace(/\\/g, "/");
  if (isRuntimePath(p)) return false;
  if (p === "package.json" || p === ".cursor" || p.startsWith(".cursor/")) return false;
  return true;
}
