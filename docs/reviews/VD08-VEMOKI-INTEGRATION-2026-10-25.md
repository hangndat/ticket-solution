# VD-08 — Tích hợp, UAT và release handoff Vemoki

**Epic:** #874 · **Issue:** #889 · **Ngày:** 25/10/2026 · **Trạng thái:** code complete; acceptance chưa complete; chưa pilot ready.

## Baseline và phạm vi

- Mẫu chuẩn: `docs/design/vemoki-unified-v1/` từ nguồn cuối `Vemoki-Complete 2`. Manifest `VERIFY.py` đã PASS 57 file ở PR #877. Bỏ Web Gate admission theo O23; Portal chỉ đọc Gate report, Staff iOS sở hữu scan/confirm.
- Không dùng bundle `github-pr/` cũ làm nguồn. Không mở API/permission/payment/Android/Wallet mới. Không production deploy hoặc store submit.
- `origin/main` sau PR #888: `d6a17787424750b475450886f2f1052fd40fde7e`. CI tích hợp của SHA này được theo dõi ở [run 40113019581](https://github.com/hangndat/ticket-solution/actions/runs/40113019581); trạng thái phải được cập nhật sau khi run kết thúc.

## Code và review đã tích hợp

| Slice | PR / merge SHA | Review, CI, trạng thái |
| --- | --- | --- |
| VD-00/01/03 — nguồn mẫu, O23, handoff | [#877](https://github.com/hangndat/ticket-solution/pull/877) · `992a85e9d34fcebe7e9b78f6d74e21bb61e0ebf5` | DoD PASS, manifest PASS; Issues #875/#876 hoàn thành. |
| VD-02 — link/copy Web Gate dư | [#883](https://github.com/hangndat/ticket-solution/pull/883) · `569224dc5f93ce33df098e256ad82f7d2fc5579d` | DoD/Security PASS, UI PASS with known gap; Issue #878 Chờ duyệt K-08. |
| VD-06 — Staff iOS | [#884](https://github.com/hangndat/ticket-solution/pull/884) · `c680c74806ee0659968348b6beec61ee431a180b` | DoD/Security PASS, UI PASS with known gap; Issue #879 Chờ duyệt thiết bị/auth. |
| VD-07 — Portal operations | [#885](https://github.com/hangndat/ticket-solution/pull/885) · `c242b7ce7859d6b0c36fe8fbb333aab37311631a` | DoD/Security PASS, UI PASS with known gap; Issue #880 Chờ duyệt OIDC/browser UAT. |
| VD-05 — attendee iOS | [#886](https://github.com/hangndat/ticket-solution/pull/886) · `4e1d32fc494dbdb71e49be77799a7c39cb9f755c` | CI mobile PASS, DoD/UI PASS with known gap; Issue #882 Chờ duyệt vé/QR runtime. |
| VD-04 marketing | [#887](https://github.com/hangndat/ticket-solution/pull/887) · `c05ecfd6c3e7a78fe079a7332904202c09107d34` | CI web PASS, DoD/UI PASS with known gap; K-08 viewport chưa có. |
| VD-04 attendee web | [#888](https://github.com/hangndat/ticket-solution/pull/888) · `d6a17787424750b475450886f2f1052fd40fde7e` | CI web PASS trên head `510d55f0…`; review/revalidation DoD/UI PASS with known gap, Security PASS. Issue #881 Chờ duyệt. |

Review từng PR dùng implementer khác reviewer và pin exact head SHA. PR #888 đã sửa F01–F06 trong vòng 1/2; cache QR ghi mà không đọc đã được xóa trước merge. PR #884/#885 cũng qua vòng sửa và revalidation trước merge. Không reset finding hoặc lượt sửa của các issue UI cũ.

## Ma trận nghiệm thu hiện tại

| Surface / persona / state | Bằng chứng đã có | Chưa chứng minh được |
| --- | --- | --- |
| Marketing VI/EN, sales + legal | CI web, review CSS scope/reduced-motion; Orca browser có ảnh thử local | 320/390/768/1024/1440 thực tế; ảnh đặt tên `390` đo được 1462×1834 px, không đại diện viewport 390. Keyboard/200% zoom chưa đủ matrix. |
| Attendee web guest, event/redeem | CI web route integration, SSR/auth gate review | Orca screenshot PR #888 bị CDP `Page.captureScreenshot` timeout; chưa có UAT viewport/persona đầy đủ. |
| Attendee web owner, ticket/QR/offline | CI web và review tenant/session, forbidden, QR display; QR không lưu `sessionStorage` | OIDC owner thật, physical QR, cold offline deeplink (SSR cần mạng lần đầu), logout/tenant switch runtime matrix. |
| Attendee iOS guest | Xcode Release simulator build và Orca emulator AX trên iPhone 17e, UDID `1CE47E90-329A-4019-B4C6-44DB96C29138`; public events/detail render trên integrated `main` `c05ecfd6…` (đã chứa PR #886). | Wallet/redeem đã xác thực, QR và camera trên thiết bị thật; Dynamic Type/VoiceOver matrix. |
| Staff iOS | Local prebuild + Pods, Debug/Release Xcode simulator build PASS; bundle `com.hangndat.ticket`, personal Team `BLUA62D52G`. | Bản dựng hiện báo “Chưa sẵn sàng đăng nhập”; không có Staff OIDC fixture. Vì vậy chưa chạy camera, offline queue/restart/conflict, role revoked và history scoped runtime. |
| Portal operator/report.read | CI Portal, DoD/Security/UI review trên PR #885; Gate report chỉ đọc theo code | OIDC operator + `report.read` fixture, viewport browser UAT, server-backed `asOf`/stale persona matrix. |
| Web Gate legacy | PR #883 code/review chứng minh không thêm camera/manual admission web | Direct bookmark/deep-link UAT qua Orca browser ở viewport chuẩn vẫn thiếu. |

Local iOS artifacts (gitignored): `vd06-ios-staff/apps/mobile/.uat-artifacts/vd06-issue879/` và `vd06-ios-staff/apps/mobile/.uat-artifacts/vd05-issue882/`. Lệnh chính: `expo prebuild --platform ios --no-install`, `pod install`, `xcodebuild -workspace apps/mobile/ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release -sdk iphonesimulator -destination id=1CE47E90-329A-4019-B4C6-44DB96C29138 CODE_SIGNING_ALLOWED=NO build`, `orca emulator attach/ax/tap/kill`, `xcrun simctl io ... screenshot`. Không dùng Expo/EAS Cloud Build. Thiết bị simulator được tách khỏi simulator của người dùng; helper Orca đã đóng sau UAT.

## Quyết định handoff

1. **Code complete:** Có cho phạm vi VD-00…VD-07 đã chốt và merge. CI từng PR PASS; chờ CI tích hợp `d6a17787…` kết thúc để chốt gate cuối.
2. **Acceptance complete:** Chưa. Issues #878–#882 ở Chờ duyệt; #889 tổng hợp UAT. Bằng chứng còn thiếu ở bảng trên không được suy từ prototype, unit test hoặc simulator guest.
3. **Pilot ready:** Chưa. Cần môi trường OIDC có persona/tenant dữ liệu kiểm thử, Orca browser viewport capture hoạt động, và thiết bị thật cho camera/QR/offline/a11y. Khi có điều kiện, chạy lại từng AC, gắn SHA/build/viewport/UDID/persona/state vào issue tương ứng rồi review sign-off.
4. **Release:** Chỉ chuẩn bị handoff. Production deploy, signing/store submission cần task và ủy quyền riêng theo policy dự án.

