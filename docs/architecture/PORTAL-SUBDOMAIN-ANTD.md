# Portal subdomain + Ant Design — roadmap kiến trúc (đề xuất)

| Trường | Giá trị |
| ------ | ------- |
| Ngày soạn | 2026-10-18 |
| Role | `architect` — [docs/agents/roles/architect.md](../agents/roles/architect.md) |
| Mode | Thiết kế (discovery) — **không** feature coding trong Task này |
| Trạng thái | **Đề xuất** — chưa ADR đã chấp nhận; không tự chuyển quyền Gate/Platform |
| Base SHA đã đọc | `400ad87a1401972476c79f17c4fd726ca7538063` |
| Run / Task | `run_df32d5572a2d` / `task_e3802a180517` |
| Output duy nhất | file này (`docs/architecture/PORTAL-SUBDOMAIN-ANTD.md`) |
| Liên quan O13 | [o13-marketing-app-subdomain.md](./o13-marketing-app-subdomain.md), [DECISION-LOG O13](../DECISION-LOG.md#o13--trang-bán-platform-gtm--tách-subdomain-18102026) |
| Điều phối Run | [PORTAL-RESEARCH-RUN.md](../plans/PORTAL-RESEARCH-RUN.md) |
| Crosscheck discovery | BA/PD/BE/security/planner đã có artifact §9.3 — đối chiếu 2026-10-18 |

**Đã xác nhận từ user (không hỏi lại):** host **`portal.vemoki.com`** = staff admin + UI **Ant Design**. Việc còn lại là chốt biên Gate/Platform/packaging/session trong gói duyệt ADR — không hỏi “có làm portal không”.

**Non-goals:** không commit/push/PR; không DNS/TLS/deploy; không cài package; không sửa `apps/mobile` / `infra/*` dirty tree của Run khác; không mở Android/payment/refund/transfer/seat/Wallet/SSO doanh nghiệp/billing/custom-domain; không đổi Nest invariants (tenant/RLS/quota/check-in); không tuyên bố pilot/production ready.

**Architecture impact:** Có — subdomain/session/UI migration; consumer coding chỉ sau khi coordinator đóng gói duyệt §3–§4 (và user chấp nhận ADR).

**Sync IA shell (2026-10-19):** Trên production `portal.vemoki.com`, staff shell `apps/portal` dùng sider Ant Design **nhóm** (org · tên sự kiện / vận hành · thiết lập) — không flat list; permission vẫn O02 qua `capabilities.ts`. Deploy 2026-10-19; code WIP nhánh `hangndat/d1-portal-nav-groups` base `52bc54e3fdcb`, **chưa merge `main`**. Evidence: [PORTAL-PROD-UAT-NAV-2026-10-19.md](../reviews/PORTAL-PROD-UAT-NAV-2026-10-19.md), [PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md](../reviews/PORTAL-NAV-SPINNER-WIP-DOD-2026-10-19.md). Không đổi host model §3 — chỉ ghi trạng thái UI đã quan sát.

---

## Checklist đầu ra architect

| # | Mục | Section |
| - | --- | ------- |
| 1 | Phạm vi, ràng buộc, audit hiện trạng | §1–§2 |
| 2 | Host model + Gate/Platform (cần chốt) | §3 |
| 3 | Packaging: `apps/web` host-routing vs `apps/portal` | §4 |
| 4 | Ant Design + CSP/style | §5 |
| 5 | Cookie / OIDC / CSRF / CORS / redirect an toàn | §6 |
| 6 | Migration / rollback / ownership / deps | §7–§9 |
| 7 | ADR draft + evidence + kết luận | §10–§12 |

---

## 1. Vấn đề và mục tiêu

### Vấn đề

O13 đã khóa **hai host**: marketing `vemoki.com` và product `app.vemoki.com` (attendee + staff admin + Gate + platform cùng product host). User giao tiếp: tách **portal admin staff** sang `portal.vemoki.com`, UI **Ant Design (antd)**, chỉ discovery/design/roadmap.

Hiện `apps/web` là một Next App Router (`next@16.4.2`) không phụ thuộc antd: admin là surface form-heavy (`apps/web/app/admin/admin-form.tsx` ~2390 dòng), Gate/platform cùng app; BFF cookie host-only; Keycloak clients `ticket-web` / `ticket-admin-web` / `ticket-platform-web`.

### Mục tiêu đề xuất (sau khi ADR được chấp nhận)

| Host | Audience | Surface chính (khuyến nghị dứt khoát) |
| ---- | -------- | ------------------------------------- |
| `vemoki.com` | Buyer GTM | Sales / legal / support (O13 giữ) |
| `app.vemoki.com` | Attendee / guest **+ Web Gate day-of** | Redeem, claim, invite, account, `/t/*`, demo; **`/gate` giữ đây** (G2) |
| `portal.vemoki.com` | Staff admin + Platform Operator | `/admin` (antd) + **`/platform` (P1)**; không mặc định chuyển Gate |
| `api.vemoki.com` / `auth.vemoki.com` | API / IdP | Không đổi topology (ADR-16 / Keycloak self-host) |

### Invariants giữ nguyên

1. Cookie session **host-only** — omit `Domain`; **cấm** `Domain=.vemoki.com` (O07 / R-INT R9 / O13 B2).
2. Không tin `X-Forwarded-*` từ client; nginx **bắt buộc** ghi đè `X-Forwarded-Host $host`.
3. Canonical origin / CSRF allowlist qua env (`WEB_PUBLIC_ORIGIN`), không suy từ forwarded thô khi env đã set.
4. Authz deny-by-default; Nest + RLS là nguồn quyền; UI antd không tự cấp quyền.
5. Self-host Keycloak/MinIO/SMTP; native iOS chỉ local build; mobile API/source public **không** đổi vì portal.

---

## 2. Audit hiện trạng (read-only, exact source)

### 2.1 Host routing (O13 đã có trong code)

- `apps/web/proxy.ts` — Next 16 `proxy` (thay middleware): soft-redirect anonymous `/admin|/gate` → `/auth?next=…`; gọi `decideHostRouting`.
- `apps/web/src/marketing/hosts.ts` — apex marketing rewrite; product paths trên marketing host **302** → `PRODUCT_ORIGIN` **giữ `search`**.
- `PRODUCT_PATH_PREFIXES` gồm `/admin`, `/platform`, `/gate`, `/auth`, `/redeem`, `/api/auth`, `/api/bff`, `/api/admin`, …

**Gap vs portal:** chưa có host `portal.vemoki.com`; mọi staff vẫn sống trên `app.` theo O13.

### 2.2 Session / OIDC / BFF

| Khía cạnh | Evidence | Ghi chú |
| --------- | -------- | ------- |
| Attendee/staff cookie | `apps/web/src/oidc/cookies.ts` — `oidc_access_token` / refresh / PKCE / state; `httpOnly`, `sameSite: 'lax'`, **không** `domain` | Một jar host-only trên product host |
| Platform cookie tách tên | `apps/web/src/platform/oidc.ts` — `platform_oidc_*` | Cùng host vẫn tách session Operator |
| CSRF | `apps/web/src/bff/csrf.ts` — Origin allowlist `WEB_PUBLIC_ORIGIN` + double-submit `vemoki_csrf` | Mutating BFF bắt buộc JSON + header |
| Public origin | `apps/web/src/oidc/public-origin.ts` | Ưu tiên env; fallback X-Forwarded chỉ khi env trống |
| Post-login path | `apps/web/src/oidc/post-login.ts` — allowlist path-only, **drop query**, chặn `//` / scheme | Anti open-redirect |
| Staff guard | `apps/web/src/nav/staff-route-guard.ts` | Soft-redirect capability fail-closed |
| API auth routes | `/api/auth/{login,callback,logout}` + `/api/auth/platform/*` | **Chưa** có mirror `/api/admin/auth/*` trong tree `app/api` dù realm `ticket-admin-web` đã khai báo callback |

### 2.3 Keycloak realm (file repo — có dirty local ngoài Task)

Clients liên quan (đọc `infra/keycloak/realm-ticket.json` tại workspace; **không sửa** trong Task này):

| Client | PKCE | Redirect URI (đã thấy) |
| ------ | ---- | ---------------------- |
| `ticket-web` | S256 | `…/api/auth/callback` trên local + `vemoki.com` + `app.vemoki.com` |
| `ticket-admin-web` | S256 | `…/api/admin/auth/callback` (URI khai báo; route code mirror chưa thấy) |
| `ticket-platform-web` | S256 + ACR MFA | mix `/api/auth/platform/callback` và `/api/platform/auth/callback` |

Nguồn chính thức: Keycloak Valid Redirect URIs dùng exact/case-sensitive match; production nên HTTPS cụ thể, tránh wildcard rộng ([Keycloak OIDC securing apps — Redirect URIs](https://www.keycloak.org/securing-apps/oidc-layers), truy cập 2026-10-18).

### 2.4 Deploy edge (docs + compose — read-only)

- ADR-16 / `infra/deploy/README.md`: nginx host giữ 80/443; `X-Forwarded-Host $host` bắt buộc.
- Compose mẫu đã hướng `PUBLIC_WEB_BASE_URL` / `WEB_PUBLIC_ORIGIN` / `OIDC_REDIRECT_URI` → `https://app.vemoki.com` (O13 product). **Chưa** `portal.`.

### 2.5 UI stack

- `apps/web/package.json`: chỉ `next` / `react` / `@ticket/contracts` — **không** antd.
- `next.config.ts` trống (không CSP headers trong config).
- Admin UX hiện custom CSS/components; D11 BA đã ghi admin là surface dày, một form lớn.

### 2.6 Giới hạn công cụ

- CRG MCP `code-review-graph-ticket`: `list_graph_stats_tool` OK (≈3888 nodes); `semantic_search_nodes_tool` không match query tự do (0 embeddings) → audit bằng `ctx_compose` / đọc path + `rg` trên source.
- Không chạy runtime login/UAT trong Task docs-only — không bịa proof.

---

## 3. Host model — Gate và Platform (khuyến nghị dứt khoát + tradeoff)

O13 #2 đặt admin **và** gate trên `app.`. User đã xác nhận **portal admin antd** → sửa audience admin (và đề xuất platform). **Không** mặc định chuyển Gate. Khuyến nghị dưới đây thống nhất đa số discovery (planner/BA/BE + follow-up coordinator): **Gate giữ `app.`** để giảm risk migration day-of / kiosk / deep-link.

### 3.1 Ma trận audience → host (**khuyến nghị gói duyệt**)

| Surface | Host khuyến nghị | Ghi chú |
| ------- | ---------------- | ------- |
| Marketing / sales | `vemoki.com` | O13 giữ |
| Attendee redeem/claim/ticket/guest | `app.vemoki.com` | Bundle nhẹ; không antd |
| **Web Gate** `/gate` | **`app.vemoki.com` (G2)** | Day-of / kiosk; không chặn cutover admin portal |
| Staff admin `/admin` + BFF admin | **`portal.vemoki.com`** | antd; yêu cầu user đã xác nhận |
| Platform `/platform` | **`portal.vemoki.com` (P1)** | Cùng staff shell; cookie `platform_oidc_*` đã tách tên |
| Public availability / event guest | `app.vemoki.com` (`/t/*`) | Không kéo guest vào portal |

### 3.2 Gate — options + **khuyến nghị = G2**

| | **G1 — Gate trên portal** | **G2 — Gate giữ trên app** ★ | **G3 — `gate.vemoki.com`** |
| - | ------------------------- | ---------------------------- | -------------------------- |
| Ý tưởng | `portal./gate` | Giữ `app./gate` (O13 path) | Host thứ tư |
| Pros | Staff shell thống nhất | **Giảm risk:** deep-link/TF/kiosk/offline Gate iOS không đụng cutover portal; wave admin độc lập | Isolate tải quét |
| Cons | Đổi bookmark scanner; gộp day-of vào antd release | Staff Gate session vẫn trên host attendee (XSS blast — mitigate capability + sau này G1) | Premature ops |
| Auth | Portal OIDC | Cookie `app.` hiện tại | Client riêng |

**★ Khuyến nghị architect (gói duyệt): G2.** Public availability/FAQ **không** chuyển portal. Chuyển Gate (G1) chỉ là wave sau khi portal admin ổn + UAT kiosk riêng — không bắt cùng cutover (khớp `PORTAL-EPIC-TASKS` S4 không chặn I2).

**Staff login admin:** trên `portal`. **Gate login:** giữ flow `app./auth` (scanner). Attendee OTP/magic trên `app`. Không gộp guest login vào portal.

### 3.3 Platform — options + **khuyến nghị = P1**

| | **P1 — `/platform` trên portal** ★ | **P2 — `platform.vemoki.com`** | **P3 — giữ trên app** |
| - | ---------------------------------- | ------------------------------ | --------------------- |
| Pros | Một edge staff; MFA ACR + `platform_oidc_*` sẵn; khớp planner Option A | Isolate Operator mạnh | Zero move |
| Cons | Cùng host portal (path + client mitigate) | Thêm DNS/OIDC | Admin portal / Operator lệch host attendee |
| Khi nào P2 | Compliance/ops sau portal ổn | | Chỉ dual-run tạm |

**★ Khuyến nghị: P1** trong wave portal. **Không** tạo subdomain thứ tư mặc định.

### 3.4 IdP SSO vs BFF host-only session (bắt buộc phân biệt)

| Lớp | Hành vi | Hệ quả |
| --- | ------- | ------ |
| **Keycloak IdP session** | Browser có thể còn SSO cookie trên `auth.vemoki.com` sau khi login một RP | Lần auth kế trên host khác có thể skip password (SSO IdP) — **không** đồng nghĩa share BFF cookie |
| **BFF app cookies** (`oidc_*` trên `app.`) | Host-only | Logout `app.` **không** xóa cookie `portal.` |
| **BFF portal cookies** | Host-only trên `portal.` | Tương tự ngược lại |
| **Platform cookies** (`platform_oidc_*`) | Tên tách; vẫn host-only | Logout platform route hiện **chỉ** clear cookie local (chưa end-session IdP) — gap đã ghi security |

**Khuyến nghị semantics (chưa bắt buộc code):**

1. **Không** dùng `Domain=.vemoki.com` để “một logout / một cookie”.
2. **Không** mặc định bắt “logout mọi host” trong wave 1 nếu chưa chốt UX — ghi rõ trong UI: “Đăng xuất khỏi portal” vs “Đăng xuất khỏi mọi ứng dụng Vemoki” (RP-initiated + clear từng host).
3. Threat model security (`PORTAL-DISCOVERY-SECURITY` T4) yêu cầu **thiết kế** logout matrix trước prod; acceptance wave sau chọn: (a) logout chỉ host hiện tại, hoặc (b) coordinated logout đa host + Keycloak end-session. Architect **không** tự chốt (b) trong discovery này.

### 3.5 Xung đột với O13 (cần quyết định tường minh)

| O13 đã chốt | Portal khuyến nghị | Hành động |
| ----------- | ------------------ | --------- |
| Admin trên `app.` | Admin → `portal.` | **D-PORTAL-01** sửa audience — không im lặng |
| Gate trên `app.` | **Giữ `app.` (G2)** | Khớp O13 Gate; không chuyển mặc định |
| Cookie host-only product | Host-only **từng** `app.` / `portal.` | Giữ invariant |
| CTA → `app./auth` | Staff CTA → `portal`; attendee/demo/Gate login giữ `app.` | PD/web sau duyệt |

---

## 4. Packaging — `apps/web` host-routing vs `apps/portal`

### 4A — So sánh

| | **A — Host-aware trong `apps/web`** | **B — App riêng `apps/portal` (monorepo)** |
| - | ----------------------------------- | ----------------------------------------- |
| Ý tưởng | Mở rộng `decideHostRouting`: Host `portal.` serve `/admin|/gate|/platform` + antd layout; `app.` chỉ attendee | Next app thứ hai; nginx `portal.` → `vemoki-portal:300x`; share `@ticket/contracts` |
| Pros | Một PR/ownership web ban đầu; reuse BFF helpers; dual-run redirect dễ | **Tách bundle antd** khỏi attendee/marketing; CSP/style registry độc lập; fail-closed không lộ admin route trên app process; CI/image tách |
| Cons | Root `AntdRegistry` / CSS-in-JS dễ “nhiễm” marketing+attendee nếu layout chung; build nặng; rủi ro middleware host bug | Thêm package/workspace, compose service, lockfile (coordinator), duplicate chrome/auth wiring |
| Ops | Một upstream `vemoki-web`; phân nhánh bằng `Host` | Hai upstream; TLS SAN `portal.` |

### 4B — Khuyến nghị dứt khoát (gói duyệt)

**★ Chọn B — `apps/portal` (Next app trong monorepo).**

Lý do ưu tiên: (1) antd App Router cần `AntdRegistry` ở layout ([docs chính thức](https://ant.design/docs/react/use-with-next/), 2026-10-18) — tách process tránh nhiễm marketing/attendee/Gate trên `app.`; (2) CSP/`style-src` portal siết độc lập; (3) fail-closed: process `app.` không chứa admin UI mới; (4) khớp epic planner Option P1 và mục tiêu cô lập XSS attendee↔admin (security T7).

**A chỉ là interim kỹ thuật** (redirect matrix trong `apps/web` + dual-run) — **không** khuyến nghị A làm đích lâu dài. Scaffold portal có thể song song với redirect host-aware trên `apps/web` (ownership web cả hai, một Dispatch/slice tại một thời điểm theo WIP).

Không tách git repo ngoài monorepo ở wave này.

### 4C — Compatibility

- Mobile / public API Nest: **không đổi** contract vì portal.
- BFF pattern giữ same-origin trên từng host: browser → `portal./api/bff/*` → Nest Bearer từ cookie server-side.
- Shared types: `@ticket/contracts` only; không import UI portal vào mobile.

---

## 5. Ant Design — ràng buộc kỹ thuật

Nguồn chính thức (truy cập **2026-10-18**):

| Nguồn | URL | Áp dụng |
| ----- | --- | ------- |
| antd + Next App Router | https://ant.design/docs/react/use-with-next/ | `AntdRegistry` inject first-screen styles; tránh flicker; không dùng sub-component dạng `Select.Option` — import path |
| Theme tokens | https://ant.design/docs/react/customize-theme/ | Brand Vemoki qua token; không fork theme per-tenant binary |
| Table | https://ant.design/components/table/ | UI pagination/filter ≠ authz server |
| i18n antd | https://ant.design/docs/react/i18n/ | Locale VI product; marketing VI+EN vẫn O13 |
| Next proxy | https://nextjs.org/docs/app/api-reference/file-conventions/proxy | Host routing / cookie đọc trên proxy layer |
| Keycloak redirect | https://www.keycloak.org/securing-apps/oidc-layers | Exact HTTPS redirect URIs |

### CSP / style nonce (đề xuất thiết kế)

- Hiện `next.config.ts` không set CSP — portal wave nên thêm CSP **riêng process portal** (deployment task được duyệt).
- antd css-in-js: ưu tiên registry chính thức; nếu bật CSP `style-src 'nonce-…'`, cần kế hoạch nonce khớp StyleProvider / zero-runtime (đánh giá spike trong Task web feasibility — không chốt thuật toán trong file này).
- **Không** nới `style-src *` trên attendee host vì portal.

### ProComponents

Pro Layout (https://procomponents.ant.design/en-US/components/layout/) là **tùy chọn đánh giá** (PD/web) — không mặc định đổi framework hay bắt buộc dependency.

---

## 6. Cookie / OIDC / CSRF / CORS / legacy redirect

### 6.1 Cookie (sau cutover đề xuất)

| Host | Cookies | Domain attr |
| ---- | ------- | ----------- |
| `app.vemoki.com` | `oidc_*` attendee; CSRF attendee | omit (host-only) |
| `portal.vemoki.com` | `oidc_*` staff **và/hoặc** client admin; `platform_oidc_*` nếu P1; CSRF portal | omit |
| `vemoki.com` | không OIDC product | — |

**Cấm:** `Domain=.vemoki.com`. SSO giữa `app.` và `portal.` **không** tự có — staff mở portal login riêng (có thể cùng IdP Keycloak SSO session server-side, nhưng cookie BFF vẫn per-host).

### 6.2 OIDC clients / redirect (expand → contract)

Thêm URI **trước** cutover DNS; giữ URI cũ trong dual-run:

| Client | Redirect thêm (đề xuất) | webOrigins thêm | post-logout |
| ------ | ----------------------- | --------------- | ----------- |
| `ticket-web` (attendee) | giữ `app./api/auth/callback` | `https://app.vemoki.com` | `https://app.vemoki.com/auth` |
| Staff trên portal | `https://portal.vemoki.com/api/auth/callback` (wave 1: **một** confidential client + PKCE S256) | `https://portal.vemoki.com` | `https://portal.vemoki.com/auth` |
| Gate / attendee trên app | giữ `https://app.vemoki.com/api/auth/callback` | `https://app.vemoki.com` | `https://app.vemoki.com/auth` |
| `ticket-platform-web` | `https://portal.vemoki.com/api/auth/platform/callback` (khớp path code hiện có) | `https://portal.vemoki.com` | theo logout matrix §3.4 |

**Client staff:** realm đã có `ticket-admin-web` nhưng **thiếu** route mirror `/api/admin/auth/*` trong `apps/web`. **Khuyến nghị wave 1:** portal dùng **một** client confidential + PKCE; hoặc hoàn thiện `ticket-admin-web` **hoặc** trỏ portal vào client staff rõ ràng — **không** chạy hai client chồng cookie cùng tên trên cùng host. Chi tiết chọn client = Task web+coordinator khi ADR accept (không blocker quyết định host).

### 6.3 CSRF / CORS

| Surface | Rule |
| ------- | ---- |
| Portal BFF | `WEB_PUBLIC_ORIGIN` (hoặc `PORTAL_WEB_PUBLIC_ORIGIN`) = `https://portal.vemoki.com` — Origin ngoài allowlist → 403 |
| App BFF | giữ `https://app.vemoki.com` |
| Dual-run tạm | allowlist comma-separated; **contract** gỡ host cũ |
| CORS Nest | không thay authz; chỉ origin cần thiết |
| Marketing | không gọi BFF authenticated |

### 6.4 Legacy `/admin` (và `/gate`) — deep-link an toàn

Yêu cầu: **không mất search params**; **không open redirect**.

| Nguồn | Hành vi đề xuất |
| ----- | --------------- |
| `https://vemoki.com/admin?…` | 302 → `https://portal.vemoki.com/admin?…` (giữ query; có thể qua `app.` dual-run rồi portal) |
| `https://app.vemoki.com/admin?x=1` | 302 → `https://portal.vemoki.com/admin?x=1` — `pathname + search` (pattern `decideHostRouting`) |
| `https://app.vemoki.com/gate?…` | **Không** redirect sang portal nếu G2 — Gate ở lại `app.` |
| `next` / `return` query | Path allowlist only (`sanitizePostLoginPath`); **không** `//` / scheme / host ngoại |
| External `?redirect=https://evil` | Reject |

Open redirect regression tests bắt buộc trong matrix §8.

### 6.5 Env (đề xuất tên — deployment task riêng)

| Biến | Host | Owner |
| ---- | ---- | ----- |
| `WEB_PUBLIC_ORIGIN` / alias compose | per-process app vs portal | coordinator + web |
| `OIDC_REDIRECT_URI` | khớp host process | coordinator |
| `PLATFORM_OIDC_REDIRECT_URI` | portal nếu P1 | coordinator |
| `PRODUCT_ORIGIN` / `PORTAL_ORIGIN` / `MARKETING_ORIGIN` | absolute CTA | web |
| `PUBLIC_WEB_BASE_URL` | invite/email: attendee links → `app.`; staff invite accept → chốt BA (thường `portal` hoặc `app` path) | BA + coordinator |

DNS/TLS/proxy: **chỉ** trong deployment task được ủy quyền — không làm trong discovery.

---

## 7. Migration / rollout / rollback

### Phase 0 — Gói duyệt (hiện tại)

1. Coordinator đóng gói khuyến nghị §12 cho user: **B + G2 + P1** (+ logout matrix tùy chọn).
2. Discovery BA/PD/BE/security/planner đã có — crosscheck §9.3.
3. ADR draft → Decision Log **chỉ khi** user chấp nhận (không tự “Đã chấp nhận”).

### Phase 1 — Expand (sau ủy quyền coding)

1. Scaffold **`apps/portal`** (đích B) + redirect legacy trong `apps/web`.
2. antd + registry **chỉ** portal layout.
3. BFF/auth extract shared **không** đụng Nest business rules; đóng gap API theo BE (G-M*/G-I*) trước “portal đẹp”.
4. Unit: origin/CSRF/host redirect preserve query / anti open-redirect; Gate path **không** bị kéo nhầm.
5. Keycloak: **thêm** portal redirect URIs (giữ app cho Gate/attendee).

### Phase 2 — Switch (deploy được phép)

1. DNS + TLS `portal.vemoki.com`; nginx → portal upstream; **overwrite** `X-Forwarded-Host`.
2. `app./admin` (+ `/platform` nếu P1) 302 → portal giữ query; **`/gate` ở lại app**.
3. Nav/email staff admin → portal; Gate bookmark giữ `app.`.
4. Headless UAT portal + Gate/attendee regression trên `app.`.

### Phase 3 — Contract

1. Gỡ admin UI cũ khỏi bundle attendee (hoặc 410 sau redirect).
2. Gỡ redirect URI staff khỏi `app.` clients khi monitor ổn.
3. Cập nhật ENV-MANIFEST / deploy examples.

### Rollback

| Trigger | Hành động |
| ------- | --------- |
| Login/callback portal fail | Giữ DNS; nginx portal 302 → `app.` legacy admin; Keycloak vẫn còn app URI (dual-run) |
| antd/CSP break | Revert portal release; attendee `app.` không phụ thuộc antd nên tách blast |
| Cookie regress | Không bao giờ “fix” bằng `Domain=.vemoki.com` |

---

## 8. Test matrix (evidence cần thu khi implement — chưa chạy)

| # | Case | Pass khi |
| - | ---- | -------- |
| T1 | `app./admin?foo=1` → portal | 302 Location host `portal.` **và** query `foo=1` |
| T2 | Open redirect | `return=https://evil` / `//evil` bị reject |
| T3 | Cookie host-only | Set-Cookie portal không có `Domain=.vemoki.com` |
| T4 | CSRF | Origin `app.` mutate portal BFF → 403; Origin `portal.` + token → pass |
| T5 | Attendee login | `app.` login/me không cần portal cookie |
| T6 | Platform MFA (P1) | `platform_oidc_*` + ACR; audience `ticket-platform-api` trên portal |
| T7 | Gate G2 | `app./gate` vẫn login/scan; **không** 302 sang portal; race invariant BE giữ |
| T7b | Logout semantics | Theo matrix đã chốt: clear đúng host; không giả định cookie `.vemoki.com`; IdP SSO có thể còn — UI nói rõ |
| T8 | Marketing | apex không serve antd admin |
| T9 | Mobile API | contract public không đổi (BE smoke) |
| T10 | nginx XFH | Client spoof `X-Forwarded-Host` không thành origin canonical khi env set |

---

## 9. Ownership và dependency thật

### 9.1 Dependency DAG (artifact)

```text
Coordinator gói duyệt: B + G2 + P1 (+ logout option)
    │
    ├─► User chấp nhận ADR → Decision Log          [blocker coding/deploy semantics]
    │
    ├─► BA / PD / Architect(this) / Web feas / BE gaps / Sec  [discovery ∥ — đã có]
    │
    ▼ (Run coding sau ủy quyền)
T-WEB portal boot (B) ∥ T-BE đóng G-M*/G-I* nếu còn block UI  ∥ Gate (G2) không chặn
    │
    ▼
Platform P1 trên portal (sau portal boot)
    │
    ▼
reviewer-dod + reviewer-security (exact SHA) → merge → UAT; DNS khi được phép
```

Coding **bị chặn thật** khi: ADR chưa accept; hoặc thiếu Nest path mà BFF/contracts đã kỳ vọng (xem §9.3) cho màn P0.

### 9.2 Ownership

| Việc | Role |
| ---- | ---- |
| Host/OIDC/CSP/packaging khuyến nghị | architect → **user** chốt qua coordinator |
| Journeys staff/AC | product-ba |
| Ant Design IA/a11y | product-design |
| `apps/portal` + redirects `apps/web` | web |
| Nest đóng gap list/import… | backend |
| DNS/TLS/nginx/realm/env prod | coordinator (task deploy riêng) |
| Threat model / logout matrix | reviewer-security |
| DoD exact-SHA | reviewer-dod |

### 9.3 Crosscheck discovery (2026-10-18) — API / biên

| Artifact | Khớp khuyến nghị architect? | API / gap đáng chú ý |
| -------- | --------------------------- | -------------------- |
| [PORTAL-EPIC-TASKS](../plans/PORTAL-EPIC-TASKS.md) | Gate giữ `app.`; Platform → portal; packaging P1=`apps/portal` | S4 Gate không chặn I2 admin |
| [PORTAL-BACKEND-GAPS](../plans/PORTAL-BACKEND-GAPS.md) | Gate giữ product/kiosk; subdomain ≠ authz | **G-M1/G-M2** members/invites list; **G-I1** import lifecycle — BFF/CTR đã mô tả, OpenAPI/controller thiếu; **không bịa** API tùy ý; dashboard multi-event = OUT trừ Gate/user (O12/O14) |
| [PORTAL-PRODUCT-RESEARCH](../plans/PORTAL-PRODUCT-RESEARCH.md) | portal + antd confirmed; ADR options Gate/platform | Journeys Owner/Manager/CS; không tự thi hành DNS |
| [PORTAL-ANTD-UX](../design/PORTAL-ANTD-UX.md) | antd shell staff | PD states permission-denied / async-job |
| [PORTAL-DISCOVERY-SECURITY](../reviews/PORTAL-DISCOVERY-SECURITY.md) | host-only; cấm Domain=. ; CSRF sibling; logout matrix | T4/T7; platform logout chưa end-session IdP — ghi §3.4 |
| PORTAL-WEB-FEASIBILITY | (nếu có) | Đối chiếu Next/antd registry / CSP spike |

**Hệ quả:** wave portal UI **không** chờ Gate move; **có thể** cần BE đóng G-M*/G-I* song song nếu AC P0 liệt kê members/import job UI đầy đủ.

---

## 10. ADR draft (không tự chấp nhận)

**Đề xuất ID:** `ADR-DRAFT-portal-subdomain-antd` (coordinator cấp số ADR chính thức khi chấp nhận).

| Mục | Nội dung đề xuất |
| --- | ---------------- |
| Context | Tách staff admin UI antd khỏi attendee host sau O13 |
| Decision (nháp) | (1) `portal.vemoki.com` + antd (user đã xác nhận); (2) packaging **B** `apps/portal`; (3) Gate **G2** giữ `app.`; (4) Platform **P1** trên portal; (5) cookie host-only per host — IdP SSO ≠ BFF session; (6) legacy `/admin` redirect giữ query, anti open-redirect; (7) logout matrix chốt riêng trước prod |
| Consequences | Sửa O13 **admin** audience; Gate path O13 giữ; thêm DNS/OIDC portal; hai WEB origin; không Domain=.vemoki.com |
| Status | **Đề xuất** — chờ user (gói coordinator) |

Khi chấp nhận: tạo `docs/ops/ADR-NN-…`, cập nhật DECISION-LOG, **không** backdate O13.

---

## 11. Evidence đã đọc (exact)

**Git:** `400ad87a1401972476c79f17c4fd726ca7538063`

**Docs:** `docs/PRD.md`, `docs/TECHNICAL-DESIGN.md` (skim invariants), `docs/DECISION-LOG.md` O13, `docs/ROADMAP.md` (status động = Project #3), `docs/architecture/o13-marketing-app-subdomain.md`, `docs/plans/PORTAL-RESEARCH-RUN.md`, `docs/agents/roles/architect.md`

**Source:**  
`apps/web/proxy.ts`, `apps/web/src/marketing/hosts.ts`, `apps/web/src/oidc/{cookies,public-origin,post-login,config}.ts`, `apps/web/src/bff/csrf.ts`, `apps/web/src/platform/oidc.ts`, `apps/web/src/nav/staff-route-guard.ts`, `apps/web/app/api/auth/**`, `apps/web/package.json`, `apps/web/next.config.ts`, `infra/deploy/README.md` + compose env keys (read-only), `infra/keycloak/realm-ticket.json` (read-only; file có thể dirty ngoài Task)

**Official (URL + ngày truy cập 2026-10-18):**  
antd Next, antd theme/table/i18n; Next.js proxy docs; Keycloak OIDC redirect guidance (links §5).

**Không có:** runtime proof login portal; deploy portal; ADR đã accept.

---

## 12. Kết luận — gói khuyến nghị cho coordinator

**Trạng thái:** `Đề xuất` — đủ đóng gói duyệt; **chưa** ADR accept / chưa coding-deploy.

### Khuyến nghị dứt khoát (tradeoff đã nêu §3–§4)

| Trục | Chọn | Tradeoff chấp nhận |
| ---- | ---- | ------------------ |
| Host admin + antd | `portal.vemoki.com` | Sửa O13 admin; user đã xác nhận |
| Packaging | **B — `apps/portal`** | Thêm image/CI; đổi lấy tách bundle/CSP/antd |
| Gate | **G2 — giữ `app.`** | Staff Gate vẫn gần attendee host; giảm risk cutover |
| Platform | **P1 — `/platform` trên portal** | Cùng host portal; cookie MFA đã tách tên |
| Session | Host-only BFF; IdP SSO tách lớp | Không Domain=. ; logout đa host **không** mặc định bắt buộc wave 1 |
| Legacy `/admin` | 302 portal giữ query | Anti open-redirect allowlist |

**Blocker còn lại cho user:** chấp nhận gói trên (hoặc chọn G1/P2/A có chủ đích). Client OIDC staff cụ thể = chi tiết implement sau accept.

**API:** đóng gap BFF↔OpenAPI (G-M1/M2, G-I1, …) theo BE — không invent; không đụng mobile public API.

**Còn lại ngoài Task:** coordinator tổng hợp duyệt; ủy quyền coding/deploy riêng; không commit từ worker này.
