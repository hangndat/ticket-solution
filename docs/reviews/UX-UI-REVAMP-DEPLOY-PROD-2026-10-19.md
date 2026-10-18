# Deploy prod — UX-UI Revamp tip (2026-10-19)

| Field | Value |
| ----- | ----- |
| Authorization | User: **«build tonight vs deploy server»** |
| Tip SHA | `d2a07466d079f7bdbc8a7a754e2a18f485eeef5c` (`main`) |
| Marker | `/opt/vemoki/deployed-sha.txt` |
| Host | SSH `dexter@…` (alias `conanphong` không resolve máy agent) |
| Services | `api` + `worker` + `web` (restart sau bind-mount build) |
| EAS / mobile | **Không** |
| Migrate / keycloak / nginx | **Không** đổi trong bước này |

## What ran

1. Rsync `apps/{web,api,worker}`, `packages/{backend,contracts}`, root lockfile/workspace manifests → `/opt/vemoki/src` (exclude `node_modules` / `.next` / mobile native / `.pnpm-store`).
2. Clear root-owned `packages/backend/src/generated/prisma` qua `vemoki-runtime:local`.
3. `pnpm install --frozen-lockfile` (api/web/worker filters) + contracts tsc + backend/api/web/worker build trong runtime image.
4. `docker compose --env-file /opt/vemoki/.env restart api worker web`.

## Verify

| Check | Result |
| ----- | ------ |
| `https://vemoki.com/` | **200** (redirects product paths sang `app.`) |
| `https://app.vemoki.com/` | **200** |
| `https://app.vemoki.com/auth` | **307** → `/` (thin redirect; IA gộp `/auth`) |
| `https://app.vemoki.com/redeem` | **200** |
| `https://app.vemoki.com/account` | **200** |
| `https://app.vemoki.com/api/bff/me` (anon) | **401** |
| `https://api.vemoki.com/v1/health` | **200** `{"status":"ok","service":"api"}` |
| OIDC discovery `auth.vemoki.com` | **200** |
| `https://ancafe.anphong.vn/` | **200** (không đụng) |
| Containers | api/web/worker Up; postgres/keycloak/minio/mailpit healthy |

## Limitations

- Worker log vẫn có `account_deletion_tombstone_keyring_missing` (pre-existing; không chặn HTTP tip).
- SMTP vẫn Mailpit — không MTA internet trong bước này.
- Không claim pilot ready / store ready.
- Portal (`portal.vemoki.com`) không deploy trong bước này.

## Verdict

**PASS** — tip `d2a07466…` live trên VPS (web UX-UI revamp + api/worker rebuild).
