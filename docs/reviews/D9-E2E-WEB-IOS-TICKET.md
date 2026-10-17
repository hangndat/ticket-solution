# D9 E2E — Web redeem → cùng user thấy vé trên iOS (seed local API)

**Issue:** [#200](https://github.com/hangndat/ticket-solution/issues/200) · Story [#146](https://github.com/hangndat/ticket-solution/issues/146) gap · Epic [#134](https://github.com/hangndat/ticket-solution/issues/134)  
**Đóng known gap:** [#147](https://github.com/hangndat/ticket-solution/issues/147) DoD (iOS bake `api.vemoki.com` + thiếu evidence Web→iOS)  
**Ownership:** web (+ phụ ios) · **không** EAS Cloud Build · UAT headless only  
**Branch:** `hangndat/d9-e2e-web-ios-ticket-2`  
**Evidence commit SHA:** `d691d7eeed859d496ad1a17868b1464bf87d6fc1` (UAT screenshots + `web-uat redeem`). Tip PR: `git rev-parse HEAD` trên branch.

## Seed + local stack

| Thành phần | Giá trị |
| --- | --- |
| DB | `ticket_d9_demo` @ Compose Postgres `:55432` + runtime `d9_demo_rt` (NOBYPASSRLS) |
| OIDC issuer | `http://192.168.86.8:8080/realms/ticket` |
| API | `HOST=0.0.0.0 PORT=3001` → `http://192.168.86.8:3001` / `http://127.0.0.1:3001` |
| Web | Next `http://127.0.0.1:3010` · `API_BASE_URL=http://127.0.0.1:3001` |
| Codes | `DEMO-FUN-*` / `DEMO-STUDIO-*` (fixture) |
| Attendee | `attendee@example.com` / `attendee-demo` |
| Tenant / event | `demo-fun` / `fun-fest` · UUIDs `d9d9f001-0001-…0001` / `d9d9f001-0002-…0001` |

```bash
node scripts/lib/d9-demo-bootstrap-db.mjs
# seed (issuer = Keycloak discovery LAN)
DATABASE_URL=postgresql://ticket_dev:local_dev_only@127.0.0.1:55432/ticket_d9_demo \
  OIDC_ISSUER=http://192.168.86.8:8080/realms/ticket \
  CODE_HMAC_PEPPER=local-dev-code-pepper-change-me \
  node packages/backend/scripts/demo-seed.cjs
# API + web (xem /tmp session logs trên máy UAT; ports 3001 / 3010)
```

## iOS rebuild — **không** bake `api.vemoki.com`

```bash
cd apps/mobile
export EXPO_PUBLIC_API_BASE_URL=http://192.168.86.8:3001
export EXPO_PUBLIC_OIDC_ISSUER=http://192.168.86.8:8080/realms/ticket
export EXPO_PUBLIC_OIDC_CLIENT_ID=ticket-mobile
export EXPO_PUBLIC_OIDC_SCOPES='openid profile email'
export EXPO_PUBLIC_TENANT_ID=d9d9f001-0001-4000-8000-000000000001
export EXPO_PUBLIC_EVENT_ID=d9d9f001-0002-4000-8000-000000000001
unset APS_ENVIRONMENT APP_VARIANT EXPO_PUBLIC_APS_ENVIRONMENT

CI=1 pnpm exec expo prebuild --platform ios --no-install
cd ios && pod install && cd ..

# Signed Release-for-simulator (SecureStore/Keychain cần signing; unsigned → entitlement fail)
xcodebuild \
  -workspace ios/Vemoki.xcworkspace \
  -scheme Vemoki \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=F191CF59-4B73-44E5-BFA8-4CE439EB31AD' \
  -derivedDataPath .expo/d9-e2e-derived-data-signed-release \
  DEVELOPMENT_TEAM=BLUA62D52G \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY='Apple Development' \
  build

xcrun simctl install booted \
  .expo/d9-e2e-derived-data-signed-release/Build/Products/Release-iphonesimulator/Vemoki.app
```

**Bake verified (installed `EXConstants.bundle/app.config` → `extra.ticketPublic`):**

| Field | Value |
| --- | --- |
| `apiBaseUrl` | `http://192.168.86.8:3001` (**không** `https://api.vemoki.com`) |
| `oidcIssuer` | `http://192.168.86.8:8080/realms/ticket` |
| `oidcClientId` | `ticket-mobile` |
| `tenantId` | `d9d9f001-0001-4000-8000-000000000001` |
| `apsEnvironment` | `development` |

Device: iPhone 17 Pro · UDID `F191CF59-4B73-44E5-BFA8-4CE439EB31AD` · bundle `com.hangndat.ticket` · Team `BLUA62D52G` · **không** EAS Cloud.

## Web — Playwright headless redeem

```bash
WEB_BASE_URL=http://127.0.0.1:3010 \
WEB_UAT_OUT_DIR=apps/web/.uat-artifacts/d9-e2e \
  bash scripts/web-uat.sh redeem http://127.0.0.1:3010 DEMO-FUN-006
```

| Check | Result |
| --- | --- |
| Keycloak login attendee | OK |
| `POST` redeem `DEMO-FUN-006` via BFF | OK |
| `GET /api/bff/tickets?tenantId=…` | **200** · `ticketCount=1` |

Curated: ![redeem](./d9-uat/e2e-web-ios/web/d9-e2e-redeem.png)

Script: `scripts/web-uat.mjs` command `redeem` (headless chrome-headless-shell; không cliclick / computer-use).

## iOS — sim-uat (AXe HID + simctl)

```bash
scripts/sim-uat.sh launch com.hangndat.ticket
scripts/sim-uat.sh tap --label "Vé của tôi"
# OIDC ASWebAuthenticationSession → Keycloak @ 192.168.86.8 → attendee
scripts/sim-uat.sh screenshot …/d9-e2e-my-tickets.png
scripts/sim-uat.sh tap --label "Sự kiện"
scripts/sim-uat.sh tap --label "Tải danh sách sự kiện đã xuất bản"
```

### Vé của tôi (cùng user sau web redeem)

| Check | Result |
| --- | --- |
| Session | Đã xác minh · user `6259e34d-…` (attendee seed) |
| Tenant | `d9d9f001-0001-4000-8000-000000000001` |
| Vé | **ACTIVE** (sau redeem `DEMO-FUN-006` trên web) |

Curated: ![tickets](./d9-uat/e2e-web-ios/ios/d9-e2e-my-tickets.png)

### Published-list → **local** API (không prod)

| Check | Result |
| --- | --- |
| App bake API | `http://192.168.86.8:3001` only |
| UI sau “Tải danh sách…” | ErrorState: *Không tải được danh sách đã xuất bản — không dùng demo thay thế* (fail-closed; **không** fallback fixture như published) |
| HTTP local | `GET http://192.168.86.8:3001/v1/public/tenants/demo-fun/events` → **404** Nest `Cannot GET /v1/public/...` |
| HTTP prod cùng path | `https://api.vemoki.com/v1/public/tenants/demo-fun/events` → **404** (route chưa có trên Nest) |

Curated: ![published](./d9-uat/e2e-web-ios/ios/d9-e2e-published-list.png)

**Kết luận gap #147:** lỗi published-list **không còn do gọi `api.vemoki.com`**. App gọi local; 404 là thiếu route `GET /v1/public/tenants/...` trên Nest (prod cũng 404) — ngoài scope web/ios worker; ghi known gap backend nếu cần HTTP 200.

## Limitations

- Simulator Release signed (Development) — **không** TestFlight / device Archive / store submit.
- Không deploy prod; không claim pilot ready.
- Unsigned Debug build: SecureStore entitlement fail (`deleteValueWithKeyAsync`) — UAT dùng signed binary.
- Published HTTP 200 chưa có cho tới khi backend ship public projection (TD § Public).

## Verdict (implementer handoff)

Web redeem → cùng attendee thấy **Vé ACTIVE** trên iOS với API/OIDC **local** — **PASS** cho AC Issue #200 (trừ public list 200 — đã chứng minh local, không prod). Chờ DoD reviewer độc lập (exact SHA).
