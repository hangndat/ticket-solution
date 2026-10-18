# DoD — PR #379 / Issue #370 (O02 iOS ẩn tab Nhân viên)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | `reviewer-dod` · Orca Dispatch `ctx_4b66e80b92be` · terminal `term_5bff9823-1c51-4b37-832d-89be7050282e` · task `task_70063da90686` · **≠** implementer `ctx_7fcd7cdee1bf` |
| Scope | Issue [#370](https://github.com/hangndat/ticket-solution/issues/370) · PR [#379](https://github.com/hangndat/ticket-solution/pull/379) · ownership `apps/mobile` (+ UAT doc + stub) · Epic #293 · PD D11 §6.1 / GAP-O02-NAV |
| Commit SHA | `403fce62176827bcda690fa3b76a95f5a89ff359` (exact tip `gh pr view 379` / `headRefOid`) |
| Architecture impact | Có — consume MeEvents `staffEligible` (BE #369 / contract handoff); không đổi BE contract trong PR này |
| Verdict | **PASS** |
| Merge | DoD pass — coordinator quyết định merge khi CI vẫn xanh trên tip |

## Checks trên SHA

| Check | Kết quả |
| --- | --- |
| Tip PR #379 | `403fce62176827bcda690fa3b76a95f5a89ff359` — khớp task |
| CI GitHub (`CI` run `39120278683`) | **success** trên tip — `ci` / `mobile` / `changes` / `turbo-persist` pass; BE/web slices skip (đúng ownership) |
| `node --test` staff-eligibility + fetch-me-events + installed-app-link (worktree tip) | **15 pass** / 0 fail |
| Ownership diff vs merge-base `origin/main` | Chỉ `apps/mobile/**` + `docs/reviews/O02-IOS-370-UAT.md` + `scripts/o02-me-events-stub.mjs` — **OK** |
| EAS Cloud | Không có trong diff; UAT ghi local Release Team `BLUA62D52G` — **OK** |
| Secrets / prod UAT bake | `EXPO_PUBLIC_ALLOW_UAT_SESSION` documented empty-by-default trong `.env.example`; gate `__DEV__` \|\| env=1 — **OK** |

## Checklist O02 / PD §6.1 / Issue #370 AC

| AC | Kết luận |
| --- | --- |
| Guest / chưa login → tab **Nhân viên** không hiện | **Met** — `showStaff = staffEligible === true`; unsigned → `staffEligibility.reset()` fail-closed; NativeTabs `hidden={!showStaff}` |
| Không `staffEligible` (attendee) → tab ẩn | **Met** (code + unit + UAT persona attendee) |
| Có quyền Gate / `staffEligible: true` → tab hiện | **Met** (code + unit + UAT staff → Gate shell) |
| Prefer **ẩn** (không chỉ disable) | **Met** — `hidden` trên `NativeTabs.Trigger`; PD §6.1 «ẩn/disabled» chọn nhánh ẩn theo AC Issue |
| Deep-link staff khi không quyền → deny VI fail-closed | **Met** — `vemoki://staff` → `/staff-access`; copy `staffDenyCopy` VI + «Về Sự kiện»; tab route cũng Redirect fail-closed |
| `sim-uat` dual persona + evidence | **Met** — `docs/reviews/O02-IOS-370-UAT.md` (guest / staff / attendee / deny); artifacts path gitignored |
| Không EAS Cloud / không đổi BE contract | **Met** |
| Exact-SHA DoD reviewer độc lập | **Met** (artifact này) |

## Findings

### Blocker

Không.

### Should-fix / known limits (không hạ PASS theo AC #370)

1. **UAT screenshots** nằm `apps/mobile/.uat-artifacts/o02-ios-370/` (gitignored) — không có trong worktree reviewer; nghiệm thu dựa trên UAT doc + code/unit/CI. Re-run sim-uat nếu cần pixel audit sau merge.
2. **MeEvents stub** (`scripts/o02-me-events-stub.mjs`) + `EXPO_PUBLIC_ALLOW_UAT_SESSION=1` chỉ cho local evidence — không bake prod (đã ghi PR/UAT).
3. **Local xcodebuild** được nêu trong UAT (Team `BLUA62D52G`) nhưng không đính kèm log `BUILD SUCCEEDED` trong artifact — Issue #370 AC nhấn sim-uat + SHA DoD + không EAS; không coi thiếu log là blocker cho verdict này.

## Revalidation

Commit hành vi mới sau tip → bắt buộc DoD lại trên SHA mới; **không** kế thừa PASS này.
