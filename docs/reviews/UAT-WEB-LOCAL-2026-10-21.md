# UAT Web Local — Issue #658

| Trường | Giá trị |
| --- | --- |
| **Runner** | Sora · uat (Orca worker `task_aa2d9f928473`) |
| **Catalog-SHA** | `85ca33bff51ce95e3b03860be472316fe4c0fc0c` |
| **Issue** | [#658](https://github.com/hangndat/ticket-solution/issues/658) |
| **Stack** | LOCAL Compose: Postgres `:55432`, Redis, Keycloak `127.0.0.1:8080`, MinIO, Mailpit — **không** production/VPS |
| **Ports** | API `3001`, web `3000`, portal `3002` (dev trên worktree `uat-658-web`) |
| **Persona** | `staff@example.com` / `staff-demo`, `attendee@example.com` / `attendee-demo` (D9 fixture) |
| **Artifacts** | `apps/web/.uat-artifacts/uat-web-local-2026-10-21/` (gitignored) |
| **Keycloak drift** | Tạm `accessTokenLifespan=60` (W3); **đã hoàn nguyên `300`**. Thêm redirect `ticket-admin-web` cho `:3002` (không hoàn nguyên URI — chỉ local). |

## Suites

| Suite | Mô tả | Trạng thái |
| --- | --- | --- |
| W1–W8 | Security headers, OIDC BFF, refresh, admin/portal, CSV, API hardening, portal smoke, a11y | Đã chạy (xem bảng case) |

## Cases

| ID | Verdict | Bằng chứng |
| --- | --- | --- |
| **W1** headers | **PASS** | `curl -I` → `w1-web-home-headers.txt`, `w1-portal-home-headers.txt`, `w1-api-health-headers.txt`. Web+portal: `Content-Security-Policy` (có `unsafe-inline` / `unsafe-eval` trên script/style), `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`. API `/v1/health`: JSON 200, không CSP (chấp nhận cho JSON health). |
| **W2** login/callback/logout | **PASS with gap** | Orca `tab create` + `exec` (`w2-page.txt`, `w2-goto-auth.json`, `w2-screenshot-post-login.json` → `w2-post-login.png`). `curl -I http://127.0.0.1:3000/api/auth/logout` → `w2-logout-headers.txt`: `Set-Cookie` xóa `oidc_*` (path `/`; không `Secure` khi local `NODE_ENV=development` / `AUTH_COOKIE_SECURE` unset). **Gap:** callback đăng nhập attendee qua UI chưa xác nhận `/account` đã session (snapshot `w2-attendee-post-login.json` còn trạng thái tải). |
| **W3** refresh token (#630) | **FAIL** | Đặt lifespan 60s (`w3-set-lifespan-v2.txt`); sau 130s portal vẫn lỗi API (`w3-after-wait-v2.json` — «Không kết nối được máy chủ»). Web `/admin` với `ticket-web` → `admin_denied` (`w3-after-wait-snapshot.json`). Revoke session Keycloak (`w3-revoke-v2.txt`); sau revoke `auth_failed` / loading (`w3-after-revoke-snapshot.json`). **IdP unreachable:** **BLOCKED** (không cách ly Keycloak shared). Hoàn nguyên lifespan: script lần 1 `401` (`w3-lifespan-restore.txt`); coordinator manual restore `300` OK. |
| **W4** admin-form (#639/#643/#646) | **FAIL** | API có auth khi `source apps/api/.env`: `GET /v1/me/tenants` **200** (`w4-me-tenants-v3.txt`, 2 tenant demo). UI portal không vào shell admin (API down / «Chưa rõ kết quả» — `w4-portal-snapshot.json`, `w7-snapshot-events.json`). **Chưa** chạy hành trình clone/archive/redemption/CS/export trên UI. |
| **W5** upload CSV (#653) | **FAIL** | `POST …/imports/files` + `kind=CODES`: lần đầu `422` sai `kind` (`w5-valid-upload.txt`); với `kind=CODES` + Bearer staff: **500** `MinIO PUT failed` (`/tmp/uat-api-fixed.log`, `w5-upload-v3.txt`). Oversize ~11 MiB+ cùng lỗi MinIO, **chưa** chứng minh từ chối nhanh 413/422 trên route import. Chunked: **BLOCKED** (chưa có upload hợp lệ). |
| **W6** API hardening (#618) | **PASS with gap** | `w6-curl.txt`: `limit=1.5` → **422** `INVALID_LIMIT`; UUID sai → **422** `INVALID_UUID`; body JSON >1 MiB route gate → **413**. `w6-issue-boot-v3.txt`: boot issue misconfig **không** lộ tên biến env. **Gap:** **429** — 605× `GET /v1/public/events` không đạt ngưỡng (`public_read_no_429_in_605`); `tenant-registrations` trả **503** (không dùng làm bằng chứng rate limit). |
| **W7** portal smoke | **FAIL** | Orca tab `:3002` — trang auth portal (`w7-portal-logged-in.json`: «Đăng nhập nhân sự»). Sau thao tác login, snapshot sự kiện = lỗi kết nối API (`w7-portal-logged-in.json` / `w7-snapshot-events.json`). **i18n:** không đổi ngôn ngữ thành công. |
| **W8** a11y `/admin` | **FAIL** | Snapshot (`w8-admin-snapshot.json`, `w8-snapshot-v2.json`) chỉ alert lỗi mạng, **không** có form admin để kiểm label/aria. |

## Drift

- API local `pnpm dev` **không** tự nạp `apps/api/.env` vào `process.env` — cần `set -a && source .env` hoặc export; nếu không, route auth trả `OIDC_MISCONFIGURED` **503** (đã thấy trong `w4-api-journey.txt` / supplement).
- MinIO bucket/import PUT thất bại trên stack hiện tại → chặn W5 và portal data.
- Keycloak `ticket-admin-web` thêm redirect `http://127.0.0.1:3002/*` cho UAT portal port.

## Verdict (Issue #658 local web)

**NO-GO** — W3, W4, W5, W7, W8 chưa đạt; W2/W6 còn gap (session UI, 429). Không claim pilot ready. Retest sau: API env ổn định + MinIO import bucket + portal login MFA (nếu bật) + hành trình admin đầy đủ trên `:3002`.

## Lệnh Orca tiêu biểu

```text
orca tab create --url http://127.0.0.1:3000/ --worktree path:<worktree> --json
orca exec --page <browserPageId> --command "snapshot" --json
orca exec --page <browserPageId> --command "screenshot" --json
orca tab close --page <browserPageId> --json
```
