# DoD revalidation — PR #267 squash / Issue #257 (iOS Events published-first / ADR-19)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Orca worker Cursor · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · terminal `term_8d80af56-0a67-4fc4-8819-9aa507606fdb` · task `task_6d6900537ddb` · dispatch `ctx_b8cad6de23f8` · run `run_39e3bc589df3` — **≠** implementer (PR #267 / prior `ctx_0ff4bd7f675f`) |
| Scope | Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) · Issue [#257](https://github.com/hangndat/ticket-solution/issues/257) · PR [#267](https://github.com/hangndat/ticket-solution/pull/267) (squash vào `main`) · ownership `apps/mobile` only |
| Commit SHA (review) | **`1c106c5eaa32b42e2c8100690f12112fce9a97f9`** (merge commit trên `main`) |
| PR head (blob twin) | `1506daaaf79d0b6d077620de5e00d44c24ce8773` — **mobile blobs identical** to merge (`git rev-parse` blob equality cho `events.tsx`, `event-detail.tsx`, `events-home.ts`, `types.ts`, routes, `package.json`) |
| Prior verdict (không kế thừa) | PR #266 tip `8442d4c9cea569c4ad3d4014314ae91924b3020e` → [D254-PR-266-IOS-PUBLISHED-DOD.md](./D254-PR-266-IOS-PUBLISHED-DOD.md) PASS w/ gap — **SHA/tree khác** (refactor `events-home-source` → `published/events-home`, contracts re-export) → revalidation bắt buộc |
| Architecture | Consumer [ADR-19](../ops/ADR-19-EVENT-SERVER-SOURCE.md) + BA AC1–4/7 ([EVENT-SERVER-SOURCE-BA.md](../plans/EVENT-SERVER-SOURCE-BA.md) §7) |
| Verdict | **PASS with known gap** |

## Checks (trên exact merge SHA / blob twin)

| Check | Kết quả | Evidence |
| --- | --- | --- |
| Merge SHA resolve | **PASS** | `git rev-parse` → `1c106c5eaa32b42e2c8100690f12112fce9a97f9` · parent `77b4655…` · message `feat(mobile): Events home published-first (ADR-19 / #257) (#267)` |
| Diff ownership | **PASS** | 8 files under `apps/mobile/` only (squash vs parent): `published/events-home*`, `published/types*`, `screens/events.tsx`, `screens/event-detail.tsx`, `components/screen-state-copy*` |
| Blob twin vs PR head | **PASS** | Mobile paths tại `1506daaa…` == `1c106c5…` (SAME blobs) |
| Unit tests | **PASS** | `pnpm --filter @ticket/mobile test` trên worktree chứa merge → **207 pass / 0 fail** (gồm `published/events-home.test.ts`, `published/types.test.ts`) |
| CI PR head | **PASS** | Actions [39091027606](https://github.com/hangndat/ticket-solution/actions/runs/39091027606) · `head_sha=1506daaa…` · `mobile` SUCCESS · aggregate `ci` SUCCESS |
| CI merge SHA | **PASS (job) / GAP (aggregate)** | Run [39091471044](https://github.com/hangndat/ticket-solution/actions/runs/39091471044) · `head_sha=1c106c5…` · job **`mobile` SUCCESS** (và hầu hết jobs SUCCESS) nhưng workflow **conclusion=`cancelled`** (superseded bởi push docs `187b168…`) |
| CI follow-up main | **PASS** | [39091562969](https://github.com/hangndat/ticket-solution/actions/runs/39091562969) · `187b168…` (docs DoD #266; **không** đổi `apps/mobile/`) · `mobile` + `ci` SUCCESS |
| Headless sim UAT | **GAP** | Không re-run `scripts/sim-uat.sh` trên merge SHA — ngoài AC bắt buộc #257; Epic milestone gate (a) vẫn riêng |
| EAS Cloud | **PASS** | Không có EAS Cloud trong diff; JS-only mobile |
| Independence | **PASS** | Dispatch `ctx_b8cad6de23f8` ≠ implementer |

## Checklist vs AC (#257 / ADR-19 / BA)

| # | Tiêu chí | Kết quả | Notes |
| --- | --- | --- | --- |
| 1 | Events home ưu tiên `fetchPublishedEventList` làm FlatList SoT | **PASS** | `listData = publishedPhase === 'ready' ? published : []` — never `listDemoEvents` vào `data` |
| 2 | Fail-closed lỗi / empty / misconfig — không silent demo fallback | **PASS** | `publishedListStateFromResult` clears items + `PUBLISHED_LIST_FAIL_CLOSED_MESSAGE`; UI ErrorState / EmptyState; brand chrome chỉ khi `ready` + có row |
| 3 | Detail mặc định published | **PASS** | `[tenantSlug]/[slug].tsx` không truyền `fixture`; `EventDetailScreen` default `fixture=false` → `PublishedEventDetailView` |
| 4 | Fixture chỉ route / nhãn DEMO tường minh | **PASS** | Footer «Demo · dữ liệu mẫu»; links `/events/fixture/[eventId]`; fixture route luôn `fixture`; Notice «Demo · fixture · chưa xuất bản» |
| 5 | ADR-19: fixture không SoT / không fallback published path | **PASS** | Khớp ADR §2–4 Fail-closed |
| 6 | Contract consumer `@ticket/contracts` | **PASS** | `types.ts` re-export `PublishedEvent*` từ `@ticket/contracts`; local `PUBLISHED_SECTION_KINDS` synced (`hero/info/redeem/guide/faq/terms`) + tests đọc `packages/contracts/src/config.ts` |
| 7 | Không lộ draft qua silent fallback | **PASS** | Published 404 → EmptyState nháp không hiện; không suy fixture từ API failure |
| 8 | Tests trong package script | **PASS** | `src/published/*.test.ts` trong `apps/mobile` `test` script |

## Architecture impact (Có — consumer ADR-19)

- SoT FlatList = published projection; fixture demoted to labeled footer/route — không design drift cần Architect riêng.
- Failure mode fail-closed khớp ADR-19 + BA AC3/AC4/AC7.
- Không token/Keychain mới → không bắt buộc `reviewer-security` thêm cho slice này.

## Findings

| Mức | Finding |
| --- | --- |
| — | Không blocker / should-fix. Code landed trên `main` đã khớp AC. |
| Nit | Hero copy «Đổi mã để nhận vé» thay câu fail-closed cũ trên header — fail-closed vẫn đủ ở ErrorState / footer Demo. |
| Nit | Aggregate CI `cancelled` trên `1c106c5` dù job `mobile` đã SUCCESS — tin job + twin PR head + follow-up `187b168`. |

## Known gaps (không nuốt AC)

1. **Headless sim UAT** chưa chạy trên merge SHA — ngoài AC #257; Epic gate (a) riêng.
2. **Workflow aggregate** trên `1c106c5` marked `cancelled` (concurrency) — job `mobile` SUCCESS; follow-up main CI xanh không đụng mobile blobs.
3. **Prod public path** có thể 404 tới khi BE deploy — client fail-closed đúng; ngoài ownership iOS.

## Verdict

**PASS with known gap** trên exact SHA `1c106c5eaa32b42e2c8100690f12112fce9a97f9` (revalidation; **không** kế thừa PASS của `8442d4c…`).

Đã trên `main` qua PR #267 — **không merge** từ session này. Coordinator có thể đóng DoD Task #257 khi chấp nhận gap sim UAT / aggregate-cancelled (job mobile đã xanh).

**Không merge** từ session reviewer này.
