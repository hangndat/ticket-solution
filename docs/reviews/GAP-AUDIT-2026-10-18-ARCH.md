# Gap audit kiến trúc — ADR / authz / O02 nav (2026-10-18)

| Trường | Giá trị |
| --- | --- |
| Mode | Kiểm tra sự phù hợp (architect) |
| Role | `architect` — `docs/agents/roles/architect.md` |
| Tip SHA | `a8e70ca134ba305b3b52fff0e8a81a2e0871ca20` (`git rev-parse HEAD`) |
| Branch | `hangndat/d13-pr354-dod-artifact` |
| Scope | Deny-by-default membership, O02 mode switch, tín hiệu quyền client/nav, BFF `/me`, RLS/authz gaps tip |
| Non-goals | Không sửa code đa slice; không thay DoD/security verdict |
| **Verdict kiến trúc O02** | **FAIL** (nav / permission-driven chrome) |

## Tóm tắt điều hành

Backend authz deny-by-default (`requireTenantPermission` + role-map allowlist + Gate `openStaffSession`) và RLS membership vẫn khớp TD §5.2 / ADR-02 trên tip — **UI hide ≠ security**: API fail-closed. Client **không** có contract/session shape đủ để biết «user có staff permission» rồi switch nav theo O02/ADR-07: `GET /v1/me` chỉ identity; `SiteNav` hardcode variant theo page; iOS luôn hiện tab Nhân viên. Event-permission discovery (`MeEventsResponse` / `/v1/tenants/{t}/me/events`) có trong contracts nhưng **chưa wire Nest** — Scanner/CS/Supervisor có `tenantPermissions: []` nên `/me/tenants` cũng không đủ làm tín hiệu chrome.

## Evidence đã đọc (tip)

| Area | Paths |
| --- | --- |
| Quyết định | `docs/DECISION-LOG.md` O01/O02, ADR-07/09/18/19; `docs/TECHNICAL-DESIGN.md` §5.2, §12.3 |
| BE authz | `packages/backend/src/membership.ts`, `role-map.ts`, `membership-invite.ts` (`listMyTenants`), `gate.ts` (`openStaffSession`) |
| Contract | `packages/contracts/src/index.ts` `MeResponse`, `MeTenantItem`, `MeEventsResponse` |
| API | `apps/api/src/app.ts` (`GET /v1/me`); `apps/api/src/platform.ts` (`GET /v1/me/tenants`) — **không** có handler `me/events` |
| Web | `apps/web/app/api/bff/me/route.ts`, `…/me/tenants/route.ts`, `src/site-chrome.tsx`, pages `gate`/`admin`/`page` (variant cứng), **không** `middleware.ts` |
| iOS | `apps/mobile/src/app/(tabs)/_layout.tsx`, `screens/staff.tsx` (`resolveGateAuth`) |
| Prior DoD | `docs/reviews/D1-ISSUE-12-MEMBERSHIP.md` (membership deny-by-default PASS lịch sử) |

Checks: đọc source + contract + OpenAPI paths qua search; **không** chạy runtime/UAT trong phiên này (docs/architecture audit).

---

## Kiểm bắt buộc

### 1. Client có API/session shape «user có staff permission»?

| Signal | Shape | Đủ cho O02 nav? |
| --- | --- | --- |
| `GET /v1/me` → BFF `/api/bff/me` | `userId`, `issuer`, `subject`, `email`, `emailVerified` | **Không** — không membership/role/permissions |
| `GET /v1/me/tenants` → BFF `/api/bff/me/tenants` | `role`, `tenantPermissions[]` per tenant | **Một phần** — Owner/Manager có tenant perms; **Scanner/CS/Supervisor = `tenantPermissions: []`** (role-map); không aggregate «has any staff» |
| `MeEventsResponse` / path web `meEvents(tenantId)` | `eventId` + `permissions[]` (contract) | **Thiếu implementation** — không có Nest route / OpenAPI path; client không discover `gate.confirm` |
| Session web | HttpOnly cookie + probe `/api/bff/me` (debug UI) | Không feed SiteNav |
| iOS session | Bearer + `verifyViaMe`; staff tab luôn mount | Không hide theo membership |

**Kết luận:** Gap kiến trúc / contract handoff — thiếu tín hiệu chrome ổn định (aggregate hoặc MeEvents + consumer).

### 2. UI hide ≠ security — API vẫn fail-closed?

**Có (backend).** `requireTenantPermission` deny-by-default; Gate `openStaffSession` yêu cầu `gate.confirm` + `assert_can_open_staff_session`; BFF chỉ `forwardWithBearer` — không cấp tenant/permission. Attendee không membership không vượt được mutation staff qua API.

**Không chứng minh:** Next không middleware chặn render `/gate`/`/admin` — surface UX vẫn mở; bảo mật dựa Nest.

### 3. Deep link `/staff` | `/gate` khi không quyền

| Surface | Hành vi tip |
| --- | --- |
| Web `/staff` | **Không có route** — không áp dụng |
| Web `/gate`, `/admin` | Page render được; `SiteNav` variant `staff`/`admin` cứng; OIDC thiếu → banner fail-closed; mutation qua BFF→Nest từ chối nếu thiếu membership/permission |
| iOS tab `staff` | Luôn visible; `resolveGateAuth` từ chối scan nếu chưa login; session/API Gate vẫn authz server |

**Gap UX/O02:** deep link / tab staff lộ chrome + form trước khi biết quyền; không redirect/hide theo permission. **Không** phải lỗ hổng bypass API nếu Nest giữ fail-closed.

### 4. Drift ADR vs code đáng kể

| ADR / O | Kỳ vọng | Tip | Drift |
| --- | --- | --- | --- |
| **O02 / ADR-07** | App chung; **navigation theo permission**; mode switch không tự cấp quyền | Nav variant page-static; iOS tab staff luôn hiện | **Đáng kể — FAIL O02 nav** |
| ADR-09 | Keycloak OIDC + PKCE iOS | `/v1/me` JWKS + web BFF cookie; iOS session | Khớp hướng (không audit IdP deploy) |
| ADR-18 | Offline Gate sync | Gate BE + iOS queue paths shipped riêng | Ngoài gap nav; không FAIL audit này |
| ADR-19 | Published event SoT | Epic #254 riêng | Ngoài scope authz nav |
| TD §5.2 | Deny-by-default + DB check mutation | `membership.ts` / Gate | Khớp |
| TD §12.3 | Tách attendee/staff trees theo permission server | iOS trees tách file nhưng **không** gated permission | Drift UX |

---

## Gaps (P0 / P1)

### P0

| ID | Gap | Impact | Đề xuất Task |
| --- | --- | --- | --- |
| **ARCH-P0-1** | Không có tín hiệu chrome «has staff capability» ổn định: `/v1/me` trống; `/me/tenants` thiếu event perms; `MeEvents` contract **chưa ship Nest** | O02 mode switch / ẩn nav không thể đúng cho Scanner+ | **Architect handoff** → contract: (A) `GET /v1/tenants/{t}/me/events` + optional aggregate trên `/v1/me` hoặc `/v1/me/capabilities`, **hoặc** (B) mở rộng `MeTenantItem` với `eventPermissionSummary` / `staffEligible` derived server-side. Ownership: **BE** implement + OpenAPI; **coordinator** chốt contract |
| **ARCH-P0-2** | Web `SiteNav` hardcode `guest`/`staff`/`admin`/`platform` theo page — không đọc session/permissions | Attendee thấy link Cổng trên `/gate`; home guest không switch sau login | **web** consumer sau contract: derive variant từ capabilities; soft-hide links; deep link `/gate`/`/admin` → empty/deny UX (không coi là authz) |
| **ARCH-P0-3** | iOS `(tabs)` luôn `NativeTabs.Trigger name="staff"` | Attendee thấy tab Nhân viên trái O02 | **ios** consumer: ẩn/disable tab khi không `staffEligible`; deep link staff → màn «không có quyền» |

### P1

| ID | Gap | Impact | Đề xuất |
| --- | --- | --- | --- |
| **ARCH-P1-1** | Không Next `middleware` / RSC guard cho `/gate` `/admin` | Surface + copy staff lộ trước auth | web: optional redirect `/auth` khi unauthenticated (UX only) |
| **ARCH-P1-2** | `/me/tenants` dùng cho admin selector; không shared nav store | Trùng fetch / lệch chrome giữa page | web: session chrome provider sau ARCH-P0-1 |
| **ARCH-P1-3** | F1 lịch sử membership (`activated_at <= now` trong lock) từ DoD #12 | Edge scheduled activate | BE backlog nhỏ — không chặn O02 nav |
| **ARCH-P1-4** | Role name trên `MeTenantItem` dễ bị client lạm dụng thay permission codes | Sai hide/show | Handoff: UI chỉ allowlist permission codes (`gate.confirm`, `event.create`, …); role chỉ display |

---

## Handoff đề xuất (planner / coordinator)

```text
Wave đề xuất (sau khi coordinator xác nhận contract):
1. [architect] docs/architecture/o02-permission-nav-handoff.md
   — chốt shape capabilities + compatibility; Architecture impact: Có
2. [backend] Implement MeEvents (hoặc aggregate) + tests; OpenAPI; không đổi deny-by-default
3. [web] ∥ [ios] Consumer ẩn nav/tab + deep-link deny UX — deps: contract/BE SHA
Không serialize web trước ios nếu cùng contract artifact.
Reviewer-dod/security riêng; audit này không thay security gate.
```

**Phương án contract (gợi ý, chưa chốt):**

1. **Ưu tiên tối thiểu:** ship `GET /v1/tenants/{tenantId}/me/events` đúng `MeEventsResponse` đã có trong `@ticket/contracts`.
2. **Chrome-friendly:** thêm `GET /v1/me/staff-capabilities` (hoặc field trên `/v1/me`) `{ staffEligible: boolean; tenants: … }` computed server từ membership + assignments active — tránh client suy luận từ role name.
3. **Không** đưa permission vào JWT claim lâu dài làm SoT (TD §5.2: mutation vẫn DB check).

---

## Kết luận

| Câu hỏi | Kết quả |
| --- | --- |
| Membership deny-by-default / Gate authz server | **Phù hợp** ADR/TD (PASS lớp API) |
| O02 / ADR-07 navigation theo permission | **FAIL** — thiếu signal + consumer nav/tab |
| UI hide thay security? | **Không** — API fail-closed; gap là UX/contract |
| Cần làm rõ trước coding consumer? | **Có** — ARCH-P0-1 handoff architect→BE |

**Verdict tổng:** **FAIL** kiến trúc phù hợp O02 (nav) trên tip `a8e70ca134ba305b3b52fff0e8a81a2e0871ca20`. Backend authz không bị kết luận FAIL trong audit này.

*Artifact này không phải DoD/security PASS/FAIL thay reviewer độc lập.*
