# TestFlight upload — UX-UI Revamp (2026-10-19)

| Field | Value |
| ----- | ----- |
| Authorization | User: **«up testflight đi»** |
| Source tip (git) | `bfe531c52baa2e9c10c339ffdf86a28b22e729bd` (`main` + buildNumber bump) |
| Bundle | `com.hangndat.ticket` · Team `BLUA62D52G` |
| Marketing version | `1.0.0` |
| Build (`CFBundleVersion`) | **`12`** (11 rejected DUPLICATE — ASC already had 11) |
| Tool | Local `expo prebuild` + `xcodebuild archive/export` + `xcrun altool` |
| EAS Cloud Build | **Không dùng** |
| Submit for Review / release | **Không** (chỉ upload → TestFlight processing) |

## Kết quả

`xcrun altool --upload-app` **UPLOAD SUCCEEDED**. Delivery UUID `a3fb1af9-3af6-42df-9dd1-5651e3b0fa4d`.

| Artifact | Value |
| -------- | ----- |
| IPA (local, gitignored) | `apps/mobile/.expo/tf-upload-12/export/Vemoki.ipa` |
| IPA SHA256 | `1b2fea4ab0c554323bb0e11df58f08375f990095da7035ac9f3624af64d60590` |
| IPA bytes | `12035242` |
| Signing | Apple Distribution · `get-task-allow=false` · `aps-environment=production` |
| ASC API Key ID (không secret) | `KHT3SAL2FS` |

## Lệnh (không chứa secret)

```sh
cd apps/mobile
# bump app.config.ts ios.buildNumber → 12; APS_ENVIRONMENT=production …
pnpm exec expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath .expo/tf-upload-12/Vemoki-1.0.0-12.xcarchive \
  DEVELOPMENT_TEAM=BLUA62D52G CODE_SIGN_STYLE=Automatic \
  'CODE_SIGN_IDENTITY=Apple Development' \
  CURRENT_PROJECT_VERSION=12 MARKETING_VERSION=1.0.0 archive
xcodebuild -exportArchive \
  -archivePath .expo/tf-upload-12/Vemoki-1.0.0-12.xcarchive \
  -exportPath .expo/tf-upload-12/export \
  -exportOptionsPlist .expo/tf-upload-12/ExportOptions.plist
xcrun altool --upload-app --type ios \
  --file .expo/tf-upload-12/export/Vemoki.ipa \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"
```

## Giới hạn

- Không External TestFlight group auto-attach; Internal khi ASC `VALID`.
- Không physical device smoke trong bước này.
- Không Submit for Review / Ready for Sale.
- Không commit IPA / `.p8` / issuer.
