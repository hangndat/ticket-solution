# Evidence — Issue #502 portal.vemoki.com cutover (dual-run ON)

Ngày: 2026-10-19  
Issue: [#502](https://github.com/hangndat/ticket-solution/issues/502) · Story [#494](https://github.com/hangndat/ticket-solution/issues/494) · Epic [#491](https://github.com/hangndat/ticket-solution/issues/491)  
Run: `run_d04055a8969b` · Dispatch: `ctx_a94660582bfd`  
Commit tip (branch): `1641ef6334c50d397dca48c4383525260885d7fc` — PR #512 tip; revalidate if further commits land.

Architecture impact: **Có** (host/OIDC/nginx/dual-run — ADR-20 §8).

## Tóm tắt nghiệm thu (UTC 2026-10-19)

| Gate | Kết quả | Thời điểm (UTC) |
| --- | --- | --- |
| C1 DNS `portal.vemoki.com` A → `113.161.116.5` | **PASS** | `2026-10-19T04:24:06Z` (dig public) |
| C2 TLS SAN gồm `DNS:portal.vemoki.com` | **PASS** | cert NotBefore `Oct 19 01:11:39 2026 GMT` |
| C3 Nginx portal → `vemoki-portal:3013` | **PASS** | `vemoki.conf` server_name + proxy (không đụng ancafe/dath) |
| C4 Portal OIDC staff path | **PASS** | `/api/auth/login` → 307 IdP `ticket-admin-web` + `redirect_uri=https://portal.vemoki.com/api/auth/callback`; cookies host-only (không `Domain=`) |
| C5 Dual-run ON | **PASS** | `PORTAL_ADMIN_REDIRECT=1`; GET `app./admin` → **302** `https://portal.vemoki.com/admin`; POST `/admin` **không** Location portal |
| C6 GATE-STAY-APP | **PASS** | GET `app./gate` → `/auth?next=%2Fgate` (không portal host) |
| C7 Rollback note | **Documented** | § Rollback bên dưới + runbook §4 |
| Script `./scripts/portal-prod-cutover-check.sh` | **PASS** (public DNS, không `--resolve`) | `2026-10-19T04:27:40Z` |

## Đã làm trên VPS (conanphong / `dexter@113.161.116.5`)

| Hạng mục | Trạng thái | Evidence |
| --- | --- | --- |
| Compose `portal` / `web` | **Up** | `vemoki-portal-1`, `vemoki-web-1` (recreate web sau flag=1) |
| Sync cutover assets (check script + docs) | **Done** | rsync → `/opt/vemoki/src/scripts|docs|infra/deploy` |
| Env portal names (`PORTAL_*`, `OIDC_ADMIN_CLIENT_SECRET`, …) | **Done** | names only; values not logged |
| Keycloak realm portal URIs | **Done** (trước DNS) | realm JSON chứa; KC healthy |
| Nginx vhost + ACME `server_name` portal | **Done** | `grep portal.vemoki.com` trên `data/nginx/vemoki.conf` |
| DNS A | **Done** | user confirmed + `dig +short` = `113.161.116.5` |
| TLS SAN expand | **Done** | SAN: apex/www/app/api/auth/**portal** |
| Dual-run `PORTAL_ADMIN_REDIRECT=1` | **ON** | sed flip `0`→`1`; `docker compose … --force-recreate web` @ ~`04:23Z` |
| Neighbour vhost | **OK** | `https://ancafe.anphong.vn/` HTTP 200 |

## Smoke headless (commands + exact times)

```text
# UTC 2026-10-19T04:27:40Z — public, no --resolve
./scripts/portal-prod-cutover-check.sh
→ PORTAL_PROD_CUTOVER_RESULT PASS
  PASS DNS portal.vemoki.com A=113.161.116.5
  PASS TLS SAN includes portal.vemoki.com
  PASS portal / HTTP 200
  PASS portal /api/auth/login → IdP with portal redirect_uri
  PASS dual-run ON: app /admin → https://portal.vemoki.com/admin
  PASS POST /admin does not redirect to portal
  PASS GATE-STAY-APP
  PASS ancafe.anphong.vn HTTP 200
  PASS realm JSON portal redirect URIs

# UTC 2026-10-19T04:27:40Z — session deny-by-default
curl -sS -o /dev/null -w '%{http_code}' https://portal.vemoki.com/api/bff/me/subject
→ 401

# UTC 2026-10-19T04:24:02Z — OIDC login hop (no full password login in this session)
curl -sSI https://portal.vemoki.com/api/auth/login
→ 307 Location: auth.vemoki.com/.../auth?client_id=ticket-admin-web&redirect_uri=https%3A%2F%2Fportal.vemoki.com%2Fapi%2Fauth%2Fcallback&...
  Set-Cookie: … Path=/; Secure; HttpOnly; SameSite=lax  (no Domain=)
```

Script fix in this tip: TLS SAN probe falls back to `openssl x509 -text` khi LibreSSL/macOS không hỗ trợ `x509 -ext` (tránh false FAIL trên máy deploy macOS).

## Rollback (tắt redirect — ADR-20 §8)

Thứ tự **không đảo**:

1. Trên VPS: set `PORTAL_ADMIN_REDIRECT=0` trong `/opt/vemoki/.env` (backup session: `.env.bak-502`).
2. `cd /opt/vemoki/src/infra/deploy && docker compose --env-file /opt/vemoki/.env up -d --no-deps --force-recreate web`
3. Verify: `curl -sSI https://app.vemoki.com/admin` **không** Location `https://portal.vemoki.com…` (legacy `/auth?next=…` hoặc serve app).
4. Không xóa DNS A trong cửa sổ quan sát ngắn; không set cookie `Domain=.vemoki.com`.

## Repo artifacts

- Runbook: `docs/ops/PORTAL-PROD-CUTOVER.md`
- Nginx snippet: `infra/deploy/nginx-portal.snippet.conf`
- Check script: `scripts/portal-prod-cutover-check.sh`
- PR: [#512](https://github.com/hangndat/ticket-solution/pull/512)

## Checks (local — earlier)

```text
./scripts/portal-local-dual-run-check.sh  → PORTAL_LOCAL_DUAL_RUN_PASS
pnpm --filter @ticket/web exec tsx --test tests/portal-dual-run.test.ts → 8 pass
pnpm --filter @ticket/portal exec tsx --test tests/dual-run-allowlist.test.ts → 4 pass
```

## Limitations

- Không EAS; không mock auth; không in `/opt/vemoki/.env` secrets.
- Full interactive staff password login qua IdP không chạy trong session này — evidence = OIDC redirect + PKCE cookies + BFF 401 deny-by-default.
- `/api/bff/me` (đúng path web) không tồn tại trên portal; portal dùng `/api/bff/me/subject` (401 no session).
- **Không merge** PR #512 trong task này — chờ DoD reviewer độc lập + CI xanh.
