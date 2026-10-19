# DoD — PR #524 Portal Analytics portfolio UI PS1 (#515) — revalidation

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_f564ff8a-2a9e-4706-9075-ba7dfe3e68e7` · Task `task_58e23bcf6263` · Dispatch `ctx_be25011aacf7` · Run `run_d04055a8969b` · **≠** implementer fix `ctx_9c3ceb7cabea` · **≠** prior DoD `ctx_341b83a191b8` |
| Scope | PR [#524](https://github.com/hangndat/ticket-solution/pull/524) · Issue [#515](https://github.com/hangndat/ticket-solution/issues/515) · Story #493 / Epic #491 · ownership **web** (`apps/portal/**`) |
| Commit SHA | `77791c0088a7095333e1935b22a06beb9936f613` (exact; = PR tip `headRefOid`) |
| Prior verdict | **FAIL** trên `05a7ac0d97cc6b14f9c32192b8e747bf0a2aab84` (CONFLICTING vs `main` #523 + thiếu CI xanh) — **không kế thừa**; đây là reval sau merge `origin/main` |
| Architecture impact | **Có** — surface `/t/[tenantId]/analytics` consume `GET …/reports/portfolio` · Decision IDs: **O17** / **P2-PORTFOLIO-REOPEN** / **P2-AUTHZ-ASSIGNMENT** / ADR [`PORTAL-P2-ADR.md`](../architecture/PORTAL-P2-ADR.md) §4.3 · PD [`PORTAL-P2-UX.md`](../design/PORTAL-P2-UX.md) §3.1 / AC-PS1 · **O02** (nav theo `report.read` server) |
| Reviewer merge | **Không** merge (theo Task) |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `77791c0088a7095333e1935b22a06beb9936f613` |
| Diff ownership vs merge-base `main` (`26d7d60…`) | 13 files, **chỉ** `apps/portal/**` — route analytics, BFF portfolio, nav/capabilities, i18n keys, tests |
| Dep contract #514 / PR #522 | **MERGED** trên `main` (đã có trong merge commit tip) |
| Local unit (AC) | `pnpm exec tsx --test tests/ops-portfolio.test.ts tests/capabilities.test.ts tests/ops-paths.test.ts tests/i18n.test.ts` → **28 pass / 0 fail** |
| Local lint | `pnpm --filter @ticket/portal lint` → **PASS** (`--max-warnings 0`) |
| Local typecheck | Build `@ticket/contracts` + `@ticket/web-session` rồi `pnpm --filter @ticket/portal typecheck` → **PASS**; CI `portal` trên tip cũng SUCCESS |
| GitHub Actions CI trên tip SHA | `changes` / `portal` / `ci` / `turbo-persist` = **SUCCESS**; web/mobile/backend/db-isolation skipped (đúng path filter portal) — run [39190792974](https://github.com/hangndat/ticket-solution/actions/runs/39190792974) |
| Mergeability vs `origin/main` | **MERGEABLE** · `mergeStateStatus: CLEAN` |
| Secret scan (diff) | Không thấy secret / `.env` / credential thật |
| Headless smoke UAT | **Chưa chạy** — Issue #515 «khi có thể»; logic fail-closed + unit cover AC; không bắt buộc theo AC wording |

## Đối chiếu AC #515 / PD AC-PS1 / ADR §4.3 (reval)

| Yêu cầu | Evidence trên SHA `77791c0…` | Đạt? |
| --- | --- | --- |
| Route `/t/[tenantId]/analytics` | `app/t/[tenantId]/analytics/page.tsx` | Có |
| Consume `GET …/reports/portfolio` qua BFF fail-closed | BFF `reports/portfolio/route.ts` → `PORTAL_UPSTREAM.portfolio`; `interpretPortfolio` unknown/rejected | Có |
| Không `report-summary` | `portfolioUpstreamPath` + `ops-paths` assert `/reports/portfolio` | Có |
| Nav «Phân tích» = `report.read` + assignment (O02) | `tenantHasAnalytics` + `buildOrgMenuItems(..., translate)`; tests deny gate.confirm / cross-tenant | Có |
| Refresh thủ công | Nút `data-testid=portfolio-refresh`; không poll | Có |
| Deep-link event overview | `portfolioEventHref` → `/t/{t}/e/{e}`; row click + Link | Có |
| Empty / 403 fail-closed | empty items → empty state; `useAnalyticsAccess` → permission-denied; 401/403/404 → rejected | Có |
| Partial row → `—` + Alert, không bịa 0 | `hasPartial` + `ops.portfolio.partial`; tests bad row / UNLIMITED+0 | Có |
| i18n không regress (#523) | Analytics + portfolio keys có **VI + EN**; shell vẫn `PortalTranslate` / `MessageKey`; `i18n.test` catalog parity PASS; nav label qua `nav.org.analytics` | Có |
| CI xanh trên tip | portal + aggregate ci SUCCESS trên `77791c0…` | Có |
| MERGEABLE | CLEAN | Có |

## Architecture (handoff)

- Contract consumer khớp ADR §4.3 / O17: path portfolio, assignment filter server, watermark `asOf`, refresh thủ công.
- Rebase/merge main giữ `PortalTranslate` từ #523 và thêm Analytics — drift i18n hard-code VI từ FAIL trước **đã hết**.
- Không sửa BE/OpenAPI — đúng ownership web.
- Không cần Architect gate riêng: ranh giới portfolio không đổi; integration blocker trước đã đóng.

## Findings

### Blocker

Không còn. Hai blocker FAIL trước (CONFLICTING + thiếu CI) đã đóng trên tip này.

### Should-fix (không chặn merge)

1. (Tuỳ chọn) cột «Cập nhật» PD §3.1 nếu API có field per-row — hiện chỉ watermark `asOf` page-level.
2. Append pagination: lỗi network khi «Tải thêm» có thể thay page bằng `unknown` (mất rows trước) — UX, không nuốt AC.

### Nit

- Cột «Trạng thái» luôn `—` (đúng honesty khi API không có field).
- Refresh / load-more reuse hash keys `gate.h_3keb7` / `sources.h_1w8bpuo` (đã có EN) — có thể rename catalog sau.
- Thiếu unit riêng cho `useAnalyticsAccess` page machine (nav + interpretPortfolio đã cover AC chính).

## Limitations

- Verdict chỉ pin `77791c0088a7095333e1935b22a06beb9936f613`. Commit hành vi mới → **bắt buộc DoD lại**.
- Headless Owner → portfolio → deep-link chưa có artifact trên SHA này (AC «khi có thể»).
- Reviewer **không** merge.

## Verdict

**PASS** — PS1 / fail-closed / `report.read` nav / BFF portfolio / i18n VI+EN / unit AC + lint / CI portal xanh / MERGEABLE CLEAN trên exact SHA reval. Coordinator có thể merge sau khi xác nhận Project gates; reviewer không merge.
