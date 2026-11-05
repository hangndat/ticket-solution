# Handoff cho leader tiếp theo — chuẩn bị triển khai UI iOS đã duyệt

**Ngày bàn giao:** 05/11/2026 · **Trạng thái:** đủ nguồn để lập scope/Task, **chưa có implementation hoặc UAT trong lượt bàn giao này**. Owner đã duyệt từng luồng và yêu cầu gom một bản đúng nguồn; [board 45 khung](index.html) đã thay board 25 màn dựng lại sai. [ADR](../../architecture/ADR-MOBILE-WIREFRAMES-2026-11-05.md) ghi quyết định và thứ tự ưu tiên.

## Checkpoint cho leader

| Mục | Giá trị tại lúc lưu |
| --- | --- |
| Worktree | `/Users/admin/SideProject/ticket-solution/main-3` |
| HEAD quan sát | `51bd5a5b77ba6fdeeac011a0982dd6770f7bdac5` |
| Artifact visual | `docs/design/mobile-approved-wireframes-2026-11-05/index.html` |
| SHA-256 visual | `eca0dbc1e391c22521f97e697200877cf9c0d2844f3520c1b1e4e43b3849efcf` |
| Nguồn chi tiết | 15 HTML trong `originals/`, hash trong `MANIFEST.sha256` |
| Phạm vi code dự kiến | `apps/mobile` của owner iOS; không tự chạm Web, Portal, API, token/brand SoT |
| Trạng thái Git | Gói wireframe/ADR được commit local lần đầu tại `f50eb3128d8cbeb80dd1bcae009c805f93be9f55`; chưa push/PR. Working tree vẫn có nhiều thay đổi **khác** ở mobile/web/brand/docs. Tách và bảo toàn chúng; không `reset`, không stage ngoài scope. |
| Orca Run/Task | Chưa tạo cho việc triển khai từ gói này; không suy ID từ phiên thiết kế. |

Leader mới cần đọc [`AGENTS.md`](../../../AGENTS.md), [routing](../../agents/policies/routing.md), [dispatch](../../agents/workflows/dispatch.md), [lifecycle](../../agents/workflows/lifecycle.md), [UI workflow](../../agents/ui-workflow.md), [Project/DoD](../../agents/policies/project.md) và chính sách Git trước khi giao Task/PR. Chỉ một leader giữ quyền điều phối Run; không coi file này là receipt dispatch hay quyền merge/deploy/store.

## Nguồn chuẩn và các xung đột cần giải đúng cách

1. **Nghiệp vụ và quyền:** [PRD](../../PRD.md), [Technical Design](../../TECHNICAL-DESIGN.md), [Decision Log](../../DECISION-LOG.md) — đặc biệt O23, O27–O33. Chúng quyết định auth, quyền, navigation và Gate admission.
2. **Visual iOS mới được duyệt:** HTML trong [`originals/`](originals/) và [board tổng hợp](index.html). Board là ảnh chụp từ bản gốc, không phải thiết kế lại. Bốn delta nút sau lượt duyệt nằm trong [README](README.md#bốn-chỉnh-sửa-nút-sau-lượt-duyệt).
3. **Brand/token:** [Electric Violet](../electric-violet/README.md), quyết định bổ sung ngày 04/11 trong Decision Log, `brand/vemoki/tokens.json`. Không copy giá trị màu từ ảnh tĩnh để tạo token SoT khác.
4. **O30 ↔ ví A+C:** O30 mô tả thẻ vé một hàng, còn owner đã duyệt thẻ vé gần nhất nổi bật. [ADR](../../architecture/ADR-MOBILE-WIREFRAMES-2026-11-05.md) chỉ thay **presentation** của ví; vẫn giữ vé hợp lệ trước, vé đã dùng mờ/watermark, back navigation và các invariant khác.
5. **Tab bar trong ảnh cũ ↔ O28:** một số wireframe có nhãn tab minh họa từ thời điểm trước. **Không chép literal** nếu khác O28: guest = Sự kiện + Đổi mã; verified attendee = Sự kiện + Đổi mã + Vé của tôi; Account mở từ header/root stack. Staff có ba tab theo O28. Giữ privacy native theo O27 và account back theo O29/O30.
6. **Gate chrome trong ảnh cũ ↔ O31/O32:** picker sự kiện chỉ ở header, trạng thái phiên/cổng theo API và dòng trạng thái đã chốt. Green admission chỉ khi backend xác nhận; queued/unknown/offline không cho vào. Nếu ảnh cũ khác copy hoặc vị trí nghiệp vụ này, giữ contract mới hơn và ghi delta trong PR.

## Các phần cần chuẩn bị triển khai

| Nhóm | Màn và trạng thái | Lưu ý chính |
| --- | --- | --- |
| Người tham dự | Khám phá, chi tiết sự kiện, Đổi mã, Ví A+C, chi tiết vé, nhận vé mời | Banner theo sự kiện; QR và mã tay từ credential thật; back từ chi tiết về ví giữ danh sách/vị trí cuộn, tránh tải lại gây layout shift. |
| Tài khoản | Tài khoản, xóa tài khoản, chính sách quyền riêng tư native, lời mời tham gia tổ chức | Không thêm tab Tài khoản; route root stack/back theo O29/O30; không đổi auth/OIDC từ wireframe. |
| Staff Gate | Quét vé, trạng thái quét, nhập tay, lịch sử, tài khoản nhân viên, kiểm tra/thiếu quyền | Không mở preview camera trước quyền/phiên phù hợp; status không tạo “Cho vào” giả. |
| Rỗng/lỗi | Catalog rỗng, ví guest/empty, mã sai, link mời sai, vé/sự kiện không sẵn sàng | Phân biệt dữ liệu rỗng, link vĩnh viễn sai và lỗi mạng có thể retry. |

Số khung = **45**, không phải 45 màn route hoặc 45 Task. Leader kiểm route/component hiện hành bằng CRG + LeanCTX trên đúng worktree/HEAD trước khi lập Task source. Nhân viên iOS đọc `expo-overview` trước code, sau đó chọn `expo-native-ui`/`react-native-best-practices` theo thay đổi; review UI theo `docs/agents/ui-workflow.md`. Không mở công việc Web/Portal hay API chỉ vì ảnh có nội dung giả lập.

## CTA bắt buộc ở bốn trạng thái đã sửa sau duyệt

| Trạng thái | Bố trí cần implement | Điều kiện |
| --- | --- | --- |
| Tài khoản nhân viên | Back ở native header về Gate; không có CTA “Quay lại quét vé” lặp ở đáy. Đăng xuất là hành động nguy hiểm ở cuối nội dung **cuộn được**. | Safe area và chữ dài không cắt nút. |
| Khám phá trống | “Làm mới” là hành động phụ. | Không gọi empty catalog là lỗi mạng. |
| Link mời không hợp lệ | Guest → “Về Sự kiện”; đã xác minh → có thể “Về Vé của tôi”. | Không điều hướng guest vào ví yêu cầu auth. |
| Sự kiện không sẵn sàng | Link sai/không công khai → “Khám phá sự kiện”; “Thử lại” chỉ cho lỗi mạng. | Không retry vô ích trên 404 hoặc unpublished. |

CTA của các màn còn lại giữ theo HTML gốc, trừ khi xung đột với contract mới hơn nêu trên. Mọi footer CTA phải nằm trên safe area/tab bar và vẫn bấm được khi bàn phím mở; phần body dài cuộn riêng. Không tạo action mới như payment, seat map hoặc Apple Wallet từ prototype.

## Đề xuất thứ tự thực hiện và nghiệm thu

1. **Chốt baseline tích hợp:** kiểm trạng thái Git/Issue/Project #3 và ownership của thay đổi đang dirty; xác định base SHA sạch. Pin `index.html` + `MANIFEST.sha256` vào Task Spec. Không copy board 25 màn sai.
2. **Làm một màn đại diện** (gợi ý Ví của tôi) bằng component iOS thật; so ảnh runtime với HTML gốc ở khổ iPhone mục tiêu, kiểm quay về ví giữ danh sách/scroll và không nhảy layout. Sau khi reviewer/owner xác nhận delta, nhân rộng theo các nhóm còn lại; một owner `apps/mobile` cho mỗi slice code.
3. **Chia Task theo hành vi/phụ thuộc thực** trong phạm vi iOS và WIP, không chia 45 Task theo số khung. Task Spec ghi Role ID, employee, Architecture impact, Cost tier, skills, source visual/version/hash, route/state, AC và evidence. Cần đổi shared contract/route thật mới xin architect/coordinator xử lý; mặc định không có architecture change từ ADR này.
4. **Kiểm runtime:** lint/typecheck/test/build scoped; Orca emulator cho màn và trạng thái trong scope, ảnh với build SHA, route, persona, locale VI và viewport. Gate camera/QR cần device evidence nếu AC yêu cầu; simulator/prototype không thay bằng chứng thiết bị thật. Kiểm không có CTA ngoài màn ở kích cỡ nhỏ, khi scroll, bàn phím và tab bar xuất hiện. O33 waive a11y UAT cho MVP/pilot; không báo a11y PASS từ kiểm tĩnh.
5. **Review/DoD:** UI đổi hành vi là nhánh B: reviewer độc lập gộp `dod+ux` (thêm security khi scope thật sự nhạy cảm), exact SHA và findings theo workflow. Coordinator đối chiếu mẫu gốc + bốn CTA delta, CI và evidence trước merge. Approval design ≠ code complete ≠ acceptance complete ≠ pilot ready.

## Giới hạn đã biết

- HTML/ảnh dùng sự kiện và tài khoản minh họa; không làm fixture production, không dùng QR demo để xác nhận vào cổng.
- `index.html` là board ảnh tĩnh; 15 HTML gốc là nguồn để xem bố cục chi tiết. Chưa kiểm tương tác, keyboard, auth, offline hoặc Gate trên app build sau quyết định này.
- Gói [Electric Violet](../electric-violet/README.md) và các thay đổi brand/app đang là thay đổi **riêng, chưa nằm trong commit tài liệu wireframe này**. Checkout chỉ lấy commit này có thể chưa có gói đó hoặc token mới. Leader phải xác minh dependency brand đã tích hợp ở exact SHA trước khi triển khai UI; README Electric Violet theo snapshot cũ cũng không chứng minh runtime hiện tại.
- Chưa giao worker/leader khác và chưa tạo Issue/PR trong lượt này. Gói đã có commit local nêu trên; leader tiếp theo tiếp nhận qua file này rồi chuẩn bị Task theo policy, không coi việc bàn giao là bắt đầu coding.
