# DoD review — PR #288 (iOS hide W0 demo catalog on TestFlight)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_6a51c5a8-2c68-4bb8-bfde-ccbb21dace74` · task `task_8496dd25505d` · dispatch `ctx_f087117731c4` · run `run_3403caf1f2b4` — **≠** implementer `ctx_44bed90ad5a8` |
| Scope | PR [#288](https://github.com/hangndat/ticket-solution/pull/288) · ownership `apps/mobile` (identity config + `events.tsx` + `app.config` + README) |
| Commit SHA | **`b6ae575aa9623a7cec36219089fe1aa0fd47b877`** (`git rev-parse HEAD` == PR tip) |
| Architecture impact | Không (consumer gate UI; ADR-19 FlatList SoT không đổi) |
| Verdict | **FAIL** |

## Checks (trên exact SHA)

| Check | Kết quả | Evidence |
| --- | --- | --- |
| Worktree SHA | **PASS** | `git rev-parse HEAD` → `b6ae575aa9623a7cec36219089fe1aa0fd47b877` |
| Diff ownership | **PASS** | 5 files, toàn bộ dưới `apps/mobile/` |
| Identity + events-home unit | **PASS** | `node --experimental-strip-types --test src/identity/config.test.ts src/published/events-home.test.ts` → **15 pass / 0 fail** (gồm `production APS bake hides demo event catalog`) |
| CI tip `mobile` | **FAIL** | Actions run [39099153837](https://github.com/hangndat/ticket-solution/actions/runs/39099153837) · `headSha` = `b6ae575a…` · `@ticket/mobile#typecheck` exit 2 |
| Typecheck root cause | **FAIL** | `apps/mobile/src/screens/events.tsx(264,7): error TS2322: Type 'Element \| null' is not assignable to type 'Element \| ComponentType<any> \| undefined'` (`ListFooterComponent={ showDemo ? (…) : null }`) |
| Headless sim UAT | **GAP** | Không re-run `scripts/sim-uat.sh` trên tip; AC gate bằng source + unit (sim không bắt buộc cho verdict này khi typecheck đã FAIL) |
| Independence | **PASS** | Dispatch `ctx_f087117731c4` ≠ implementer `ctx_44bed90ad5a8` |
| Merge | **N/A** | Reviewer **không merge** |

## Checklist vs AC (task DoD)

| # | Tiêu chí | Kết quả | Notes |
| --- | --- | --- | --- |
| 1 | `showDemoEventCatalog()` false khi APS production; demo không hiện trên TF home | **PASS (source)** | `showDemoEventCatalog()` = `getApsEnvironment() !== 'production'`; production bake sets `EXPO_PUBLIC_APS_ENVIRONMENT` + `extra.ticketPublic.apsEnvironment`; `EventsScreen` gates `listDemoEvents` + `ListFooterComponent` behind `showDemo` |
| 2 | ADR-19 published FlatList SoT còn nguyên — không regress events-home | **PASS** | `listData` vẫn chỉ `published` khi `ready`, else `[]`; never `listDemoEvents` vào FlatList `data`; brand chrome vẫn chỉ từ published ready; fail-closed copy giữ nguyên |
| 3 | `buildNumber` 10; tests identity ổn | **PARTIAL** | `app.config.ts` `ios.buildNumber: '10'`; identity tests PASS local; **CI typecheck FAIL** trên cùng tip → không đủ “ổn” cho merge |
| 4 | Artifact + exact SHA + verdict | **PASS** | File này |
| 5 | Không merge | **PASS** | Không merge từ session reviewer |

## Findings

| Mức | Finding |
| --- | --- |
| **Blocker** | `ListFooterComponent` dùng `: null` → TS2322 trên tip; CI `mobile` đỏ. Fix: dùng `undefined` (hoặc omit footer) thay vì `null`, rồi revalidate CI trên SHA mới. |
| — | Hành vi gate demo / ADR-19 SoT nhìn đúng; không regress published FlatList `data`. |
| Nit | Unit test chỉ assert env `EXPO_PUBLIC_APS_ENVIRONMENT=production`; không mock `expo-constants` extra path — đủ cho Metro-inline bake; runtime `ticketPublic.apsEnvironment` vẫn được `getApsEnvironment` đọc. |

## Known gaps

1. **CI typecheck đỏ** — blocker merge / Hoàn thành (không phải known-gap chấp nhận được).
2. **Headless sim UAT** chưa chạy trên tip — ngoài AC bắt buộc khi typecheck đã FAIL; sau fix cần CI xanh trước khi xét gap sim.

## Verdict

**FAIL** trên exact SHA `b6ae575aa9623a7cec36219089fe1aa0fd47b877`.

Coordinator: giữ PR `Chờ duyệt` hoặc trả `Đang làm`; giao fix-worker sửa `ListFooterComponent` null→undefined (hoặc tương đương type-safe); **revalidate DoD trên SHA mới** sau CI `mobile` xanh. **Không merge** tip hiện tại.
