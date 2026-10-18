# D11 — DoD revalidation PR #250 Web EventReport O12 Wave P2 (#249)

| Trường | Giá trị |
| --- | --- |
| Verdict | **FAIL** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_c3b142d7-2672-4027-9d05-557d6f324792` · Task `task_b8cab50f5eda` · Dispatch `ctx_02cb6ad21d52` · **≠** fix implementer `ctx_6a3739ca74bd` · **≠** original DoD FAIL `ctx_1b2fc202ef02` |
| Scope | PR [#250](https://github.com/hangndat/ticket-solution/pull/250) · Issue [#249](https://github.com/hangndat/ticket-solution/issues/249) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership **web** (`apps/web/**` only) |
| Commit SHA | `2e02c3f15808f55ad2d84feb3207522f5070b195` (exact; = PR tip / CI `headSha`) |
| Prior FAIL | [D11-PR-250-WEB-EVENTREPORT-P2-DOD.md](./D11-PR-250-WEB-EVENTREPORT-P2-DOD.md) trên `4fa09315cc81920a73bb75bec3df10d74024d489` (`react-hooks/set-state-in-effect`) |
| Architecture impact | **Không** — consume contract EventReport O12 đã merge (P1). Không cần Architect |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / tip | SHA `2e02c3f15808f55ad2d84feb3207522f5070b195` tồn tại; message `fix(web): clear EventReport by scope without setState-in-effect` |
| Diff ownership (PR) | 3 files: `apps/web/app/admin/admin-form.tsx`, `apps/web/src/admin/report.ts`, `apps/web/tests/admin-report.test.ts` — không BE/mobile/OpenAPI |
| Fix lint (blocker cũ) | Đã bỏ `useEffect` + `setReport(null)`. `reportHold` scoped `{tenantId,eventId,view}`; derived `report` chỉ hiện khi khớp scope hiện tại. Local `eslint app/admin/admin-form.tsx --max-warnings 0` → exit 0 |
| Local unit tests | Worktree @ SHA: `pnpm exec tsx --test tests/admin-report.test.ts` → **6 pass / 0 fail** |
| CI turbo (lint/typecheck/test/build) | Run [39061702429](https://github.com/hangndat/ticket-solution/actions/runs/39061702429) job `web`: turbo **7/7 successful** · unit **150 pass / 0 fail** · `eslint . --max-warnings 0` xanh (blocker setState-in-effect đã hết) |
| CI `test:routes` | **FAIL** — `assert.ok(adminHtml.includes('Tải báo cáo'))` tại `tests/routes.integration.mjs:100`; UI nút là **«Tải lại báo cáo»** (đổi từ commit feature `4fa0931`) |
| CI aggregate | job `web` FAIL → job `ci` FAIL |
| Secret scan (diff tip) | Không thấy secret / `.env` / credential thật |
| P3 / out-of-scope | Không deep-link; không auto-poll; không sửa BE |

## Đối chiếu AC #249 (revalidate)

| Yêu cầu | Evidence trên SHA | Đạt? |
| --- | --- | --- |
| Parse/render O12 fields + asOf | Không đổi so với prior; unit 6 tests + CI unit 150 pass | Có (logic) |
| Fail-closed shown/unknown/rejected | Giữ qua `interpretEventReport` + tests | Có |
| Đổi tenant/event xóa số cũ | Derived `report` null khi `reportHold` scope ≠ `tenantId`/`eventId` hiện tại; stale fetch gắn `requestScope` nên không leak số sang scope khác | Có (semantics) |
| Copy VI + watermark; refresh thủ công | «Tải lại báo cáo»; không auto-refresh | Có (UI) — nhưng **routes assertion lệch copy** |
| Layout Manager → Supervisor | Không đổi so với prior FAIL (đạt) | Có |
| Tests `admin-report.test.ts` | 6 pass local + trong CI unit | Có |
| Không P3 / không BE | Diff web-only | Có |
| CI xanh trên tip | `test:routes` đỏ → CI đỏ | **Không** |

## Findings

### Resolved (prior blocker)

1. ~~`react-hooks/set-state-in-effect` / `setReport(null)` trong `useEffect`~~ — đã sửa bằng `reportHold` + derived `report`. Lint CI xanh trên SHA này.

### Blocker (mới — lộ sau khi lint qua)

1. **`test:routes` assertion lệch copy** — `routes.integration.mjs` còn assert chuỗi `'Tải báo cáo'` trong khi admin UI render `'Tải lại báo cáo'` từ Wave P2 feature commit. CI web/CI aggregate đỏ trên exact SHA `2e02c3f…`. Cần cập nhật assertion (hoặc đồng bộ label) rồi re-run CI.

### Should-fix / Nit

- Không có thêm blocker logic O12.
- Nit prior (layout «Vé theo trạng thái» giữa Manager/Supervisor) vẫn tùy chọn.

## Limitations / revalidation

- Verdict chỉ pin SHA `2e02c3f15808f55ad2d84feb3207522f5070b195`.
- Push sửa routes/copy → **bắt buộc DoD lại** trên SHA mới.
- Reviewer **không** merge; không đăng comment GitHub từ worker session (theo Orca channel rule) — coordinator có thể đăng bản VI dưới đây.

## Draft comment VI (cho coordinator)

> **DoD revalidation FAIL** PR #250 / #249 trên SHA `2e02c3f15808f55ad2d84feb3207522f5070b195`.  
> Blocker lint cũ (`setState-in-effect`) đã hết — turbo lint/typecheck/test/build + 150 unit tests xanh.  
> CI vẫn đỏ vì `test:routes` assert `'Tải báo cáo'` trong khi UI là «Tải lại báo cáo». Artifact: `docs/reviews/D11-PR-250-WEB-EVENTREPORT-P2-DOD-REVAL.md`. Không merge.

## Verdict

**FAIL** — fix reportHold đạt AC fail-closed + lint xanh, nhưng **CI web chưa xanh** trên exact SHA do `test:routes` copy mismatch.
