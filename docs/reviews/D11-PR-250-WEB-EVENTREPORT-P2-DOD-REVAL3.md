# D11 — DoD revalidation lần 3 — PR #250 tip typegen/CI (#249)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_f31dd86e-07ff-4d1c-b303-e4651391c6cf` · Task `task_73c38e0e2afd` · Dispatch `ctx_8c3fb24b4cf6` · **≠** fix `ctx_648d0c9cc800` · **≠** prior DoD FAIL `ctx_1b2fc202ef02` / reval1 `ctx_02cb6ad21d52` / reval2 `ctx_41145c78fde8` |
| Scope | PR [#250](https://github.com/hangndat/ticket-solution/pull/250) · Issue [#249](https://github.com/hangndat/ticket-solution/issues/249) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership **web** (+ tip infra: `.github/workflows/ci.yml`, `turbo.json` — xem mục CI/turbo) |
| Commit SHA | `b68e3cdffb6ef1b2554d684f6ce9a8d10fb33ca4` (exact; = PR tip / CI `headSha`) |
| Prior FAIL | [D11-PR-250-WEB-EVENTREPORT-P2-DOD-REVAL2.md](./D11-PR-250-WEB-EVENTREPORT-P2-DOD-REVAL2.md) trên `06b568553191f606e543c3582fecbb898758d89c` (turbo typecheck ENOENT `.next/types/routes.d.ts` → `test:routes` skipped) |
| Architecture impact | **Không** — consume contract EventReport O12 đã merge (P1); tip chỉ làm typegen/CI deterministic. Không cần Architect |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / tip | SHA `b68e3cdffb6ef1b2554d684f6ce9a8d10fb33ca4` tồn tại; message `fix(web): make next typegen deterministic before CI turbo` |
| Delta vs reval2 SHA | Chỉ 3 files: `.github/workflows/ci.yml`, `apps/web/package.json`, `turbo.json` (+14/−2). **Không** đổi O12 product source |
| O12 product blobs vs `06b5685` | `admin-form.tsx`, `report.ts`, `admin-report.test.ts`, `routes.integration.mjs` — blob hash **giống hệt** tip trước |
| reportHold / no setState-in-effect | Giữ pattern: scoped `reportHold` + derived `report`; `setReportHold(null)` chỉ trong handler reload (không trong `useEffect` clear-report). UI nút «Tải lại báo cáo» |
| Routes assert «Tải lại báo cáo» | Source `routes.integration.mjs:100` khớp UI |
| CI typegen (pre-turbo) | Run [39063752235](https://github.com/hangndat/ticket-solution/actions/runs/39063752235) job `web` step `pnpm --filter @ticket/web run typegen` → **SUCCESS** (`✓ Types generated successfully`) |
| CI turbo (lint/typecheck/test/build) | **8/8 successful**; unit **153 pass / 0 fail**; typecheck chạy typegen rồi `tsc --noEmit` xanh; build compile xanh |
| CI `test:routes` | **SUCCESS** — 1 pass / 0 fail (không còn skip) |
| CI aggregate | job `web` SUCCESS · job `ci` SUCCESS · `turbo-persist` SUCCESS · run conclusion **success** trên `headSha` = tip |
| Secret scan (diff tip) | Không thấy secret / `.env` / credential thật |
| P3 / out-of-scope | Không deep-link; không auto-poll; không sửa BE/product O12 trong tip |

## CI / turbo root edits — necessary & safe?

Tip mở rộng khỏi `apps/web/**` thuần sang root tooling. Đánh giá:

| Thay đổi | Cần thiết? | An toàn? |
| --- | --- | --- |
| `apps/web` script `typegen`: `mkdirSync(.next/types)` rồi `next typegen`; `typecheck` gọi `pnpm run typegen` | **Có** — khắc phục ENOENT `routes.d.ts` khi Next typegen chưa tạo dir | **Có** — chỉ tạo thư mục types local; không đổi semantics product |
| CI web: chạy `typegen` **trước** `turbo run lint typecheck test build` | **Có** — đảm bảo artifact types sẵn trước graph song song | **Có** — scoped job `web`; không đụng BE/mobile steps |
| `turbo.json` `@ticket/web#typegen` outputs; `@ticket/web#typecheck` dependsOn `typegen`; `@ticket/web#build` dependsOn `typecheck` | **Có** — chặn race `next typegen` ∥ `next build` (nguyên nhân REVAL2) | **Có** — override **chỉ** `@ticket/web#*`; package khác giữ `build`/`typecheck` generic. Trade-off: web build serial sau typecheck (chậm hơn một chút, có chủ đích) |

Kết luận tip infra: **cần thiết và an toàn** cho gate CI deterministic; không mở rộng contract API / RLS / mobile.

## Đối chiếu AC #249 (revalidate lần 3)

| Yêu cầu | Evidence trên SHA | Đạt? |
| --- | --- | --- |
| Parse/render O12 fields + asOf | Product blobs unchanged; CI unit 153 pass | Có |
| Fail-closed shown/unknown/rejected | `interpretEventReport` + tests (giữ) | Có |
| Đổi tenant/event xóa số cũ | `reportHold` scope gate (giữ) | Có |
| Copy VI + watermark; refresh thủ công | «Tải lại báo cáo»; CI `test:routes` pass | Có |
| Layout Manager → Supervisor | Không đổi (đạt từ prior) | Có |
| Tests `admin-report.test.ts` | Trong CI unit suite (153 pass) | Có |
| Không P3 / không BE | Tip chỉ CI/typegen/turbo | Có |
| CI xanh trên tip (typegen deterministic) | web + ci + test:routes SUCCESS trên exact SHA | **Có** |

## Findings

### Resolved (prior blockers)

1. ~~`react-hooks/set-state-in-effect`~~ — đã hết từ `2e02c3f` (reportHold); product không đổi trên tip.
2. ~~`test:routes` assert `'Tải báo cáo'`~~ — đã khớp «Tải lại báo cáo» từ `06b5685`; **nay có evidence CI pass**.
3. ~~CI turbo ENOENT `.next/types/routes.d.ts`~~ — tip `b68e3cd` typegen deterministic + serialize web#build; CI xanh.

### Should-fix / Nit

- Không blocker mới.
- Nit: typegen chạy cả pre-turbo step và lại trong `typecheck` (redundant nhưng belt-and-suspenders; chấp nhận được).
- Nit layout «Vé theo trạng thái» giữa Manager/Supervisor vẫn tùy chọn (không gate #249).

## Limitations / revalidation

- Verdict chỉ pin SHA `b68e3cdffb6ef1b2554d684f6ce9a8d10fb33ca4`.
- Commit hành vi mới sau tip → bắt buộc DoD lại; không kế thừa PASS này.
- Reviewer **không** merge; không đăng comment GitHub từ worker session (Orca channel rule) — draft VI dưới đây cho coordinator.

## Draft comment VI (cho coordinator)

> **DoD revalidation lần 3 PASS** PR #250 / #249 trên SHA `b68e3cdffb6ef1b2554d684f6ce9a8d10fb33ca4`.  
> O12 UI + reportHold + assert «Tải lại báo cáo» giữ nguyên so với tip trước; tip chỉ sửa typegen/CI/turbo (cần thiết, scoped `@ticket/web`, an toàn).  
> CI xanh: typegen + turbo 8/8 + unit 153/0 + `test:routes` 1/0; job web + ci SUCCESS (run 39063752235). Artifact: `docs/reviews/D11-PR-250-WEB-EVENTREPORT-P2-DOD-REVAL3.md`. Không merge từ reviewer.

## Verdict

**PASS** — blockers lint / routes copy / typegen CI đã hết trên exact tip; web + ci xanh; root CI/turbo edits justified and safe. Coordinator có thể merge sau khi đủ quyền integration (không phải bước của reviewer này).
