# Signing iOS cá nhân — Vemoki

Mọi host đọc policy này trước local prebuild, Xcode/xcodebuild, signing, provisioning hoặc thao tác App Store. Máy có thể đăng nhập nhiều Apple account; không suy tài khoản cá nhân từ mặc định Xcode, Keychain hoặc phiên App Store Connect.

- Vemoki dùng personal Team ID `BLUA62D52G`, bundle `com.hangndat.ticket`. Xác minh team và quyền còn hiệu lực trước thao tác; thông tin trong repo không chứng minh entitlement hiện tại.
- Không dùng team công ty, bao gồm `3WHS6JDYV2`, hoặc identity công ty `97UYJZL33M`. Team khác cần chỉ định rõ của user, không tự fallback.
- Native build chỉ local Mac/self-managed macOS với Expo prebuild và Xcode/xcodebuild/fastlane; không Expo/EAS Cloud Build, không upload signing material lên Expo.
- Xác minh `DEVELOPMENT_TEAM` của project sinh ra khớp team cá nhân. Nếu sai, sửa cấu hình nguồn `apps/mobile/app.config.ts`/config plugin rồi chạy local prebuild; không coi sửa tay `ios/` gitignored là nguồn chuẩn.
- Chọn certificate/provisioning theo mục tiêu: Development cho USB, Distribution cho App Store. Xác minh identity thuộc team cá nhân trước dùng; không chọn identity đầu tiên trong Keychain.
- USB theo [ios-usb-device](../../../.agents/skills/ios-usb-device/SKILL.md). Upload/store chỉ khi task đã ủy quyền và đúng account, app, team.
- Không ghi Apple ID email/password, certificate, `.p12`, provisioning profile hoặc App Store Connect API key vào Git/log/báo cáo. Chỉ ghi tên biến và kết quả xác minh cần thiết.

Đây là nguồn policy dùng chung của dự án; không yêu cầu Codex/Claude/OpenCode đọc cấu hình Cursor trên máy. Không thay đổi account, certificate hoặc provisioning trong bước đọc policy.
