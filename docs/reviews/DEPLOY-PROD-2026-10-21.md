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
