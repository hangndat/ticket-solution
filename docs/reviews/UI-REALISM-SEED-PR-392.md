# UI realism seed — DoD review PR #392

| Field | Value |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` · Orca worker `term_c6cbbd7c-a117-4329-8cf4-82cf1035acaa` · task `task_6836184e5cb8` · dispatch `ctx_776f7bb58e98` (≠ implementer) |
| Scope | PR [#392](https://github.com/hangndat/ticket-solution/pull/392) · branch `hangndat/ui-realism-seed` · ownership `packages/backend` demo-seed realism + force republish marketing |
| Paths | `packages/backend/src/demo-seed.ts` · `packages/backend/scripts/demo-seed.cjs` · `packages/backend/test/demo-seed-unit.test.cjs` · `packages/backend/test/demo-seed-rebrand.test.cjs` · `packages/backend/test/published-events.test.cjs` · `scripts/d9-demo-seed.sh` · `docs/demo/D9-DEMO-DATASET.md` |
| Commit SHA | `92831a1aee761d9725ca306b0aef4da8387b9609` |
| Architecture impact | Không — seed copy + republish flag only; no contract/API surface change |
| Date | 2026-10-18 |

## Checks (exact SHA)

| Check | Result |
| --- | --- |
| `git rev-parse` / PR tip | `92831a1aee761d9725ca306b0aef4da8387b9609` |
| Diff scope (commit files) | 7 files — backend seed + tests + docs/ops script; **no** `apps/web` / `apps/mobile` |
| CI run [39129617246](https://github.com/hangndat/ticket-solution/actions/runs/39129617246) on tip | `backend` SUCCESS · `database-isolation (published-events)` SUCCESS · other DB isolation SUCCESS · `changes` / `ci` / `turbo-persist` SUCCESS · web/mobile SKIPPED (path filter) |
| Local unit re-run | Not executed here — worktree thiếu `node_modules`; unit/DB coverage taken from CI on same SHA |

## Acceptance checklist

| Gate | Verdict | Evidence |
| --- | --- | --- |
| Chỉ `event.name` có `· Demo` | PASS | `D9_DEMO.tenants.*.name` = `MFest` / `Studio Organization` (no marker); `events.mfest.name` / `studioNight.name` = `` `… ${DEMO_MARKER}` ``; unit asserts org without `/· Demo/`, events with |
| Venue / FAQ / terms production-like | PASS | Venues: real HCMC place names, no `(fixture)`; FAQ door/redeem copy without fixture language; terms `terms-v1` + house-rules prose; DB test asserts FAQ/terms not matching `/fixture\|not a real/`; sources `VIP Pass` / `General Admission` |
| Force republish marketing path | PASS | `forceRepublishMarketing` → `ensurePublishedMarketingConfig.forceRepublish`; CLI `D9_DEMO_FORCE_MARKETING=1\|true` in `demo-seed.cjs` + export in `d9-demo-seed.sh`; `published-events` test: default re-seed skips, force bumps `publishedConfigVersion` |
| No web edits | PASS | `git show --name-only 92831a1…` — no `apps/web` / `apps/mobile` |
| Tests pass | PASS | CI backend + `published-events` (force republish) + rebrand-related unit asserts in package tests on exact SHA |

## Findings

### Blocker
Không.

### Should-fix / nit
- `published_brand_snapshot` vẫn gắn `fixture: true` (internal brand JSON). Không vi phạm AC «chỉ event.name · Demo» / venue-FAQ-terms; ghi nhận nếu UI nào đó surface raw brand snapshot.

### Limitations
- Không chạy lại DB isolation local (Docker) trong session reviewer — dựa CI xanh trên exact SHA.
- Ops re-seed thật trên DB đã seed (`D9_DEMO_FORCE_MARKETING=1 ./scripts/d9-demo-seed.sh`) không chạy trong PR/reviewer (đúng PR test plan unchecked); path đã cover bằng unit wiring + `published-events` force assert.
- Reviewer **không merge** (constraint Task).

## Verdict

**PASS**

DoD đủ cho PR #392 tại exact SHA `92831a1aee761d9725ca306b0aef4da8387b9609`. Integration/merge thuộc coordinator sau khi nhận artifact này.
