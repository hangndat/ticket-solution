# ADR / Handoff — O13: marketing `vemoki.com` vs product `app.vemoki.com`

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Trạng thái | **Đã chốt hướng triển khai (architect)** — chưa deploy prod |
| Base SHA đã đọc | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| Nguồn chốt sản phẩm | [DECISION-LOG O13](../DECISION-LOG.md#o13--trang-bán-platform-gtm--tách-subdomain-18102026), [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH](../plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md) |
| Deploy hiện tại | [ADR-16](../DECISION-LOG.md) · [infra/deploy/README.md](../../infra/deploy/README.md) |
| Cookie/host rule sẵn có | [ENV-MANIFEST §5](../ops/ENV-MANIFEST.md) · `scripts/lib/tenant-host.mjs` (host-only; **cấm** `Domain=.vemoki.com`) |

**Non-goals (Task):** không deploy prod; không đổi OIDC provider (Keycloak giữ nguyên); không payment / Android / Wallet / seat (O10).

**Phạm vi file này:** chỉ docs/handoff. Đề xuất cho `apps/web` + coordinator (DNS/nginx/env/realm) — **không** sửa code trong Task này.

---

## Checklist 5 mục đầu ra architect

| # | Mục | Section |
| - | --- | ------- |
| 1 | Context & constraints | §1 |
| 2 | Options (≥2 host packaging + ≥2 cookie/session) | §2 |
| 3 | Decision + DNS/TLS/nginx sketch | §3 |
| 4 | Cookie / CORS / OIDC redirect + env vars | §4–§5 |
| 5 | Cutover, ownership, test matrix, rollback | §6–§9 |

---

## 1. Context & constraints

### Vấn đề

O13 khóa GTM: buyer (Tenant Owner + Agency) thấy **sales** tại apex `vemoki.com`; mọi product surface (auth, admin, redeem, gate, event guest, demo fixture) sống trên **`app.vemoki.com`**. Hiện prod edge proxy một host web `vemoki.com` → `vemoki-web:3000` (ADR-16). Session BFF là cookie host-only; Keycloak redirect/webOrigins và `PUBLIC_WEB_*` / `WEB_PUBLIC_ORIGIN` đang trỏ apex.

### Ràng buộc kỹ thuật đã có (không được phá)

1. **Cookie session host-only** — omit `Domain`; cấm `Domain=.vemoki.com` (O07 / tenant wildcard / R-INT R9).
2. **OIDC:** Keycloak self-host `auth.vemoki.com` — không đổi provider (ADR-09/11).
3. **Origin redirects:** prefer allowlist env (`WEB_PUBLIC_ORIGIN` trong code web; deploy docs/`compose` còn ghi `PUBLIC_WEB_ORIGIN`) — không tin `X-Forwarded-*` thô; nginx **bắt buộc** `X-Forwarded-Host $host`.
4. **BFF same-origin:** browser → Next `/api/auth/*` + `/api/bff/*`; Nest nhận Bearer từ cookie server-side — marketing **không** cần share session cookie với product.
5. **ASC / store:** Marketing + Support URL → `vemoki.com` (+ privacy 200); deep link product → `app.vemoki.com` sau cutover.

### Gap vận hành cần ghi nhận (không sửa trong Task này)

| Gap | Hiện trạng | Ảnh hưởng cutover |
| --- | ---------- | ----------------- |
| Tên env origin | Code đọc `WEB_PUBLIC_ORIGIN`; `infra/deploy/compose.yaml` set `PUBLIC_WEB_ORIGIN` | Coordinator/web phải **đồng bộ tên** khi đổi host product (đề xuất: compose truyền `WEB_PUBLIC_ORIGIN`, alias docs) |
| Platform redirect path | Realm có `…/api/platform/auth/callback`; app dùng `…/api/auth/platform/callback` | Khi cập nhật realm cho `app.` chỉ thêm URI khớp **path code thật** |
| Admin client | Realm `ticket-admin-web` → `/api/admin/auth/callback`; chưa thấy route mirror trong `apps/web/app/api` | Giữ URI apex cũ tạm; thêm `app.` khi web ship admin callback |

---

## 2. Options

### 2A — Đóng gói marketing vs product (host packaging)

| | **A1 — Monorepo host-aware Next (`apps/web`)** | **A2 — Tách app marketing (`apps/marketing` hoặc package riêng)** |
| - | --------------------------------------------- | ------------------------------------------------------------------ |
| Ý tưởng | Một Next app; middleware/host switch: apex = sales(+privacy/support/i18n); `app.` = product routes hiện tại | Process/image riêng cho sales; product giữ `apps/web` |
| Pros | Một PR web; dùng chung tokens/brand; deploy một `vemoki-web` hoặc hai upstream từ cùng build; khớp O13 “không bắt buộc tách git” | Isolate GTM deps; scale/cache marketing độc lập; giảm rủi ro sales page đụng auth middleware |
| Cons | Middleware/host bugs có thể lộ product route trên apex (cần fail-closed allowlist path); build nặng hơn | Thêm ownership/CI/image; lockfile/coordinator; duplicate brand wiring |
| Ops | nginx: apex → web:3000 (marketing mode), `app.` → web:3000 **hoặc** cùng upstream + `Host` khác | nginx: apex → marketing:3002, `app.` → web:3000 |

**Khuyến nghị: A1 (host-aware trong `apps/web`)** cho wave GTM đầu. O13 chỉ khóa DNS/host boundary; tách repo/package (A2) trì hoãn đến khi sales cần CMS/release cadence khác product.

### 2B — Cookie / session giữa apex và `app.`

| | **B1 — Cookie `Domain=.vemoki.com` (share session)** | **B2 — Tách session (host-only trên `app.`)** |
| - | --------------------------------------------------- | --------------------------------------------- |
| Ý tưởng | Set `Domain=.vemoki.com` để apex đọc được token BFF | Giữ host-only như hiện tại; marketing **không** mang OIDC session |
| Pros | “Đăng nhập một lần thấy cả marketing” | Khớp R-INT/O07; không mở rộng blast radius sang `*.vemoki.com` tenant hosts; CSRF/origin đơn giản hơn |
| Cons | **Vi phạm** rule host-only đã chốt; cookie đi tới mọi subdomain (tenant, api nhầm lẫn nếu path rộng); marketing surface thành attack target session | CTA “Đăng nhập” phải cross-origin sang `app.`; user trên apex chưa có session (đúng GTM) |

**Khuyến nghị: B2 (tách session, host-only trên `app.vemoki.com`).** Marketing chỉ link CTA; form quan tâm không dùng BFF cookie product.

### Ma trận chọn

| Trục | Chọn | Lý do ngắn |
| ---- | ---- | ---------- |
| Packaging | **A1** | Nhanh, đủ O13, một ownership web |
| Cookie | **B2** | Đã là invariant repo; marketing ≠ authenticated product |

---

## 3. Decision + DNS / TLS / nginx sketch

### Quyết định

1. **Hosts:** `vemoki.com` (+ `www` → apex) = marketing/sales; `app.vemoki.com` = product BFF + UI; giữ `api.vemoki.com`, `auth.vemoki.com`.
2. **App layout:** monorepo **host-aware** `apps/web` (A1); không tách git marketing ở wave này.
3. **Session:** host-only trên `app.vemoki.com` (B2); **không** `Domain=.vemoki.com`.
4. **Canonical product origin:** mọi OIDC redirect, post-login/post-logout, invite/email deep link product, CSRF allowlist product → `https://app.vemoki.com`.
5. **Apex sau cutover:** chỉ sales + legal/support + form quan tâm (+ i18n VI/EN); request product path trên apex → **301/302** sang `https://app.vemoki.com{path}` (danh sách path §6).

### DNS (sketch)

| Record | Type | Target / ghi chú |
| ------ | ---- | ---------------- |
| `vemoki.com` | A/AAAA (hoặc ALIAS) | VPS edge (đã có) |
| `www.vemoki.com` | CNAME/A | → apex; nginx 301 → `https://vemoki.com$request_uri` |
| `app.vemoki.com` | A/AAAA | Cùng VPS edge |
| `api.vemoki.com` | (giữ) | Nest |
| `auth.vemoki.com` | (giữ) | Keycloak |
| `*.vemoki.com` tenant | (giữ O07) | Không dùng cho session platform |

TLS: Let's Encrypt (hoặc cert hiện có) — thêm SAN/`app.vemoki.com` (và `www` nếu chưa). Reload nginx sau `nginx -t`.

### Nginx sketch (ADR-16: nginx host giữ 80/443; Compose không publish 80/443)

```nginx
# --- marketing (apex) ---
server {
  listen 443 ssl http2;
  server_name vemoki.com;
  # ssl_certificate …;

  location / {
    proxy_pass http://vemoki-web:3000;   # host-aware Next — marketing routes
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;  # bắt buộc overwrite
  }
}

server {
  listen 443 ssl http2;
  server_name www.vemoki.com;
  return 301 https://vemoki.com$request_uri;
}

# --- product ---
server {
  listen 443 ssl http2;
  server_name app.vemoki.com;
  # ssl_certificate …;

  location / {
    proxy_pass http://vemoki-web:3000;   # cùng upstream (A1) hoặc upstream riêng nếu sau này A2
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host  $host;
  }
}

# api.vemoki.com → vemoki-api:3001  (giữ)
# auth.vemoki.com → vemoki-keycloak:8080  (giữ)

# Optional edge redirects (nếu muốn fail-closed trước khi hit Next):
# server_name vemoki.com;
# location ~ ^/(auth|admin|platform|gate|redeem|api/auth|api/bff|api/admin|t/) {
#   return 302 https://app.vemoki.com$request_uri;
# }
```

**Location rewrite:** nếu Next còn emit `Location: https://0.0.0.0:3000/...`, nginx map theo **server_name đang phục vụ** (`app.` hoặc apex) — mở rộng rule ADR-16 hiện chỉ rewrite về `https://vemoki.com`.

---

## 4. Cookie / CORS / OIDC redirect URI list

### Cookie (product trên `app.vemoki.com`)

| Cookie (hiện có) | Host | Domain attr | SameSite | Ghi chú |
| ---------------- | ---- | ----------- | -------- | ------- |
| `oidc_access_token` / `oidc_refresh_token` / PKCE / state | `app.vemoki.com` | **omit** (host-only) | `Lax` | `AUTH_COOKIE_SECURE=true` sau TLS |
| CSRF double-submit | `app.vemoki.com` | omit | `Lax` | Origin phải ∈ allowlist product |
| Marketing apex | `vemoki.com` | — | — | **Không** set OIDC session cookies |

### CORS / Origin

| Surface | Rule |
| ------- | ---- |
| Browser → Next BFF | Same-origin trên `app.vemoki.com` (không cần CORS cho BFF) |
| CSRF / `WEB_PUBLIC_ORIGIN` | Allowlist **product:** `https://app.vemoki.com` (có thể tạm thêm apex trong cửa sổ dual-run — rồi gỡ) |
| Marketing → Nest | **Không** gọi Nest authenticated từ apex; form quan tâm = server action/API marketing hoặc mailto/external — nếu cần public POST, endpoint riêng không cookie session |
| Keycloak `webOrigins` | Thêm `https://app.vemoki.com`; giữ local; apex có thể giữ đến hết dual-run rồi gỡ khỏi client product |
| Nest `@fastify/cors` | Chỉ origin product (và local); **không** coi CORS là authz |

### OIDC redirect / post-logout (Keycloak clients)

Cập nhật realm (hoặc admin UI) — **thêm** URI `app.` trước cutover DNS; **giữ** apex trong dual-run; sau ổn định gỡ apex khỏi client product.

| Client | redirectUris **thêm** | webOrigins **thêm** | post_logout / notes |
| ------ | --------------------- | ------------------- | ------------------- |
| `ticket-web` | `https://app.vemoki.com/api/auth/callback` | `https://app.vemoki.com` | post-logout → `https://app.vemoki.com/auth` (via BFF logout) |
| `ticket-platform` | `https://app.vemoki.com/api/auth/platform/callback` (**path code**) | `https://app.vemoki.com` | Không dùng path realm cũ `/api/platform/auth/callback` trừ khi web đổi route |
| `ticket-admin-web` | `https://app.vemoki.com/api/admin/auth/callback` (khi route tồn tại) | `https://app.vemoki.com` | Dual-run với apex URI hiện có |
| iOS public client | (giữ scheme `ticketsolution` / `vemoki`) | — | Ngoài scope host web |

**CTA marketing → product (không phải redirect URI Keycloak):**

| CTA | URL đích |
| --- | -------- |
| Xem demo | `https://app.vemoki.com/…` (fixture; nhãn giả lập) |
| Đăng nhập | `https://app.vemoki.com/auth` (hoặc `/api/auth/login`) |
| Đăng ký quan tâm | form trên `https://vemoki.com` (ở lại apex) |

---

## 5. Env vars

### Product / web (`app.vemoki.com`)

| Biến | Giá trị sau cutover | Owner đề xuất |
| ---- | ------------------- | ------------- |
| `WEB_PUBLIC_ORIGIN` | `https://app.vemoki.com` | web (+ compose sync) |
| `PUBLIC_WEB_ORIGIN` | Đồng bộ hoặc **alias → `WEB_PUBLIC_ORIGIN`** trong compose | coordinator |
| `OIDC_REDIRECT_URI` | `https://app.vemoki.com/api/auth/callback` | coordinator env + web verify |
| `PLATFORM_OIDC_REDIRECT_URI` | `https://app.vemoki.com/api/auth/platform/callback` | coordinator + web |
| `OIDC_ISSUER` / JWKS | `https://auth.vemoki.com/realms/ticket` (giữ) | — |
| `AUTH_COOKIE_SECURE` | `true` | — |
| `API_BASE_URL` | internal `http://api:3001` (giữ) | — |

### Worker / email links

| Biến | Giá trị sau cutover | Ghi chú |
| ---- | ------------------- | ------- |
| `PUBLIC_WEB_BASE_URL` | `https://app.vemoki.com` | Membership invite / accept links (fail-closed nếu thiếu) |

### Marketing (cùng process A1)

| Biến (đề xuất) | Giá trị | Ghi chú |
| -------------- | ------- | ------- |
| `MARKETING_ORIGIN` hoặc host detect | `https://vemoki.com` | Middleware phân nhánh; không dùng làm OIDC redirect |
| `PRODUCT_ORIGIN` | `https://app.vemoki.com` | CTA absolute links từ sales |

### Không đổi

- Keycloak DB/realm name; client IDs (`ticket-web`, `ticket-platform`, …) trừ khi task riêng.
- `PLATFORM_ROOT_DOMAIN=vemoki.com` (tenant wildcard) — apex marketing ≠ tenant host.

---

## 6. Migration / cutover

Thứ tự an toàn (expand → switch → contract). **Không** chạy prod từ handoff này — chỉ khi coordinator được ủy quyền deploy.

### Phase 0 — Code (web, trước DNS)

1. Host-aware routing: apex serve sales(+privacy/support/i18n); `app.` serve product.
2. Middleware fail-closed: product API/auth routes **không** execute business trên Host apex (redirect hoặc 404).
3. Absolute CTA → `PRODUCT_ORIGIN`.
4. Unit tests origin/CSRF với allowlist `app.`.
5. Compose/docs: map `WEB_PUBLIC_ORIGIN` (sửa lệch tên với `PUBLIC_WEB_ORIGIN`).

### Phase 1 — Expand (coordinator, dual-run)

1. DNS + TLS `app.vemoki.com`.
2. nginx `server_name app.vemoki.com` → `vemoki-web` (+ Location rewrite theo host).
3. Keycloak: **thêm** redirect/webOrigins `app.` (giữ apex).
4. Env staging/prod file: set redirect + `WEB_PUBLIC_ORIGIN` + `PUBLIC_WEB_BASE_URL` → `app.` **khi** traffic product chuyển (có thể tạm allowlist comma: `https://app.vemoki.com,https://vemoki.com` nếu dual-run CSRF cần).

### Phase 2 — Switch

1. Trỏ người dùng/ASC/deep link product → `app.`.
2. Apex: 302 product paths → `app.`; `/` = sales.
3. Verify login/logout/me trên `app.`; sales 200 trên apex; privacy 200.

### Phase 3 — Contract

1. Gỡ apex khỏi Keycloak product client redirect/webOrigins (sau monitor).
2. Gỡ apex khỏi `WEB_PUBLIC_ORIGIN` allowlist.
3. Cập nhật `infra/deploy/.env.example`, README, ENV-MANIFEST ví dụ → `app.`.

### Path redirect gợi ý (apex → app)

`/auth`, `/admin`, `/platform`, `/gate`, `/redeem`, `/t/*`, `/api/auth/*`, `/api/bff/*`, `/api/admin/*` (và path product khác web inventory khi implement).

---

## 7. Ownership — web vs coordinator

| Việc | Ownership | Không làm |
| ---- | --------- | --------- |
| Host-aware routes, sales page VI+EN, privacy/support UI, CTA, middleware redirects, CSRF/origin tests, cookie opts host-only | **web** (`apps/web`) | DNS prod, realm prod secrets |
| DNS/TLS, nginx vhost, Compose env, Keycloak realm URI update trên VPS, `PUBLIC_WEB_BASE_URL` worker | **coordinator** | Copy/sales design (PD); Nest business APIs |
| Wireframe/copy sales | **product-design** (song song) | — |
| DoD exact-SHA | **reviewer-dod** | — |
| Backend Nest | chỉ nếu email link/`PUBLIC_WEB_BASE_URL` cần đổi code (thường **chỉ env**) | Không đổi OIDC provider |

**Ủy quyền coding web:** sau PD handoff (O13 #7) — feature branch/PR + DoD; **không** tự deploy/store.

---

## 8. Test matrix

| # | Case | Cách | Pass khi |
| - | ---- | ---- | -------- |
| T1 | Apex `/` = sales | `curl -sI https://vemoki.com/` / Playwright headless | 200; không render shell auth product |
| T2 | Apex product path redirect | `curl -sI https://vemoki.com/auth` | 301/302 → `https://app.vemoki.com/auth` |
| T3 | `www` → apex | `curl -sI https://www.vemoki.com/` | 301 → `https://vemoki.com/` |
| T4 | OIDC login product | headless / P4-style: login → `/api/bff/me` | 200 + email; Host=`app.` |
| T5 | Callback URI | Keycloak reject callback trên apex sau contract | chỉ `app.` callback thành công |
| T6 | Cookie host-only | DevTools / unit `tenant-host` + web cookie opts | không có `Domain=.vemoki.com` |
| T7 | CSRF | mutate BFF với `Origin: https://vemoki.com` | **fail** sau contract; `Origin: https://app.vemoki.com` pass |
| T8 | Logout | `/api/auth/logout` | clear cookies + end-session; land `app./auth` |
| T9 | Invite email link | worker + Mailpit (local) / log | URL host `app.vemoki.com` |
| T10 | Privacy ASC | `curl -sI https://vemoki.com/privacy` | 200 |
| T11 | API/Auth hosts | `api.` / `auth.` health/discovery | không đổi hành vi |
| T12 | Marketing CTA | Playwright: click Đăng nhập/Demo | absolute → `app.` |
| T13 | i18n sales | `/` VI + `/en` (hoặc switch) | cả hai 200 (web sau PD) |

Local trước prod: Host header / `WEB_PUBLIC_ORIGIN` trong unit (`apps/web/tests/origin.test.ts` pattern) + `scripts/web-uat.sh` headless.

---

## 9. Rollback

| Trigger | Hành động | Owner |
| ------- | --------- | ----- |
| Login/callback fail trên `app.` | Giữ DNS `app.`; revert env redirect + `WEB_PUBLIC_ORIGIN` về apex; nginx `app.` 302 → `https://vemoki.com$request_uri`; Keycloak vẫn còn apex URI (dual-run) | coordinator |
| Sales apex lỗi nặng | nginx apex tạm proxy toàn bộ sang product build cũ **hoặc** static holding page; không set cookie `.vemoki.com` | coordinator |
| Cookie/CSRF regression | Revert web middleware/allowlist PR; giữ host-only | web |
| Sau contract đã gỡ apex URI | **Re-add** apex redirect URIs trước khi trỏ traffic lại apex | coordinator |

Rollback **không** gồm: đổi IdP; expand cookie Domain; deploy từ machine agent không ủy quyền.

---

## 10. Đề xuất cụ thể cho consumer (không code trong Task này)

### Web

- Middleware host switch + redirect matrix §6.
- Sales routes trên apex; product giữ cấu trúc hiện tại dưới `app.`.
- Cookie: tiếp tục `sessionCookieOptions` **không** `domain`.
- Env: đọc/ghi rõ `WEB_PUBLIC_ORIGIN=https://app.vemoki.com`; CTA dùng `PRODUCT_ORIGIN`.
- Tests: mở rộng origin/CSRF cho `app.`; host-aware route tests.

### Coordinator

- DNS/TLS/nginx sketch §3 khi được phép deploy.
- Compose: `OIDC_REDIRECT_URI`, `PLATFORM_OIDC_REDIRECT_URI`, `WEB_PUBLIC_ORIGIN` (alias từ `PUBLIC_WEB_ORIGIN` nếu cần tương thích), worker `PUBLIC_WEB_BASE_URL`.
- Realm file/UI: thêm URI bảng §4; cân nhắc sửa lệch path platform.
- Cập nhật `infra/deploy/README.md` + `.env.example` sau cutover.

---

## 11. Liên kết quyết định

| ID | Nội dung | Quan hệ O13 host |
| -- | -------- | ---------------- |
| O13 | Sales apex / product `app.` | **Khóa** host model |
| O07 | Custom domain sau MVP; subdomain platform | Apex marketing ≠ tenant site |
| ADR-09/11 | Keycloak self-host; cấm SaaS IdP | Chỉ thêm redirect URI |
| ADR-16 | nginx edge + thin runtime | Thêm `server_name app.` |
| R-INT R9 | Cookie host-only | Chọn B2 |

---

## 12. Evidence đọc (base)

- Git HEAD lúc soạn: `e8512d0055e0e9d6585007e8363b6224a7138b12`
- `docs/DECISION-LOG.md` §O13, ADR-16
- `docs/plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md` §5–9
- `infra/deploy/README.md`, `infra/deploy/compose.yaml`, `infra/deploy/.env.example`
- `infra/keycloak/realm-ticket.json` (redirect/webOrigins)
- `apps/web/src/oidc/cookies.ts`, `public-origin.ts`, `apps/web/.env.example`
- `docs/ops/ENV-MANIFEST.md` §5, `scripts/lib/tenant-host.mjs`

**Còn lại cho wave sau:** PD wireframe sales VI+EN → web implement (ủy quyền O13 #7) → coordinator deploy khi được phép → headless UAT + reviewer-dod. Architect handoff **không** đóng Issue Hoàn thành và **không** deploy.
