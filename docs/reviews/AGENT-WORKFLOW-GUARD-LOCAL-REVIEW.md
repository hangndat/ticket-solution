# Agent workflow guard — local review (not exact-SHA merge DoD)

**Reviewer:** worker `task_eeb8910e045b` / `ctx_2cf6a6d05bac`  
**Scope:** `scripts/agent-workflow-guard.mjs`, `scripts/lib/workflow-observation.mjs`, `scripts/agent-workflow-guard.test.mjs`  
**Tests:** `node --test scripts/agent-workflow-guard.test.mjs` → **10/10 pass**  
**Verdict:** **FAIL** (mechanical gates have confirmed bypasses; fix before trusting evidence-only / handoff)

**Cập nhật sau review:** giữ nguyên kết luận lịch sử ở dưới; batch 2 và coordinator đã sửa/revalidate local, gồm browser smoke thật. Xem [checkpoint cuối](WORKFLOW-TOKEN-OPTIMIZATION-2026-10-23.md). Đây chưa phải verdict độc lập trên commit mới.

## Findings

| ID | Severity | Code | Confirmed? |
| --- | --- | --- | --- |
| F01 | High | `PROVENANCE_TREE_UNVERIFIED` | Yes |
| F02 | Medium | `BUILD_ID_NOT_CROSSCHECKED` | Yes |
| F03 | Medium | `DOM_VISIBLE_FALSE_IGNORED` | Yes |
| F04 | High | `AUTH_WEAK_WITHOUT_EXPLICIT_AUTHENTICATED` | Yes |
| F05 | Medium | `CHECKPOINT_V1_STATUS_WILDCARD` | Yes |
| F06 | Medium | `PNG_VIEWPORT_CHECK_SKIPPED` | Yes |
| F07 | High | `HANDOFF_SCOPE_BYPASS` | Yes |
| F08 | High | `ALLOWLIST_DOTDOT_LEAK` | Yes |
| F09 | Low | `EXPECT_TEXT_INCLUDES_UNSUPPORTED` | Yes (gap, not bug) |
| F10 | Low | `ORCA_EVAL_PARSE_OK` | No issue — redaction works in G06 |

### F01 — `git.sourceTree.sha` format-only

`validateManifestProvenance` requires `FULL_SHA` on `git.sourceTree.sha` but never compares to `git rev-parse <commit>^{tree}` (or equivalent). A manifest can cite a valid tree hash unrelated to `git.commit.sha`.

**Repro:** Set `git.commit.sha` = resolved HEAD, `git.sourceTree.sha` = another valid 40-char hex; `evidence` passes provenance tree field.

### F02 — `git.build.id` not tied to observation

Provenance requires non-empty `git.build.id` / `expect.build.id` but does not require `manifest.observations.build.id` (or `expect.build.id`) to match `git.build.id`. `compareBuild` only compares expect vs observations, not git block.

**Repro:** `git.build.id: "a"`, `expect.build.id: "b"`, matching observations for `"b"` → no `BUILD_PROVENANCE_MISMATCH` on git linkage.

### F03 — `visible: false` never enforced

`compareDom` only fails when `item.visible === true` and DOM not visible. Expecting hidden elements (`visible: false`) never validated.

**Repro:** `dom: [{ selector: "#modal", visible: false }]` with `visible: true` in observation → probe passes.

### F04 — Protected auth without `authenticated: true`

`compareAuthProbe` checks `expect.authProbe.authenticated` only when `=== true`. Omitted field skips session check. `buildAuthFetchExpression` sets `authenticated` true when `roles.length > 0` or `operator !== null` even if `body.authenticated !== true`.

**Repro:** Protected expect without `authenticated`; auth JSON `{ authenticated: false, roles: ["platform"], operator: null }` → merged probe `authenticated: true`, no finding.

### F05 — Legacy checkpoint schema

`loadCheckpoint` v1 (`paths[]`) stores `status: "??"` for every path. `isBaselineEntry` requires porcelain status match, so normal dirty entries (` M`, etc.) never match v1 baseline — checkpoint ineffective or always flags leak. v2 re-hash on load is correct; v1 migration path unsafe.

**Repro:** Record v1-style checkpoint JSON with `paths`; touch tracked file with same content hash but status ` M` → spurious `EVIDENCE_ONLY_PATH_LEAK`.

### F06 — PNG IHDR vs expected viewport optional

`validateArtifacts` / `validateScreenshotStates` compare IHDR only when `art.viewport` / `st.viewport` present. Missing viewport on artifact/state skips dimension gate; expect-level viewport not enforced on PNG bytes.

**Repro:** State screenshot 1×1 PNG, omit `viewport` on state; expect viewport 1280×720 → no `PNG_VIEWPORT_MISMATCH`.

### F07 — Handoff scope optional

`cmdHandoff` runs `runScopeCapture` only when argv contains `--base` or `--mode`. Handoff with manifest only (no scope flags) never runs evidence-only allowlist — contradicts evidence-only workflow intent.

**Repro:** `handoff --manifest m.json` with dirty `package.json`; passes if manifest valid, no scope findings.

### F08 — Allowlist prefix traversal

`pathAllowed` does not normalize `..`. `docs/reviews/../package.json` matches prefix `docs/reviews`.

**Repro:** `node -e "import {pathAllowed} from './scripts/lib/workflow-observation.mjs'; console.log(pathAllowed('docs/reviews/../package.json',['docs/reviews']))"` → `true`.

### F09 — `textIncludes` / rich state fields

No `textIncludes` in probe expression or validators; `expect.states` only cover screenshot files/hashes/viewport. Coordinators must not assume copy/state assertions beyond DOM presence/visibility.

### F10 — Orca eval (positive)

`runOrcaEval` parses `{ ok, result, value }`, redacts error messages containing token/secret (G06). Fake host `eval_unsupported` maps to exit 3 path. **No raw secret leak observed in tests.**

## Test coverage gaps (not failures)

- No test for F01 tree mismatch, F04 omitted `authenticated`, F07 handoff without scope, F08 dotdot path.
- G04 rename passes (good); no test for same-path index-only staged change vs content hash (checkpoint v2 covers content edit).

## Unsupported / out of scope

- Live `orca eval` browser tab (not run in review; G06 uses fake CLI only).
- Cross-manifest policy when coordinator mandates evidence-only without passing `--base` on handoff (process gap per F07).
