# DoD review — Issue #546 · PR #573 (web invite motion polish)

| Field | Value |
| ----- | ----- |
| Reviewer / session | James · dod — Orca worker `task_86a346447d2d` / `ctx_c30069c439f6` (≠ implementer Higo web) |
| Scope | Epic [#546](https://github.com/hangndat/ticket-solution/issues/546), PR [#573](https://github.com/hangndat/ticket-solution/pull/573), `apps/web/app/invite/` |
| Commit SHA | `ea569624af0901d31c3112674f2ccea9367a0fad` |
| Architecture impact | Không — UI motion wrapper only; no BFF/API contract change |
| Verdict | **PASS with known gap** |

## Summary

Single-commit PR wraps invite **loading** and **fail-closed** (`SurfaceState`) outcomes in `div.invite-outcome` so they receive the existing `fade-rise` animation in `globals.css`, matching success (already on `section.invite-outcome`) and PD Phase 3 motion item #1 (`docs/design/ux-ui-revamp/phase-3/visual-notes.md`). No copy, authz, or route changes.

## Checks (exact SHA `ea569624af0901d31c3112674f2ccea9367a0fad`)

| Check | Command | Result |
| ----- | ------- | ------ |
| CI (REST) | `./scripts/gh-dod-evidence.sh 573` | **pass** — `head.sha` = review SHA; `mergeable=true`; `web`, `ci`, `turbo-persist`, `changes` **success**; other jobs skipped (expected web-only) |
| Diff scope | `git show ea569624… -- apps/web` | **1 file** — `invite-accept.tsx` (+16/−12); wrappers only |
| Motion / a11y (static) | CSS `.invite-outcome` + `SurfaceState` testIds unchanged | **pass** — animation via existing class; `invite-accept-loading` / `invite-accept-result` preserved inside wrapper |

Reviewer did not re-run full local `pnpm --filter @ticket/web` suite on this host; relies on green `web` CI job on exact SHA (same pattern as PR #558 DoD).

## AC / PD mapping

| Item | Assessment |
| ---- | ---------- |
| Phase 3 motion #1 (invite fade-in success / denied / network) | **PASS** — closes gap where only success had `invite-outcome`; loading + denied/network/unknown now animated |
| AC-I1–I4 (invite surface from #554 / #558 baseline) | **PASS (unchanged)** — no regression in form, copy, or token park behavior |
| O02 / PD §6.1 chrome | **N/A** — invite guest surface only; no staff/iOS nav change |

## Findings

| Severity | Item |
| -------- | ---- |
| **Known gap (carried)** | Live membership **accept E2E** with Nest/BFF stack remains **ops/env** — documented in `docs/reviews/ux-ui-p3-web-pr558-uat-gap.md`, `docs/design/ux-ui-revamp/phase-3/EPIC-TRIAGE-546.md`, and PR #573 body. Not introduced or widened by this motion-only diff. |
| nit | Wrapper `div` is presentational; live regions remain on `SurfaceState` / success `section` — acceptable. |

## Security

**N/A** — no auth, CSRF, or data-handling change in diff.

## Limitations

- Did not merge (review-only Task).
- Did not re-execute `invite-http-uat.mjs` on reviewer host; prior #558 wave evidence + unchanged accept path still govern runtime accept gap.

## Verdict rationale

**PASS with known gap:** Exact SHA matches PR tip; CI green on `web`/`ci`; diff correctly applies PD motion to loading and fail-closed invite outcomes without behavioral change. Nest accept E2E stays the pre-existing ops gap, explicitly acknowledged in epic triage and PR scope.
