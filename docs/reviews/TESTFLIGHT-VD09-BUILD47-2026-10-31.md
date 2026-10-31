# TestFlight — VD09 build47, 31/10/2026

**Upload thành công; Apple processing VALID; build đã có trong nhóm internal James.** User authorize upload TestFlight, không Submit for Review. Local prebuild + archive/export + `xcrun altool`, không EAS/cloud.

| Trường | Giá trị |
| --- | --- |
| Source SHA (bump commit) | `8fd852667c7a3ae9e6ce83d79c4cb79d4af78e8e` (branch `hangndat/vd09-ios-build47`, PR #1098) |
| Version / build | **1.0.0 (47)** |
| Bundle / app | `com.hangndat.ticket` / ASC `6823694490` |
| IPA SHA256 | `4ac0e00e010c13c4f5bf4011be7f9f7742bc8498e02ae1f849d375dc15c099fa` |
| ASC build id / Delivery UUID | `eac2af5e-d093-4328-bd4e-5dd6403c75d3` (cả hai trùng) |
| Apple upload | `UPLOAD SUCCEEDED with no errors`, altool exit0 |
| Processing | **VALID** |
| Internal TestFlight (nhóm James) | Build **47** đã xuất hiện trong danh sách build của nhóm `James` (`GET /v1/betaGroups/{id}/builds`) — Apple tự gắn build VALID vào nhóm internal, không có API thao tác tay cho internal group (`POST betaGroups` trả 422 "Cannot add internal group to a build") |
| `internalBuildState` / `externalBuildState` (API) | `READY_FOR_BETA_TESTING` / `READY_FOR_BETA_SUBMISSION` — build 46 (upload trước) cũng giữ cùng trạng thái này, không chặn việc build đã trong nhóm James |
| Export compliance | `usesNonExemptEncryption=false` (đã bake sẵn, không cần xác nhận tay) |
| Beta Review (external) | **Không** gắn — giữ đúng yêu cầu không Submit for Review |

## Sự cố phát hiện và đã sửa trước khi upload

Lần archive đầu tiên (trước upload) bake nhầm `apsEnvironment=development` vào `EXConstants.bundle/app.config` vì biến `APS_ENVIRONMENT`/`EXPO_PUBLIC_APS_ENVIRONMENT=production` chỉ được export cho bước `expo prebuild`, không export lại cho tiến trình `xcodebuild archive` (bước "Bundle React Native code and images" chạy app.config.ts trong subprocess riêng, kế thừa env của `xcodebuild`). Hệ quả: `extra.ticketPublic.oidcIssuer`/`oidcClientId` trống (thiếu `auth.vemoki.com`, `ticket-mobile` trong jsbundle). Đã xoá archive/export cũ, prebuild + archive lại với env production export đúng trong cùng lệnh `xcodebuild`. Bản build 47 đã upload là bản **đã sửa**, không phải bản archive lỗi đầu tiên.

## Kiểm jsbundle (bản đã upload)

| Chuỗi | Có trong jsbundle |
| --- | --- |
| `api.vemoki.com` | Có (1) |
| `auth.vemoki.com` | Có (1) |
| `ticket-mobile` | Có (1) |
| `EXConstants.bundle/app.config` → `apsEnvironment` | `production`; `allowLocalFixtureApi`/`allowUatSessionRoutes`/`allowFixtureEventRoutes` = `false` |
| Chuỗi con `localhost` / `UAT` | Vẫn còn ký tự (identifier flag `EXPO_PUBLIC_ALLOW_UAT_SESSION_ENV_FLAG`, URL fallback dev `http://localhost:3000`/`:8081`) — đây là code dùng chung một bundle cho cả dev/prod, được gate runtime bằng flag `false` ở trên, không phải endpoint đang active. Cùng kiến trúc với các build TestFlight trước (27, 12…) đã được chấp nhận. |

Signing: `Apple Distribution: Hang Nguyen Dat (BLUA62D52G)`, profile `iOS Team Store Provisioning Profile: com.hangndat.ticket`, `get-task-allow=false`, `aps-environment=production`, team `BLUA62D52G` (không dùng team công ty 3WHS6JDYV2/97UYJZL33M).

## Lệnh (không chứa secret)

```sh
cd apps/mobile
export APS_ENVIRONMENT=production EXPO_PUBLIC_APS_ENVIRONMENT=production EXPO_PUBLIC_BUILD_GIT_SHA=$(git rev-parse HEAD)
pnpm exec expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath .expo/tf-upload-47/Vemoki-1.0.0-47.xcarchive \
  DEVELOPMENT_TEAM=BLUA62D52G CODE_SIGN_STYLE=Automatic \
  'CODE_SIGN_IDENTITY=Apple Development' \
  CURRENT_PROJECT_VERSION=47 MARKETING_VERSION=1.0.0 archive
xcodebuild -exportArchive \
  -archivePath .expo/tf-upload-47/Vemoki-1.0.0-47.xcarchive \
  -exportPath .expo/tf-upload-47/export \
  -exportOptionsPlist .expo/tf-upload-47/ExportOptions.plist
xcrun altool --upload-app --type ios \
  --file .expo/tf-upload-47/export/Vemoki.ipa \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"
```

## Giới hạn

- Không claim login/ví PASS — owner nghiệm thu trên iPhone qua TestFlight (nhóm James).
- Không Submit for Review / Ready for Sale / gắn nhóm Beta Review.
- Không physical device smoke trong bước này.
- Không commit IPA / `.p8` / issuer / credentials.
- Artifact local (gitignored): `apps/mobile/.expo/tf-upload-47/export/Vemoki.ipa`.
