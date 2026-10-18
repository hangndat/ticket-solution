# Vemoki trên VPS

Bản đầu chạy trên máy đã có nginx giữ cổng 80/443. Compose Vemoki không publish 80/443. TLS và vhost nằm ở nginx đó. SMTP production (ADR-13) chưa bật; worker vẫn trỏ Mailpit. MinIO chạy **internal-only** (không publish 9000/9001 lên edge).

Env mẫu (không secrets): [`./.env.example`](./.env.example) → copy vào `/opt/vemoki/.env` (mode 600).

## Image

`Dockerfile.runtime` chỉ có Node 24, OpenSSL và pnpm. `node_modules`, `dist` và `.next` nằm trên đĩa host, mount vào `/app`.

Store pnpm phải cùng một mount với source. Hai bind mount khác nhau cùng ổ vẫn không hard link được, pnpm sẽ copy từng file. Trên VPS store là `/opt/vemoki/src/.pnpm-store`.

`Dockerfile` (build một image tự chứa) tách layer dependency và dùng cache BuildKit. Cách đó không phải cách đang chạy trên VPS.

## Từng service

Deploy một service khi chỉ service đó đổi. `restart` đủ sau khi build lên bind mount. `up -d --no-deps` khi không muốn kéo dependency. Chi tiết lệnh và verify: `.cursor/skills/deploy-prod/SKILL.md`.

| Service | Việc | Khởi động lại |
| --- | --- | --- |
| web | build `@ticket/web` | `restart web` |
| portal | build `@ticket/portal` | `restart portal` |
| api | build backend rồi `@ticket/api` | `restart api` |
| worker | build backend rồi `@ticket/worker` | `restart worker` |
| migrate | schema Prisma | `up -d migrate`, đợi exit 0 |
| keycloak | file realm | `up -d --no-deps --force-recreate keycloak` |
| nginx | `vemoki.conf` | `nginx -t` rồi reload, không compose stack nginx |
| postgres | không deploy app | không tạo lại volume |
| mailpit | không có source | chỉ bật nếu container tắt |
| minio | object store CSV/assets | `up -d minio minio-init`; volume `minio_data` |
| minio-init | tạo bucket private | one-shot; exit 0 |


## MinIO (CSV export + D9 demo assets)

Local demo seed (không prod): `D9_MEDIA_STACK_UP=1 ./scripts/d9-seed-media.sh` — checklist `docs/ops/MEDIA-ASSET-CHECKLIST.md`.

**Image pin (O1):** `cleanstart/minio@sha256:4febd64f632c221b48e0fbf435ac534df822aa5b06805540c03973939e4cc82a` — official Hub/Quay `minio/minio` đã đóng anonymous pull. Init: `amazon/aws-cli:2.17.50@sha256:ac68e76a…` (thay `minio/mc`). Chi tiết: `docs/architecture/object-store-minio-replacement.md`.

Prod từng trả `MINIO_MISCONFIGURED` vì api/worker thiếu endpoint + không có container. Sau khi merge:

1. Thêm vào `/opt/vemoki/.env`: `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, buckets (`vemoki-exports` / `vemoki-assets` / `vemoki-imports`). **Không** commit giá trị thật.
2. Từ `infra/deploy`: `docker compose --env-file /opt/vemoki/.env up -d minio minio-init` (đợi minio-init exit 0).
3. `docker compose --env-file /opt/vemoki/.env up -d --no-deps api worker` (hoặc `restart` sau rebuild).
4. Verify: tạo CSV export trên admin → job READY + download; `docker compose … logs api` không còn `MINIO_MISCONFIGURED`.

Thiếu `MINIO_ENDPOINT` / keys → API **fail-closed** (`MINIO_MISCONFIGURED`, HTTP 503). Không fallback memory store trên production path.

## APNs (push ACCEPTED ≠ DELIVERED)

Mặc định `APNS_ENABLED=false` (không cần `.p8`). Team `BLUA62D52G`, bundle `com.hangndat.ticket`.

Bật trên VPS (operator):

1. Tạo thư mục host: `mkdir -p /opt/vemoki/secrets/apns && chmod 700 /opt/vemoki/secrets/apns`
2. Đặt AuthKey Apple (`.p8`) thành `/opt/vemoki/secrets/apns/AuthKey.p8` (mode `400`). **Không** commit / rsync vào git.
3. Trong `/opt/vemoki/.env`: `APNS_ENABLED=true`, `APNS_KEY_ID=<Key ID>`, giữ `APNS_TEAM_ID=BLUA62D52G`, `APNS_BUNDLE_ID=com.hangndat.ticket`, `APNS_KEY_PATH=/run/secrets/apns/AuthKey.p8`, `APNS_PRODUCTION=true` (TF/prod gateway).
4. Uncomment volume mount APNs trong `compose.yaml` service `worker`, rồi `up -d --no-deps --force-recreate worker`.
5. Verify: worker start không crash; notification `providerStatus=ACCEPTED` sau gửi thành công — **không** ghi `DELIVERED` (ADR-12). Device delivery thật thuộc UAT thiết bị.

`APNS_ENABLED=true` mà thiếu key/path → worker **fail-closed** khi khởi tạo adapter (`APNS_MISCONFIGURED`).

## MembershipInvite / Mailpit

Worker cần `PUBLIC_WEB_BASE_URL=https://app.vemoki.com` (O13 product origin; không dùng apex marketing) và `TICKET_CREDENTIAL_KEY` (cho TicketIssued QR). Invite email relay qua SMTP → Mailpit; thiếu `PUBLIC_WEB_BASE_URL` làm fail-closed link accept. Outbox type `MembershipInvite` không bị chặn chỉ vì thiếu credential key (đã tách khỏi TicketIssued).

## Lệnh

Từ `infra/deploy`, với env file ngoài git:

```bash
docker build -f Dockerfile.runtime -t vemoki-runtime:local .
docker run --rm --env-file /opt/vemoki/.env -v /opt/vemoki/src:/app -w /app \
  vemoki-runtime:local \
  sh -c 'pnpm config set store-dir /app/.pnpm-store && pnpm config set package-import-method hardlink && pnpm install --frozen-lockfile --filter @ticket/api... --filter @ticket/web... --filter @ticket/portal... --filter @ticket/worker... && pnpm --filter @ticket/api exec tsc -p ../../packages/contracts/tsconfig.json && pnpm --filter @ticket/backend build && pnpm --filter @ticket/api build && pnpm --filter @ticket/web build && pnpm --filter @ticket/portal build && pnpm --filter @ticket/worker build'
docker compose --env-file /opt/vemoki/.env up -d
```

`apps/mobile` không được cài vào image. File realm Keycloak phải đọc được bởi user trong container. Mode `600` của user host khác sẽ làm import thất bại và container thoát ngay.

## Nginx

Proxy (O13 dual-run / cutover):

- `vemoki.com` → `vemoki-web:3000` (marketing / host-aware; product paths 302 → `app.`)
- `app.vemoki.com` → `vemoki-web:3000` (product BFF + UI)
- `api.vemoki.com` → `vemoki-api:3001`
- `auth.vemoki.com` → `vemoki-keycloak:8080`
- `portal.vemoki.com` → `vemoki-portal:3013` (Issue #502 / ADR-20; snippet `nginx-portal.snippet.conf`)

Giữ `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`. **Bắt buộc** ghi đè `X-Forwarded-Host $host` (không chuyển tiếp header client). Web allowlist: `WEB_PUBLIC_ORIGIN` / `PUBLIC_WEB_ORIGIN` = `https://app.vemoki.com` (không tin forwarded host thô).

Next bind `0.0.0.0` nên `request.url` có thể thành `https://0.0.0.0:3000/...`. Callback và logout dùng `publicOrigin` (forwarded host do nginx ghi đè). Nginx `proxy_redirect` `0.0.0.0:3000` → host đang phục vụ (`https://app.vemoki.com/` trên product vhost; apex vhost → `https://vemoki.com/`).

Keycloak clients (`ticket-web` / `ticket-admin-web` / `ticket-platform-web`): dual-run giữ apex **và** `app.` trong `redirectUris` / `webOrigins` / `post.logout.redirect.uris` (xem `infra/keycloak/realm-ticket.json`). Platform callback path code = `/api/auth/platform/callback`.

## Đã kiểm tra

`https://vemoki.com`, `https://api.vemoki.com/v1/health`, discovery OIDC và site nginx cũ trả 200. `/api/bff/me` khi chưa đăng nhập là 401. Đăng nhập demo `attendee@example.com` và `staff@example.com` về `/auth` và `/api/bff/me` đúng email. Không còn redirect tới `0.0.0.0`.
