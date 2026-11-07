# #1233 — Nghiệm thu UI iOS 45 khung đã duyệt

- Source được James review: `25af88b4ba2186e302cca7b50a313d99453ef559`; base runtime `38f11b0bef63914c5b0428d428ab2ed1be754990` và `d6f4e645f0349ffdf0f8fcb48bd173b440639961`.
- **Acceptance 45 khung: PASS** theo AC và giới hạn trong [review độc lập gộp](D6-integrated390-revalidation.md). James độc lập implementer Zico/coordinator; Gate fix counter 2/2.
- Kiểm code tại source25: 600 mobile tests, typecheck, lint 0 lỗi, UI budget và diff check PASS. Root build/cài Release A25, kiểm embedded SHA/API/UAT và hash nguồn; B38 giữ cho các flow không bị delta Gate25 ảnh hưởng.
- **PR/CI tích hợp: đang chốt.** Issue #1233 giữ OPEN, chưa merge/deploy/store; acceptance này không kết luận pilot/production ready.

| Nhóm (số khung) | Kết quả / review |
| --- | --- |
| Ví A+C (1) | PASS — [hero theo startsAt và hành trình ví](D6-wallet-hero-card.md); mở rộng startsAt đã được owner cho phép. |
| Khám phá + sự kiện (3) | PASS — [catalog, chi tiết, lỗi/rỗng và keyboard](D6-explore-event-detail.md). |
| Đổi mã + chi tiết vé (5) | PASS — [credential fail-closed, owner/offline và CTA](D6-redeem-ticket-detail.md). |
| Nhận vé mời (3) | PASS — [guest→verified, required fields, pending/issued, keyboard](D6-claim-invitation.md). |
| Tài khoản + xóa + privacy (6) | PASS — [Back, GET/POST retry, logout current-owner cleanup](D6-account-privacy.md). |
| Gate quét + kết quả (8) | PASS trong scope kết hợp — [callback/core hiện tại, D12 và camera component kế thừa](D6-gate-scan-status.md). |
| Gate nhập tay + lịch sử (7) | PASS — [preview/Hủy, kết quả, search, receipt và paging](D6-gate-manual-history.md). |
| Lời mời tổ chức (2) | PASS — [local OIDC/API, accept/Portal, wrong-email/expired và network retry](D6-membership-invite.md). |
| Trạng thái bổ sung (10) | PASS — [Staff/verified, loader, empty/error/deep links và keyboard](D6-remaining-states.md). |

Nguồn visual vẫn là 45 khung/15 HTML gốc trong `docs/design/mobile-approved-wireframes-2026-11-05`, pin `MANIFEST.sha256`; bốn CTA delta và D12 theo DECISION-LOG, không sửa ngược bản duyệt.

Evidence cuối có **114/114 hash**, 91 PNG 1170×2532 (390×844 pt), 23 AX; manifest và receipts không chứa token được pin trong [gói provenance](assets/D6-integrated390/provenance.json). Raw PNG/AX, fixture và báo cáo runtime nằm local tại `apps/mobile/.uat-artifacts/d6/integrated390/`, không commit ảnh/credential.

Giới hạn: máy thật 402×874 dùng cho paging và camera permission/live preview; camera vật lý QR kế thừa có giới hạn từ [PR #972](epic914-real-gates-20261026.md) vì component/dependency không đổi. Current callback→Expo→JS→HTTP/UI kiểm bằng native producer harness cách ly, bỏ qua physical capture/AVFoundation metadata producer/connection lifecycle. Hai QR khác nhau chỉ tạo một reserve/confirm; binary25 duplicate hiển thị warning và vẫn denied. Không gọi harness là camera vật lý mới.

Queued pending/no-admission đã quan sát; cold replay gặp fixture thiếu endpoint trả 404 và chuyển rejected/fail-closed, không chứng minh replay thành công. Security PASS trong code scope và runtime local synthetic/historical đã ghi; không chứng nhận production signature/RBAC, full storage purge hoặc server account erasure. Logout audit chỉ đọc metadata, xóa current-owner credential/cache/workspace; device metadata và cache owner khác được giữ theo contract.
