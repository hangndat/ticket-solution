# DoD — PR #524 Portal Analytics portfolio UI PS1 (#515)

| Trường | Giá trị |
| --- | --- |
| Verdict | **FAIL** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_c445d43e-e585-4944-821f-6754d757e39f` · Task `task_b98ef1402c82` · Dispatch `ctx_341b83a191b8` · Run `run_d04055a8969b` · **≠** implementer `ctx_f9b75c9fae64` |
| Scope | PR [#524](https://github.com/hangndat/ticket-solution/pull/524) · Issue [#515](https://github.com/hangndat/ticket-solution/issues/515) · Story #493 / Epic #491 · ownership **web** (`apps/portal/**`) |
| Commit SHA | `05a7ac0d97cc6b14f9c32192b8e747bf0a2aab84` (exact; = PR tip `headRefOid`) |
| Architecture impact | **Có** — surface `/t/[tenantId]/analytics` consume `GET …/reports/portfolio` · Decision IDs: **O17** / **P2-PORTFOLIO-REOPEN** / **P2-AUTHZ-ASSIGNMENT** / ADR [`PORTAL-P2-ADR.md`](../architecture/PORTAL-P2-ADR.md) §4.3 · PD [`PORTAL-P2-UX.md`](../design/PORTAL-P2-UX.md) §3.1 / AC-PS1 · **O02** (nav theo `report.read` server, không suy role name) |
| Reviewer merge | **Không** merge (theo Task) |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `05a7ac0d97cc6b14f9c32192b8e747bf0a2aab84` |
| Diff ownership | 11 files, **chỉ** `apps/portal/**` — không BE/OpenAPI/mobile; BFF path `…/reports/portfolio` (không `report-summary`) |
| Dep contract #514 / PR #522 | **MERGED** `07b0ffbfc32af81223f87412d70a2d9c317b8709` trên `main` (2026-10-19) |
| Local unit | `pnpm exec tsx --test tests/ops-portfolio.test.ts tests/capabilities.test.ts tests/ops-paths.test.ts` → **14 pass / 0 fail** |
| Local lint | `pnpm --filter @ticket/portal lint` → **PASS** (`--max-warnings 0`) |
| Local typecheck | Build `@ticket/contracts` + `@ticket/web-session` rồi `pnpm --filter @ticket/portal typecheck` → **PASS** |
| GitHub Actions CI trên tip SHA | **Không có** workflow `ci` conclusion trên `05a7ac0…` — `gh pr checks 524` = «no checks»; REST check-suites chỉ Cloudflare `queued` |
| Mergeability vs `origin/main` | **CONFLICTING** — `portal-shell.tsx`, `capabilities.ts`, `use-event-access.ts` conflict với EN locale pack [#523](https://github.com/hangndat/ticket-solution/pull/523) (`MessageKey` / `PortalTranslate` trên `buildOrgMenuItems`) |
| Secret scan (diff) | Không thấy secret / `.env` / credential thật |
| Headless smoke UAT | **Chưa chạy** (PR Test plan unchecked; Issue «khi có thể») — #522 đã merge nên gap có thể đóng sau rebase |

## Đối chiếu AC #515 / PD AC-PS1 / ADR §4.3

| Yêu cầu | Evidence trên SHA | Đạt? |
| --- | --- | --- |
| Route `/t/[tenantId]/analytics` | `app/t/[tenantId]/analytics/page.tsx` | Có (logic) |
| Consume `GET …/reports/portfolio` qua BFF fail-closed | BFF `reports/portfolio/route.ts` → `PORTAL_UPSTREAM.portfolio`; `interpretPortfolio` unknown/rejected; không fake 0 | Có |
| Không `report-summary` | `portfolioUpstreamPath` + `ops-paths` assert `/reports/portfolio` | Có |
| Nav «Phân tích» = `report.read` + assignment (O02) | `tenantHasAnalytics` + `buildOrgMenuItems`; tests deny gate.confirm / cross-tenant | Có |
| Refresh thủ công | Nút «Làm mới» `data-testid=portfolio-refresh`; không poll | Có |
| Deep-link event overview | `portfolioEventHref` → `/t/{t}/e/{e}`; row click + Link | Có |
| Empty / 403 fail-closed | empty items → empty state; `useAnalyticsAccess` → permission-denied; 401/403/404 → rejected Result | Có |
| Partial row → `—` + Alert, không bịa 0 | `hasPartial` + `PORTFOLIO_PARTIAL_ALERT`; tests bad row / UNLIMITED+0 | Có |
| Dictionary O12 counts only (không revenue BI) | Columns check-in / pending / email CS / quota; Trạng thái = `—` + tooltip «API không có» | Có |
| CI xanh trên tip | Không có Actions green trên SHA; PR conflict với `main` | **Không** |
| Rebase-ready với i18n #523 | Signature `buildOrgMenuItems(..., translate)` trên main vs `(..., meEvents)` trên tip | **Không** |

## Architecture (handoff)

- Contract consumer khớp ADR §4.3 / O17: path portfolio, assignment filter server (`items` vắng ≠ hàng unknown), watermark `asOf`, refresh thủ công.
- Không sửa BE/OpenAPI — đúng ownership web.
- Design drift **sau** #523: tip còn hard-code VI menu labels trong khi `main` đã `PortalTranslate` — **phải** rebase + gắn `MessageKey` cho «Phân tích» trước merge.
- Không cần Architect gate riêng lúc này (contract #522 đã merge; drift là integration/i18n, không đổi ranh giới portfolio). Push SHA mới → DoD lại.

## Findings

### Blocker

1. **PR `mergeable: CONFLICTING` với `main`** — xung đột nội dung tại `apps/portal/src/components/portal-shell.tsx`, `src/nav/capabilities.ts`, `src/prep/use-event-access.ts` vì [#523](https://github.com/hangndat/ticket-solution/pull/523) đổi nav sang i18n (`PortalTranslate` / `MessageKey`) trong khi tip #524 thêm Analytics + `meEvents`. Không merge được; SHA tip không còn là candidate integration sạch.
2. **Thiếu CI xanh trên exact SHA** — không quan sát được job `portal` / aggregate `ci` success cho `05a7ac0…` (path filter lẽ ra chạy portal). Sau rebase bắt buộc CI xanh + **revalidation DoD** trên SHA mới.

### Should-fix (sau rebase)

1. Gắn label Analytics qua catalog i18n (`nav.org.analytics` hoặc key PD) — không hard-code «Phân tích» nếu #523 đã chuẩn hóa chrome.
2. (Tuỳ chọn) cột «Cập nhật» PD §3.1 nếu API có field; hiện thiếu — chấp nhận nếu không có watermark per-row trên portfolio envelope.

### Nit

- Cột «Trạng thái» luôn `—` (đúng honesty khi API không có field) — có thể ẩn cột nếu PD optional P2.1.
- Thiếu unit cho `useAnalyticsAccess` / page state machine (parse + nav đã cover phần lớn AC).
- Append pagination: lỗi network khi «Tải thêm» thay cả page bằng `unknown` (mất rows trước) — UX, không nuốt AC.

## Limitations / revalidation

- Verdict chỉ pin `05a7ac0d97cc6b14f9c32192b8e747bf0a2aab84`.
- Rebase/fix conflict / CI → **bắt buộc DoD lại** trên tip mới; không kế thừa PASS.
- Headless UAT Owner → portfolio → deep-link chưa có artifact trên SHA này.
- Reviewer **không** merge; giữ `Chờ duyệt` hoặc trả `Đang làm` cho fix/rebase worker.

## Verdict

**FAIL** — logic PS1 / fail-closed / `report.read` nav / BFF portfolio / unit+lint+typecheck **đạt trên exact SHA**, nhưng **không đủ DoD integration**: PR conflict với `main` (#523) và **không có CI xanh** trên tip. Cần rebase (giữ Analytics + i18n), CI portal xanh, rồi revalidate.
