# ADR-20 — Portal admin (`portal.vemoki.com`) + Ant Design + session/BFF

| Trường | Giá trị |
| --- | --- |
| ID | **ADR-20** (coordinator cấp) |
| Ngày chấp nhận | **2026-10-18** |
| Trạng thái | **Đã chấp nhận** — gói P0+P1 primary [`docs/plans/PORTAL-ROADMAP.md`](../plans/PORTAL-ROADMAP.md) do **user duyệt** (hội thoại 18/10/2026); kỹ thuật trong thẩm quyền coordinator được chốt dưới đây |
| Role soạn | `architect` · [`docs/agents/roles/architect.md`](../agents/roles/architect.md) · Mode **Thiết kế** |
| Run / Task | `run_34fde1e32ed1` · `task_fe3aadfcd481` |
| Base SHA đã đối chiếu source | `c7e344847b1acf1688302fef513b277fc8f18973` (`origin/main`); research artifacts local trên checkout portal-coordination |
| Discovery tiền đề | [`PORTAL-SUBDOMAIN-ANTD.md`](../architecture/PORTAL-SUBDOMAIN-ANTD.md), [`PORTAL-DISCOVERY-SECURITY.md`](../reviews/PORTAL-DISCOVERY-SECURITY.md), [`PORTAL-WEB-FEASIBILITY.md`](../plans/PORTAL-WEB-FEASIBILITY.md), [`PORTAL-BACKEND-GAPS.md`](../plans/PORTAL-BACKEND-GAPS.md) |
| Non-goals ADR này | Production DNS/TLS/deploy/cutover/cloud/store; Android/payment/Wallet/enterprise SSO/billing/custom-domain; multi-event BI (O12/O14 OUT); sửa Nest invariants tenant/RLS/PG quota/check-in |

Architecture impact: **Có**.

> Decision Log: coordinator cập nhật mục tiếp nối O13 sau khi commit ADR này (worker không sửa GitHub / Decision Log trong Task này).

---

## 1. Ngữ cảnh

O13 khóa `vemoki.com` (marketing) và `app.vemoki.com` (product: attendee + staff admin + Gate + platform trên cùng Next app). User yêu cầu **staff admin riêng** tại `portal.vemoki.com` với UI **Ant Design**, và đã duyệt gói triển khai P0+P1 theo roadmap portal (không hỏi lại host/UI).

Hiện trạng source (đã đọc):

- `apps/web` — Next App Router; OIDC BFF `/api/auth/{login,callback,logout}` dùng env `OIDC_CLIENT_ID` (local `.env.example` = `ticket-web`); cookie host-only `oidc_*` (`apps/web/src/oidc/cookies.ts` — **không** set `domain`).
- Platform — client/cookie tách: `PLATFORM_OIDC_*`, cookie `platform_oidc_*`, routes `/api/auth/platform/*` (`apps/web/src/platform/oidc.ts`).
- CSRF/origin fail-closed — `apps/web/src/bff/origin.ts` (thiếu Origin → 403; allowlist `WEB_PUBLIC_ORIGIN`).
- Post-login anti open-redirect — `sanitizePostLoginPath` path-only, drop query (`apps/web/src/oidc/post-login.ts`).
- Realm Keycloak (`infra/keycloak/realm-ticket.json`): `ticket-admin-web` confidential + PKCE S256 nhưng Valid Redirect URIs khai báo `/api/admin/auth/callback` — **không** có mirror route trong tree `apps/web/app/api`. Platform realm URIs lệch path so với code (`/api/platform/auth/callback` vs `/api/auth/platform/callback`).
- Refresh token được **lưu** cookie sau code exchange; **chưa** thấy grant `refresh_token` dùng lại trong BFF (gap phải đóng trên portal).

---

## 2. Quyết định đã chấp nhận (tên tường minh)

| Mã | Quyết định |
| --- | --- |
| `GATE-STAY-APP` | Web Gate giữ `app.vemoki.com/gate` trong đợt P0/P1; không chuyển portal cùng cutover admin |
| `PORTAL-SEPARATE-APP` | Next app riêng **`apps/portal`** trong monorepo (không host-aware lâu dài trong `apps/web`; không git repo ngoài) |
| `PLATFORM-PORTAL-ZONE` | Platform Operator chuyển wave P1.1 vào `portal.vemoki.com/platform` với **client + cookie + audience + nav** riêng; Tenant Owner ≠ Operator |
| `ANTD-CORE-FIRST` | Ant Design thuần (Layout/Menu/Table/Form/Drawer/Modal/Steps/Upload); locale VI; **không** ProComponents / Umi / Ant Design Pro mặc định |

### Host map (sau ADR)

| Host | Audience | Surface |
| --- | --- | --- |
| `vemoki.com` | Buyer GTM | Marketing / legal / support (O13 giữ) |
| `app.vemoki.com` | Attendee + Web Gate | Redeem/claim/invite/account/`/t/*`; **`/gate`** |
| `portal.vemoki.com` | Staff admin (+ Platform P1.1) | AntD shell; `/` hoặc `/admin` staff; `/platform` Operator |
| `api.` / `auth.` | Nest / Keycloak | Topology giữ |

**Sửa O13 audience admin** tường minh: staff admin UI đích = `portal.`, không còn “admin sống trên `app.`” sau parity + switch. Gate path O13 **giữ** trên `app.`.

---

## 3. Identity / OIDC / cookie / BFF (chốt kỹ thuật)

### 3.1 Clients

| Surface | Keycloak client | Loại | PKCE | Ghi chú |
| --- | --- | --- | --- | --- |
| Attendee + Gate (app process) | `ticket-web` | Confidential | S256 | Giữ callback `https://app.vemoki.com/api/auth/callback` |
| Staff portal | **`ticket-admin-web`** | Confidential | **S256** | Portal process **chỉ** client này cho staff session |
| Platform Operator | `ticket-platform-web` (env `PLATFORM_OIDC_CLIENT_ID`; khớp realm id — sửa drift `.env.example` `ticket-platform` khi coordinator chạm env) | Confidential + ACR MFA | S256 | Cookie/audience tách; không tái dùng staff access token |

**Cấm wave P0/P1:** thêm route legacy mới `/api/admin/auth/*` trên portal hoặc app. Callback staff trên portal = **`/api/auth/callback`** (cùng path shape với app, **khác origin**).

Coordinator (realm/env, task riêng — không DNS prod trong ADR):

1. Thêm Valid Redirect URI / webOrigin / post-logout cho **`https://portal.vemoki.com/api/auth/callback`** (và local portal port) trên `ticket-admin-web`.
2. Không bắt buộc implement URI `/api/admin/auth/callback` đã khai báo lịch sử; dual-run có thể giữ URI cũ trên app cho đến khi gỡ admin legacy — **không** nhân bản path đó trên portal.
3. Platform: chuẩn hóa redirect **`…/api/auth/platform/callback`** trên portal (khớp code hiện có); dual-run giữ URI app đến parity Platform.

### 3.2 Cookies (host-only)

| Host | Cookie jar | Domain attr |
| --- | --- | --- |
| `app.vemoki.com` | `oidc_*` (attendee/Gate), CSRF app | **omit** |
| `portal.vemoki.com` | Staff: `oidc_*` (tên tái dùng **trên host portal**, jar tách vì host-only) **hoặc** prefix `portal_oidc_*` nếu spike chứng minh conflict tooling — mặc định **giữ tên `oidc_*` trên portal process** vì process khác host; Platform: `platform_oidc_*` | **omit** |

**Cấm tuyệt đối:** `Domain=.vemoki.com`. IdP SSO trên `auth.` **≠** chia sẻ BFF cookie giữa `app.` và `portal.`.

Flags: `HttpOnly`; `Secure` theo `AUTH_COOKIE_SECURE` (prod TLS); `SameSite=lax`; `Path=/`. Không dùng `document.cookie` để “chứng minh” session HttpOnly.

### 3.3 Same-origin BFF + Origin fail-closed

- Browser chỉ gọi BFF **cùng origin** với surface (`portal./api/bff/*` → Nest Bearer từ cookie server-side).
- Mutating methods: thiếu `Origin` hoặc Origin ngoài allowlist → **403** (pattern `assertSameOrigin`).
- Portal process env: `WEB_PUBLIC_ORIGIN` (hoặc alias `PORTAL_WEB_PUBLIC_ORIGIN` map vào cùng reader) = origin portal exact; **không** gộp `app.` vào allowlist portal sau dual-run trừ cửa sổ có chủ đích rồi gỡ.
- App process giữ allowlist app; không tin `X-Forwarded-Host` client — nginx **overwrite** `$host` (ADR-16 / deploy docs).

### 3.4 Logout semantics (per-surface — bắt buộc tường minh)

| Hành động UI | Hiệu ứng bắt buộc | Không giả định |
| --- | --- | --- |
| “Đăng xuất portal” | Clear cookie staff trên **host portal**; RP-initiated Keycloak end-session với `client_id=ticket-admin-web` + `post_logout_redirect_uri` portal `/auth` | Xóa cookie `app.` hoặc `platform_oidc_*` |
| “Đăng xuất Operator” | Clear `platform_oidc_*` trên portal; end-session platform client | Xóa staff `oidc_*` trừ UX gọi rõ cả hai |
| “Đăng xuất khỏi app / Gate” | Clear cookie trên **app** + end-session `ticket-web` | Xóa portal jar |
| “Đăng xuất mọi ứng dụng Vemoki” (P1 optional UX) | Chuỗi RP logout từng surface + IdP end-session; **không** bắt buộc implementation wave P0 | Dùng parent-domain cookie để “một phát xóa hết” |

Wave P0: **per-surface logout explicit** đủ DoD. Coordinated multi-host logout = enhancement có AC riêng — không gate foundation portal.

### 3.5 Token refresh / revoke

| Sự kiện | Semantics |
| --- | --- |
| Code exchange | Lưu `access_token` (maxAge ≈ `expires_in`) + `refresh_token` (TTL dài hơn, HttpOnly) như app hiện tại |
| Trước gọi Nest khi access hết/401 | Portal BFF **phải** `grant_type=refresh_token` server-side; rotate cookie; thất bại → clear session + 401/redirect login (fail-closed, không mock) |
| Logout surface | Clear cookies jar đó; gọi Keycloak end-session; **nên** gọi token revoke endpoint Keycloak cho refresh (best-effort; lỗi revoke không chặn clear cookie local) |
| Membership revoke / capability mất | Nav/BFF fail-closed (pattern `nav-capabilities-store` / staff guard); không giữ UI “thành công” với 403 |

### 3.6 Env `.example` (portal process — tên đề xuất)

`apps/portal/.env.example` (web scaffold; coordinator đồng bộ ENV-MANIFEST / compose khi được phép):

```text
OIDC_ISSUER=…
OIDC_CLIENT_ID=ticket-admin-web
OIDC_CLIENT_SECRET=…   # never commit real
OIDC_REDIRECT_URI=http://127.0.0.1:<portal-port>/api/auth/callback
OIDC_SCOPES=openid profile email
WEB_PUBLIC_ORIGIN=http://127.0.0.1:<portal-port>
API_BASE_URL=…
AUTH_COOKIE_SECURE=   # empty local; true behind TLS
PORTAL_ORIGIN=https://portal.vemoki.com
PRODUCT_ORIGIN=https://app.vemoki.com
MARKETING_ORIGIN=https://vemoki.com
# Platform (P1.1) — fail-closed nếu thiếu khi bật zone
PLATFORM_OIDC_CLIENT_ID=ticket-platform-web
PLATFORM_OIDC_CLIENT_SECRET=…
PLATFORM_OIDC_REDIRECT_URI=…/api/auth/platform/callback
PLATFORM_OIDC_AUDIENCE=ticket-platform-api
PLATFORM_OIDC_REQUIRED_ACR=2
```

`apps/web/.env.example` giữ `ticket-web` cho attendee/Gate; thêm `PORTAL_ORIGIN` cho CTA/redirect flags.

---

## 4. Shared helpers vs copy-lock

**Quyết định:** trong cùng wave coordinator thêm workspace `apps/portal` + lockfile, extract **thin package** `@ticket/web-session` (tên cuối coordinator confirm nếu conflict naming) chứa **chỉ** pure helpers:

- canonicalize / public-origin allowlist read
- `assertSameOrigin` / CSRF origin primitives
- session cookie option factories (+ platform cookie name constants nếu dùng chung)
- `sanitizePostLoginPath` (allowlist mở rộng portal — §5)

**Không** extract toàn bộ BFF route handlers, admin panels, Nest clients, hay AntD shell.

| Ownership | Phạm vi |
| --- | --- |
| Coordinator | `packages/web-session` (hoặc tên chốt), lockfile, CI path filter |
| Web | `apps/portal` + redirects/nav trong `apps/web`; import package; **không** fork logic origin/CSRF |
| Drift mitigation | ESLint `no-restricted-imports` cấm copy lại module đã nằm trong package; package có unit tests chuyển từ `apps/web/tests/origin.test.ts` / oidc-config |

**Interim copy-lock** chỉ nếu lockfile wave bị chặn: ghi `SOURCE` path + sha256 trong `docs/ops` note; tối đa một PR portal foundation; promote shared ngay PR kế. Không coi copy vô hạn là đích.

Handoff: **đủ để web foundation code ngay** (scaffold portal + login shell + BFF stub) khi package/helpers sẵn hoặc copy-lock có chủ đích — **không** chờ mọi Nest gap đóng.

---

## 5. Invite / email / deep-link

| Luồng | Host đích | Ghi chú |
| --- | --- | --- |
| Staff invite **accept** / onboarding nhân sự | **`portal.`** | Link email staff → portal path allowlist; login `ticket-admin-web` |
| Attendee invite / redeem / claim / guest | **`app.`** (giữ) | Không kéo guest vào AntD portal |
| Gate scanner bookmark | **`app./gate`** | `GATE-STAY-APP` |

Deep-link an toàn (mọi host):

- Chỉ path allowlist; **cấm** `//`, scheme, host ngoại, open redirect qua `return`/`next`/`redirect`.
- Query: migration redirect **giữ** query nghiệp vụ allowlist (org/event/intent); post-login cookie **drop** query tùy ý (giữ pattern hiện tại) trừ adapter có AC riêng.
- Fragment: server không nhận — client adapter nếu PD yêu cầu.
- Không copy raw token/PII vào URL mới.

Mở rộng `sanitizePostLoginPath` allowlist portal: `/`, `/admin`, `/auth`, `/platform` (và path con staff được PD liệt kê) — **không** thêm `/gate` vào portal allowlist.

---

## 6. AntD / CSP / trust boundaries

| Mục | Chốt |
| --- | --- |
| Registry | `@ant-design/nextjs-registry` `AntdRegistry` **chỉ** root layout `apps/portal` — first paint SSR styles |
| Theme | `ConfigProvider` + token Vemoki; `App` wrapper cho message/modal; locale `vi_VN` |
| CSP | CSP **riêng process portal**; spike P0.1: nonce (hoặc hash) khớp StyleProvider / css-in-js — **không** nới `style-src *` trên `app.` vì portal |
| Trust | UI AntD không cấp quyền; Nest + RLS deny-by-default; BFF không forward header spoof; attendee process **không** chứa admin AntD routes |
| ProComponents | OUT mặc định (`ANTD-CORE-FIRST`) |

---

## 7. DTO / audit / cursor / privacy / permission — **policy đã chốt (§7.1)**

Authority cho consumer BE/web = **§7.1** + `packages/backend/src/role-map.ts` hiện tại. **Không** tạo permission mới (`audit.read` / `inventory.read`) và **không** role-map migration trong đợt O16/P1.

> **Superseded (không phải alternate deploy):** trước §7.1 từng có bảng «đề xuất» + câu hỏi coordinator confirm (`audit.read` mới / Supervisor map / `inventory.read` mới). Các option đó **đã bị thay** bởi §7.1 — **không** mở OpenAPI hay nav theo proposal cũ.

| ID | Contract | Permission / privacy (**đã chốt**) | Cursor |
| --- | --- | --- | --- |
| **H-A1** | `GET /v1/tenants/{t}/events/{e}/audit?cursor&from&to&action` | **`report.read` hiện có** + event assignment (như `readEventReport`). Owner vẫn cần assignment; Manager theo allowlist `MANAGER_EVENT`. CS / Scanner / Supervisor **không** tự có audit/report từ tên role (`eventPermissionsForRole('Supervisor')` = `gate.confirm`/`gate.undo`/`ticket.revoke` only). Response allowlist: `actorUserId`, `action`, `resourceType`/`resourceId`, `createdAt`, `operationId` khi cần — **không** raw email/phone/token/code/HMAC; **không** dump tùy ý `sanitizedDiff` / payload secret. `report.read` ≠ quyền export audit. Tôn O06 retention. | Opaque `nextCursor`; **không** bịa `total` |
| **H-P-AUDIT** | `GET /v1/platform/audit?…` tách hẳn staff audit | Operator + MFA/verifier platform; audience `ticket-platform-api` — **không** staff `report.read` / support-grant `cs.read` | Cùng cursor policy |
| **H-C1** | `GET …/codes?cursor&limit&state&sourceId&q` (gap G-C1) | **`inventory.import` hiện có** + event assignment. **Không** `inventory.read` mới. Response: code **id** (identifier), `status`/state, `sourceId`, `ticketTypeId`; masked suffix chỉ nếu derive an toàn ở layer response — schema `RedemptionCode` lưu `code_hmac`/pepper **không** được list ra client; raw code không tồn tại trên row list. `q` = lookup kiểu CS (hash input server-side), không echo raw. | cursor+limit |
| **H-M1/M2** | Members / invites list (gap G-M*) | `members.manage`; cross-tenant → 404/403 không leak; email masked | cursor+limit |
| **List chung** | Mọi list portal Table | Server authz; UI filter ≠ bypass | Cursor-first; cấm offset giả toàn bộ |

**Privacy mặc định (bắt buộc):** list/detail CS-like masking; export giữ cooldown/quyền hiện có; audit/codes browser không trở thành dump secret/HMAC raw.

### 7.1 Coordinator xác nhận trong phạm vi O16 (18/10/2026)

- Staff event audit dùng **`report.read` hiện có**, yêu cầu event assignment như reporting; không tạo `audit.read`/migration quyền hàng loạt ở đợt này. Owner vẫn cần assignment, Manager theo allowlist; CS/Scanner/Supervisor không tự có quyền audit từ tên role. Audit response theo `PortalAuditEntry` đã chốt: audit/actor/resource/operation IDs, action và createdAt; không free-text `reason`, không tự dựng result chưa có trong source; không raw email/phone/token/code/HMAC/payload dump. Quyền đọc báo cáo không mặc nhiên quyền export audit.
- Platform audit là endpoint riêng dưới `/v1/platform/audit`, chỉ Operator với verifier platform/MFA; không đi qua staff `report.read` hoặc support grant `cs.read`.
- Inventory codes browse dùng **`inventory.import` hiện có**, event-scoped; chỉ code identifier/masked suffix và state/source/type, không list raw code hoặc hash secret (`code_hmac`). Không tạo `inventory.read` mới.
- `PLATFORM_OIDC_REQUIRED_ACR=2` khớp default `PLATFORM_MFA_ACR_VALUES=2` trong `packages/backend/src/platform-config.ts` và quyết định MFA hiện hành; không sao chép ví dụ `vemoki-mfa` của web vào portal rồi gây mismatch. Backend verifier là nguồn enforce, cấu hình realm local phải được kiểm chứng.
- `@ticket/web-session` được coordinator chấp nhận làm thin pure helper package. Có thể copy-lock một PR foundation nếu shared package chưa sẵn, nhưng phải có source fingerprint và security regression; không thêm framework hay extract whole BFF.

Đây là handoff đủ để triển khai trong scope đã duyệt; không là security/UAT PASS. Task backend/API vẫn cần contract/test và reviewer độc lập trên exact SHA.

---

## 8. Migration / dual-run / rollback

| Phase | Hành vi |
| --- | --- |
| Expand | Scaffold `apps/portal` + OIDC callback portal; **giữ** admin legacy trên `app.` đến parity matrix đủ evidence |
| Flags | Redirect `app./admin` (và `/platform` khi P1) → portal: **chỉ GET/HEAD navigation**; **mặc định OFF**; destination cố định + query allowlist; **không** redirect POST/PUT/PATCH/BFF mù |
| Switch | Chỉ khi Task deploy được ủy quyền + parity pass; DNS/TLS/nginx portal; monitor |
| Rollback | Tắt flag app→portal **trước**; không tạo loop portal↔app; giữ callback/legacy route cần rollback; **không** “fix” bằng parent-domain cookie |
| Gate | **Không** nằm trong redirect admin |

Legacy admin UI/BFF trên `app.` **không** gỡ cho đến hết cửa sổ dual-run đã thống nhất.

**Prep local (P1.2):** thao tác loopback + Keycloak URI port `3013` + rollback giấy — [`PORTAL-LOCAL-CUTOVER-PREP.md`](./PORTAL-LOCAL-CUTOVER-PREP.md). Không thay thế Task deploy prod.

---

## 9. Test matrix (evidence khi implement — chạy trên exact SHA)

Tái sử dụng / mở rộng tests hiện có: `apps/web/tests/origin.test.ts`, `oidc-config.test.ts`, `gate-csrf.test.ts`, `invite-csrf.test.ts`, `marketing-host.test.ts`.

| # | Case | Pass khi |
| --- | --- | --- |
| T1 | Flag ON: `app./admin?foo=1` → portal | 302 Location host portal **và** query `foo=1`; chỉ GET/HEAD |
| T2 | Flag OFF | Không redirect admin; legacy vẫn phục vụ |
| T3 | Open redirect | `return=https://evil`, `//evil`, scheme → reject |
| T4 | Cookie host-only | Set-Cookie portal **không** có `Domain=.vemoki.com` |
| T5 | CSRF | Origin `app.` mutate portal BFF → 403; Origin portal + token → pass |
| T6 | Staff client | Portal login dùng `ticket-admin-web`; callback path `/api/auth/callback` |
| T7 | Platform (P1.1) | `platform_oidc_*` + ACR; không lẫn staff token |
| T8 | Gate | `app./gate` không 302 portal; login/scan regression |
| T9 | Logout per-surface | Clear đúng jar; UI copy khớp semantics §3.4 |
| T10 | Refresh | Access hết hạn → refresh grant thành công hoặc fail-closed logout |
| T11 | Attendee | `app.` login/me không cần portal cookie; bundle không kéo antd |
| T12 | CSP/SSR | First paint có style registry; không nới CSP app vì portal |
| T13 | XFH | Spoof `X-Forwarded-Host` không đổi canonical khi env set |

Headless UAT: `scripts/web-uat.sh` / Playwright — milestone gate khi đóng Epic (không thay unit matrix).

---

## 10. Ownership / handoff coding

| Việc | Owner |
| --- | --- |
| ADR-20 + Decision Log link | architect (file này) → coordinator commit/Log |
| `apps/portal` scaffold, AntD shell, auth/BFF routes, redirects flags trong `apps/web` | **web** |
| `@ticket/web-session` + lockfile/CI/workspace | **coordinator** |
| Nest gaps G-M*/G-I*/H-A1… | **backend** (contract trước consumer khi thiếu API) |
| Realm/OIDC URI/env compose (non-prod → prod khi được phép) | **coordinator** |
| DNS/TLS/nginx prod | **chỉ** Task deploy ủy quyền riêng |
| DoD / security exact SHA | `reviewer-dod` ± `reviewer-security` |
| Gate move | **OUT** gói này |

**Parallel:** web foundation portal **không** bị chặn bởi mọi API gap; màn P0 phụ thuộc endpoint thiếu → Task BE song song / Bị chặn từng màn — không chặn boot auth/shell.

---

## 11. Phương án đã xét và không chọn

| Phương án | Lý do loại |
| --- | --- |
| Host-aware lâu dài trong `apps/web` (A) | Nhiễm AntD/CSP/bundle attendee; user đã duyệt `PORTAL-SEPARATE-APP` |
| Gate chuyển portal (G1) cùng cutover | Risk day-of/kiosk; đã duyệt `GATE-STAY-APP` |
| Platform host thứ tư / giữ mãi trên app | Ops sớm / lệch staff shell; đã duyệt `PLATFORM-PORTAL-ZONE` |
| Callback `/api/admin/auth/*` mới | Realm lịch sử lệch code; task cấm thêm legacy path — dùng `/api/auth/callback` trên portal |
| `Domain=.vemoki.com` / logout đa host bắt buộc P0 | Vi phạm O07/O13 B2; security discovery T4 |
| ProComponents mặc định | Peer antd 6 chưa chứng minh; `ANTD-CORE-FIRST` |
| Extract toàn hệ thống shared BFF | Scope creep; chỉ thin session helpers |

---

## 12. Hệ quả

1. Continuity O13: marketing/app giữ; **admin audience** chuyển portal sau parity.
2. Thêm process/image/CI `apps/portal`; Keycloak URIs portal; hai `WEB_PUBLIC_ORIGIN`.
3. Legacy admin trên app đến parity + flag redirect; Gate/attendee regression bắt buộc.
4. Foundation web được phép code theo ADR này trong Epic/Run đã ủy quyền PR/CI/integration — **không** tự DNS/deploy prod.
5. Coordinator confirm §7 (permission/DTO) trước khi tuyên bố audit browser acceptance complete.

---

## 13. Evidence đã đọc (exact)

**Git:** `c7e344847b1acf1688302fef513b277fc8f18973`

**Docs:** `PORTAL-ROADMAP.md`, `PORTAL-SUBDOMAIN-ANTD.md`, `PORTAL-DISCOVERY-SECURITY.md`, `PORTAL-WEB-FEASIBILITY.md`, `PORTAL-BACKEND-GAPS.md`, `ADR-19`, `ENV-MANIFEST.md` §5, `DECISION-LOG` O13 (đối chiếu)

**Source / tests:**  
`apps/web/src/oidc/{config,cookies,post-login}.ts`, `apps/web/src/bff/origin.ts`, `apps/web/src/platform/oidc.ts`, `apps/web/app/api/auth/{callback,logout}/route.ts`, `apps/web/app/api/auth/platform/callback/route.ts`, `apps/web/.env.example`, `infra/keycloak/realm-ticket.json` (clients `ticket-web` / `ticket-admin-web` / `ticket-platform-web`), `apps/web/tests/origin.test.ts`, `oidc-config.test.ts`

**CRG:** `code-review-graph-ticket` `list_graph_stats_tool` OK (~3888 nodes); semantic embeddings thiếu → path/FTS + lean-ctx/source verify.

**Không có trong Task này:** runtime OIDC portal, DNS, commit (root coordinator commit docs wave), sửa Decision Log/GitHub.

---

## 14. Kết luận

**Đủ để triển khai trong scope** foundation `apps/portal` + auth/BFF/AntD shell theo quyết định §2–§6 và §8–§9.

Còn **coordinator confirm** (không hỏi lại user host/UI): §7 permission/DTO audit & inventory read; tên package shared nếu đổi khỏi `@ticket/web-session`; đồng bộ realm client id platform với `.env.example`.

Blocker cứng cho coding foundation: **không** — ADR-20 đã chấp nhận theo duyệt user 2026-10-18.
