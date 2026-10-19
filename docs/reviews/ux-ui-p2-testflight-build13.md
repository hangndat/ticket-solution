# TestFlight upload — UX-UI Phase 2 build 13

| Field | Value |
| ----- | ----- |
| Issue | [#545](https://github.com/hangndat/ticket-solution/issues/545) |
| Authorization | Orca Dispatch `ctx_35948f44a3c5` / Task `task_74780f8e6f4e` (coordinator Epic follow-up after UX-UI P2) |
| Source tip (git) | `e630d0b655631345b2168117a87c499edbb2ef08` (branch `hangndat/ux-ui-p2-tf-545` — `buildNumber` 12→13 + this evidence) |
| Base `main` | `0b42515e4ad940a45ecd5c08341a26af0e68e621` |
| Bundle | `com.hangndat.ticket` · Team `BLUA62D52G` |
| Marketing version | `1.0.0` |
| Build (`CFBundleVersion`) | **`13`** |
| ASC build id / Delivery UUID | `fa4f322d-6a18-4a62-b5a9-e2133a055f8f` |
| Tool | Local `expo prebuild` + `xcodebuild archive/export` + `xcrun altool` |
| EAS Cloud Build | **Không dùng** |
| Submit for Review / release | **Không** (chỉ upload → TestFlight processing) |

## Kết quả

`xcrun altool --upload-app` **UPLOAD SUCCEEDED**. Delivery UUID `fa4f322d-6a18-4a62-b5a9-e2133a055f8f`.

ASC read-back (API Key `KHT3SAL2FS`, chỉ đọc): build **13** `processingState=VALID`, `preReleaseVersion=1.0.0`, `internalBuildState=IN_BETA_TESTING`, `externalBuildState=READY_FOR_BETA_SUBMISSION`. Uploaded `2026-10-18T21:32:47-07:00`.

App Store Version `1.0.0` vẫn `PREPARE_FOR_SUBMISSION` / `releaseType=MANUAL` — **chưa** Submit for Review, **chưa** Ready for Sale.

| Artifact | Value |
| -------- | ----- |
| IPA (local, gitignored) | `apps/mobile/.expo/tf-upload-13/export/Vemoki.ipa` |
| IPA SHA256 | `53f32dd3da9ead85ad718697c0528892ef2e51ea9d9c61d1d9a821a18568fc59` |
| IPA bytes | `18886697` |
| Signing (exported IPA) | Apple Distribution: Hang Nguyen Dat (`BLUA62D52G`) · `get-task-allow=false` · `aps-environment=production` |
| ASC API Key ID (không secret) | `KHT3SAL2FS` |
| altool / ContentDelivery | `26.40.1` / Xcode 26.5 |

## Lệnh (không chứa secret)

```sh
cd apps/mobile
# bump app.config.ts ios.buildNumber → 13
APS_ENVIRONMENT=production APP_VARIANT=production EXPO_PUBLIC_APS_ENVIRONMENT=production \
  pnpm exec expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath .expo/tf-upload-13/Vemoki-1.0.0-13.xcarchive \
  DEVELOPMENT_TEAM=BLUA62D52G CODE_SIGN_STYLE=Automatic \
  'CODE_SIGN_IDENTITY=Apple Development' \
  CURRENT_PROJECT_VERSION=13 MARKETING_VERSION=1.0.0 archive
xcodebuild -exportArchive \
  -archivePath .expo/tf-upload-13/Vemoki-1.0.0-13.xcarchive \
  -exportPath .expo/tf-upload-13/export \
  -exportOptionsPlist .expo/tf-upload-13/ExportOptions.plist
xcrun altool --upload-app --type ios \
  --file .expo/tf-upload-13/export/Vemoki.ipa \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"
```

Host logs (gitignored): `/tmp/tf13-prebuild.log`, `/tmp/tf13-pod.log`, `/tmp/tf13-xcodebuild.log`, `/tmp/tf13-export.log`, `/tmp/tf13-altool.log`, `/tmp/tf13-asc-poll.json`.

## Giới hạn

- Không External TestFlight group auto-attach; Internal khi ASC `VALID`.
- Không physical device smoke trong bước này.
- Không Submit for Review / Ready for Sale.
- Không commit IPA / `.p8` / issuer / `ios/` (prebuild, gitignored).
- Artifact implementer — DoD reviewer độc lập exact-SHA trước khi Project **Hoàn thành**.
