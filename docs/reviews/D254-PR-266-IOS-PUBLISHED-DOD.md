# DoD review — PR #266 / Issue #257 (iOS Events published-first / ADR-19)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_362f5d46-5abf-4495-bf5b-85d276dcefa5` · task `task_4263c14bd627` · dispatch `ctx_16626a691204` · run `run_39e3bc589df3` — **≠** implementer `ctx_0ff4bd7f675f` |
| Scope | Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) · Issue [#257](https://github.com/hangndat/ticket-solution/issues/257) · PR [#266](https://github.com/hangndat/ticket-solution/pull/266) · ownership `apps/mobile` only |
| Commit SHA | **`8442d4c9cea569c4ad3d4014314ae91924b3020e`** (worktree `git rev-parse HEAD` == PR tip == CI `headSha`) |
| Architecture | Consumer [ADR-19](../ops/ADR-19-EVENT-SERVER-SOURCE.md) + [event-server-source.md](../architecture/event-server-source.md); BE SoT đã PASS tại [D254-PR-261-BE-PUBLIC-EVENTS-DOD.md](./D254-PR-261-BE-PUBLIC-EVENTS-DOD.md) |
| Verdict | **PASS with known gap** |

## Checks (trên exact SHA)

| Check | Kết quả | Evidence |
| --- | --- | --- |
| Worktree SHA | **PASS** | `git rev-parse HEAD` → `8442d4c9cea569c4ad3d4014314ae91924b3020e` |
| Diff ownership | **PASS** | 8 files, toàn bộ dưới `apps/mobile/` (không trộn BE/web) |
| Unit tests | **PASS** | `pnpm --filter @ticket/mobile test` → **201 pass / 0 fail** (gồm `events-home-source.test.ts`: FlatList source `published\|none`, never demo) |
| CI tip | **PASS** | Actions run [39090925827](https://github.com/hangndat/ticket-solution/actions/runs/39090925827) · `headSha` = `8442d4c…` · `mobile` SUCCESS · aggregate `ci` SUCCESS |
| Typecheck / lint (local) | **GAP (env)** | Reviewer worktree thiếu đủ `node_modules`/Expo types → `tsc` fail local; **tin CI mobile SUCCESS** trên cùng SHA |
| Headless sim UAT | **GAP** | Không re-run `scripts/sim-uat.sh` trên tip; PR ghi sim binary predates JS — AC #257 đủ bằng source + unit + CI |
| EAS Cloud / Team | **PASS** | Không có EAS Cloud; scope mobile JS only; Team personal không đổi trong diff |
| Independence | **PASS** | Dispatch `ctx_16626a691204` ≠ implementer `ctx_0ff4bd7f675f` |

## Checklist vs AC (#257 / ADR-19 consumer)

| # | Tiêu chí | Kết quả | Notes |
| --- | --- | --- | --- |
| 1 | Events home ưu tiên `fetchPublishedEventList` làm FlatList chính | **PASS** | `events.tsx`: `listData` chỉ từ `eventsHomeListSource(published.length)` → `published` hoặc `[]`; never `listDemoEvents` vào `data` |
| 2 | Fail-closed khi lỗi / empty / misconfig — **không** silent demo fallback | **PASS** | On non-ok: `setPublished([])` + `error`/`misconfigured` UI; copy «không dùng demo thay thế»; brand chrome chỉ từ published sẵn sàng |
| 3 | Detail mặc định published | **PASS** | `[tenantSlug]/[slug].tsx` mặc định `fixture=false`; chỉ `?fixture=true\|1` mới DEMO |
| 4 | Fixture chỉ route / nhãn DEMO tường minh | **PASS** | Footer «DEMO · catalog mẫu»; links `/events/fixture/[eventId]`; `FixtureDemoDetail` + Notice «Demo · chưa xuất bản» |
| 5 | ADR-19: client fixture không SoT / không fallback published path | **PASS** | Khớp quyết định ADR §2–4 + architecture §3–4 (iOS published đúng hướng; fixture giữ dưới label/route) |
| 6 | Contract consumer Nest public | **PASS** | Tiếp tục `fetchPublishedEventList` / `fetchPublishedEventDetail` → `/v1/public/tenants/…`; không fork schema fixture làm SoT |
| 7 | Không lộ draft qua silent fallback | **PASS** | Published 404 → EmptyState «bản nháp không hiện»; không suy ra fixture từ API failure |
| 8 | Tests policy + package script | **PASS** | `events-home-source.ts` + `src/screens/*.test.ts` trong `package.json` test glob |

## Architecture impact (Có — consumer ADR-19)

Đối chiếu handoff:

- **SoT** = PG published projection (BE #255 / PR #261) — iOS không đưa demo vào FlatList chính.
- **Failure mode** = empty/error UI, không substitute fixture — khớp ADR-19 Fail-closed + architecture §4.
- **Fixture** còn dưới nhãn/route DEMO tường minh — đúng non-goal “giữ tạm rồi gỡ”, không design drift cần Architect riêng.
- Không phát hiện lộ draft/internal qua path published; security gate riêng không bắt buộc thêm cho slice này (không token/Keychain mới).

## Findings

| Mức | Finding |
| --- | --- |
| — | Không blocker / should-fix trước merge. |
| Nit | `mustFailClosedWithoutDemo` chỉ dùng trong unit test; fail-closed thực tế inline trong `events.tsx` (đủ đúng; helper là policy doc). |
| Nit | Footer DEMO vẫn render khi published error/empty — **có chủ đích** (nhãn tường minh), không thay `data` FlatList. |

## Known gaps (không nuốt AC)

1. **Headless sim UAT** chưa chạy trên tip SHA — ngoài AC bắt buộc #257; milestone Epic vẫn cần gate (a) riêng.
2. **Local typecheck/lint** reviewer thiếu deps — dựa CI `mobile` SUCCESS trên exact SHA.
3. **Prod `api.vemoki.com` public path** có thể 404 đến khi deploy BE — client fail-closed đúng ADR-19; ngoài ownership iOS.

## Verdict

**PASS with known gap** trên exact SHA `8442d4c9cea569c4ad3d4014314ae91924b3020e`.

Coordinator có thể merge PR #266 sau khi chấp nhận gap sim UAT / local tsc env (AC hành vi + CI đủ). Revalidate nếu tip có commit **hành vi** mới sau SHA này; commit docs evidence-only không cần re-run behavior review.

**Không merge** từ session reviewer này.
