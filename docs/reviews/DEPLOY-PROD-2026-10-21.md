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

## Deploy #711 — `9515c980` (web OIDC audience authorize/refresh + SSR aud guard)

| Field | Value |
| --- | --- |
| Source SHA | `9515c980db4185c8109fe648204036e3e0e56fb1` (merge PR [#711](https://github.com/hangndat/ticket-solution/pull/711)) |
| Prior prod marker | `8f4f70af2a10df072693bfb26047efcea8d93db9` → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-9515c980/` |
| Operator | Gonic (Orca worker `task_ed057f33438e`) |
| Scope | **web** only (no migrate, nginx, keycloak, api, worker, portal) |
| Compose | `docker compose --env-file /opt/vemoki/.env -f compose.yaml -f /opt/vemoki/compose.trace.override.yaml up -d --no-deps web` + `restart web` (trace override retained) |

### Keycloak (read-only, prod realm `ticket`, client `ticket-web`)

| Check | Kết quả |
| --- | --- |
| `oidc-audience-mapper` on `ticket-web` | **Có** |
| `included.client.audience` | `ticket-api` |

### Code paths

| Path | Change |
| --- | --- |
| `apps/web/src/oidc/authorize.ts`, `access-token-audience.ts`, `refresh.ts`, `session-refresh.ts` | audience on authorize/refresh |
| `apps/web/app/api/auth/login/route.ts` | login authorize params |
| `apps/web/src/nav/staff-route-guard.ts` | SSR decode `aud` guard |
| `apps/web/tests/*` | audience + authorize URL tests |

### Trước deploy #711

| Check | Trước |
| --- | --- |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `/opt/vemoki/deployed-sha.txt` | `8f4f70a…` |

### Thực hiện #711

1. Backup `apps/web` → `deploy-2026-10-21-9515c980/web/`.
2. Rsync worktree `apps/web` only (excludes deploy-prod skill); no lockfile / contracts change.
3. `vemoki-runtime:local`: `@ticket/web` build → compose `up -d --no-deps web` (trace override) → `restart web`.

### Sau deploy #711

| Check | Sau |
| --- | --- |
| `GET https://vemoki.com/` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `GET https://app.vemoki.com/api/auth/refresh` (no cookie) | **307** → `/auth?next=%2F` (không 5xx) |
| `POST https://app.vemoki.com/redeem` + `next-action: x` | **400** (edge guard) |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://ancafe.anphong.vn/` | 200 |
| `vemoki-web-1` logs (5m) | `failed-to-find-server-action` count **0**; không error spike |

### Rollback #711

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-9515c980
rsync -a "$BACKUP/web/" /opt/vemoki/src/apps/web/
## rebuild @ticket/web per deploy-prod skill; restart web (giữ trace override)
```

### Follow-up (repo)

- PR docs artifact (mục này); không merge trong task deploy.

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

## Deploy #678 — `bfc0316` (web server-action edge guard)

| Field | Value |
| --- | --- |
| Source SHA | `bfc03166b7e46399a5ea19b68bedaa6c8c1fca3b` (merge PR [#678](https://github.com/hangndat/ticket-solution/pull/678)) |
| Prior prod marker | `cbabea4ccc6447e7dc40a832ba95c81320c1b0d9` → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-bfc0316/` |
| Operator | Gonic (Orca worker `task_f806b6bb6b50`) |
| Scope | **web** only (no migrate, nginx, keycloak, api, worker, portal) |
| Compose | VPS `infra/deploy/compose.yaml` unchanged (matches git `a55f89ee`; OIDC hotfix retained) |
| Build log | `/opt/vemoki/deploy-678-bfc0316-web.log` |

### Code paths

| Path | Change |
| --- | --- |
| `apps/web/app/redeem/redeem-form.tsx` | server action wiring |
| `apps/web/proxy.ts` | edge guard for invalid server actions |
| `apps/web/src/security/server-action-edge.ts` | **new** — reject bogus `next-action` before RSC handler |
| `apps/web/src/nav/staff-route-guard.ts` | minor |
| `apps/web/tests/*` | integration + unit for edge guard |

### Trước deploy #678

| Check | Trước |
| --- | --- |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `/opt/vemoki/deployed-sha.txt` | `cbabea4…` |

### Thực hiện #678

1. Backup `apps/web` → `deploy-2026-10-21-bfc0316/web/`.
2. Rsync worktree `bfc0316` `apps/web` only (excludes deploy-prod skill); no lockfile / contracts change.
3. `vemoki-runtime:local`: `@ticket/web` build → `docker compose restart web`.

### Sau deploy #678

| Check | Sau |
| --- | --- |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| CSP app (`connect-src`) | `connect-src 'self' http://api:3001 https://auth.vemoki.com` + `nosniff` |
| `POST https://app.vemoki.com/redeem` + `next-action: x` | **400** (edge guard; not 500 / server-action miss) |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://ancafe.anphong.vn/` | 200 |
| `vemoki-web-1` logs (after redeem probe) | `failed-to-find-server-action` count **0** |

### Rollback #678

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-bfc0316
rsync -a "$BACKUP/web/" /opt/vemoki/src/apps/web/
## rebuild @ticket/web per deploy-prod skill, restart web
```

---

## Deploy #682 — `0add1f6` (web `/gate` SSR discovery via forwardWithBearer)

| Field | Value |
| --- | --- |
| Source SHA | `0add1f6072d4e4b9b7b6b73f7b8ffb3baa7b0bb8` (merge PR [#682](https://github.com/hangndat/ticket-solution/pull/682)) |
| Prior prod marker | `bfc03166b7e46399a5ea19b68bedaa6c8c1fca3b` → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-f01730a/` (snapshot trước rsync; main tip `f01730a`) |
| Operator | Gonic (Orca worker `task_bc64b07f1ae4`) |
| Scope | **web** only (no migrate, nginx, keycloak, api, worker, portal) |
| Build log | `/opt/vemoki/deploy-682-f01730a-web.log` |

### Code paths

| Path | Change |
| --- | --- |
| `apps/web/app/admin/page.tsx` | staff route loading |
| `apps/web/app/gate/page.tsx` | gate SSR loading |
| `apps/web/src/bff/upstream.ts` | `forwardWithBearer` discovery |
| `apps/web/src/nav/staff-route-guard.ts` | gate/admin guard |
| `apps/web/tests/staff-route-guard.test.ts` | **new** |

### Trước deploy #682

| Check | Trước |
| --- | --- |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `/opt/vemoki/deployed-sha.txt` | `bfc0316…` |

### Thực hiện #682

1. Backup `apps/web` → `deploy-2026-10-21-f01730a/web/`.
2. Rsync worktree `apps/web` only (excludes deploy-prod skill); no lockfile / contracts change.
3. `vemoki-runtime:local`: `@ticket/web` build → `docker compose restart web`.

### Sau deploy #682

| Check | Sau |
| --- | --- |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `POST https://app.vemoki.com/redeem` + `next-action: x` | **400** (edge guard) |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://ancafe.anphong.vn/` | 200 |
| `vemoki-web-1` logs (after probes) | `failed-to-find-server-action` count **0** |

### API log ghi chú (ngoài scope deploy)

`vemoki-api-1` tiếp tục spam `account_deletion_tombstone_keyring_missing` / `KEYRING_MISSING` (không secret). 5 dòng gần nhất lúc verify:

```json
{"alert":"account_deletion_tombstone_keyring_missing","severity":"error","code":"KEYRING_MISSING","operational_reason":"keyring_unavailable","live_tombstone_keys":0}
{"alert":"account_deletion_tombstone_keyring_missing","severity":"error"}
{"alert":"account_deletion_tombstone_keyring_missing","severity":"error","code":"KEYRING_MISSING","operational_reason":"keyring_unavailable","live_tombstone_keys":0}
{"alert":"account_deletion_tombstone_keyring_missing","severity":"error"}
{"alert":"account_deletion_tombstone_keyring_missing","severity":"error","code":"KEYRING_MISSING","operational_reason":"keyring_unavailable","live_tombstone_keys":0}
```

### Rollback #682

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-f01730a
rsync -a "$BACKUP/web/" /opt/vemoki/src/apps/web/
## rebuild @ticket/web per deploy-prod skill, restart web
```

---

## Deploy #707 — `8f4f70a` (web SSR `/api/auth/refresh` Route Handler)

| Field | Value |
| --- | --- |
| Source SHA | `8f4f70af2a10df072693bfb26047efcea8d93db9` (merge PR [#707](https://github.com/hangndat/ticket-solution/pull/707)) |
| Prior prod marker | `7af72d35e0d74ed695cbce97a82ff239ca633ca2` (deploy #703) → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-8f4f70a/` |
| Operator | Gonic (Orca worker `task_806bc4a4aba2`) |
| Scope | **web** only (no migrate, nginx, keycloak, api, worker, portal) |
| Compose | Giữ `/opt/vemoki/compose.trace.override.yaml` (`GATE_SSR_TRACE=1`); restart web với `-f compose.yaml -f compose.trace.override.yaml` |
| Build log | `/opt/vemoki/deploy-707-8f4f70a-web.log` |

## Deploy #703 — `7af72d35` (web SSR gate refresh + `GATE_SSR_TRACE` off by default)

| Field | Value |
| --- | --- |
| Source SHA | `7af72d35e0d74ed695cbce97a82ff239ca633ca2` (merge PR [#703](https://github.com/hangndat/ticket-solution/pull/703)) |
| Prior prod marker | `0add1f6072d4e4b9b7b6b73f7b8ffb3baa7b0bb8` → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-7af72d35/web/` |
| Operator | Gonic (Orca worker `task_6581e36a7304`) |
| Scope | **web** only (no migrate, nginx, keycloak, api, worker, portal) |
| Compose | `GATE_SSR_TRACE` **không** trong `compose.yaml` (VPS == git; trace tắt mặc định) |
| Build log | `/opt/vemoki/deploy-703-7af72d35-web.log` |

### Code paths

| Path | Change |
| --- | --- |
| `apps/web/app/api/auth/refresh/route.ts` | **new** — GET refresh + cookie rotation (SSR-safe) |
| `apps/web/app/gate/page.tsx` | redirect qua `/api/auth/refresh?next=/gate` khi stale access |
| `apps/web/src/oidc/session-refresh.ts` | SSR refresh attempt markers |
| `apps/web/tests/auth-refresh-route.test.ts` | **new** |

### Trước deploy #707

| `apps/web/app/gate/page.tsx` | gate page |
| `apps/web/src/bff/upstream.ts` | upstream / bearer forwarding |
| `apps/web/src/gate/gate-ssr-trace.ts` | **new** — opt-in SSR trace (`GATE_SSR_TRACE`) |
| `apps/web/src/nav/staff-route-guard.ts` | gate refresh + stale access handling |
| `apps/web/src/oidc/access-token-clock.ts` | **new** — access token clock skew |
| `apps/web/src/oidc/refresh.ts` | refresh integration |
| `apps/web/tests/access-token-clock.test.ts` | **new** |

### Trước deploy #703

| Check | Trước |
| --- | --- |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `/opt/vemoki/deployed-sha.txt` | `7af72d35…` (#703) |

### Thực hiện #707

1. Backup `apps/web` → `deploy-2026-10-21-8f4f70a/web/`.
2. Rsync worktree `apps/web` only (excludes deploy-prod skill); no lockfile / contracts change.
3. `vemoki-runtime:local`: `@ticket/web` build → `docker compose` restart `web` (trace override file retained).

### Sau deploy #707

| `/opt/vemoki/deployed-sha.txt` | `0add1f6…` |

### Thực hiện #703

1. Backup `apps/web` → `deploy-2026-10-21-7af72d35/web/`.
2. Rsync worktree `apps/web` only (excludes deploy-prod skill); no lockfile / contracts change.
3. `vemoki-runtime:local`: `@ticket/web` build → `docker compose restart web` (không `compose --build`).

### Sau deploy #703

| Check | Sau |
| --- | --- |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `GET https://app.vemoki.com/api/auth/refresh?next=/gate` (no cookie) | **307** → `/auth?next=%2Fgate` (không 5xx) |
| `GET …/api/auth/refresh?next=https://evil.com` | **307** → `/auth?next=%2F` (không redirect ra ngoài) |
| `POST https://app.vemoki.com/redeem` + `next-action: x` | **400** (edge guard) |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://ancafe.anphong.vn/` | 200 |
| `vemoki-web-1` logs (5m, sau probes) | `failed-to-find-server-action` count **0**; `[gate-ssr-trace]` expected (override) |

### Rollback #707

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-8f4f70a
rsync -a "$BACKUP/web/" /opt/vemoki/src/apps/web/
## rebuild @ticket/web per deploy-prod skill; restart web với trace override compose flags

| `GET https://vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `POST https://app.vemoki.com/redeem` + `next-action: x` | **400** (edge guard) |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://ancafe.anphong.vn/` | 200 |
| `vemoki-web-1` logs (after probes) | no `error` / `failed-to-find-server-action`; `GATE_SSR_TRACE` không bật |

### Rollback #703

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-7af72d35
rsync -a "$BACKUP/web/" /opt/vemoki/src/apps/web/
## rebuild @ticket/web per deploy-prod skill, restart web
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

---

## Deploy #728 / #729 / #731 — `81bd804` (BFF `vemoki-api` alias, API `tenantId`, web redeem)

| Field | Value |
| --- | --- |
| Source SHA | `81bd80499d6fbd573a35da7726da5fa49b1409a9` (`main`; #728 auth terminal + compose alias, #729 API `tenantId`, #731 web redeem) |
| Prior prod marker | `9515c980db4185c8109fe648204036e3e0e56fb1` → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-81bd804/` |
| Operator | Gonic (Orca worker `task_92bcf70d3363`) |
| Scope | **api** + **web** + **portal** compose env (no migrate, nginx vhost edit, keycloak, worker) |
| Compose | `API_BASE_URL: http://vemoki-api:3001` on web/portal; `up -d --no-deps web portal` **without** `compose.trace.override.yaml` |
| Build logs | `/opt/vemoki/deploy-728-81bd804-api.log`, `/opt/vemoki/deploy-728-81bd804-web.log` |

### Code / infra paths

| Path | Change |
| --- | --- |
| `infra/deploy/compose.yaml`, `infra/deploy/README.md` | BFF upstream `vemoki-api` alias; edge DNS smoke note |
| `packages/contracts`, `packages/backend`, `apps/api` | public events include `tenantId` (#729) |
| `apps/web` | auth terminal / redeem (#728, #731) |
| `apps/portal` | rsync only `next-env.d.ts` (no portal rebuild) |

### Edge DNS (trước recreate web/portal)

| Check | Kết quả |
| --- | --- |
| `docker exec vemoki-api-1 getent hosts vemoki-api` | `172.23.0.7` (khớp `vemoki-api-1` trên edge) |
| `docker exec vemoki-web-1 getent hosts vemoki-api` | một bản ghi, cùng IP |

### Trước deploy

| Check | Trước |
| --- | --- |
| `GET https://api.vemoki.com/v1/public/events?limit=1` | 200, **không** có `tenantId` |
| `docker exec vemoki-web-1 printenv API_BASE_URL` | `http://api:3001` |
| `/opt/vemoki/deployed-sha.txt` | `9515c980…` |

### Thực hiện

1. Backup `packages/{contracts,backend}`, `apps/{api,web,portal}`, `infra/deploy/{compose.yaml,README.md}` → `deploy-2026-10-21-81bd804/`.
2. Rsync worktree paths (excludes deploy-prod skill).
3. `vemoki-runtime:local`: contracts tsc → `@ticket/backend` build → `@ticket/api` build → `docker compose restart api`.
4. Verify API health + `tenantId` on public events.
5. `@ticket/web` build → `docker compose --env-file /opt/vemoki/.env up -d --no-deps web portal`.
6. **Nginx reload (operator):** sau recreate, HTTPS app/portal **502** vì worker nginx giữ upstream IP cũ; `nginx -s reload` bị chặn khi `vemoki-pre-*` không resolve. Đã thêm stub Alpine trên edge (`vemoki-pre-web`, `vemoki-pre-api`, `vemoki-pre-keycloak`, `vemoki-pre-portal`) chỉ để DNS pass `nginx -t`, rồi reload — **không** sửa `vemoki.conf`.

### Sau deploy

| Check | Sau |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://api.vemoki.com/v1/public/events?limit=1` | 200, có `tenantId` |
| `docker exec vemoki-web-1 printenv API_BASE_URL` | `http://vemoki-api:3001` |
| `docker exec vemoki-portal-1 printenv API_BASE_URL` | `http://vemoki-api:3001` |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `GET https://app.vemoki.com/api/bff/me` (no cookie) | **401** |
| `GET https://app.vemoki.com/gate` (no cookie) | **307** |
| `GET https://app.vemoki.com/api/auth/refresh` (no cookie) | **307** (không 5xx / loop) |
| `POST https://app.vemoki.com/redeem` + `next-action: x` | **400** |
| `GET https://app.vemoki.com/api/bff/public/tenants/mfest-demo/events/mfest` | 200, có `tenantId` |
| `GET https://ancafe.anphong.vn/` | 200 |
| CSP app `connect-src` | `http://vemoki-api:3001` + `https://auth.vemoki.com` |
| `vemoki-web-1` / `vemoki-portal-1` logs (5m) | `failed-to-find-server-action` **0**; không spike 401 |

### Rollback

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-81bd804
rsync -a "$BACKUP/packages/contracts/" /opt/vemoki/src/packages/contracts/
rsync -a "$BACKUP/packages/backend/" /opt/vemoki/src/packages/backend/
rsync -a "$BACKUP/apps/api/" /opt/vemoki/src/apps/api/
rsync -a "$BACKUP/apps/web/" /opt/vemoki/src/apps/web/
rsync -a "$BACKUP/apps/portal/" /opt/vemoki/src/apps/portal/
cp -a "$BACKUP/infra/deploy/compose.yaml" "$BACKUP/infra/deploy/README.md" /opt/vemoki/src/infra/deploy/
## rebuild api + web per deploy-prod skill; restart api; up/restart web+portal; nginx reload if recreated
```

### Follow-up (repo)

- PR docs artifact (mục này); không merge trong task deploy.

---

## Deploy #749 — `17cce6b` (APNs host fallback + sửa nhãn environment)

| Field | Value |
| --- | --- |
| Source SHA | `17cce6b8264e27f228315db9283a3ad2e72a2156` (merge PR [#749](https://github.com/hangndat/ticket-solution/pull/749)) |
| Prior prod marker | `81bd80499d6fbd573a35da7726da5fa49b1409a9` → updated `/opt/vemoki/deployed-sha.txt` |
| VPS | `conanphong` → `/opt/vemoki/src` |
| Rollback backup | `/opt/vemoki/backup/deploy-2026-10-21-17cce6b/` |
| Operator | Gonic (Orca worker `task_549cfc5b2db6`) |
| Scope | **api** + **worker** only (no migrate, nginx, keycloak, web, portal, compose change) |
| Build log | `/opt/vemoki/deploy-749-17cce6b-build.log` |

### Code paths

| Path | Change |
| --- | --- |
| `packages/backend/src/apns.ts` | APNs alternate host khi token environment label lệch |
| `packages/backend/src/device-tokens.ts`, `outbox.ts`, `index.ts` | wiring + relay |
| `packages/backend/test/apns-env-fallback.test.cjs` | **new** |
| `apps/api`, `apps/worker` | rsync (no functional diff ngoài dependency backend) |

`packages/contracts` — **không** rsync (PR không đổi contracts).

### Trước deploy #749

| Check | Trước |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://api.vemoki.com/v1/public/events?limit=1` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `/opt/vemoki/deployed-sha.txt` | `81bd804…` |
| `docker exec vemoki-worker-1 printenv APNS_ENABLED APNS_PRODUCTION` | `true` / `true` |
| `docker exec vemoki-worker-1 printenv APNS_ENV_FALLBACK` | unset (mặc định bật fallback) |

### Thực hiện #749

1. Backup `packages/backend`, `apps/{api,worker}` → `deploy-2026-10-21-17cce6b/`.
2. Rsync worktree paths (excludes deploy-prod skill); không `pnpm install` (lockfile không đổi).
3. `vemoki-runtime:local`: `@ticket/backend` build → `@ticket/api` build → `docker compose restart api`.
4. `@ticket/worker` build → `docker compose restart worker`.

### Sau deploy #749

| Check | Sau |
| --- | --- |
| `GET https://api.vemoki.com/v1/health` | 200, `status":"ok"` |
| `GET https://api.vemoki.com/v1/public/events?limit=1` | 200 |
| `GET https://app.vemoki.com/` | 200 |
| `GET https://portal.vemoki.com/` | 200 |
| `docker exec vemoki-worker-1 printenv APNS_ENABLED APNS_PRODUCTION` | `true` / `true` (giữ nguyên) |
| `docker exec vemoki-worker-1 printenv APNS_ENV_FALLBACK` | unset (giữ mặc định) |
| `vemoki-worker-1` | **Up**; banner `outbox email relay` trong log |
| Worker log | Tiếp tục `KEYRING_MISSING` + `relay_exports` **42501** (đã biết); không lỗi APNs mới sau restart |

### Rollback #749

```bash
BACKUP=/opt/vemoki/backup/deploy-2026-10-21-17cce6b
rsync -a "$BACKUP/packages/backend/" /opt/vemoki/src/packages/backend/
rsync -a "$BACKUP/apps/api/" /opt/vemoki/src/apps/api/
rsync -a "$BACKUP/apps/worker/" /opt/vemoki/src/apps/worker/
## rebuild backend → api → restart api; worker → restart worker per deploy-prod skill
```

### Follow-up (repo)

- PR docs artifact (mục này); không merge trong task deploy.
