# Production deploy — 2026-10-21

| Field | Value |
| --- | --- |
| Source SHA | `1ba6647b8e6b1652cfdf25b86500d9d415bab48e` (`main`) |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-1ba6647/` |
| Operator | Gonic (Orca worker `task_bb111a33f720`) |
| Migrate | **Không** — danh sách migration prod khớp worktree (tip `202610201200_mpr_w1_owner_tickets_aggregate`) |

## Dry-run (rsync `-rlc --itemize-changes`, excludes theo deploy-prod skill)

| Path / service | Lệch? | Ghi chú |
| --- | --- | --- |
| `packages/contracts` | Có | `src/index.ts` |
| `packages/backend` | Có | event modules, tests, `package.json` |
| `apps/api` | Có | hardening, identity/platform split, `http-limits`, OpenAPI |
| `apps/worker` | Có | tick guard / overlap / timeout relay |
| `apps/web` | Có | CSP/refresh OIDC, admin hooks, upload guard |
| `apps/portal` | Có | `next-env.d.ts` only |
| `infra` | Có | `deploy/.env.example` (+ compose hotfix below) |
| `pnpm-lock.yaml` | Có | `pnpm install --frozen-lockfile` on VPS |

## Trước deploy (VPS, `curl --resolve …:443:127.0.0.1` cho vemoki hosts)

| Check | Trước |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://vemoki.com/` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://ancafe.anphong.vn/` | 200 |

## Thực hiện

1. Backup rsync các path trên → `/opt/vemoki/backup/deploy-2026-10-21-1ba6647/`.
2. Rsync worktree → prod (không `--delete`; không đụng `node_modules` / `.pnpm-store`).
3. `pnpm install` + build theo skill: contracts → backend → api → **restart api** → worker → **restart worker** → web → **restart web** → portal → **restart portal**.
4. **Compose hotfix (prod):** service `web` thiếu `OIDC_AUDIENCE` / `OIDC_JWKS_URL` trong `environment` (portal đã có). Sau build web mới, `/api/bff/me` trả **503** `OIDC_MISCONFIGURED` dù biến có trong `/opt/vemoki/.env`. Đã thêm hai dòng vào `infra/deploy/compose.yaml` (repo + VPS) và `up -d --no-deps --force-recreate web`.

## Sau deploy

| Check | Sau |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://vemoki.com/` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://portal.vemoki.com/api/bff/me/subject` (no cookie) | **401** (`UNAUTHENTICATED`) — portal không mount `/api/bff/me` (404) |
| CSP + `X-Content-Type-Options: nosniff` on app | Có |
| CSP + `nosniff` on portal | Có |
| `GET https://ancafe.anphong.vn/` | 200 |
| `GET https://dath.anphong.vn/` | timeout từ VPS (hairpin); không đụng vhost |

## Worker

Container **Up**; banner outbox relay trong log. Tiếp tục log `relay_exports` **42501** permission denied (exports table) và `KEYRING_MISSING` tombstone — **không** chặn deploy scope; theo dõi riêng.

## Rollback

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-1ba6647
# rsync -a $BACKUP/<path>/ /opt/vemoki/src/<path>/  # per service
# rebuild + restart theo deploy-prod skill
```

## Follow-up (repo)

- PR này gồm artifact + `infra/deploy/compose.yaml` (web OIDC env parity với portal).
- Không merge trong task deploy.

---

## Production deploy — 2026-10-21

## Deploy #668 — `cbabea4` (fix rate-limit RLS + CSP runtime)

| Field | Value |
| --- | --- |
| Source SHA | `cbabea4ccc6447e7dc40a832ba95c81320c1b0d9` (merge PR [#668](https://github.com/hangndat/ticket-solution/pull/668)) |
| Prior prod marker | `d926669636746f62c599d03c14de3ac28d07bb50` → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-cbabea4/` |
| Operator | Gonic (Orca worker `task_61bc1bec6a36`) |
| Scope | **api** + **web** only (no migrate, nginx, keycloak, worker, portal restart) |
| Build logs | `/opt/vemoki/deploy-668-cbabea4-build.log`, `/opt/vemoki/deploy-668-cbabea4-web.log` |

### Code paths

| Path | Change |
| --- | --- |
| `apps/api/src/http-rate-limit.ts` | `set_config('app.tenant_id', …)` before `notification_rate_counters` writes |
| `apps/web/next.config.ts`, `apps/web/proxy.ts` | CSP `connect-src` from runtime env |
| `infra/deploy/Dockerfile` | `ARG`/`ENV` `API_BASE_URL`, `OIDC_ISSUER` (image build; prod bind-mount build unchanged) |

### Compose drift (git vs VPS)

`infra/deploy/compose.yaml` on **cbabea4** `main` still omits `OIDC_AUDIENCE` / `OIDC_JWKS_URL` on service `web` (hotfix in open PR [#665](https://github.com/hangndat/ticket-solution/pull/665)). VPS prod already had both lines (from deploy `1ba6647`). Rsync briefly overwrote compose from git; **restored** prod file from backup so running env is unchanged.

```diff
--- git cbabea4 (web environment excerpt)
+++ VPS prod (retained)
@@ OIDC_SCOPES: openid profile email
+      OIDC_AUDIENCE: ${OIDC_AUDIENCE:-ticket-api}
+      OIDC_JWKS_URL: ${OIDC_JWKS_URL:-https://auth.vemoki.com/realms/ticket/protocol/openid-connect/certs}
```

Web container env (runtime CSP): `API_BASE_URL=http://api:3001`, `OIDC_ISSUER=https://auth.vemoki.com/realms/ticket` — present in compose; no compose `up` this deploy.

### Trước deploy #668

| Check | Trước |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200 |
| `GET https://api.vemoki.com/v1/public/events?limit=1` | **500** (RLS on rate counters) |

### Thực hiện #668

1. Backup `apps/{api,web}`, `packages/{backend,contracts}`, `infra` → `deploy-2026-10-21-cbabea4/`.
2. Rsync worktree `cbabea4` paths (excludes deploy-prod skill); sync `Dockerfile`; **retain** VPS `compose.yaml` (OIDC hotfix).
3. `vemoki-runtime:local`: contracts tsc → `@ticket/backend` build → `@ticket/api` build → `docker compose restart api`.
4. `@ticket/web` build → `docker compose restart web`.

### Sau deploy #668

| Check | Sau |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://api.vemoki.com/v1/public/events?limit=1` | **200** |
| `GET https://vemoki.com/` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| CSP app (`connect-src`) | `connect-src 'self' http://api:3001 https://auth.vemoki.com` + `nosniff` |
| `GET https://ancafe.anphong.vn/` | 200 |
| `vemoki-web-1` logs (5m) | `failed-to-find-server-action` count **0** |

### Rollback #668

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-cbabea4
rsync -a "$BACKUP/api/" /opt/vemoki/src/apps/api/
rsync -a "$BACKUP/web/" /opt/vemoki/src/apps/web/
rsync -a "$BACKUP/backend/" /opt/vemoki/src/packages/backend/
rsync -a "$BACKUP/contracts/" /opt/vemoki/src/packages/contracts/
rsync -a "$BACKUP/infra/" /opt/vemoki/src/infra/
## rebuild api + web per deploy-prod skill, restart api then web
```

---

## Deploy `1ba6647` (earlier 2026-10-21)

| Field | Value |
| --- | --- |
| Source SHA | `1ba6647b8e6b1652cfdf25b86500d9d415bab48e` (`main`) |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-1ba6647/` |
| Operator | Gonic (Orca worker `task_bb111a33f720`) |
| Migrate | **Không** — danh sách migration prod khớp worktree (tip `202610201200_mpr_w1_owner_tickets_aggregate`) |

### Dry-run (rsync `-rlc --itemize-changes`, excludes theo deploy-prod skill)

| Path / service | Lệch? | Ghi chú |
| --- | --- | --- |
| `packages/contracts` | Có | `src/index.ts` |
| `packages/backend` | Có | event modules, tests, `package.json` |
| `apps/api` | Có | hardening, identity/platform split, `http-limits`, OpenAPI |
| `apps/worker` | Có | tick guard / overlap / timeout relay |
| `apps/web` | Có | CSP/refresh OIDC, admin hooks, upload guard |
| `apps/portal` | Có | `next-env.d.ts` only |
| `infra` | Có | `deploy/.env.example` (+ compose hotfix below) |
| `pnpm-lock.yaml` | Có | `pnpm install --frozen-lockfile` on VPS |

### Trước deploy (VPS, `curl --resolve …:443:127.0.0.1` cho vemoki hosts)

| Check | Trước |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://vemoki.com/` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://ancafe.anphong.vn/` | 200 |

### Thực hiện

1. Backup rsync các path trên → `/opt/vemoki/backup/deploy-2026-10-21-1ba6647/`.
2. Rsync worktree → prod (không `--delete`; không đụng `node_modules` / `.pnpm-store`).
3. `pnpm install` + build theo skill: contracts → backend → api → **restart api** → worker → **restart worker** → web → **restart web** → portal → **restart portal**.
4. **Compose hotfix (prod):** service `web` thiếu `OIDC_AUDIENCE` / `OIDC_JWKS_URL` trong `environment` (portal đã có). Sau build web mới, `/api/bff/me` trả **503** `OIDC_MISCONFIGURED` dù biến có trong `/opt/vemoki/.env`. Đã thêm hai dòng vào `infra/deploy/compose.yaml` (repo + VPS) và `up -d --no-deps --force-recreate web`.

### Sau deploy

| Check | Sau |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://vemoki.com/` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://portal.vemoki.com/api/bff/me/subject` (no cookie) | **401** (`UNAUTHENTICATED`) — portal không mount `/api/bff/me` (404) |
| CSP + `X-Content-Type-Options: nosniff` on app | Có |
| CSP + `nosniff` on portal | Có |
| `GET https://ancafe.anphong.vn/` | 200 |
| `GET https://dath.anphong.vn/` | timeout từ VPS (hairpin); không đụng vhost |

### Worker

Container **Up**; banner outbox relay trong log. Tiếp tục log `relay_exports` **42501** permission denied (exports table) và `KEYRING_MISSING` tombstone — **không** chặn deploy scope; theo dõi riêng.

### Rollback

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-1ba6647
## rsync -a $BACKUP/<path>/ /opt/vemoki/src/<path>/  # per service
## rebuild + restart theo deploy-prod skill
```

### Follow-up (repo)

- PR [#665](https://github.com/hangndat/ticket-solution/pull/665): artifact + `infra/deploy/compose.yaml` (web OIDC env parity với portal).
- Không merge trong task deploy gốc.
