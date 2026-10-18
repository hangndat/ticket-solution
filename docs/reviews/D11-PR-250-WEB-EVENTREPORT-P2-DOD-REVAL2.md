# D11 — DoD revalidation lần 2 — PR #250 tip routes fix (#249)

| Trường | Giá trị |
| --- | --- |
| Verdict | **FAIL** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_2640799e-e2b0-4bec-a9a1-e18b7f5483e0` · Task `task_a7ccc6ef2835` · Dispatch `ctx_41145c78fde8` · **≠** fix workers `ctx_6a3739ca74bd` / `ctx_e2aa304b8883` · **≠** prior DoD FAIL `ctx_1b2fc202ef02` / reval1 `ctx_02cb6ad21d52` |
| Scope | PR [#250](https://github.com/hangndat/ticket-solution/pull/250) · Issue [#249](https://github.com/hangndat/ticket-solution/issues/249) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership **web** (`apps/web/**` only) |
| Commit SHA | `06b568553191f606e543c3582fecbb898758d89c` (exact; = PR tip / CI `headSha`) |
| Prior FAIL | [D11-PR-250-WEB-EVENTREPORT-P2-DOD-REVAL.md](./D11-PR-250-WEB-EVENTREPORT-P2-DOD-REVAL.md) trên `2e02c3f15808f55ad2d84feb3207522f5070b195` (`test:routes` assert `'Tải báo cáo'` lệch UI «Tải lại báo cáo») |
| Architecture impact | **Không** — consume contract EventReport O12 đã merge (P1). Không cần Architect |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / tip | SHA `06b568553191f606e543c3582fecbb898758d89c` tồn tại; message `fix(web): align routes test with EventReport reload copy` |
| Diff ownership (vs main) | 4 files web-only: `admin-form.tsx`, `report.ts`, `admin-report.test.ts`, `routes.integration.mjs` — không BE/mobile/OpenAPI |
| Delta vs reval1 SHA | Chỉ `apps/web/tests/routes.integration.mjs` (+1/−1): assert → `'Tải lại báo cáo'` |
| reportHold / no setState-in-effect | Giữ pattern reval1: scoped `reportHold` + derived `report`; không `setReport(null)` trong `useEffect`. Local `eslint app/admin/admin-form.tsx src/admin/report.ts --max-warnings 0` → exit 0 |
| Routes assert «Tải lại báo cáo» | Source: `routes.integration.mjs:100` `assert.ok(adminHtml.includes('Tải lại báo cáo'))`; UI nút cùng copy. **CI chưa chứng minh** — bước `test:routes` **SKIPPED** vì turbo fail trước |
| Local unit O12 | Worktree @ SHA: `pnpm exec tsx --test tests/admin-report.test.ts` → **6 pass / 0 fail** |
| CI turbo (lint/typecheck/test/build) | Run [39063330340](https://github.com/hangndat/ticket-solution/actions/runs/39063330340) job `web` step turbo **FAIL** trong ~2s: `@ticket/web#typecheck` → `next typegen` **ENOENT** `.next/types/routes.d.ts`. Lint/test/build bị cascade (eslint exit non-zero / tests cancelled «Promise resolution is still pending») — **không** phải regression copy routes |
| CI `test:routes` | **SKIPPED** (step 5) — không chạy trên exact SHA |
| CI aggregate | job `web` FAIL → job `ci` FAIL |
| Secret scan (diff tip) | Không thấy secret / `.env` / credential thật |
| P3 / out-of-scope | Không deep-link; không auto-poll; không sửa BE |

## Đối chiếu AC #249 (revalidate lần 2)

| Yêu cầu | Evidence trên SHA | Đạt? |
| --- | --- | --- |
| Parse/render O12 fields + asOf | Không đổi so với reval1; unit 6 tests local pass | Có (logic) |
| Fail-closed shown/unknown/rejected | `interpretEventReport` + tests; derived `report` null khi scope lệch | Có |
| Đổi tenant/event xóa số cũ | `reportHold` scope gate (không setState-in-effect) | Có (semantics + lint local) |
| Copy VI + watermark; refresh thủ công | «Tải lại báo cáo»; assertion routes đã khớp source | Có (source) — **thiếu evidence CI `test:routes`** |
| Layout Manager → Supervisor | Không đổi so với prior (đạt) | Có |
| Tests `admin-report.test.ts` | 6 pass local | Có |
| Không P3 / không BE | Diff web-only | Có |
| CI xanh trên tip | Turbo typecheck ENOENT → web/ci đỏ; `test:routes` skipped | **Không** |

## Findings

### Resolved (prior blockers)

1. ~~`react-hooks/set-state-in-effect`~~ — vẫn đã hết từ `2e02c3f` (reportHold); lint local xanh trên tip.
2. ~~`test:routes` assert `'Tải báo cáo'`~~ — tip `06b5685` đã đổi assertion sang `'Tải lại báo cáo'` khớp UI.

### Blocker (CI gate trên exact SHA)

1. **CI web/ci đỏ trên `06b5685`** — Run `39063330340`: `@ticket/web#typecheck` fail (`next typegen` ENOENT `.next/types/routes.d.ts`). Bước `pnpm --filter @ticket/web test:routes` bị skip → **không** có chứng nhận CI xanh cho copy fix. Cần CI xanh (re-run hoặc fix typegen/cache) rồi DoD lại trên SHA tip (cùng SHA nếu chỉ re-run thành công; SHA mới nếu có commit hành vi).

### Should-fix / Nit

- Không có blocker logic O12 mới trên source tip.
- Nit layout «Vé theo trạng thái» giữa Manager/Supervisor vẫn tùy chọn.

## Limitations / revalidation

- Verdict chỉ pin SHA `06b568553191f606e543c3582fecbb898758d89c`.
- Re-run CI xanh trên **cùng** SHA có thể đủ để revalidate lần 3 mà không cần commit mới; commit hành vi mới → bắt buộc DoD lại.
- Reviewer **không** merge; không đăng comment GitHub từ worker session (Orca channel rule) — draft VI dưới đây cho coordinator.

## Draft comment VI (cho coordinator)

> **DoD revalidation lần 2 FAIL** PR #250 / #249 trên SHA `06b568553191f606e543c3582fecbb898758d89c`.  
> Blocker routes copy đã sửa trong source (`assert` «Tải lại báo cáo»); reportHold/lint setState-in-effect vẫn đạt (eslint local exit 0; unit O12 6/6).  
> CI vẫn đỏ: turbo `@ticket/web#typecheck` ENOENT `.next/types/routes.d.ts` → `test:routes` skip; job web + ci FAIL (run 39063330340). Artifact: `docs/reviews/D11-PR-250-WEB-EVENTREPORT-P2-DOD-REVAL2.md`. Không merge.

## Verdict

**FAIL** — tip đã khớp assertion «Tải lại báo cáo» và giữ fail-closed reportHold, nhưng **CI web (+ci) chưa xanh** trên exact SHA (typecheck infra; `test:routes` chưa chạy trên CI).
