# UAT iOS Simulator — Issue #659 (local stack)

| Trường | Giá trị |
| --- | --- |
| Issue | [#659](https://github.com/hangndat/ticket-solution/issues/659) |
| Role | `launch-uat` · Persona Sora · uat |
| Runner | Orca Cursor worker · Task `task_30c6fe624d40` · Dispatch `ctx_c17e0ebfe33b` |
| Catalog-SHA | `85ca33bff51ce95e3b03860be472316fe4c0fc0c` |
| Branch | `hangndat/uat-ios-sim-2026-10-21` |
| Thời điểm (UTC+7) | 2026-10-21 ~11:00–11:25 |
| Simulator | iPhone 17 Pro · UDID `F191CF59-4B73-44E5-BFA8-4CE439EB31AD` (không dùng D11-Gate-UAT) |
| Nest API (worker) | `http://127.0.0.1:3101` (instance riêng, DB compose `55432`) |
| Metro | `http://127.0.0.1:8181` (`RCT_METRO_PORT=8181` bake trong `Info.plist`) |
| Keycloak | `http://127.0.0.1:8080/realms/ticket` (shared compose — không restart) |
| Verdict | **NO-GO** — I1 PASS; I2–I7 BLOCKED (không drive được API local 3101 từ app) |

## Suites

| Suite | Trạng thái |
| --- | --- |
| I1–I7 (Issue #659 iOS sim) | Đã chạy / ghi nhận (xem bảng Cases) |

## Môi trường & lệnh Orca

```text
orca emulator attach "F191CF59-4B73-44E5-BFA8-4CE439EB31AD" --worktree path:/Users/admin/orca/workspaces/main/uat-659-ios --json
orca emulator ax --json
orca emulator tap <x> <y> --json
xcrun simctl io F191CF59-4B73-44E5-BFA8-4CE439EB31AD screenshot apps/mobile/.uat-artifacts/<file>.png
```

Build / cài (I1):

```bash
cd apps/mobile
CI=1 pnpm exec expo prebuild --platform ios
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki \
  -configuration Debug -sdk iphonesimulator \
  -destination 'id=F191CF59-4B73-44E5-BFA8-4CE439EB31AD' \
  -derivedDataPath ios/build-uat RCT_METRO_PORT=8181 build
# → ** BUILD SUCCEEDED ** (BUILD_SECONDS=88, log: apps/mobile/.uat-artifacts/i1-xcodebuild.log)
xcrun simctl install F191CF59-4B73-44E5-BFA8-4CE439EB31AD ios/build-uat/Build/Products/Debug-iphonesimulator/Vemoki.app
xcrun simctl launch F191CF59-4B73-44E5-BFA8-4CE439EB31AD com.hangndat.ticket
```

Metro (giữ process sống trong terminal Orca — `nohup` hay thoát sớm khiến bundler chết):

```bash
cd apps/mobile && RCT_METRO_PORT=8181 pnpm exec expo start --port 8181
```

API 3101 (worker):

```bash
cd apps/api && PORT=3101 HOST=127.0.0.1 DATABASE_URL=postgresql://ticket_dev:***@127.0.0.1:55432/ticket_solution \
  OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket OIDC_AUDIENCE=ticket-api \
  CODE_HMAC_PEPPER=local-dev-code-pepper-change-me TICKET_CREDENTIAL_KEY=local-dev-credential-key \
  node dist/main.js
# curl http://127.0.0.1:3101/v1/public/events → 200 (sau migrate thiếu)
```

**DB (shared):** áp dụng migration pending `202610200001_mpr_platform_published_catalog` (+ 3 migration kèm) và `GRANT ticket_platform_runtime TO ticket_dev` để `GET /v1/public/events` không 500 — không reset DB, không `demo:seed` force.

**Keycloak realm:** không đổi `accessTokenLifespan` (I3 chưa chạy).

## Cases

| ID | Verdict | Bằng chứng |
| --- | --- | --- |
| **I1** | **PASS** | `expo prebuild` + `xcodebuild` Debug sim **BUILD SUCCEEDED** ~88s; cài + mở app trên UDID riêng; `orca emulator ax` thấy tab **Sự kiện** / **Tài khoản**; screenshot `apps/mobile/.uat-artifacts/i1-events-home.png`. Ban đầu redbox “No script URL” → fix bake `RCTMetroPort=8181` + Metro `:8181`. |
| **I2** | **BLOCKED** | Luồng OIDC mở ASWebAuthentication + Keycloak WebView (`orca tap` Continue; form Email/Password). `orca emulator type` không nhập đúng credential (Keycloak báo Invalid username/password) dù `password` grant Keycloak OK. Deep link `vemoki://uat/session?access_token=…` → **“Máy chủ không xác minh được phiên UAT (API /v1/me)”** vì app gọi **production** API (xem Drift). `curl -H "Authorization: Bearer …" http://127.0.0.1:3101/v1/me` → 200 từ host. Screenshot `i2-account-profile.png` (Keycloak / từ chối UAT). |
| **I3** | **BLOCKED** | Phụ thuộc I2 + chỉnh `accessTokenLifespan=60s` realm local — chưa thực hiện. |
| **I4** | **BLOCKED** | Cần phiên verified + tắt API 3101 — app không dùng `:3101` cho `/v1/me`. |
| **I5** | **BLOCKED** | Cần staff workspace + API 3101 — cùng blocker Drift. |
| **I6** | **BLOCKED** | Không dựng proxy cục bộ cho issuer (không dừng Keycloak shared); không chạy case. |
| **I7** | **BLOCKED** | Cần đăng nhập + vé/QR offline qua API local — blocker Drift. |

## Drift

| Hiện tượng | Git / runtime |
| --- | --- |
| Task yêu cầu `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3101` | `apps/mobile/src/identity/config.ts`: `getApiBaseUrl()` **luôn** trả `https://api.vemoki.com` (`VEMOKI_PROD_API_BASE_URL`); test `config.test.ts` khẳng định hành vi. Metro bundle vẫn có chuỗi `3101` từ env nhưng **runtime identity/wallet/gate không đọc**. |
| Home Events hiển thị MFest · Demo | Có thể từ catalog production hoặc fixture dev; **không** chứng minh gọi Nest `:3101`. |
| DB local thiếu grant platform catalog | Trước migrate: API 3101 `GET /v1/public/events` → 500 `permission denied for table events` với `SET LOCAL ROLE ticket_platform_runtime`; sau migrate + grant role → 200. |

## Dọn dẹp

- `orca emulator kill` trên UDID `F191CF59-…`
- Dừng API `:3101` và Metro `:8181` của worker (không restart Keycloak/postgres/redis shared)
- Không commit `.env` / `ios/` generated

## Retest 2026-10-21 ~12:45 (UTC+7)

| Trường | Giá trị |
| --- | --- |
| Runner | Orca Cursor worker · Task `task_43e921463b27` · Dispatch `ctx_495f98b65ae5` |
| Catalog-SHA | `258a44e6369b69b34e8c9215b3b4ab671a9429c2` |
| Verdict | **NO-GO** — I1 **PASS**; I2–I7 **BLOCKED** (app runtime vẫn gọi `https://api.vemoki.com`, không `:3101`) |

### Điều tra & config local (không sửa code sản phẩm)

- `apps/mobile/.env` đã có `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3101`, OIDC `127.0.0.1:8080`, `EXPO_PUBLIC_TENANT_ID` demo — Metro `:8181` đang chạy; **runtime** `getApiBaseUrl()` trong `apps/mobile/src/identity/config.ts` vẫn trả `VEMOKI_PROD_API_BASE_URL` (test `API base URL is always production` khẳng định). **Không có** override chỉ bằng env/local config.
- Nest worker `:3101`: lần đầu thiếu `OIDC_JWKS_URL` → `GET /v1/me` **503** `OIDC_MISCONFIGURED`; sau khi nạp `apps/api/.env` (local, không commit) với JWKS → `curl` bearer Keycloak local **200** trên `http://127.0.0.1:3101/v1/me`; cùng token → `https://api.vemoki.com/v1/me` **401** (issuer local ≠ prod).
- Keycloak password grant `attendee@example.com` / `attendee-demo` **OK** trên `8080` — không phải blocker redirect/ATS cho luồng UAT session.
- Deep link `vemoki://uat/session?access_token=…` (sim) → màn **“Máy chủ không xác minh được phiên UAT (API /v1/me)”** vì `verifyViaMe` dùng production API; screenshot `apps/mobile/.uat-artifacts/retest-i2-uat-session-deny.png`.

### Cases (retest)

| ID | Verdict | Ghi chú |
| --- | --- | --- |
| **I1** | **PASS** | App đã cài trên UDID; `orca emulator ax` thấy tab **Sự kiện** / **Tài khoản**, danh sách MFest · Demo (Metro `:8181`). |
| **I2** | **BLOCKED** | UAT session + OIDC không xác minh được `/v1/me` trên instance `:3101` do **product gap** `getApiBaseUrl()`; không drive #613 refresh trên API local. |
| **I3** | **BLOCKED** | Cần phiên verified trên `:3101` + chỉnh realm lifespan — chưa chạy. |
| **I4** | **BLOCKED** | Cần verified + tắt API `:3101` — app không target `:3101`. |
| **I5** | **BLOCKED** | Staff / `probeMeEvents` trên `:3101` — cùng gap API base. |
| **I6** | **BLOCKED** | Không chạy proxy issuer (Keycloak shared). |
| **I7** | **BLOCKED** | Vé/QR offline qua API local — cùng gap. |

### Gap đề xuất (ngoài scope worker)

Cần thay đổi sản phẩm (ví dụ `getApiBaseUrl()` đọc `EXPO_PUBLIC_API_BASE_URL` / `extra.ticketPublic.apiBaseUrl` khi `__DEV__` hoặc flag UAT) để AC #659 có thể chạy full I2–I7 trên `:3101` mà không gọi production.

## Launch verdict

**NO-GO** cho pilot iOS sim UAT local theo AC #659: gate build local **PASS**, nhưng không hoàn tất OIDC + hành vi phụ thuộc API instance `:3101` do drift `getApiBaseUrl()` → production (retest xác nhận; stack `:3101` + JWKS local **sẵn sàng** sau config worker).
