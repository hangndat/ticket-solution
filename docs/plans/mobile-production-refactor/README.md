# Refactor trải nghiệm production — quyết định và handoff O18

**Trạng thái đối chiếu 24/10/2026:** user đã duyệt thiết kế, mockup và roadmap ngày 20/10. Wave 1 đã có [PR #586](https://github.com/hangndat/ticket-solution/pull/586) (catalog API), [PR #587](https://github.com/hangndat/ticket-solution/pull/587) (mobile catalog/Tài khoản) và [PR #597](https://github.com/hangndat/ticket-solution/pull/597) (ví owner) merge vào `main`; Issue [#580](https://github.com/hangndat/ticket-solution/issues/580) đã đóng. Các gap và task trong [ROADMAP.md](ROADMAP.md) là snapshot lúc lập kế hoạch, không phải trạng thái triển khai live. Lấy tiến độ từ [Project #3](https://github.com/users/hangndat/projects/3) và evidence trên PR/SHA; việc merge không tự chứng minh toàn bộ AC, UAT iPhone vật lý hoặc pilot ready.
Run: `run_526c9a272efd`. Nguồn quyết định: user ngày 20/10/2026.

## Quyết định đã chốt

- Trang Sự kiện hiển thị các sự kiện công khai đã xuất bản của toàn platform, không phụ thuộc tenant slug trong env. Không được lộ bản nháp, private event hoặc dữ liệu tenant nội bộ.
- App luôn gọi API production `https://api.vemoki.com`; không chuyển server theo env hay fallback local/demo. Unit/integration test vẫn được inject transport, không thay runtime app.
- Thiết kế lại Tài khoản theo công việc người dùng; bỏ demo/debug, jargon cấu hình và CTA trùng.
- Nghiên cứu lại thời điểm xin quyền thông báo, trạng thái quyền hệ điều hành, đăng ký thiết bị và khả năng gửi thực tế; không dùng toggle giả trạng thái iOS.
- Giữ quyết định navigation gần nhất: nhân viên `Nhập tay · Scan · Lịch sử`, khách ẩn `Vé của tôi` khi chưa có quyền truy cập ví; đăng nhập tại Tài khoản và auth gate theo tác vụ.
- Yêu cầu một mã tự nhận diện tổ chức/sự kiện vẫn được bảo toàn; đánh giá là workstream riêng, không tự triển khai migration dữ liệu production.

## Ownership và artifact

| Vai trò | Artifact |
| --- | --- |
| BA — Kazu | [BA-RESEARCH.md](BA-RESEARCH.md) |
| PD — Liv | [PD-HANDOFF.md](PD-HANDOFF.md), prototype review nếu phù hợp |
| Architect — Dexter | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Planner — Dexter | [ROADMAP.md](ROADMAP.md) |
| iOS hiện tại — Zico | [IOS-AUDIT.md](IOS-AUDIT.md) |
| Coordinator | index, quyết định, tổng hợp và tracking |

## Phạm vi và bằng chứng

Gói này ghi quyết định và handoff của pha nghiên cứu 20/10. Giới hạn “chưa coding” và mô tả working tree bẩn trong các bản audit/roadmap là bối cảnh lịch sử, không phải gate mới cho các PR đã merge. Không suy ra quyền deploy production, mutate DB hoặc store submit từ tài liệu này; không dùng EAS Cloud Build. UAT iPhone thật cho acceptance; screenshot/API/unit test không thay bằng chứng thao tác đầy đủ.

Bản cũ chỉ dùng lịch sử: [archive/](archive/). Gói hiện tại thắng các chỉ dẫn cũ yêu cầu tenant slug hoặc catalog riêng MFest. Không tự đổi fixture thành dữ liệu thật bằng cách bỏ nhãn trong DB.

## Tổng hợp để review

- **Tài khoản:** ba nhóm Bạn / Thông báo / Quyền riêng tư & dữ liệu; đăng xuất ở cuối, xóa tài khoản qua màn riêng có xác nhận. Bỏ thông tin phiên/token/xác minh kỹ thuật, làm mới hồ sơ và CTA trùng. [Prototype Tài khoản ban đầu](prototype.html); [mockup đầy đủ](full-prototype.html) phản ánh các bổ sung sau review.
- **Thông báo:** không xin quyền lúc mở app; người dùng chủ động bật trong Tài khoản hoặc nhận lời mời có thể bỏ qua sau vé đầu tiên. Đã từ chối thì mở Cài đặt; quyền gửi yên lặng không được mô tả như quyền đầy đủ. Lỗi đăng ký máy chủ không đồng nghĩa mất quyền iOS; đăng ký thành công không chứng minh tin đã tới. Chi tiết UI theo PD-HANDOFF, bốn lớp kỹ thuật trong BA chỉ dùng chẩn đoán nội bộ.
- **Sự kiện:** cần API catalog công khai toàn platform; đề xuất GET /v1/public/events. Không lấy danh sách tenant từng thấy trên máy làm đại diện toàn platform. Ví cũng cần tổng hợp vé theo chủ sở hữu để không bỏ sót vé từ tenant khác.
- **API:** hằng production trên mọi runtime app, kể cả Debug/Metro; bỏ qua cấu hình env cũ thay vì khiến app không tải được. Test dùng transport inject riêng.
- **Thực thi:** backend chốt contract trước consumer; một worker iOS xử lý tuần tự cùng slice, bảo toàn dirty tree. Reviewer độc lập trên exact SHA và UAT iPhone thật trước acceptance.

BA, PD, Architect, planner và iOS đã bàn giao; coordinator đã đối chiếu và hợp nhất. User đã duyệt mockup + roadmap (tiếp nối session PD/Codex `web-prototype.html` / `WEB-HANDOFF.md`). Evidence triển khai đã merge nằm trên các PR nêu ở đầu tài liệu; gói kế hoạch này không xác nhận deploy hoặc UAT acceptance cho implementation.

## Mockup đầy đủ

[full-prototype.html](full-prototype.html): khách, người dùng đã đăng nhập, nhân viên; Sự kiện toàn platform, đổi mã/auth gate, ví/QR, Tài khoản, trạng thái thông báo, xóa tài khoản, Scan/Nhập tay/Lịch sử. Dữ liệu minh họa, không gọi API.

Bổ sung review: chính sách trong WebView, camera có vạch quét và Reduce Motion; lịch sử hiện tại chỉ 12 lượt trên máy, chưa paging. Mockup đã có trạng thái tải thêm/lỗi/hết dữ liệu; implementation phải mở rộng lưu trữ thực, giữ nhãn phạm vi thiết bị. Xem PD-HANDOFF phần bổ sung.

## Bản web bổ sung

[web-prototype.html](web-prototype.html) · [WEB-HANDOFF.md](WEB-HANDOFF.md). Desktop và mobile web cho khách/người dùng, nhân viên cổng và quản trị tổ chức. Yêu cầu review web là bối cảnh của bản handoff ngày 20/10; tiến độ triển khai sau đó theo Project #3 và các PR tương ứng.
