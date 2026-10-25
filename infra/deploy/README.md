# Vemoki trên VPS

Bản đầu chạy trên máy đã có nginx giữ cổng 80/443. Compose Vemoki không publish 80/443. TLS và vhost nằm ở nginx đó. **SMTP internet (ADR-13):** worker dùng `SMTP_URL` / `SMTP_FROM` trong `/opt/vemoki/.env` (Porkbun `:587`); Keycloak realm **ticket** cấu hình riêng qua `scripts/keycloak-prod-smtp-apply.sh` (không import Mailpit). Realm prod: `infra/keycloak/realm-ticket.prod.json` → `/opt/vemoki/realm-ticket.prod.json`. MinIO chạy **internal-only** (không publish 9000/9001 lên edge).

Env mẫu (không secrets): [`./.env.example`](./.env.example) → copy vào `/opt/vemoki/.env` (mode 600).

## Image

`Dockerfile.runtime` chỉ có Node 24, OpenSSL và pnpm. `node_modules`, `dist` và `.next` thuộc release directory bất biến; mỗi service mount một đường dẫn release riêng, read-only. Quy trình mới: [`docs/ops/IMMUTABLE-RELEASE.md`](../../docs/ops/IMMUTABLE-RELEASE.md). Không build/install vào `/opt/vemoki/src` đang chạy.

Store pnpm tạm nằm trong staging release trong lúc build và được xóa trước publish. Build chạy trên Linux/Node 24 đúng architecture của VPS để Prisma và sharp có binary tương thích.

`Dockerfile` (build một image tự chứa) tách layer dependency và dùng cache BuildKit. Cách đó không phải cách đang chạy trên VPS.

## Từng service

Deploy một service khi chỉ service đó đổi: verify release, đổi một pin, rồi `up -d --no-deps --force-recreate` đúng service. `restart` không nhận bind mount mới. Các lệnh cũ trong `.cursor/skills/deploy-prod/SKILL.md` chỉ mô tả layout trước #899; dùng runbook immutable release cho app services.

| Service | Việc | Khởi động lại |
| --- | --- | --- |
| web | pin verified release của `@ticket/web` | `up -d --no-deps --force-recreate web` |
| portal | pin verified release của `@ticket/portal` | `up -d --no-deps --force-recreate portal` |
| api | pin verified release của backend + `@ticket/api` | `up -d --no-deps --force-recreate api` |
| worker | pin verified release của backend + `@ticket/worker` | `up -d --no-deps --force-recreate worker` |
| migrate | pin verified migration package với `--schema` bằng DB input hiện tại, kiểm manifest `inputMin/inputMax/target` | `up -d --no-deps --force-recreate migrate`, đợi exit 0 rồi đo schema target |
| keycloak | file realm (`realm-ticket.prod.json`, không `smtpServer`) + `keycloak-prod-smtp-apply.sh` sau recreate | `up -d --no-deps --force-recreate keycloak` |
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
2. Từ `infra/deploy`: `docker compose --env-file /opt/vemoki/.env --env-file /opt/vemoki/release-pins.env up -d minio minio-init` (đợi minio-init exit 0).
3. `docker compose --env-file /opt/vemoki/.env --env-file /opt/vemoki/release-pins.env up -d --no-deps --force-recreate api worker` sau khi pin release đã verify.
4. Verify: tạo CSV export trên admin → job READY + download; `docker compose … logs api` không còn `MINIO_MISCONFIGURED`.

Thiếu `MINIO_ENDPOINT` / keys → API **fail-closed** (`MINIO_MISCONFIGURED`, HTTP 503). Không fallback memory store trên production path.

## APNs (push ACCEPTED ≠ DELIVERED)

Mặc định `APNS_ENABLED=false` (không cần `.p8`). Team `BLUA62D52G`, bundle `com.hangndat.ticket`.

Bật trên VPS (operator):

1. Tạo thư mục host: `mkdir -p /opt/vemoki/secrets/apns && chmod 700 /opt/vemoki/secrets/apns`
2. Đặt AuthKey Apple (`.p8`) thành `/opt/vemoki/secrets/apns/AuthKey.p8` (mode `400`). **Không** commit / rsync vào git.
3. Trong `/opt/vemoki/.env`: `APNS_ENABLED=true`, `APNS_KEY_ID=<Key ID>`, giữ `APNS_TEAM_ID=BLUA62D52G`, `APNS_BUNDLE_ID=com.hangndat.ticket`, `APNS_KEY_PATH=/run/secrets/apns/AuthKey.p8`, `APNS_PRODUCTION=true` (TF/prod gateway).
4. APNs volume nằm ngoài release; recreate worker bằng pin đã verify.
5. Verify: worker start không crash; notification `providerStatus=ACCEPTED` sau gửi thành công — **không** ghi `DELIVERED` (ADR-12). Device delivery thật thuộc UAT thiết bị.

`APNS_ENABLED=true` mà thiếu key/path → worker **fail-closed** khi khởi tạo adapter (`APNS_MISCONFIGURED`).

## SMTP (worker + Keycloak)

Worker: `SMTP_URL` + `SMTP_FROM` trong `/opt/vemoki/.env` (prod Porkbun). Local dev: Mailpit (`compose.yaml` root).

Keycloak: **không** hard-code Mailpit trên prod — import `realm-ticket.prod.json` (không block `smtpServer`), rồi chạy `scripts/keycloak-prod-smtp-apply.sh` (parse `SMTP_URL`, `kcadm` realm `ticket`). Sau mỗi `force-recreate keycloak`, chạy lại script nếu import làm mất SMTP.

Verify (operator, không in secret): gửi `execute-actions-email` UPDATE_PASSWORD tới inbox test; worker smoke qua `sendMailViaSmtp` trong container.

## MembershipInvite

Worker cần `PUBLIC_WEB_BASE_URL=https://app.vemoki.com` (O13 product origin; không dùng apex marketing) và `TICKET_CREDENTIAL_KEY` (cho TicketIssued QR). Invite email relay qua `SMTP_URL`; thiếu `PUBLIC_WEB_BASE_URL` làm fail-closed link accept. Outbox type `MembershipInvite` không bị chặn chỉ vì thiếu credential key (đã tách khỏi TicketIssued).

## Lệnh

Từ `infra/deploy`, với env file ngoài git:

Xem lệnh build, pin, verify và rollback trong [`docs/ops/IMMUTABLE-RELEASE.md`](../../docs/ops/IMMUTABLE-RELEASE.md). Không chạy lệnh install/build cũ trên live mount.

`apps/mobile` không được cài vào image. File realm Keycloak phải đọc được bởi user trong container. Mode `600` của user host khác sẽ làm import thất bại và container thoát ngay.

## Nginx

Proxy (O13 dual-run / cutover):

- `vemoki.com` → `vemoki-web:3000` (marketing / host-aware; product paths 302 → `app.`)
- `app.vemoki.com` → `vemoki-web:3000` (product BFF + UI)
- `api.vemoki.com` → `vemoki-api:3001`
- `auth.vemoki.com` → `vemoki-keycloak:8080`
- `portal.vemoki.com` → `vemoki-portal:3013` (Issue #502 / ADR-20; snippet `nginx-portal.snippet.conf`)

**BFF upstream (web/portal):** `API_BASE_URL` phải dùng alias edge duy nhất `http://vemoki-api:3001`, không dùng tên service Compose `api` — network `nginx-letencrypt_nginx_network` có thể gắn nhiều stack (alias `api`/`web`/… trùng). Smoke sau deploy: `docker exec vemoki-web-1 getent ahosts vemoki-api` → một IP prod.

**Chỉ network `internal` (an toàn với alias ngắn):** `postgres`, `minio`, `mailpit`, `migrate` — không publish lên edge.

Giữ `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`. **Bắt buộc** ghi đè `X-Forwarded-Host $host` (không chuyển tiếp header client). Web allowlist: `WEB_PUBLIC_ORIGIN` / `PUBLIC_WEB_ORIGIN` = `https://app.vemoki.com` (không tin forwarded host thô).

Next bind `0.0.0.0` nên `request.url` có thể thành `https://0.0.0.0:3000/...`. Callback và logout dùng `publicOrigin` (forwarded host do nginx ghi đè). Nginx `proxy_redirect` `0.0.0.0:3000` → host đang phục vụ (`https://app.vemoki.com/` trên product vhost; apex vhost → `https://vemoki.com/`).

Keycloak clients (`ticket-web` / `ticket-admin-web` / `ticket-platform-web`): dual-run giữ apex **và** `app.` trong `redirectUris` / `webOrigins` / `post.logout.redirect.uris` (xem `infra/keycloak/realm-ticket.json`). Platform callback path code = `/api/auth/platform/callback`.

## Đã kiểm tra

`https://vemoki.com`, `https://api.vemoki.com/v1/health`, discovery OIDC và site nginx cũ trả 200. `/api/bff/me` khi chưa đăng nhập là 401. Đăng nhập demo `attendee@example.com` và `staff@example.com` về `/auth` và `/api/bff/me` đúng email. Không còn redirect tới `0.0.0.0`.
