# Vemoki trên VPS

Bản đầu chạy trên máy đã có nginx giữ cổng 80/443. Compose Vemoki không publish 80/443. TLS và vhost nằm ở nginx đó. SMTP production (ADR-13) chưa bật; worker vẫn trỏ Mailpit.

## Image

`Dockerfile.runtime` chỉ có Node 24, OpenSSL và pnpm. `node_modules`, `dist` và `.next` nằm trên đĩa host, mount vào `/app`.

Store pnpm phải cùng một mount với source. Hai bind mount khác nhau cùng ổ vẫn không hard link được, pnpm sẽ copy từng file. Trên VPS store là `/opt/vemoki/src/.pnpm-store`.

`Dockerfile` (build một image tự chứa) tách layer dependency và dùng cache BuildKit. Cách đó không phải cách đang chạy trên VPS.

## Từng service

Deploy một service khi chỉ service đó đổi. `restart` đủ sau khi build lên bind mount. `up -d --no-deps` khi không muốn kéo dependency. Chi tiết lệnh và verify: `.cursor/skills/deploy-prod/SKILL.md`.

| Service | Việc | Khởi động lại |
| --- | --- | --- |
| web | build `@ticket/web` | `restart web` |
| api | build backend rồi `@ticket/api` | `restart api` |
| worker | build backend rồi `@ticket/worker` | `restart worker` |
| migrate | schema Prisma | `up -d migrate`, đợi exit 0 |
| keycloak | file realm | `up -d --no-deps --force-recreate keycloak` |
| nginx | `vemoki.conf` | `nginx -t` rồi reload, không compose stack nginx |
| postgres | không deploy app | không tạo lại volume |
| mailpit | không có source | chỉ bật nếu container tắt |


## Lệnh

Từ `infra/deploy`, với env file ngoài git:

```bash
docker build -f Dockerfile.runtime -t vemoki-runtime:local .
docker run --rm --env-file /opt/vemoki/.env -v /opt/vemoki/src:/app -w /app \
  vemoki-runtime:local \
  sh -c 'pnpm config set store-dir /app/.pnpm-store && pnpm config set package-import-method hardlink && pnpm install --frozen-lockfile --filter @ticket/api... --filter @ticket/web... --filter @ticket/worker... && pnpm --filter @ticket/api exec tsc -p ../../packages/contracts/tsconfig.json && pnpm --filter @ticket/backend build && pnpm --filter @ticket/api build && pnpm --filter @ticket/web build && pnpm --filter @ticket/worker build'
docker compose --env-file /opt/vemoki/.env up -d
```

`apps/mobile` không được cài vào image. File realm Keycloak phải đọc được bởi user trong container. Mode `600` của user host khác sẽ làm import thất bại và container thoát ngay.

## Nginx

Proxy:

- `vemoki.com` → `vemoki-web:3000`
- `api.vemoki.com` → `vemoki-api:3001`
- `auth.vemoki.com` → `vemoki-keycloak:8080`

Giữ `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`. **Bắt buộc** ghi đè `X-Forwarded-Host $host` (không chuyển tiếp header client). Web nên dùng `PUBLIC_WEB_ORIGIN=https://vemoki.com` (allowlist) thay vì tin forwarded host thô.

Next bind `0.0.0.0` nên `request.url` có thể thành `https://0.0.0.0:3000/...`. Callback và logout dùng `publicOrigin` (forwarded host do nginx ghi đè). Nginx đổi `Location` còn trỏ `0.0.0.0:3000` về `https://vemoki.com`.

## Đã kiểm tra

`https://vemoki.com`, `https://api.vemoki.com/v1/health`, discovery OIDC và site nginx cũ trả 200. `/api/bff/me` khi chưa đăng nhập là 401. Đăng nhập demo `attendee@example.com` và `staff@example.com` về `/auth` và `/api/bff/me` đúng email. Không còn redirect tới `0.0.0.0`.
