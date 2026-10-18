# D13 — Archive local và IPA App Store

Task #325 · Epic #301. Architecture impact: **Không** — build/release từ source đã duyệt, không đổi code app.

Source exact `6002d09afa9382a72ee9840c8ba1dd41c7b09065` (merge PR353); app `1.0.0 (10)`, bundle `com.hangndat.ticket`, team `BLUA62D52G`. Source PR353 được reviewer độc lập duyệt tại `cbf84078c5423cb148c469fb64fb26f0436f2037`; CI main17 checks đạt trước build. `git status` sau prebuild không có thay đổi tracked; untracked review artifact PR353 được giữ nguyên.

## Kết quả

Local Expo prebuild → `pod install` → Xcode26.5/SDK26.5 archive Release arm64 → export `method=app-store-connect`, `destination=export` đều exit0. IPA cuối ký **Apple Distribution**, profile App Store không có danh sách device, `get-task-allow=false`, `aps-environment=production`; `codesign --verify --deep --strict` đạt. MinimumOS16.4.

Resolved Expo config production đã assert API `https://api.vemoki.com`, issuer `https://auth.vemoki.com/realms/ticket`, client `ticket-mobile`, không pin tenant/event; ba string production cũng có trong compiled `main.jsbundle`. Đây là kiểm tra cấu hình/binary, **không** thay signed-in runtime UAT.

Biên nhận allowlist, SHA256 và đường dẫn artifact: [JSON](./D13-S4-T1-LOCAL-ARCHIVE.json). IPA và archive/logs nằm local trong `.expo/d13-release/`, không commit signing material hoặc binary.

## Lệnh và khôi phục signing

Cwd `apps/mobile`; các bước build cùng public env:

```sh
APS_ENVIRONMENT=production APP_VARIANT=production EXPO_PUBLIC_APS_ENVIRONMENT=production
EXPO_PUBLIC_API_BASE_URL=https://api.vemoki.com
EXPO_PUBLIC_OIDC_ISSUER=https://auth.vemoki.com/realms/ticket
EXPO_PUBLIC_OIDC_CLIENT_ID=ticket-mobile EXPO_PUBLIC_PUSH_PROVIDER=apns
EXPO_PUBLIC_TENANT_ID= EXPO_PUBLIC_EVENT_ID= CI=1
pnpm exec expo prebuild --platform ios --no-install
# cwd ios: pod install
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release   -destination 'generic/platform=iOS' -archivePath .expo/d13-release/Vemoki-1.0.0-10-auto.xcarchive   -derivedDataPath .expo/d13-release/derived -jobs 4   DEVELOPMENT_TEAM=BLUA62D52G CODE_SIGN_STYLE=Automatic 'CODE_SIGN_IDENTITY=Apple Development' archive
xcodebuild -exportArchive -archivePath .expo/d13-release/Vemoki-1.0.0-10-auto.xcarchive   -exportPath .expo/d13-release/export -exportOptionsPlist .expo/d13-release/ExportOptions.plist
```

Env trên là giá trị cho process, không phải script shell tự export ở block minh họa. Lệnh thực tế và timestamp được lưu `archive-auto-command.json`; `ExportOptions.plist` có teampersonal, signingStyleautomatic, signingCertificateAppleDistribution, manageAppVersionAndBuildNumberfalse, uploadSymbolsfalse, destinationexport.

Lần đầu manual Distribution archive exit65 vì profile Store là **Xcode-managed**, không tương thích manual signing. Giữ `archive.log` lỗi; chuyển sang archive Automatic Development rồi **export re-sign Distribution thành công**. Không coi Development archive đơn lẻ là IPA Store. Kiểm tra chữ ký/APS nêu trên thực hiện trên **IPA đã export**, không trên archive Development.

## Version/build và giới hạn

ASC read-only trước build có các build `0.1.0 (1–11)`; chưa có train `1.0.0`. iOS yêu cầu cặp `CFBundleShortVersionString` + `CFBundleVersion` duy nhất, không bắt buộc build10 lớn hơn build11 của train0.1.0: [Apple primary](https://developer.apple.com/documentation/xcode/setting-the-next-build-number-for-xcode-cloud-builds). Tài liệu chỉ dùng để xác minh quy tắc version; **không dùng Xcode Cloud**. Kiểm tra lại ASC trước upload để tránh trùng do phiên làm việc khác.

Chưa upload/processing ASC, chưa chọn build cho draft, chưa submit/release. Chưa signed-in deletion E2E trên binary này, chưa physical camera/push smoke. Runtime erasure/email/Privacy Labels/territory còn gate riêng. Không EAS/Expo Cloud Build và không upload source/credential/signing lên Expo. Cần review độc lập artifact trước khi chốt #325; archive/IPA thành công không phải publish.
