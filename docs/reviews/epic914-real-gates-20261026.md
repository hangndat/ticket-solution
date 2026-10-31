# Epic #914 — đối chiếu thiết bị thật và inbox thật, 26/10/2026

User đã mở lại phạm vi B-03/B-04, cho phép dùng iPhone đang kết nối và gửi tới inbox chỉ định. Giữ nguyên lệnh cấm tạo Run mới hoặc bind/consume Run #928. Không deploy production, sửa cấu hình server hay thay dữ liệu #928.

## B-03 — tái sử dụng evidence máy thật

Nguồn canonical: [PR #972](https://github.com/hangndat/ticket-solution/pull/972), [review độc lập James](https://github.com/hangndat/ticket-solution/pull/972#issuecomment-6412271884), [xác nhận merge và CI tích hợp](https://github.com/hangndat/ticket-solution/pull/972#issuecomment-6412486477).

PR tip `65b5609aa8291773751806278ea21c87852a9ca6`; merge `8a2a532d2e45fa5d59aba1f78345f477f3d10ea4`. Binary UAT gốc mang nhãn `608a21b6…-uat-fix`; không nhận rằng binary đã bake tip SHA. PR và reviewer xác minh mobile tree từ commit UAT `c9af4134` bằng tip. Coordinator kiểm tiếp `git diff 65b5609aa8291773751806278ea21c87852a9ca6 ddb7428b6e266d4ea406ff74478cc71cf30c5055 -- apps/mobile` và diff tới `origin/main`: rỗng.

| Ca trên Dexter iPhone 16 Pro | Kết quả đã có |
| --- | --- |
| Camera đọc QR fixture | PASS; người dùng hướng camera, UI “Được vào”, DB USED |
| Quét trùng | PASS; đúng một check-in |
| Camera bị từ chối quyền | PASS; hướng dẫn Settings và nhập tay; đã khôi phục quyền |
| API không truy cập được | PASS; queue, chưa cho vào; DB còn ACTIVE |
| Queue qua restart, phục hồi API và receipt | PASS; đúng một check-in, có receipt |
| Cold-start recovery | PASS; nút retry phục hồi Staff/session sau xác minh server |
| VoiceOver hộp xác nhận | PASS; người dùng xác nhận nghe nội dung và dùng nút hủy |

Đây là evidence thiết bị thật, không phải simulator. Không chạy lại các ca này chỉ vì thay leader. Bản Release bổ sung chuẩn bị trong lượt này đã build thành công nhưng **chưa cài lên máy**.

Giới hạn giữ nguyên: mất kết nối được tạo bằng API-unavailable có kiểm soát, không phải radio-off toàn máy; không chứng minh offline đa thiết bị chống trùng, toàn bộ OIDC tương tác, Dynamic Type hay APNs. Không chuyển các giới hạn đó thành PASS. Raw artifact của phiên cũ không còn ở đường dẫn local được PR dẫn; evidence tái sử dụng dựa trên mô tả PR, review độc lập và CI công khai, không giả nhận đã mở lại ảnh gốc. Các AC còn lại của #940/#941 vẫn cần đối chiếu riêng.

## B-04 — kênh email thật

- Đọc riêng SMTP từ server đã được user chỉ định; dùng `smtp.porkbun.com:587`, người gửi `noreply@vemoki.com`. Không sửa cấu hình server và không ghi credential vào báo cáo.
- Tạo DB fixture riêng `ticket_epic914_real_20261026` từ snapshot fixture #939; không sửa DB nguồn hoặc dữ liệu #928.
- Dùng `retryNotificationDelivery` với actor Owner của fixture, rồi `claimOutboxBatch` và `processClaimedOutbox` cùng `createSmtpEmailAdapter` thật. Chỉ một `TicketIssued` được chọn, chỉ gửi tới địa chỉ user đã cho phép. Không dùng Mailpit/noop.
- Thời gian gửi `2026-10-26T12:40:28.991Z`; tiêu đề **Vé đã cấp — MFest · Demo**. Worker: claimed 1, completed 1, failed 0; SMTP `ACCEPTED`.
- User xác nhận **“Đã nhận, QR hiển thị”**, sau đó cung cấp ảnh inbox khớp người gửi, tiêu đề, thời gian và vé fixture. Vì vậy xác nhận nhận thư không chỉ suy từ SMTP.
- Ảnh inbox và QR chứa credential chỉ lưu trong `.local-dev/vcx939-leader/gates-real/` (private, gitignored); không đưa lên GitHub. Cấu hình SMTP riêng có mode 0600.

**Verdict: PASS cho gửi/nhận email thật và QR hiển thị.** Vé/link thuộc fixture local; không nhận đây là nghiệm thu toàn bộ owner-link trên production hoặc onboarding/membership invite S5. Không gửi thêm thư chỉ để lặp evidence.

## Kết luận phạm vi

B-04 có evidence inbox thật; các ca camera/QR/offline queue nêu trên của B-03 đã có evidence máy thật và được tái sử dụng với giới hạn rõ. Hàng VoiceOver trong bảng B-03 là lịch sử phiên 26/10 — **iOS VoiceOver ngoài phạm vi #914 / quyết định owner**, không còn AC/UAT/S6 và không chặn đóng Epic. Hai tài nguyên thiết bị/inbox không còn là điều kiện đang chờ user chuẩn bị. Không tự đóng #940/#941, toàn bộ acceptance Epic #914 hoặc tuyên bố pilot ready từ báo cáo này.
