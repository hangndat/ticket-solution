# Env manifest — self-host SMTP / MinIO / APNs (không secrets)

Ngày: 2026-10-17 · R-INT  
Nguồn mẫu: root `.env.example`, `apps/worker/.env.example`, Compose `compose.yaml`.  
**Không** commit giá trị production. Placeholder local chỉ để tài liệu / Compose.

## 1. SMTP (ADR-13)

| Biến | Bắt buộc prod | Dev/test | Ý nghĩa |
| --- | --- | --- | --- |
| `SMTP_URL` | Có (TLS/auth theo URL) | `smtp://127.0.0.1:1025` → Mailpit | Worker transport; **prod không fallback noop** |
| `SMTP_FROM` | Có | `tickets@localhost` | Envelope/from hiển thị |
| `MAILPIT_SMTP_PORT` / `MAILPIT_UI_PORT` | Không | `1025` / `8025` | Chỉ Compose Mailpit (local root `compose.yaml`) |

Production thiếu SMTP → notification FAILED/PENDING/misconfigured rõ (N-BE). Mailpit **không** chứng minh delivery internet.

**Keycloak (realm `ticket`):** không dùng `smtpServer` trong file import prod (`infra/keycloak/realm-ticket.prod.json`, `REALM_FILE=/opt/vemoki/realm-ticket.prod.json`). Cấu hình live cùng credential Porkbun với worker: `scripts/keycloak-prod-smtp-apply.sh` trên VPS (đọc `SMTP_URL` / `SMTP_FROM`, **không** in password). Dev local giữ Mailpit trong `infra/keycloak/realm-ticket.json`.

## 2. MinIO (ADR-14)

| Biến | Bắt buộc khi dùng object | Dev | Ý nghĩa |
| --- | --- | --- | --- |
| `MINIO_API_PORT` / `MINIO_CONSOLE_PORT` | — | `9000` / `9001` | Compose publish loopback |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Có (local placeholder) | `minioadmin` | Bootstrap root; đổi trên VPS |
| `MINIO_ENDPOINT` | Có (app) | `http://127.0.0.1:9000` | S3 API base |
| `MINIO_BUCKET_ASSETS` | Có khi B-BE | `vemoki-assets` | Brand/config raster (quarantine → ready) |
| `MINIO_BUCKET_EXPORTS` | Có khi export | `vemoki-exports` | Private export/error reports |
| `MINIO_BUCKET_IMPORTS` | Có khi I-BE | `vemoki-imports` | CSV quarantine |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Có | local placeholders | App credentials ≠ root nếu tách được |
| `MINIO_REGION` | Tuỳ | `us-east-1` | S3 SDK |

Buckets private; không public anonymous. Signed URL ngắn hạn do app cấp.

**Image (O1, 2026-10-18):** Compose pin `cleanstart/minio@sha256:4febd64f…` (official `minio/minio` / `minio/mc` không còn anonymous pull). Init bucket: `amazon/aws-cli` one-shot — xem `docs/architecture/object-store-minio-replacement.md`.

Demo media seed (D9-S2): `./scripts/d9-seed-media.sh` — checklist `MEDIA-ASSET-CHECKLIST.md`, manifest `brand/demo/manifest.json`.

## 3. APNs (ADR-12)

| Biến | Bắt buộc prod push | Dev | Ý nghĩa |
| --- | --- | --- | --- |
| `APNS_ENABLED` | `true` khi bật | `false` | Fail-closed khi thiếu cấu hình |
| `APNS_KEY_ID` | Có | — | Key ID từ Apple Developer |
| `APNS_TEAM_ID` | Có | `BLUA62D52G` (personal team id — không phải secret) | Team |
| `APNS_BUNDLE_ID` | Có | `com.hangndat.ticket` | Topic |
| `APNS_KEY_PATH` hoặc `APNS_KEY_P8` | Có (một trong hai) | — | `.p8` trên đĩa host / secret mount — **không** commit |
| `APNS_PRODUCTION` | `true`/`false` | `false` | sandbox vs production gateway |
| `EXPO_PUBLIC_PUSH_PROVIDER` | — | `apns` (mobile) | Client chỉ đăng ký token; không Expo Push |

Thiếu key/env khi `APNS_ENABLED=true` → worker fail-closed (không silent success). Device delivery thật thuộc D5 / N-IOS UAT.

## 4. Outbox / worker (ADR-17)

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `OUTBOX_POLL_MS` | `2000` | Poll interval |
| `OUTBOX_CLAIM_LIMIT` | `10` | Batch size (khi BE đọc) |
| `OUTBOX_LEASE_SECONDS` | `30` | Lease fence |
| `WORKER_LEASE_OWNER` | hostname/pid | Id reclaim |

Redis: `REDIS_PORT` / URL chỉ cache/admission — **không** durable outbox.

## 5. Tenant host + O13 product origin (O07 / TD §12.1 / O13)

| Biến | Ví dụ (sau cutover O13) | Ý nghĩa |
| --- | --- | --- |
| `PLATFORM_ROOT_DOMAIN` | `vemoki.com` | Apex + wildcard `*.vemoki.com` (tenant hosts) |
| `TENANT_HOST_ALLOWLIST` | JSON/file path | Canonical host → tenantSlug (không tin Host thô) |
| `WEB_PUBLIC_ORIGIN` | `https://app.vemoki.com` | **Canonical** CSRF/origin allowlist (code web đọc tên này) |
| `PUBLIC_WEB_ORIGIN` | `https://app.vemoki.com` | Alias/docs/compose; đồng bộ với `WEB_PUBLIC_ORIGIN` |
| `PUBLIC_WEB_BASE_URL` | `https://app.vemoki.com` | Worker invite/email deep links product |
| `OIDC_REDIRECT_URI` | `https://app.vemoki.com/api/auth/callback` | Attendee BFF callback |
| `PLATFORM_OIDC_CLIENT_ID` | `ticket-platform-web` | Phải khớp Keycloak clientId (không dùng `ticket-platform`) |
| `PLATFORM_OIDC_REDIRECT_URI` | `https://app.vemoki.com/api/auth/platform/callback` | Path **code** (`/api/auth/platform/…`), không `/api/platform/auth/…` |
| `PRODUCT_ORIGIN` / `MARKETING_ORIGIN` | `app.` / apex | CTA marketing → product; host-aware Next |

Cookie session: **host-only** trên `app.vemoki.com` (không `Domain=.vemoki.com`). Xem `scripts/lib/tenant-host.mjs` và `docs/architecture/o13-marketing-app-subdomain.md`.

## 6. Portal admin dual-run (ADR-20 / P1.2 local + #502 prod)

Process `apps/portal` (local port **3013**; prod host **`portal.vemoki.com`**).  
Local: [`PORTAL-LOCAL-CUTOVER-PREP.md`](./PORTAL-LOCAL-CUTOVER-PREP.md). Prod cutover: [`PORTAL-PROD-CUTOVER.md`](./PORTAL-PROD-CUTOVER.md) (Issue #502).

| Biến | Ví dụ local | Ý nghĩa |
| --- | --- | --- |
| `WEB_PUBLIC_ORIGIN` | `http://127.0.0.1:3013` | CSRF/origin allowlist **process portal** |
| `OIDC_CLIENT_ID` | `ticket-admin-web` | Staff portal (không dùng `ticket-web`) |
| `OIDC_REDIRECT_URI` | `http://127.0.0.1:3013/api/auth/callback` | Path code `/api/auth/callback` — **không** `/api/admin/auth/*` |
| `PLATFORM_OIDC_CLIENT_ID` | `ticket-platform-web` | Operator MFA trên portal |
| `PLATFORM_OIDC_REDIRECT_URI` | `http://127.0.0.1:3013/api/auth/platform/callback` | Khớp path code |
| `PORTAL_ORIGIN` / `PRODUCT_ORIGIN` | `https://portal.vemoki.com` / `https://app.vemoki.com` | CTA tuyệt đối; dual-run local vẫn dùng loopback redirect URI |
| `PORTAL_ADMIN_REDIRECT` | unset / `0` (mặc định OFF) | `apps/web` proxy: GET/HEAD `/admin`\|`/platform` → `PORTAL_ORIGIN` khi `1`/`true`; **không** POST/BFF (ADR-20 §8 / #438) |
| `PORTAL_DUAL_RUN_BANNER` | `1` khi có `PORTAL_ORIGIN` (web) / `PRODUCT_ORIGIN` (portal) | Banner dual-run; độc lập với flag redirect |
| `API_BASE_URL` | `http://127.0.0.1:3100` | Nest từ BFF portal |
| `OIDC_ADMIN_CLIENT_SECRET` | (prod `/opt/vemoki/.env` only) | Compose portal → `OIDC_CLIENT_SECRET` cho `ticket-admin-web` |
| `PORTAL_WEB_PUBLIC_ORIGIN` | `https://portal.vemoki.com` | Compose portal `WEB_PUBLIC_ORIGIN` prod |
| `PORTAL_OIDC_REDIRECT_URI` | `https://portal.vemoki.com/api/auth/callback` | Staff callback prod |
| `PORTAL_PLATFORM_OIDC_REDIRECT_URI` | `https://portal.vemoki.com/api/auth/platform/callback` | Platform callback trên portal prod |

Cookie staff/platform trên portal: **host-only** (omit `Domain`). Kiểm tra realm JSON: `./scripts/portal-local-dual-run-check.sh`.

## Cấm

- Commit `.env` thật, `.p8`, MinIO root production, SMTP password.
- SaaS SMTP/push/object runtime (ADR-11).
- Production DNS/TLS/`portal.vemoki.com` cutover — chỉ Issue #502 / `PORTAL-PROD-CUTOVER.md` (không trong P1.2 local prep).
