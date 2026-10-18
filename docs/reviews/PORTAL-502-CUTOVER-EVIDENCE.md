# Evidence — Issue #502 portal.vemoki.com cutover (in progress / DNS gate)

Ngày: 2026-10-19  
Issue: [#502](https://github.com/hangndat/ticket-solution/issues/502) · Epic [#491](https://github.com/hangndat/ticket-solution/issues/491)  
Run: `run_d04055a8969b` · Dispatch: `ctx_8e5b0801c001`  
Base (pre-PR tip when drafted): `3c108886436e6f8d9bfe6807021cbfdade59dd6a` — **revalidate exact tip SHA after commit/PR**.

Architecture impact: **Có** (host/OIDC/nginx/dual-run).

## Đã làm trên VPS (conanphong / `dexter@113.161.116.5`)

| Hạng mục | Trạng thái | Evidence |
| --- | --- | --- |
| Compose service `portal` → `vemoki-portal:3013` | **Done** | `docker compose ps` shows `vemoki-portal-1` Up |
| Build `@ticket/web-session` + `@ticket/portal` + `@ticket/web` | **Done** | Next build OK on host bind-mount |
| Env portal (`PORTAL_*`, `OIDC_ADMIN_CLIENT_SECRET`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`) | **Done** | Names set in `/opt/vemoki/.env` (values not logged) |
| Keycloak realm URI `https://portal.vemoki.com/...` | **Done** (JSON + recreate) | realm file contains portal redirects; KC healthy |
| Nginx vhost portal + ACME server_name | **Done** | `vemoki.conf` includes `portal.vemoki.com`; `nginx -t` OK |
| Portal HTTP via `--resolve …:127.0.0.1` | **Done** | `/` → 200; `/api/auth/login` → **307** IdP `ticket-admin-web` + `redirect_uri=https://portal.vemoki.com/api/auth/callback`; Set-Cookie **không** `Domain=` |
| DNS A `portal.vemoki.com` | **BLOCKED** | `dig +short portal.vemoki.com A` empty; no Porkbun API key on host; ask `msg_25cebd84958a` chờ coordinator |
| TLS SAN expand include portal | **Blocked on DNS** | Current SAN: apex/www/app/api/auth only |
| Dual-run `PORTAL_ADMIN_REDIRECT=1` | **Not enabled** (đúng) | Giữ `0` — bật khi DNS+TLS xanh để tránh redirect staff sang host không resolve |
| Gate stay app | **OK** | `app./gate` không Location portal (flag OFF) |
| Rollback path | **Documented** | `docs/ops/PORTAL-PROD-CUTOVER.md` §4 |

## Repo artifacts

- Runbook: `docs/ops/PORTAL-PROD-CUTOVER.md`
- Nginx snippet: `infra/deploy/nginx-portal.snippet.conf`
- Check script: `scripts/portal-prod-cutover-check.sh`
- Compose portal + web `PORTAL_*`; realm portal prod URIs; ENV-MANIFEST / deploy skill / README

## Checks (local)

```text
./scripts/portal-local-dual-run-check.sh  → PORTAL_LOCAL_DUAL_RUN_PASS
pnpm --filter @ticket/web exec tsx --test tests/portal-dual-run.test.ts → 8 pass
pnpm --filter @ticket/portal exec tsx --test tests/dual-run-allowlist.test.ts → 4 pass
```

## Còn lại để dual-run ON

1. Porkbun: A record `portal` → `113.161.116.5`
2. `certbot --expand` thêm `-d portal.vemoki.com`
3. Verify `./scripts/portal-prod-cutover-check.sh` PASS public
4. Set `PORTAL_ADMIN_REDIRECT=1` + recreate web; rollback drill tắt flag

## Limitations

- Không EAS; không mock auth.
- Không có Porkbun DNS API credential trên máy/VPS → không tự tạo A record trong session này.
- Public HTTPS portal chưa nghiệm thu (DNS trống / cert thiếu SAN).
