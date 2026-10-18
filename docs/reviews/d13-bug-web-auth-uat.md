# D13 — web auth UAT trên `app.vemoki.com` (logout redirect + O13 gaps)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Scope | `apps/web` + `scripts/web-uat.*` |
| Base / tip (trước PR) | `a6f6cd2e08c5f8e774397e008d9a8fa475e7303b` (main + #405/#400/#395) |
| Tip SHA (PR) | `c2476df0bf2c10937a778bed76a4113e3d68c3b4` (rebased; proxy = O13 host-first + owner-ticket soft-redirect) |
| Host | `https://app.vemoki.com` |
| Architecture impact | Không (fix/UAT + proxy order / logout hint) |

## Verdict

**PASS with known gap** — Keycloak `post_logout_redirect_uri=https://app.vemoki.com/auth` được chấp nhận (ops đã patch realm); BFF logout emit đúng origin; login → `/api/bff/me` 200. Gap còn lại: (1) fix proxy apex `/admin`\|`/gate` chưa deploy prod; (2) `id_token_hint` chưa live nên logout còn màn confirm Keycloak cho đến khi deploy.

## Checks đã chạy

```bash
# HTTP smoke (prod live)
curl -sI https://app.vemoki.com/auth          # 200
curl -sI https://app.vemoki.com/admin          # 307 → /auth?next=%2Fadmin
curl -sI https://app.vemoki.com/api/bff/me     # 401 (anonymous)
curl -sI https://app.vemoki.com/api/auth/logout
# → Location: …/openid-connect/logout?…&post_logout_redirect_uri=https%3A%2F%2Fapp.vemoki.com%2Fauth
curl -sL -o /tmp/kc-logout.html -w '%{url_effective} %{http_code}\n' \
  'https://auth.vemoki.com/realms/ticket/protocol/openid-connect/logout?client_id=ticket-web&post_logout_redirect_uri=https%3A%2F%2Fapp.vemoki.com%2Fauth'
# → final https://app.vemoki.com/auth 200 — không «Invalid redirect uri»

./scripts/web-uat.sh auth-smoke https://app.vemoki.com
# ok — artifact apps/web/.uat-artifacts/auth-smoke-*.png

./scripts/web-uat.sh bff-login https://app.vemoki.com attendee@example.com attendee-demo
# ok me HTTP 200 — artifact apps/web/.uat-artifacts/bff-login-*.png

./scripts/web-uat.sh nav-o02 https://app.vemoki.com
# ok soft-redirect /admin|/gate

./scripts/web-uat.sh auth-logout https://app.vemoki.com attendee@example.com attendee-demo
# (sau khi script click confirm) — artifact apps/web/.uat-artifacts/auth-logout-*.png

cd apps/web && pnpm exec tsx --test tests/marketing-host.test.ts
# 12 pass (gồm apex /admin|/gate → product origin)
```

## Đối chiếu O13 (`docs/architecture/o13-marketing-app-subdomain.md`)

| Mục | Trạng thái code | Prod live |
| --- | --------------- | --------- |
| `WEB_PUBLIC_ORIGIN` → `publicOrigin` / logout `/auth` | OK (`resolvePublicOrigin`) | Emit `https://app.vemoki.com/auth` |
| CSRF allowlist `WEB_PUBLIC_ORIGIN` | OK | — |
| Login `redirect_uri` product | OK | `https://app.vemoki.com/api/auth/callback` |
| Apex product path → `app.` | `decideHostRouting` OK | `/auth`, `/redeem`, `/api/bff/*` 302 đúng |
| Soft-redirect O02 vs host routing | **Bug:** soft-redirect chạy trước host routing → apex `/admin`\|`/gate` 307 relative `/auth` | **Fixed in PR** (host routing first) |
| KC post-logout URI allowlist | Realm (ops) | Patched — no Invalid redirect uri |
| Silent logout `id_token_hint` | **Missing** → confirm screen | **Fixed in PR** (store `oidc_id_token`) |

## Code changes (PR)

1. `apps/web/proxy.ts` — O13 host redirect trước O02 soft-redirect.
2. `apps/web/app/api/auth/{callback,logout}` + `cookies.ts` — persist `id_token`, pass `id_token_hint`.
3. `scripts/web-uat.mjs` — lệnh `auth-logout` (login → me → logout → `/auth`, click KC confirm nếu cần).
4. `apps/web/tests/marketing-host.test.ts` — assert apex `/admin`\|`/gate` → `app.vemoki.com`.

## Residual bugs (chưa đóng trong PR / ngoài scope)

1. **Prod chưa nhận PR** — apex `/admin`\|`/gate` vẫn soft-redirect relative trước khi nhảy sang `app.` (extra hop); deploy web để chốt.
2. **Platform logout** (`/api/auth/platform/logout`) chỉ clear cookie → `https://app.vemoki.com/platform`, không gọi Keycloak end-session (khác ticket-web; có thể chủ đích).
3. **`www.vemoki.com/auth`** → 301 apex rồi mới 302 `app.` (nginx www→apex); chấp nhận được.
4. Compose/docs `PUBLIC_WEB_ORIGIN` vs `WEB_PUBLIC_ORIGIN` — gap O13 §1; coordinator/infra, không sửa trong slice web này.
