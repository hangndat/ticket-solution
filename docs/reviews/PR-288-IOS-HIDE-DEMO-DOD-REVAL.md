# DoD revalidation — PR #288 (iOS hide W0 demo catalog / TestFlight build 10)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_afa8027f-fb11-47a9-b2c0-ad3ba43e527c` · task `task_13500cd46875` · dispatch `ctx_994aec917909` · run `run_3403caf1f2b4` — **≠** fix implementer `ctx_75d9ad79de93` và **≠** original iOS implementer |
| Scope | PR [#288](https://github.com/hangndat/ticket-solution/pull/288) · ownership `apps/mobile` only · paths: `src/screens/events.tsx`, `src/identity/config.ts`, `src/identity/config.test.ts`, `app.config.ts`, `README.md` |
| Commit SHA (review) | **`f273789bcfd74f787d32f849db3bb1c37f085b82`** (`gh pr view 288` → `headRefOid`; `git rev-parse` on checked-out tip) |
| Prior verdict (không kế thừa) | Tip `b6ae575aa9623a7cec36219089fe1aa0fd47b877` → **FAIL** (TS2322 `ListFooterComponent` `null`) — **SHA khác** → revalidation bắt buộc |
| Architecture impact | Không (consumer ADR-19 FlatList SoT; gate ẩn footer demo khi production APS) |
| Verdict | **PASS** |

## Checks (trên exact tip SHA)

| Check | Kết quả | Evidence |
| --- | --- | --- |
| Tip SHA resolve | **PASS** | `gh pr view 288 --json headRefOid` → `f273789bcfd74f787d32f849db3bb1c37f085b82`; commits: `b6ae575…` (gate) + `f273789…` (`undefined` fix) |
| Diff ownership | **PASS** | 5 files under `apps/mobile/` only vs `main` |
| Prior FAIL root cause | **PASS (fixed)** | `b6ae575…`: `ListFooterComponent={ showDemo ? (…) : null }` → TS2322; tip: `) : undefined` |
| CI mobile / typecheck | **PASS** | Actions [39099348714](https://github.com/hangndat/ticket-solution/actions/runs/39099348714) · `headSha=f273789…` · job **`mobile` SUCCESS** (typecheck **cache miss** `e0ffedf7f7a3fa58` → `tsc --noEmit` green) · aggregate **`ci` SUCCESS** |
| Unit gate test | **PASS** | CI log: `✔ production APS bake hides demo event catalog (no demo-mfest on TF home)` · Tasks `7 successful, 7 total` |
| Local `tsc` in reviewer worktree | **N/A (env)** | No `node_modules` in this worktree — không dùng local tsc làm gate; tin CI typecheck trên exact SHA |
| Independence | **PASS** | Dispatch `ctx_994aec917909` ≠ fix `ctx_75d9ad79de93` / original iOS implementer |
| Merge | **Không** | Reviewer không merge |

## Checklist vs AC (task reval)

| # | Tiêu chí | Kết quả | Notes |
| --- | --- | --- | --- |
| 1 | Typecheck / CI mobile green on new SHA | **PASS** | Run `39099348714` · mobile + ci SUCCESS trên `f273789…` |
| 2 | `showDemoEventCatalog` gate + ADR-19 FlatList | **PASS** | `showDemoEventCatalog()` = `getApsEnvironment() !== 'production'`; Events home vẫn `FlatList` với `data={listData}` từ published khi `ready`; demo chỉ footer khi `showDemo`; không đưa fixture vào SoT / không API fallback |
| 3 | Artifact + exact SHA + verdict | **PASS** | File này |
| 4 | Không merge | **PASS** | Không merge từ session này |

## Gate + ADR-19 (source)

- `showDemoEventCatalog()` / `getApsEnvironment()` in `apps/mobile/src/identity/config.ts` — production APS → hide W0 demo footer; local/dev vẫn hiện.
- Test covers env bake: development → `true`, `EXPO_PUBLIC_APS_ENVIRONMENT=production` → `false`.
- `EventsScreen`: `listData` vẫn published-only; `demoEvents` empty when gated; `ListFooterComponent` omitted via `undefined` when `!showDemo`.
- Build number `10` + README note for TestFlight production bake — docs aligned with gate.

## Findings

| Mức | Finding |
| --- | --- |
| — | Không blocker / should-fix trên tip `f273789…`. |
| Nit | Local reviewer worktree thiếu deps — evidence typecheck lấy từ CI cache-miss execute trên exact SHA (đủ cho DoD). |

## Verdict

**PASS** trên exact SHA `f273789bcfd74f787d32f849db3bb1c37f085b82` (revalidation; **không** kế thừa FAIL của `b6ae575…`).

Coordinator có thể tiến hành merge/integration theo ủy quyền riêng — **không merge** từ session reviewer này.
