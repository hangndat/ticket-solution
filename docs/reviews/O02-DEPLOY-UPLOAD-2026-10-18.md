# O02 — deploy prod + iOS upload (2026-10-18)

## Authorization
User (coordinator session): cập nhật code, deploy, build upload store.

## Code
- Fast-forward `main` → `63535b48e2f17c65778246e5c44fc162f0dd9f26` (O02 api/web/mobile + docs).
- Marker VPS: `/opt/vemoki/deployed-sha.txt` = tip trên.

## Deploy (VPS `dexter@…`)
1. Rsync tip → `/opt/vemoki/src` (exclude skill; giữ remote `compose.yaml`).
2. Chown/rm stale `packages/backend/src/generated/prisma` (root-owned).
3. `migrate` exit 0 — applied through `202610180006_d12_o02_me_events` (+ pending D13 migrations còn trên DB).
4. Build contracts → backend → api → web → worker (`/opt/vemoki/deploy-o02-build.log`).
5. Restart `api` `worker` `web`.
6. Ops fix: remote compose `api` thiếu `PLATFORM_*` → `/v1/me/events` trả `PLATFORM_MISCONFIGURED`. Patched remote compose + `force-recreate api`. Backup `/opt/vemoki/compose.yaml.bak.*`.

### Verify
| Check | Result |
| --- | --- |
| `https://api.vemoki.com/v1/health` | 200 `status=ok` |
| `GET /v1/me` (no auth) | 401 `UNAUTHENTICATED` |
| `GET /v1/me/events` (no auth) | 401 `UNAUTHENTICATED` (sau PLATFORM patch) |
| `https://vemoki.com/` / `app.vemoki.com` | 200 |
| OIDC discovery | 200 |
| `https://ancafe.anphong.vn/` | 200 |

## iOS (local only — không EAS Cloud)
- Bump source `apps/mobile/app.config.ts` `buildNumber` **10 → 11** (+ README TF line) — **chưa commit** trên `main`.
- `APS_ENVIRONMENT=production` prebuild → pod → archive Automatic Development → export App Store Distribution.
- IPA: `apps/mobile/.expo/o02-release/export/Vemoki.ipa`
  - `1.0.0 (11)` · `com.hangndat.ticket` · team `BLUA62D52G`
  - `aps-environment=production` · `get-task-allow=false` · Apple Distribution
  - SHA256 `abeaa6be516dca9cde2e90f48e8c0d63e07f46e65ef426691cac8152d344d1a0`
- `xcrun altool --upload-app` → **UPLOAD SUCCEEDED** · Delivery UUID `0b3757f0-5075-4e6a-94c5-29ed8306e67e`
- ASC: train **`1.0.0`** build **`11`** · id/Delivery `0b3757f0-5075-4e6a-94c5-29ed8306e67e` · `processingState=VALID` · uploaded `2026-10-18T04:28:22-07:00`.
- (Train `0.1.0` build 11 cũ vẫn tồn tại — cặp version+build khác train, không xung đột.)

## Ngoài scope / còn mở
- **Chưa** Submit for Review / production release trên App Store.
- Build number bump **chưa** PR vào `main`.
- Compose `PLATFORM_*` trên api chỉ patch **remote** — cần đồng bộ vào git `infra/deploy/compose.yaml` để tránh mất khi rsync overwrite (hiện rsync exclude compose).
- SMTP vẫn Mailpit; chưa device smoke TF build 11.
