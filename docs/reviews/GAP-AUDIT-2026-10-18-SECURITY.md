# Gap audit SECURITY — staff/admin surface exposure + authz

| Trường | Giá trị |
| --- | --- |
| Role | `reviewer-security` — [`docs/agents/roles/reviewer-security.md`](../agents/roles/reviewer-security.md) |
| Reviewer / session | Orca worker `term_1adf6f3e-13b7-4e77-9ffe-4c2c667da545` · dispatch `ctx_c02c04151cf2` · task `task_bad541b9dc13` · **≠** implementer |
| Ngày | 2026-10-18 |
| Exact SHA (worktree HEAD) | `c3fc98faa2d8bb7b427c1bcc8ec710cc91002b72` |
| Tip message | `docs(reviews): DoD artifacts UI cleanup PR #365/#366` |
| Architecture impact | **Có** — authz surface / privilege signaling |
| OUT | Không viết exploit PoC; không deploy; không merge; không đổi Project Status |

**Verdict security:** **PASS with known gap**

Không có **security blocker** (authz bypass / client-trusted role / secrets trên guest UI runtime). Các gap còn mở là **information disclosure / privilege signaling / UX stale sau revoke** — API vẫn deny-by-default. Khớp phân tích BA `GAP-AUDIT-2026-10-18-BA.md` (O02) về chrome theo route.

---

## Threat / abuse cases đã xét

| # | Abuse case | Kết luận ngắn |
| --- | --- | --- |
| T1 | Anonymous enum staff surfaces qua menu guest | Guest nav **không** lộ Admin/Cổng/Platform |
| T2 | Deep-link `/admin` `/gate` `/platform` `/account` không auth | Shell + nav staff **discoverable**; mutating API vẫn 401/403 |
| T3 | Gọi Gate/Admin API không bearer / không membership | Fail-closed OIDC + `requireTenantPermission` |
| T4 | Sau revoke, client vẫn “tin” role cache và thao tác privileged | UI có thể stale; **API từ chối** request mới |
| T5 | Demo password / secret trên guest path | **Không** trên runtime guest UI; có trong docs/README/ASC |
| T6 | BFF lộ stack/token/secret | Token không lộ; message có thể lộ tên env / URL upstream (Low) |

---

## 1. Tab/menu Nhân viên · /admin · /gate · /platform khi anonymous

### Fact (source @ SHA trên)

| Surface | Quan sát | Rủi ro |
| --- | --- | --- |
| Web guest routes (`/`, `/redeem`, `/claim`, `/invite`, `/auth`) | `SiteNav variant="guest"` → chỉ Đổi mã / Nhận lời mời / Đăng nhập | **Không** enum staff từ chrome guest |
| Web `/gate` | `variant="staff"` — link Cổng; form chỉ khi OIDC configured | Deep-link discoverable |
| Web `/admin`, `/account` | `variant="admin"` — Sự kiện / Platform / Cổng / Tài khoản | Deep-link + privilege signaling |
| Web `/platform` | `variant="platform"` — Admin tenant / Platform | Deep-link discoverable |
| iOS tabs | `(tabs)/_layout.tsx` **luôn** render tab «Nhân viên» | Privilege signaling cho mọi user đã mở app |
| SEO | Root `robots: { index: false, follow: false }` | Giảm index; **không** chặn URL trực tiếp |
| Marketing host | Product prefixes redirect sang `PRODUCT_ORIGIN` | Không ẩn surface trên app host |

### Phân loại

| ID | Severity | Loại | Mô tả |
| --- | --- | --- | --- |
| **SEC-GAP-NAV-01** | **Medium** | **UX / info disclosure** — **không** bypass | Staff/admin chrome gắn **route** (và iOS tab luôn hiện), không derive từ permission server. Anonymous/attendee biết tồn tại Admin/Cổng/Platform; phishing UX dễ hơn. |
| **SEC-GAP-NAV-02** | Low | Hardening | Không middleware soft-redirect anonymous `/admin|/gate|/platform` → `/auth?return=…`. |

**Không phải blocker:** thiếu nav ẩn ≠ thiếu API authz. Attacker vẫn cần OIDC + membership active + permission.

---

## 2. API gate/admin — deny-by-default? (spot-check)

### Gate (`apps/api/src/gate.ts` → `packages/backend/src/gate.ts`)

- Mọi endpoint Gate: `@ApiBearerAuth` + `actor()` = `verifyBearerToken` + upsert identity; thiếu config → `OIDC_MISCONFIGURED` / 401.
- `openStaffSession` / `reserveCheckin` / `confirmCheckin` / undo / revoke / offline-sync: `requireTenantPermission(…, permission, eventId)` trước nghiệp vụ.
- `AuthzError` → HTTP **403** (`authzHttpException`).
- Session staff: `assertSessionActive` (user + ACTIVE + `revoked_at IS NULL`).

### Event admin (`apps/api/src/events.ts` → `packages/backend/src/event-admin.ts`)

- Cùng pattern: bearer → `withTenant` → `requireTenantPermission` trên create/list/get/patch/clone/archive/cancel/impact/ticketType/source (nhiều call sites trong `event-admin.ts`).
- `AuthzError` → 403.

### Membership library (`packages/backend/src/membership.ts`)

- `isMembershipActive` / `lockActiveMembershipForShare`: thiếu row / chưa activate / **revoked** → `AuthzError` (`MEMBERSHIP_REQUIRED` / `MEMBERSHIP_REVOKED`).
- `requireTenantPermission`: deny-by-default; permission phải có trên membership hoặc event assignment.
- Revoke: `FOR UPDATE`; privileged ops: `FOR SHARE` — request sau revoke commit fail (đã DoD Issue #12).

**Verdict mục 2:** **PASS** (security) — spot-check không thấy “allow by default” trên Gate/Admin hot path.

---

## 3. Client có tin role từ cache cũ sau revoke?

| Layer | Hành vi | Kết luận |
| --- | --- | --- |
| API | Mỗi privileged call re-check membership qua `requireTenantPermission` | **Không** tin client role |
| Web Admin | `GET /api/bff/me/tenants` **một lần** lúc mount (`admin-form.tsx`); `Cache-Control: private, no-store` trên BFF | Sau revoke, selector có thể **stale** đến khi reload — UI signaling; mutate vẫn 403 |
| Web invite UX | Map `MEMBERSHIP_REVOKED` → copy VI deny (`invite-messages.ts`) | Tốt cho invite path |
| Mobile `SessionBoundary` | Cache theo `userId`+tenant; `invalidate`/`logout` clear cache; identity chỉ từ server verify | Không elevate từ Keychain; **không** auto-invalidate khi API trả `MEMBERSHIP_REVOKED` giữa session |
| iOS Staff screen | Fail-closed thiếu bearer/API (`resolveGateAuth` — theo BA audit) | Tab vẫn hiện (NAV gap) |

| ID | Severity | Loại | Mô tả |
| --- | --- | --- | --- |
| **SEC-GAP-CACHE-01** | Low–Medium | **UX** (không bypass) | Sau revoke, web admin tenant list / iOS tab có thể còn “nhìn như có quyền” đến khi refetch hoặc API deny. Cần clear cache + re-fetch `me/tenants` (và ẩn chrome) khi 401/403 `MEMBERSHIP_*`. |

**Verdict mục 3:** Client **không** là SoT cho authz; residual = stale privilege **signaling**.

---

## 4. Secrets / demo credentials trên guest path?

| Nơi | Có password/demo secret? | Guest runtime? |
| --- | --- | --- |
| `/auth` production | Không — chỉ fail-closed copy | Không |
| `/auth` `NODE_ENV !== 'production'` | Tên biến `OIDC_CLIENT_*` (không value) | Dev-only |
| Guest redeem/claim/home | Không password | Không |
| `apps/web/README.md` | `attendee-demo` / `staff-demo` | Docs dev — **không** render UI |
| `docs/asc/app-review-notes.md` | Demo passwords cho ASC | Docs ops — ngoài guest UI |
| BFF `forwardWithBearer` misconfig | Message liệt kê tên env gồm `OIDC_CLIENT_SECRET` | Low info disclosure (tên, không giá trị) |
| BFF `UPSTREAM_UNAVAILABLE` | Có thể gồm URL `API_BASE_URL` | Low (nội bộ topology) |
| Admin `decide.ts` | Scrub redemption/invite code khỏi message reject | Hardening tốt |

| ID | Severity | Loại |
| --- | --- | --- |
| **SEC-GAP-SECRET-01** | Low | Hardening — rút gọn BFF error messages (không echo full upstream URL / danh sách env production) |
| Demo creds in README/ASC | Info | Chấp nhận cho fixture; **không** đưa vào guest UI (hiện đã đúng) |

**Verdict mục 4:** **PASS** cho guest UI runtime — không có demo credentials trên đường khách.

---

## 5. BFF error leakage (bổ sung)

- Upstream body **passthrough** (status + JSON API) — phụ thuộc Nest map lỗi có kiểm soát (`ApiError` code/message), không stack raw từ BFF.
- Admin decision path scrub secret fields — tốt.
- Không thấy lộ access token trong response BFF đã đọc.

---

## Ma trận findings

| ID | Severity | Blocker merge? | Loại | Đề xuất Task fix |
| --- | --- | --- | --- | --- |
| SEC-GAP-NAV-01 | Medium | **Không** (UX/disclosure) | Privilege signaling | Gộp **O02**: nav/tab theo permission server; guest chrome khi anonymous; ẩn «Nhân viên»/Admin/Cổng khi thiếu quyền |
| SEC-GAP-NAV-02 | Low | Không | Hardening | Soft-gate deep-link anonymous → `/auth` + return URL (web) |
| SEC-GAP-CACHE-01 | Low–Medium | Không | UX revoke | On 401/403 `MEMBERSHIP_*` / `PERMISSION_DENIED`: clear tenant/role UI state, refetch `/me/tenants`, optional force re-login copy |
| SEC-GAP-SECRET-01 | Low | Không | Hardening | Sanitize BFF client-facing errors (no env inventory / internal URL in prod) |
| API deny-by-default | — | — | **PASS** | Không cần fix authz core từ audit này |

---

## Đề xuất Issue / Task (VI — chưa tạo số)

1. **`[Security/UX] O02 nav theo permission — web + iOS`** (P0 product / Medium security-adjacent)  
   - AC: anonymous guest chrome không lộ staff links; authenticated không có quyền → không tab/menu staff; có quyền → hiện đúng.  
   - Roles: `web` ∥ `ios` (+ DoD). Cross-ref BA `GAP-BA-O02`.

2. **`[Web] Soft-gate deep-link staff surfaces khi chưa đăng nhập`** (P2)  
   - Redirect `/admin|/gate|/platform` → `/auth` khi thiếu session; sau login return. Không thay API gate.

3. **`[Web/iOS] Revoke UX — invalidate client privilege cache`** (P1 UX)  
   - Khi API trả `MEMBERSHIP_REVOKED` / 403 privilege: clear selector, ẩn staff chrome, copy VI rõ.

4. **`[Web] BFF error message hygiene (prod)`** (P2 hardening)  
   - Message ổn định, không liệt kê secret env names / full upstream URL cho client.

---

## Checks đã chạy trên SHA

```text
git rev-parse HEAD
→ c3fc98faa2d8bb7b427c1bcc8ec710cc91002b72

CRG: list_graph_stats_tool (graph sẵn; semantic embed hạn chế → lean-ctx + source)
Source spot-check:
  apps/web/src/site-chrome.tsx
  apps/web/app/{page,admin,gate,platform,account,auth}/…
  apps/api/src/{gate,events}.ts
  packages/backend/src/{membership,gate,event-admin}.ts
  apps/web/src/bff/{upstream,api-error}.ts
  apps/web/src/admin/decide.ts
  apps/mobile/src/{identity/session-boundary.ts,app/(tabs)/_layout.tsx}
```

Không chạy exploit / không gọi prod destructive; không runtime UAT full (docs + source audit).

---

## Limitations

- Graph `head_matches_build` có thể lệch commit docs trong phiên; **source + `git rev-parse` thắng**.
- Không enumerate mọi Nest controller ngoài Gate/Event-admin; branding/CS/inventory đã thấy `requireTenantPermission` qua search — không deep-review từng route.
- Không chứng minh CI xanh trên SHA này (artifact docs-only).

---

## Verdict cuối

**PASS with known gap** trên exact SHA `c3fc98faa2d8bb7b427c1bcc8ec710cc91002b72`.

- **Security blocker:** không (API authz deny-by-default + không client SoT role + không demo secret trên guest UI).
- **Known gaps:** NAV-01/02, CACHE-01, SECRET-01 — ưu tiên Task O02 (đồng bộ BA) rồi revoke UX + BFF hygiene.
- Coordinator: **không** yêu cầu giữ feature PR chỉ vì các gap UX này; spawn fix Task riêng khi xếp hàng đợi.
)
