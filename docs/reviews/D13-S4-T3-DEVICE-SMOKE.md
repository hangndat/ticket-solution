# D13 — S4-T3 Physical-device smoke (Internal TF 1.0.0/14 · Dexter)

Task #327 · Epic #301 · Story #307. Role `ios` · Architecture impact: **Không** — device UAT + release ops evidence.

**Verdict: FAIL (không PASS)** — TF **`1.0.0 (14)`** đã upload ASC `VALID` + Internal TF với **prod bake** xác minh trên IPA (API/OIDC/APS). **Dexter’s iPhone 16 Pro** chưa cài binary TF: không có app **TestFlight** trên device, USB install Distribution IPA → `0xe800801f`; chỉ còn Vemoki **0.1.0 (7)** dev. Coordinator `ask` cài TF (10 phút) không phản hồi. Checklist OIDC prod + attendee QR + staff `GateCamera` **chưa chạy** trên TF 1.0.0/14. Không Submit for Review / không publish.

## Target binary (session 2026-10-19 · build 14)

| Trường | Giá trị |
| ------ | ------- |
| Source tip (git) | `git rev-parse HEAD` trên branch PR |
| Marketing / build | **`1.0.0` / `14`** |
| ASC Delivery UUID | `fc3a28b8-c0d3-4358-a481-de3a2ab835c8` |
| `processingState` | **VALID** (poll ngay sau upload) |
| Bundle / Team | `com.hangndat.ticket` · `BLUA62D52G` |
| IPA (local, gitignored) | `apps/mobile/.expo/tf-upload-14/export/Vemoki.ipa` |
| IPA SHA256 | `84de550b34c09b07e847ab38eea6880a684b85fd30e27b8ee1bb005c03ab4279` |
| Prod bake (IPA `main.jsbundle`) | `https://api.vemoki.com` · `https://auth.vemoki.com/realms/ticket` · `ticket-mobile` (1× mỗi chuỗi) |
| Entitlements (exported IPA) | `aps-environment=production` · `get-task-allow=false` |
| ASC API Key ID (không secret) | `KHT3SAL2FS` |
| Tool | Local prebuild + xcodebuild archive/export + `xcrun altool` · **không** EAS Cloud |

Build **13** (session trước): FAIL prod bake — xem history PR `hangndat/d13-s4-t3-smoke2`.

## Physical device (ưu tiên Dexter)

| Device | CoreDevice id | UDID | `com.hangndat.ticket` | TF smoke |
| ------ | ------------- | ---- | --------------------- | -------- |
| **Dexter’s iPhone 16 Pro** | `06CAC741-EB05-55B0-AAE6-14D7B49F50BB` | `00008140-000605803C01801C` | **0.1.0 (7)** dev | **BLOCKED** — không TestFlight app; không TF binary |
| DatHN iPhone | `CB22153A-C24F-547E-87FC-34EC62527838` | `00008130-000618E402D1001C` | 1.0.0 (13) | Ngoài scope session (ưu tiên Dexter) |

- `devicectl device install app` IPA build 14 → **FAIL** `0xe800801f` / Beta profile (kỳ vọng).
- App Store deep link TestFlight (`payload-url` / `itms-apps`) không điều hướng product page trên device này; không có tap automation ổn định (không WDA session cho App Store).

## Smoke checklist (TF 1.0.0/14 · prod · Dexter)

| # | Scenario | Status |
| - | -------- | ------ |
| 1 | Launch TF `1.0.0 (14)` | **FAIL** — binary TF chưa cài |
| 2 | Attendee QR / ví (**prod** API) | **FAIL** — blocked #1 |
| 3 | Staff `GateCamera` preview (**prod**) | **FAIL** — blocked #1 |
| 4 | Push smoke | **SKIP** |

Demo accounts (prod IdP): `attendee@example.com` / `attendee-demo`, `staff@example.com` / `staff-demo` (`docs/asc/app-review-notes.md` §A).

## Lệnh (build 14 + device)

```sh
cd apps/mobile
# app.config.ts ios.buildNumber → 14
APS_ENVIRONMENT=production APP_VARIANT=production EXPO_PUBLIC_APS_ENVIRONMENT=production \
  EXPO_PUBLIC_API_BASE_URL=https://api.vemoki.com \
  EXPO_PUBLIC_OIDC_ISSUER=https://auth.vemoki.com/realms/ticket \
  EXPO_PUBLIC_OIDC_CLIENT_ID=ticket-mobile EXPO_PUBLIC_PUSH_PROVIDER=apns CI=1 \
  pnpm exec expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath .expo/tf-upload-14/Vemoki-1.0.0-14.xcarchive \
  DEVELOPMENT_TEAM=BLUA62D52G CODE_SIGN_STYLE=Automatic \
  CURRENT_PROJECT_VERSION=14 MARKETING_VERSION=1.0.0 archive
xcodebuild -exportArchive -archivePath .expo/tf-upload-14/Vemoki-1.0.0-14.xcarchive \
  -exportPath .expo/tf-upload-14/export \
  -exportOptionsPlist .expo/tf-upload-14/ExportOptions.plist
xcrun altool --upload-app --type ios --file .expo/tf-upload-14/export/Vemoki.ipa \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"

# Dexter screenshots (device state / App Store attempts)
python3 -m pymobiledevice3 developer dvt screenshot \
  apps/mobile/.uat-artifacts/s4-t3-dexter/00-device-home.png \
  --udid 00008140-000605803C01801C
```

Host logs: `/tmp/tf14-prebuild.log`, `/tmp/tf14-pod.log`, `/tmp/tf14-xcodebuild.log`, `/tmp/tf14-export.log`, `/tmp/tf14-altool.log`.

## Artifacts (gitignored PNG)

`apps/mobile/.uat-artifacts/s4-t3-dexter/` — `00-device-home.png`, `01-appstore.png`, `02-testflight-appstore.png`, `03-testflight-store.png`, `04-testflight-itms.png`.

## Blocker / next

1. Operator: cài **TestFlight** từ App Store trên Dexter (Apple ID có internal tester `hangndat@gmail.com`).
2. TestFlight → cài/update **Vemoki 1.0.0 (14)**; gỡ hoặc bỏ qua bản dev 0.1.0 (7) khi verify.
3. Re-dispatch: `devicectl` launch + OIDC prod + screenshot QR + `GateCamera` → verdict **PASS** nếu đạt.

## Giới hạn

- Không EAS Cloud; không commit IPA/signing/`.p8`.
- Không claim PASS khi TF binary prod chưa chạy trên Dexter.
- Không Submit for Review (#332).
