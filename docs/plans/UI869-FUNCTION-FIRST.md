# #869 — quyết định mới: ưu tiên chức năng

User: “tôi sẽ chốt thiết kế sau, giải quyết các vấn đề về function trước đi” (2026-10-24). Minh/coordinator coi đây là quyết định tiếp tục có thẩm quyền cho phần chức năng còn mở, gồm F01 đã bị ngắt và F07–F10 theo feedback user. **Không reset** lịch sử2/2 + ngoại lệ đã dùng. Một batch có giới hạn theo quyết định mới, sau đó một review độc lập; nếu vẫn blocker thì checkpoint, không tiếp tục lặp tự động. Ba mockup và MKT/catalog redesign tiếp tục chờ user duyệt.

## Phạm vi / owner / đầu ra

- Minh: F01 process shutdown và integration/fixture tooling. Tối đa20phút implementation+targeted tests; giải pháp an toàn đã chốt trong report: leader chết trước stop mà group còn sống → nonzero + giữ owner record khi không chứng minh được ownership; tuyệt đối không kill group ngoại lai. Không đổi auth/backend/production.
- Linh: `apps/web` functional claim/redeem/account, tiếp tục từ working tree đã bàn giao; chẩn đoán giới hạn runtime hydrate/return OIDC, sửa các lỗi correctness có evidence, giữ UI hiện có. Tối đa30phút trước checkpoint. Kiểm real fixture email→OIDC→published terms→claim→wallet; single-code resolve→confirm→wallet không dùng mã002 dành user; trạng thái account deletion không nhầm request accepted với completed, không double submit; không gửi yêu cầu xóa trên tài khoản user.
- James: DoD/security theo diff exact SHA tích hợp, tái kiểm F01/F07–F10 và regression. Không re-audit marketing style hoặc dùng mockup làm evidence. Nếu cần thêm fixture QA cho mutation account, chỉ DB/Keycloak local cô lập, giữ API/contract chính sách30/730ngày.

## Câu hỏi cần xác minh

1. F01 nhánh leader đã chết trước stop còn false-success/xóa record không? Kiểm cả child ignore TERM sau leader exit và PID/group foreign/reused.
2. Claim result có bị mất do clearGuestClaimIntent làm location snapshot rỗng? Pending/retry có bị khóa bởi claimedKey không? Context thay đổi khi request đang chạy có giữ busy/stale response sai scope không? Đây là giả thuyết từ source, cần test/repro trước kết luận.
3. OIDC restore là lỗi client/runtime hay Orca streamed-node/animation clock? Phân biệt bằng visible DOM, console/network, một probe đại diện; không lặp chụp/đổi auth để vượt UAT.
4. Redeem/account: form/terms gate, error/unknown outcome, repeat request/idempotency và phản hồi UI đúng trạng thái. Không thay chính sách hoặc API để làm UI pass.

DoD: tests liên quan + web lint/typecheck/build, bằng chứng journey/localfixture; source commit/push vào PR870 và CI exact SHA; review độc lập. Chỉ merge/deploy khi user authorize riêng; không claim pilot ready. Browser do agent mở phải đóng, stack local giữ chạy.
