# DoD (+ security notes) — PR #441 me/tenants gồm tenant có vé (Attendee)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Role `reviewer-dod` · Orca terminal `term_b2bd8f6e-e15c-43bd-80fa-a177ebadc6fc` · task `task_90fd6d10c81b` · dispatch `ctx_61bca8e3c98a` · Run `run_34fde1e32ed1` · agent `cursor` · **≠** implementer |
| Role path | `docs/agents/roles/reviewer-dod.md` |
| Security | Slice **auth/tenancy** — checklist `reviewer-security` ghi **inline** trong artifact này (không spawn session security riêng trong wave này). Verdict security: **PASS** |
| Scope | PR [#441](https://github.com/hangndat/ticket-solution/pull/441) · Fixes [#398](https://github.com/hangndat/ticket-solution/issues/398) (deeplink attendee) · ownership: `packages/backend` migration, `packages/contracts`, `apps/web` platform/owner-ticket types |
| Architecture impact | **Có** — mở rộng visibility `GET /v1/me/tenants` / `list_my_tenants()`; đối chiếu RLS deny-by-default + O02 chrome theo permission |
| Decision IDs | Membership deny-by-default (D1 / TD § attendee routes) · O02 nav theo `tenantPermissions` / `staffEligible` (không tin role client) |
| Commit SHA | `c0fe595ddcfe994a3cbf31cdf9fb6999ccfb5da8` (`git rev-parse HEAD` khớp tip PR; commits `ea301d8` + `c0fe595`) |
| Graph | `code-review-graph-ticket` full rebuild trên SHA tip → ready; `detect_changes` + đọc source migration/consumers |
| Verdict | **PASS with known gap** |

---

## Summary

Email deeplink `/t/{slug}/tickets/{id}` resolve slug qua `me/tenants`. Chủ vé thường không có membership → trước đây `items: []` → unresolved. PR UNION tenant có `tickets.owner_user_id = actor` với role synthetic `Attendee` + `permissions = []`; membership thắng khi trùng (`DISTINCT ON` + `rank`).

---

## Checks (exact SHA `c0fe595ddcfe994a3cbf31cdf9fb6999ccfb5da8`)

| Check | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `c0fe595ddcfe994a3cbf31cdf9fb6999ccfb5da8` — khớp Spec |
| Diff vs `origin/main` | 5 files / +82 −7 — đúng scope (migration + contracts + web shape/copy) |
| CI run [39134093293](https://github.com/hangndat/ticket-solution/actions/runs/39134093293) | **SUCCESS** trên `headSha` = tip; `backend`, `web`, `mobile`, mọi `database-isolation` (gồm `rls`, `membership-report`, `account-deletion`/platform) xanh |
| Secret leak trong diff | **Không** — không `.env`/token/PII |
| Live UAT attendee deeplink trên SHA | **Không chạy lại** trong session DoD (gap) |

---

## Checklist DoD

| # | Tiêu chí | Kết quả |
| --- | --- | --- |
| 1 | `me/tenants` gồm tenant có vé owned (`owner_user_id = actor`) | **PASS (code)** — UNION ALL nhánh tickets; `SECURITY DEFINER` + `app.actor_id` bắt buộc |
| 2 | Role Attendee synthetic, permissions rỗng; membership thắng khi trùng | **PASS (code)** — `'Attendee'` + `ARRAY[]::text[]`; `rank` 0 membership / 1 attendee + `DISTINCT ON (tenant_id) … ORDER BY rank ASC` |
| 3 | RLS / deny-by-default / không cấp quyền staff | **PASS** — xem security checklist |
| 4 | Contract/web nhận `MeTenantRole` gồm `Attendee` | **PASS** — `@ticket/contracts` + `apps/web` `contracts`/`shape`/`isRole`; copy missing/tenantUnresolved rõ hơn |
| 5 | Staff không phải owner vẫn missing (deny) | **PASS (design)** — staff không `owner_user_id` → không vào nhánh Attendee; ticket API vẫn `getTicketForOwner` theo owner |
| 6 | CI xanh trên exact SHA | **PASS** |
| 7 | Acceptance khớp PR body (manual plan) | **PASS with known gap** — logic khớp; thiếu assert regression + UAT live reviewer |

---

## Security checklist (`reviewer-security`, inline)

| Threat / abuse | Đánh giá |
| --- | --- |
| Attendee thấy tenant → mở Admin chrome | **Mitigated** — `deriveNavCapabilities` cần `meEvents.staffEligible` **và** `ADMIN_TENANT_PERMISSIONS`; Attendee `permissions=[]` → `showAdmin=false`. `requireAdminCapabilityOrHome` fail-closed |
| Attendee gọi mutation admin trên tenant ticket | **Mitigated** — authz vẫn `requireTenantPermission` / membership; discovery ≠ grant |
| SECURITY DEFINER đọc chéo tickets | **Mitigated** — predicate `tk.owner_user_id = actor`; actor NULL → exception; `REVOKE PUBLIC`; `GRANT` chỉ `ticket_runtime`; `search_path` cố định |
| Role `Attendee` ghi vào `memberships` / invite | **Mitigated** — synthetic chỉ trong function return; invite CHECK vẫn `Owner\|Manager\|CS\|Supervisor\|Scanner`; `MeTenantRole` tách khỏi `MembershipRole` |
| Thông tin lộ slug/name/status tenant | **Chấp nhận theo AC** — chủ vé đã có slug trên email link; không lộ PII khác / permissions |
| Staff vừa ticket-owner tenant khác xuất hiện trong admin selector | **Hardening / UX** — `admin-form` map toàn bộ `me/tenants` không filter permission; mutate vẫn 403. Không bypass authz |

**Security verdict:** **PASS** (không blocker trước merge).

---

## Findings

### Known gap (không chặn PASS theo routing)

1. **Thiếu regression assert** — sau `redeemAndIssueTicket` cho attendee, không có `listMyTenants(attendee)` assert `role === 'Attendee'` + `tenantPermissions.length === 0`, cũng không có case membership-wins. Migration được apply trong CI isolation nhưng nhánh hành vi mới không được chứng minh bằng assert.
2. **PR test plan manual chưa check** — reviewer không tái chạy `GET /me/tenants` attendee + deeplink `/t/uat-device/tickets/…` trên môi trường live.

### Should-fix / nit (không đủ FAIL)

3. Admin tenant selector có thể liệt kê tenant Attendee (permissions rỗng) nếu user vừa staff vừa ticket-owner — UX; API vẫn deny.
4. Nhánh tickets không lọc state vé (VOID/…); tenant vẫn hiện khi còn bất kỳ hàng ticket owned — chấp nhận được cho resolve slug.

### Blocker

Không.

---

## Limitations

- Không merge, không deploy, không sửa production code trong session này (chỉ artifact + PR comment).
- Không spawn session `reviewer-security` độc lập; security gate dựa checklist inline trên exact SHA.
- CRG `detect_changes` vs `origin/main` báo nhiễu file count trên monorepo graph; phạm vi review neo `git diff origin/main...HEAD` (5 files).

---

## Verdict rationale

Fix đúng gốc (slug resolve cần tenant discovery cho ticket owner), giữ deny-by-default cho staff chrome/API, CI xanh trên tip SHA. **PASS with known gap** vì thiếu regression test + UAT live reviewer; gap không nuốt acceptance/security bắt buộc (permissions rỗng + membership thắng + CI isolation xanh).
