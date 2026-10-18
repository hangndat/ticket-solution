# O13 Auth dual-run audit — Keycloak / nginx / compose

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Role | coordinator tooling |
| Architecture impact | Có — đối chiếu handoff O13 vs prod config (docs + realm + deploy templates); **không** đổi IdP provider |
| Base SHA (trước patch) | `63535b48e2f17c65778246e5c44fc162f0dd9f26` |
| Artifact SHA | `b71a3f3431753486ff42a095b03facb57e63d30e` (commit chứa artifact + patches) |
| Live host | `113.161.116.5` (SSH `dexter@…`; alias `conanphong` không resolve từ máy agent) |
| Handoff | `docs/architecture/o13-marketing-app-subdomain.md` |

**Không** in / commit secrets; **không** dump `/opt/vemoki/.env` values (chỉ tên key + host match boolean).

---

## 1. Checklist kết quả

| # | Hạng mục | Repo (trước) | Live (lúc audit) | Sau patch repo / live |
| - | -------- | ------------ | ---------------- | --------------------- |
| 1 | Keycloak `ticket-web` redirectUris + webOrigins `app.` | Chỉ apex prod | Có `app.` + apex | Realm file đồng bộ dual-run |
| 2 | Keycloak `ticket-admin-web` `app.` | Chỉ apex | Có `app.` + apex | Realm file đồng bộ |
| 3 | Keycloak `ticket-platform-web` path code `/api/auth/platform/callback` | Chỉ legacy `/api/platform/auth/callback` | Có **cả** code path + legacy (apex + `app.`) | Realm: thêm code path + giữ legacy |
| 4 | `post.logout.redirect.uris` web clients | Chỉ `ticket-mobile` | Live đã set (`app./auth` + apex `/auth` + local) | Realm: thêm cho web/admin/platform |
| 5 | nginx `app.` + apex + `X-Forwarded-Host $host` | Docs cũ thiếu `app.` | `vemoki.conf`: apex + `app.` + api + auth; `proxy_redirect` theo host | Docs `infra/deploy/README.md` cập nhật |
| 6 | Compose `OIDC_REDIRECT_URI` / `WEB_PUBLIC_ORIGIN` / `PUBLIC_WEB_*` | Hardcode / default apex; thiếu `WEB_PUBLIC_ORIGIN` | Host `.env` + container trỏ `app.`; compose live thiếu map `PLATFORM_OIDC_CLIENT_ID` | Compose template → default `app.`; map PLATFORM_* |
| 7 | Platform clientId code vs realm | `.env.example` / tests: `ticket-platform` | Realm client: `ticket-platform-web`; **web container `PLATFORM_OIDC_CLIENT_ID` rỗng** | Docs/example/tests → `ticket-platform-web`; live compose + recreate web |

---

## 2. Evidence live (exact commands / outcomes)

### 2.1 Host / logout

```text
curl -sI https://app.vemoki.com/auth
→ HTTP/2 200

curl -sI https://vemoki.com/auth
→ HTTP/2 302  Location: https://app.vemoki.com/auth

curl -sI https://app.vemoki.com/api/auth/logout
→ HTTP/2 307
  Location: https://auth.vemoki.com/realms/ticket/protocol/openid-connect/logout
    ?client_id=ticket-web
    &post_logout_redirect_uri=https%3A%2F%2Fapp.vemoki.com%2Fauth

curl -s -D - -o /dev/null \
  'https://auth.vemoki.com/realms/ticket/protocol/openid-connect/logout?client_id=ticket-web&post_logout_redirect_uri=https%3A%2F%2Fapp.vemoki.com%2Fauth'
→ HTTP/2 302  Location: https://app.vemoki.com/auth
```

Cùng probe với `post_logout_redirect_uri=https://vemoki.com/auth` → `302 Location: https://vemoki.com/auth` (apex vẫn trong allowlist dual-run).

### 2.2 nginx (`docker exec nginx-letencrypt-nginx-1 cat /etc/nginx/conf.d/vemoki.conf`)

- `server_name` apex + `www` (301→apex) + `app.vemoki.com` + `api.` + `auth.`
- Mọi proxy: `X-Forwarded-Host $host` (overwrite)
- `proxy_redirect` `0.0.0.0:3000` → `https://vemoki.com/` (apex) / `https://app.vemoki.com/` (product)

### 2.3 Keycloak (kcadm, không secrets)

Clients present: `ticket-web`, `ticket-admin-web`, `ticket-platform-web` (không có clientId `ticket-platform`).

`post.logout.redirect.uris` (ticket-web / admin / platform-web):

```text
https://app.vemoki.com/auth##https://vemoki.com/auth##http://localhost:3000/auth##http://127.0.0.1:3000/auth##http://localhost:3010/auth##http://127.0.0.1:3010/auth
```

`ticket-platform-web` redirectUris gồm cả:

- code: `https://app.vemoki.com/api/auth/platform/callback`, `https://vemoki.com/api/auth/platform/callback`
- legacy: `…/api/platform/auth/callback` (apex + `app.`)

### 2.4 Live env (key names + host class only)

Host `/opt/vemoki/.env` keys present: `OIDC_REDIRECT_URI`, `WEB_PUBLIC_ORIGIN`, `PUBLIC_WEB_ORIGIN`, `PUBLIC_WEB_BASE_URL`, `PLATFORM_OIDC_*`, `PRODUCT_ORIGIN`, `MARKETING_*` — values class **`app.`** (không multi-allowlist).

Trước fix: `vemoki-web-1` **không** nhận `PLATFORM_OIDC_CLIENT_ID` (compose thiếu map) dù key có trên host → platform OIDC fail-closed.

Sau fix live (2026-10-18):

- Set `PLATFORM_OIDC_CLIENT_ID=ticket-platform-web` trên host `.env` (non-secret id)
- Insert map `PLATFORM_OIDC_CLIENT_ID|SECRET|AUDIENCE|REQUIRED_ACR` vào `/opt/vemoki/src/infra/deploy/compose.yaml` (backup `.bak.o13-audit-*`)
- `docker compose … up -d --no-deps --force-recreate web`
- Verify: `PLATFORM_OIDC_CLIENT_ID=ticket-platform-web`, `PLATFORM_OIDC_AUDIENCE=ticket-platform-api`, redirect = `https://app.vemoki.com/api/auth/platform/callback`

**Không** cần thêm URI Keycloak (đã đủ cho logout `app./auth`).

---

## 3. Repo patches (this PR)

| Path | Thay đổi |
| ---- | -------- |
| `infra/keycloak/realm-ticket.json` | Dual-run `app.` redirect/webOrigins; `post.logout.redirect.uris` cho web/admin/platform; platform thêm path code + giữ legacy |
| `infra/deploy/compose.yaml` | Default product host `app.`; `WEB_PUBLIC_ORIGIN`; `PLATFORM_OIDC_*` passthrough |
| `infra/deploy/.env.example` | O13 product/marketing + platform clientId docs |
| `infra/deploy/README.md` | nginx `app.` + Keycloak dual-run notes |
| `docs/ops/ENV-MANIFEST.md` | §5 O13 origin / platform path / clientId |
| `apps/web/.env.example` + `apps/web/tests/platform-shape.test.ts` | `PLATFORM_OIDC_CLIENT_ID=ticket-platform-web` |

Provider Keycloak **không** đổi.

---

## 4. Residual risks

1. **Contract phase chưa chạy:** apex vẫn trong Keycloak redirect/webOrigins/post.logout — đúng dual-run; sau ổn định cần **gỡ** apex khỏi client product (theo handoff § Phase 3).
2. **Platform legacy callback path** vẫn allowlist trên live + realm — an toàn dual-run nhưng nên gỡ `/api/platform/auth/callback` khi không còn consumer.
3. **`ticket-admin-web` callback route** chưa có mirror rõ trong `apps/web/app/api` (chỉ BFF admin) — URI `app./api/admin/auth/callback` đã có trên KC; login admin qua path đó có thể chưa ship.
4. **Platform logout** (`/api/auth/platform/logout`) **không** gọi Keycloak end-session (chỉ clear cookie → `/platform`) — IdP session có thể còn; khác attendee `/api/auth/logout`.
5. **Live compose drift:** `/opt/vemoki/src` đã được patch tay `PLATFORM_OIDC_*`; cần merge PR này (hoặc redeploy bind-mount) để template git khớp VPS và tránh mất map khi sync source.
6. **SSH alias `conanphong`:** không có trong `~/.ssh/config` máy agent — dùng `dexter@113.161.116.5`.
7. **`PUBLIC_WEB_ORIGIN` vs `WEB_PUBLIC_ORIGIN`:** code đọc `WEB_PUBLIC_ORIGIN`; compose giờ set cả hai — dual-run CSRF allowlist comma apex+app chưa bật trên live (chỉ `app.`) — OK nếu apex không mutate BFF.
8. **`PLATFORM_OIDC_CLIENT_SECRET`:** phải có trên host `.env` (không audit value); thiếu → platform vẫn fail-closed dù clientId đã đúng.

---

## 5. Verdict

| Câu hỏi | Kết luận |
| ------- | -------- |
| Logout Invalid redirect uri còn trên `app.`? | **Không** (evidence 302 → `https://app.vemoki.com/auth`) |
| Live KC cần thêm URI? | **Không** (đã đủ); repo realm đã bắt kịp |
| Gap vận hành còn lại | Platform clientId map (đã vá live); docs/compose/realm drift (PR này); residual ở §4 |

**PASS with known gap** — dual-run logout product OK; residual contract/admin-route/platform-end-session như §4.
