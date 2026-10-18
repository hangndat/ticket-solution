# D11 — DoD review PR #260 Web EventReport O12 Wave P3 (#258)

| Trường | Giá trị |
| --- | --- |
| Verdict | **PASS** |
| Reviewer / session | Role `reviewer-dod` · Agent Cursor · Orca terminal `term_83299a35-471c-4cbf-8d9b-ac17a4f26c49` · Task `task_c5a7c327f04e` · Dispatch `ctx_d960dd75ec3e` · **≠** implementer `ctx_08ec4131c071` |
| Scope | PR [#260](https://github.com/hangndat/ticket-solution/pull/260) · Issue [#258](https://github.com/hangndat/ticket-solution/issues/258) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) · ownership **web** (`apps/web/**` only) |
| Commit SHA | `36439e86047689122494900c11955e291c6c6337` (exact; = PR tip / CI `headSha`) |
| Architecture impact | **Không** — deep-link UI tới section admin đã có; không đổi contract/API. Không cần Architect |

## Checks (trên exact SHA)

| Check | Kết quả |
| --- | --- |
| `git rev-parse` / tip | SHA `36439e86047689122494900c11955e291c6c6337` tồn tại; message `feat(web): deep-link EventReport KPI tới việc cần xử lý (O12 P3)` |
| Diff ownership | 3 files, **chỉ** `apps/web/app/admin/admin-form.tsx`, `apps/web/src/admin/report.ts`, `apps/web/tests/admin-report.test.ts` — không BE/mobile/OpenAPI |
| Local unit (P3 helpers + wiring) | Overlay SHA files → `pnpm exec tsx --test tests/admin-report.test.ts`: **P3 tests pass** (`shows P3 deep-link CTAs…`, `wires EventReport KPI…`). 1 fail OpenAPI `quotaRemaining` do **contracts workspace local lệch** (không phải tip PR) — bỏ qua; tin CI trên SHA |
| CI trên SHA | Run [39078580815](https://github.com/hangndat/ticket-solution/actions/runs/39078580815) · `headSha` = tip · job `web` **SUCCESS** · `ci` **SUCCESS** · `turbo-persist` **SUCCESS** · conclusion **success** |
| CI web detail | turbo lint/typecheck/test/build **8/8**; unit **155 pass / 0 fail** (gồm 2 test P3); `eslint . --max-warnings 0` xanh; `test:routes` 1 pass |
| Secret scan (diff) | Không thấy secret / `.env` / credential thật |
| Out-of-scope | Không API/BE/mobile; không auto-refresh; không approve/deny/resend trên thẻ KPI |

## Đối chiếu AC #258 / checklist O12 P3

| Yêu cầu | Evidence trên SHA | Đạt? |
| --- | --- | --- |
| `pendingApprovalCount` > 0 → CTA `#guests-codes-heading`, không approve từ thẻ | `reportShowsPendingApprovalCta` + `<a href="#guests-codes-heading">` → `goToAdminSection('guests', …)`; KPI block không chứa `approveInvitation`/`denyInvitation`/`/approve`/`/deny` (assert trong test wiring) | Có |
| `emailNeedsCsCount` > 0 → CTA `#cs-heading`, không resend từ thẻ | `reportShowsEmailCsCta` + `#cs-heading` → `goToAdminSection('support', …)`; không `resendTicketEmail`/`/resend` trong KPI block | Có |
| unknown / rejected / count = 0: không CTA số giả | Helpers yêu cầu `reportShowsNumbers` **và** count > 0; CTA chỉ render trong `reportShowsNumbers` branch; unknown/rejected chỉ hiện message (`event-report-unknown`) | Có |
| a11y: tên link rõ + focus section đích | Label VI rõ; `tabIndex={-1}` trên `#guests-codes-heading` / `#cs-heading`; `scrollIntoView` + `focus({ preventScroll: true })` | Có |
| Tests + CI web xanh trên exact SHA | CI 155 pass; lint/typecheck/build xanh trên tip | Có |

## Findings

### Blocker

Không có.

### Should-fix

Không có.

### Nit

- Indent lệch nhẹ trên `<h2 id="guests-codes-heading">` (thêm space) — cosmetic, không chặn DoD.
- `goToAdminSection` dùng `setTimeout(0)` sau `setActiveJob`; section đích vẫn trong DOM (`hidden`), nên `getElementById`/focus vẫn ổn — chấp nhận được cho P3.

## Limitations / revalidation

- Verdict chỉ pin SHA `36439e86047689122494900c11955e291c6c6337`. Push hành vi mới → **bắt buộc DoD lại**.
- Reviewer **không** merge; không đổi Project Status sang Hoàn thành (coordinator sau đủ gate).
- Không chạy UAT headless browser trên PR này — AC Wave P3 nghiệm thu bằng unit + CI web; milestone Epic #222 vẫn cần gate UAT riêng khi đóng Epic.

## Comment VI (để coordinator đăng Issue/PR — worker không post GitHub)

```text
## DoD độc lập — PASS

- Reviewer: `reviewer-dod` · Orca `term_83299a35-471c-4cbf-8d9b-ac17a4f26c49` / `ctx_d960dd75ec3e` (≠ implementer `ctx_08ec4131c071`)
- Scope: PR #260 · Issue #258 · ownership web
- Exact SHA: `36439e86047689122494900c11955e291c6c6337`
- Checks: CI run 39078580815 — web/ci xanh; unit 155 pass (P3 CTA + wiring); lint/typecheck/build OK
- AC P3: CTA pending → `#guests-codes-heading`; CTA email CS → `#cs-heading`; không approve/resend trên thẻ; unknown/rejected/count=0 không CTA giả
- Artifact: `docs/reviews/D11-PR-260-WEB-EVENTREPORT-P3-DOD.md`
- Không merge từ reviewer.
```

## Verdict

**PASS** — deep-link O12 P3 đúng AC trên exact SHA; ownership web-only; tests + CI web xanh; không approve/resend từ thẻ KPI.
