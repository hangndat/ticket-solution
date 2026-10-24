# TestFlight — UI859 build27, 24/10/2026

**Upload thành công; Apple processing VALID; Internal TestFlight IN_BETA_TESTING.** User authorize “upload testflight đi”. Dùng lại đúng IPA đã build/ký/verify local, không build lại và không EAS/cloud.

| Trường | Giá trị |
| --- | --- |
| Source SHA | `c466343aeea75c3fe303e8ee885632ec44afce2c` |
| Version / build | **1.0.0 (27)** |
| Bundle / app | `com.hangndat.ticket` / ASC `6823694490` |
| IPA SHA256 | `f4eb2e71bdaabe0e0edbc4f65b689c66c3ea3731341a1f4047e925babb23d61a` |
| Delivery UUID / ASC build ID | `29fb654d-6319-4c3b-a979-513c63db2360` |
| Apple upload | `UPLOAD SUCCEEDED with no errors`, altool exit0 |
| Processing | **VALID** |
| Internal / external beta state | **IN_BETA_TESTING** / READY_FOR_BETA_SUBMISSION |
| Export compliance | `usesNonExemptEncryption=false` |
| Uploaded (Apple) | `2026-10-23T22:18:51-07:00` (24/10/2026 UTC) |

Preflight ASC đúng bundle và chưa có build27; hash IPA khớp biên nhận build. Upload bằng `xcrun altool --upload-app`, credentials local không in ra log user/commit. ASC read-back xác nhận đúng cặp version/build, build chưa expired. Không tạo lời mời/nhóm, không mở external beta review, không chọn build App Review hoặc public release. Trạng thái Internal không tự chứng minh một tester cụ thể đã cài app.

Artifact: `/Users/admin/SideProject/ticket-solution/release-ui859-ios/apps/mobile/.expo/release-ui859/export/Vemoki.ipa`. Logs/JSON allowlist tại `.orca-metrics/release-ui859/testflight-upload-27.log`, `testflight-upload-27-receipt.json`, `asc-build27-latest.json`; không commit binary/signing/JWT/secrets. Source tracked vẫn sạch.

[Mở TestFlight](https://appstoreconnect.apple.com/apps/6823694490/testflight/ios). Biên nhận build/deploy trước upload: [DEPLOY-PROD-UI859-2026-10-24.md](DEPLOY-PROD-UI859-2026-10-24.md). Các câu “chưa upload” trong checkpoint build trước là trạng thái lịch sử, được cập nhật bằng biên nhận này.
