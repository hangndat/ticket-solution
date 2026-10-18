# PORTAL — Cutover production `portal.vemoki.com` (Gói C)

Ngày: 2026-10-19  
Issue: [#502](https://github.com/hangndat/ticket-solution/issues/502) · Story [#494](https://github.com/hangndat/ticket-solution/issues/494) · Epic [#491](https://github.com/hangndat/ticket-solution/issues/491)  
Run: `run_d04055a8969b` · Ủy quyền: **A+B+C** (DNS/TLS/deploy prod)  
Architecture impact: **Có** (host/OIDC/nginx/dual-run — ADR-20 §8)  
Skill: `.cursor/skills/deploy-prod/SKILL.md`

> **Phạm vi:** production DNS/TLS/nginx + deploy `apps/portal` + bật dual-run GET/HEAD redirect `app./admin|/platform` → portal có quan sát/rollback.  
> **Giữ:** `GATE-STAY-APP` (`app.vemoki.com/gate` không redirect portal).  
> **Cấm:** EAS Cloud Build; mock auth/UAT; parent-domain cookie `Domain=.vemoki.com`; redirect POST/PUT/PATCH/DELETE hoặc `/api/*` BFF.

Local prep (không thay file này): [`PORTAL-LOCAL-CUTOVER-PREP.md`](./PORTAL-LOCAL-CUTOVER-PREP.md).

---

## 1. Mục tiêu dual-run ON

| # | Kết quả | Pass khi |
| --- | --- | --- |
| C1 | DNS `portal.vemoki.com` → VPS edge | `dig +short portal.vemoki.com` = IP public VPS |
| C2 | TLS SAN gồm `portal.vemoki.com` | `openssl s_client …` SAN list có portal; HTTPS 200/307 hợp lệ |
| C3 | Nginx vhost → `vemoki-portal:3013` | Host portal không đụng `ancafe`/`dath`; `X-Forwarded-Host` overwrite `$host` |
| C4 | Portal process + OIDC staff | `ticket-admin-web` callback `https://portal.vemoki.com/api/auth/callback`; cookie host-only |
| C5 | Dual-run redirect ON | `PORTAL_ADMIN_REDIRECT=1` + `PORTAL_ORIGIN=https://portal.vemoki.com`; GET `/admin` trên app → 302 portal; POST/BFF không 302 |
| C6 | Gate stay app | GET `https://app.vemoki.com/gate` **không** Location portal |
| C7 | Rollback sẵn | Tắt flag trước; nginx/portal rollback bảng §4 |

---

## 2. Thứ tự triển khai (bắt buộc)

SSH: alias `conanphong` (= `ssh -i ~/.ssh/id_rsa dexter@113.161.116.5`) hoặc `VEMoki_SSH_HOST`. Tree: `/opt/vemoki/src`. Secrets: `/opt/vemoki/.env` (mode 600) — **không** in ra chat/PR.

### 2.1 DNS (Porkbun)

Tạo **A** (và AAAA nếu có) `portal.vemoki.com` → cùng IP edge với `app.vemoki.com` / `vemoki.com`.  
Chờ resolve từ máy deploy: `dig +short portal.vemoki.com A`.

### 2.2 Sync source + realm

```bash
# Từ máy dev (rsync exclusions theo deploy-prod skill)
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .next --exclude dist --exclude .turbo \
  --exclude 'apps/mobile/ios' --exclude 'apps/mobile/android' --exclude .uat-artifacts \
  ./ dexter@<host>:/opt/vemoki/src/

# Realm: expand URI portal (giữ URI app/local) — file repo → host realm path
# Không in secret. Mode đọc được bởi user trong container Keycloak.
sudo cp /opt/vemoki/src/infra/keycloak/realm-ticket.json /opt/vemoki/realm-ticket.json
# fix ownership/mode nếu import fail (tránh 600 của user host khác)
```

Recreate Keycloak sau khi realm đổi:

```bash
cd /opt/vemoki/src/infra/deploy
docker compose --env-file /opt/vemoki/.env up -d --no-deps --force-recreate keycloak
# Verify:
curl -fsS https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration | head
```

### 2.3 Env portal (không commit)

Thêm vào `/opt/vemoki/.env` (tên biến — giá trị thật chỉ trên host):

| Biến | Giá trị prod |
| --- | --- |
| `PORTAL_ORIGIN` | `https://portal.vemoki.com` |
| `PORTAL_WEB_PUBLIC_ORIGIN` | `https://portal.vemoki.com` |
| `PORTAL_OIDC_REDIRECT_URI` | `https://portal.vemoki.com/api/auth/callback` |
| `PORTAL_PLATFORM_OIDC_REDIRECT_URI` | `https://portal.vemoki.com/api/auth/platform/callback` |
| `OIDC_ADMIN_CLIENT_SECRET` | secret client Keycloak **`ticket-admin-web`** (≠ `OIDC_CLIENT_SECRET` của `ticket-web`) |
| `PORTAL_ADMIN_REDIRECT` | `0` lúc bootstrap; `1` sau smoke C4 |
| `PORTAL_DUAL_RUN_BANNER` | `1` |

`PLATFORM_OIDC_CLIENT_SECRET` đã có cho platform — tái dùng trên service portal.

### 2.4 Build + start portal

```bash
docker run --rm --env-file /opt/vemoki/.env -v /opt/vemoki/src:/app -w /app vemoki-runtime:local \
  sh -c 'pnpm config set store-dir /app/.pnpm-store && pnpm config set package-import-method hardlink && \
    pnpm install --frozen-lockfile --filter @ticket/portal... --filter @ticket/web... && \
    pnpm --filter @ticket/api exec tsc -p ../../packages/contracts/tsconfig.json && \
    pnpm --filter @ticket/portal build && pnpm --filter @ticket/web build'

cd /opt/vemoki/src/infra/deploy
docker compose --env-file /opt/vemoki/.env up -d --no-deps portal
# Sau dual-run ON cũng restart web để nạp PORTAL_ADMIN_REDIRECT:
# docker compose --env-file /opt/vemoki/.env up -d --no-deps --force-recreate web
```

### 2.5 TLS expand (Let's Encrypt webroot)

Cert hiện tại: `live/vemoki.com` SAN = apex/www/app/api/auth — **thiếu** portal.

1. Thêm `portal.vemoki.com` vào `server_name` block **listen 80** trong `vemoki.conf` (ACME).
2. `nginx -t` + reload trong `nginx-letencrypt-nginx-1`.
3. Expand cert (từ `/media/anphong/nginx-letencrypt`):

```bash
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --cert-name vemoki.com \
    -d vemoki.com -d www.vemoki.com -d app.vemoki.com \
    -d api.vemoki.com -d auth.vemoki.com -d portal.vemoki.com \
    --expand --agree-tos --non-interactive" certbot
```

4. Xác nhận SAN có `DNS:portal.vemoki.com`.

### 2.6 Nginx HTTPS portal

Áp snippet repo [`infra/deploy/nginx-portal.snippet.conf`](../../infra/deploy/nginx-portal.snippet.conf) vào `data/nginx/vemoki.conf` (chỉ file vemoki; **không** sửa ancafe/dath).  
`proxy_pass http://vemoki-portal:3013`; overwrite `X-Forwarded-Host $host`.  
`nginx -t` rồi reload.

### 2.7 Bật dual-run ON

Sau C1–C4 pass:

```bash
# Trên VPS: set PORTAL_ADMIN_REDIRECT=1 trong /opt/vemoki/.env (không echo giá trị khác)
cd /opt/vemoki/src/infra/deploy
docker compose --env-file /opt/vemoki/.env up -d --no-deps --force-recreate web
```

Verify bằng [`scripts/portal-prod-cutover-check.sh`](../../scripts/portal-prod-cutover-check.sh).

---

## 3. Quan sát (cửa sổ dual-run)

| Tín hiệu | Kỳ vọng |
| --- | --- |
| Portal `/` hoặc `/auth` | 200 / redirect login IdP; không `0.0.0.0` trong Location |
| Portal `/api/bff/me` (no session) | 401 |
| App GET `/admin` | 302 → `https://portal.vemoki.com/admin…` (query allowlist) |
| App POST `/admin` hoặc `/api/*` | **không** 302 portal |
| App GET `/gate` | ở lại app (307/200 auth app — không portal host) |
| `ancafe.anphong.vn` | vẫn 200 |

---

## 4. Rollback (bắt buộc — ADR-20 §8)

Thứ tự **không đảo**:

1. **Tắt** `PORTAL_ADMIN_REDIRECT=0` (hoặc unset) trên web → `force-recreate web`.  
2. Xác nhận GET `app./admin` phục vụ legacy (không Location portal).  
3. Không tạo loop portal↔app; **không** “fix” bằng `Domain=.vemoki.com`.  
4. Nếu portal/OIDC hỏng: giữ Keycloak URI legacy app; staff dùng `app./admin`.  
5. Nginx: có thể tạm `proxy_pass` portal vhost → `vemoki-web:3000` **chỉ** khi cần emergency page — ưu tiên tắt flag trước.  
6. DNS: không xóa A record trong cửa sổ quan sát trừ khi abort dài hạn.

---

## 5. Evidence / DoD (#502)

- [ ] DNS + TLS SAN portal  
- [ ] Portal container up; login path staff (không mock)  
- [ ] Dual-run ON + Gate stay app (script check)  
- [ ] Rollback drill ghi trong evidence (tắt flag)  
- [ ] PR + Project `Chờ duyệt` + exact tip SHA  
- [ ] Artifact `docs/reviews/*` cite SHA  

Script: [`scripts/portal-prod-cutover-check.sh`](../../scripts/portal-prod-cutover-check.sh).
