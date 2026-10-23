# Codex routing — local uncommitted review

| Field | Value |
| --- | --- |
| Reviewer / session | Worker `task_438ba95018a8` · reviewer-dod (local dispatch) |
| Scope | Uncommitted diff: `AGENTS.md`, `docs/agents/*`, `docs/ROADMAP.md`, `.cursor/rules/orca-*`, `scripts/orca-spawn-model-preflight.mjs`, `scripts/orca-cost-wave-evidence.mjs`, `scripts/orca-spawn-model-preflight.test.mjs` |
| Commit SHA | **N/A** — local working tree only (base `8a222cd84e443d4acb17a829d018d62a20d122fd` @ `hangndat/Codex-Pro-Integrate`) |
| Checks | `node --test scripts/orca-spawn-model-preflight.test.mjs` → 18 pass, 0 fail |
| Verdict | **PASS with known gap** |

## Summary

Policy shift from “Cursor-only unless user override” to **selective Cursor + Codex** is consistent across `orca-agent-routing-core.mdc`, `cost-catalog.md`, `AGENTS.md`, `docs/agents/README.md`, and `docs/ROADMAP.md`. Preflight enforces agent-scoped pins, mandatory Codex `--effort low|medium`, and rejects cross-agent pins, `auto`, and `composer-2.5-fast`. Cost-catalog explicitly disclaims entitlement proof and preserves fallback / single-owner replacement semantics.

## Verification matrix

| Claim | Evidence | Result |
| --- | --- | --- |
| Composer 2.5 volume default | `orca-agent-routing-core.mdc` §Routing; cost-catalog table rows coordinator/backend/web/docs | OK |
| Codex isolation (`gpt-6-sol` + effort) | `loadPins("codex")` only `gpt-6-sol`; tests reject `cursor`+`gpt-6-sol`, `codex`+`composer-2.5`, `codex` without effort, `effort high` | OK |
| Bounded Codex effort | Preflight L77–79: only `low`/`medium` for `--agent codex` | OK |
| Fallback preserved | `cost-catalog.md` §Codex (Cursor primary → same-band pins → inherit on host reject; Codex exhaustion → settle then Cursor replacement) | OK |
| No false “pinned” from comments alone | `orca-cost-wave-evidence.mjs`: `classifyReceipt` counts **effective** receipt as pinned; comment-only pin → `kind: inherit` / `comment-only:*` | OK (conservative) |
| Preflight requires explicit `--agent` | `--model composer-2.5` alone → exit 2 (empty pin set) | OK |

## Findings

### F1 (gap, non-blocking) — Stale `--agent cursor` examples outside touched lines

`orca-parallel-workers.mdc` still instructs “agent vẫn `--agent cursor`” and example waves with only Cursor (§spawn checklist ~L26, ~L82–84). Footer in the same file was updated to “routing Cursor + Codex chọn lọc”. Coordinators following only the numbered checklist could miss Codex spawns until those lines are aligned.

**Close when:** Same PR/commit updates parallel-workers examples to reference `cost-catalog` agent/model pairs (incl. `codex` + `--effort`).

### F2 (gap, non-blocking) — Wave E preflight example cursor-only

`orca-agent-routing-coordinator.mdc` L30: preflight example remains `--agent cursor --model <pin>`. Valid but incomplete; Codex spawns need `--agent codex --model gpt-6-sol --effort medium|low` per catalog/tests.

**Close when:** Coordinator rule shows both Cursor and Codex preflight one-liners (or “see cost-catalog”).

### F3 (limitation) — Receipt `pinned` still means “effective model present”, not “catalog-valid”

`classifyReceipt` sets `kind: "pinned"` for any non-`auto` `launch.effective.model` without re-checking catalog membership (same as pre-change logic that always returned pinned). Host misconfiguration could still inflate `pinned` in Wave D metrics; catalog text mitigates entitlement claims, not receipt validation.

**Close when:** Optional: validate effective model against PIN_RE / agent before incrementing `pinned`.

### F4 (informational) — Role files not in this diff

`docs/agents/roles/reviewer-dod.md` still states reviewer `--agent cursor` only; `cost-catalog` allows Codex for high-risk DoD. Not introduced by this diff; coordinator should follow catalog + core over stale role one-liner until roles are synced.

## Test evidence

```text
ℹ tests 18
ℹ pass 18
ℹ fail 0
ℹ duration_ms ~1661
```

Representative cases: Codex `gpt-6-sol` + `effort medium` pass; Codex without effort fail; agent/model mismatch fail; terminal reuse pass; terminal + model fail.

## Limitations

- No merge/CI DoD; no benchmark report review (`CODEX-BENCHMARK-*` out of scope).
- `scripts/orca-cost-wave-evidence.test.mjs` untracked, not executed.
- `orca-cost-wave-evidence.mjs` not unit-tested in this task.
