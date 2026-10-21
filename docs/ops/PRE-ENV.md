# Pre environment (`pre*.vemoki.com`)

Song song production trên cùng VPS (`113.161.116.5`), stack Docker riêng (`vemoki-pre`), DB/Keycloak/MinIO/Mailpit tách biệt. **Không** restart/recreate container prod.

| Host | Vai trò |
| --- | --- |
| `pre.vemoki.com` | Marketing (apex) |
| `pre-app.vemoki.com` | Product web + BFF |
| `pre-api.vemoki.com` | API |
| `pre-auth.vemoki.com` | Keycloak |
| `pre-portal.vemoki.com` | Portal staff |

SSH: alias `conanphong` (xem [`PORTAL-PROD-CUTOVER.md`](./PORTAL-PROD-CUTOVER.md)). Secrets: `/opt/vemoki-pre/.env` (mode 600) — **không** commit / không in log.

## Repo artifacts

| File | Mục đích |
| --- | --- |
| [`infra/deploy/compose.pre.yaml`](../../infra/deploy/compose.pre.yaml) | Overlay compose (`-p vemoki-pre`) |
| [`infra/deploy/.env.pre.example`](../../infra/deploy/.env.pre.example) | Template biến Pre |
| [`infra/keycloak/realm-ticket.pre.json`](../../infra/keycloak/realm-ticket.pre.json) | Realm import (Mailpit SMTP, URI pre-*) |
| [`infra/deploy/nginx-pre.snippet.conf`](../../infra/deploy/nginx-pre.snippet.conf) | Vhost edge → `vemoki-pre-*` |
| [`scripts/pre-env-bootstrap.sh`](../../scripts/pre-env-bootstrap.sh) | Tạo `.env` + realm trên host (random secrets) |

## Bootstrap host (lần đầu)

```bash
# Từ máy dev — đồng bộ source (không secrets)
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .next --exclude dist --exclude .turbo \
  --exclude 'apps/mobile/ios' --exclude 'apps/mobile/android' \
  ./ conanphong:/opt/vemoki-pre/src/

ssh conanphong 'bash /opt/vemoki-pre/src/scripts/pre-env-bootstrap.sh'
```

Build runtime + app (cùng pattern prod, đổi env file):

```bash
ssh conanphong 'cd /opt/vemoki-pre/src/infra/deploy && \
  docker build -f Dockerfile.runtime -t vemoki-runtime:local . && \
  docker run --rm --env-file /opt/vemoki-pre/.env -v /opt/vemoki-pre/src:/app -w /app vemoki-runtime:local \
  sh -c "pnpm config set store-dir /app/.pnpm-store && pnpm config set package-import-method hardlink && \
    pnpm install --frozen-lockfile --filter @ticket/api... --filter @ticket/web... --filter @ticket/portal... --filter @ticket/worker... && \
    pnpm --filter @ticket/api exec tsc -p ../../packages/contracts/tsconfig.json && \
    pnpm --filter @ticket/web-session build && \
    pnpm --filter @ticket/backend build && pnpm --filter @ticket/api build && \
    pnpm --filter @ticket/web build && pnpm --filter @ticket/portal build && pnpm --filter @ticket/worker build" && \
  docker compose -f compose.yaml -f compose.pre.yaml --env-file /opt/vemoki-pre/.env -p vemoki-pre up -d'
```

Mail: worker + realm dùng **Mailpit** (`SMTP_URL=smtp://mailpit:1025`) — không gửi mail thật. APNs tắt (`APNS_ENABLED=false`).

## Nginx + TLS

1. Thêm 5 host `pre*` vào **dòng `listen 80` đầu tiên** (ACME) trong `/media/anphong/nginx-letencrypt/data/nginx/vemoki.conf` — **không** sửa `server_name portal.vemoki.com` trong block HTTPS portal.
2. Append nội dung [`nginx-pre.snippet.conf`](../../infra/deploy/nginx-pre.snippet.conf).
3. `docker exec nginx-letencrypt-nginx-1 nginx -t` → `nginx -s reload` (không restart container).
4. Expand cert (giữ SAN prod):

```bash
cd /media/anphong/nginx-letencrypt
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --cert-name vemoki.com \
    -d vemoki.com -d www.vemoki.com -d app.vemoki.com \
    -d api.vemoki.com -d auth.vemoki.com -d portal.vemoki.com \
    -d pre.vemoki.com -d pre-app.vemoki.com -d pre-api.vemoki.com \
    -d pre-auth.vemoki.com -d pre-portal.vemoki.com \
    --expand --agree-tos --non-interactive" certbot
```

Reload nginx sau khi cert mới.

## Verify (không secret)

```bash
for h in pre pre-app pre-api pre-auth pre-portal; do
  echo "=== $h"
  curl -sI "https://${h}.vemoki.com/" | head -1
done
curl -fsS "https://pre-api.vemoki.com/v1/health"
curl -fsS "https://pre-auth.vemoki.com/realms/ticket/.well-known/openid-configuration" | jq -r .issuer
# issuer phải là https://pre-auth.vemoki.com/realms/ticket

# Prod không đổi
for h in vemoki.com app.vemoki.com api.vemoki.com auth.vemoki.com portal.vemoki.com; do
  curl -sI "https://${h}/" | head -1
done
```

Đăng nhập: demo realm `attendee@example.com` / `attendee-demo` (chỉ Pre). Flow OIDC phải redirect về `pre-app` / `pre-auth`.

## Rollback

1. Gỡ block `server { … pre* … }` và pre host khỏi `listen 80` trong `vemoki.conf` → `nginx -t` → reload.
2. `cd /opt/vemoki-pre/src/infra/deploy && docker compose -f compose.yaml -f compose.pre.yaml --env-file /opt/vemoki-pre/.env -p vemoki-pre down`
3. (Tuỳ chọn) `docker volume rm` các volume `vemoki-pre_*` khi chắc chắn không cần dữ liệu Pre.

**Không** `docker compose` trên `/opt/vemoki` (prod) khi rollback Pre.

## Cập nhật code Pre

Rsync source → rebuild filter tương prod → `docker compose … -p vemoki-pre up -d --no-deps <service>` hoặc `restart`.
