# PRD — Vemoki

> **D11 đã được user duyệt triển khai 18/10/2026:** phạm vi và wave theo [gói review D11](./plans/D11-REVIEW-PACKAGE.md). Giữ các non-goals và gate production/store; approval không chứng minh pilot ready.

> **Cập nhật phạm vi 24/10/2026 — O23:** user quyết định bỏ Web Gate. Gate scan, nhập tay và xác nhận vào cổng chỉ trên iOS Staff; Portal chỉ đọc báo cáo theo quyền. Các dòng mô tả Web Gate bên dưới là baseline lịch sử, không còn là đích triển khai. Xem [Decision Log O23](./DECISION-LOG.md#o23--gate-chỉ-trên-ios-staff-chốt-hướng-thiết-kế-vemoki-24102026). Migration `/gate` cần Task/contract và nghiệm thu riêng; quyết định này không chứng minh mọi link cũ đã sạch.

Phiên bản: 0.4 — Draft để review (MVP mở rộng O10)
Ngày: 2026-10-17
Nguồn: yêu cầu sản phẩm trong trao đổi; quyết định mở rộng MVP 2026-10-17.
Tên sản phẩm: **Vemoki**. Domain platform: `vemoki.com`.
Thiết kế kỹ thuật: [Technical Design v0.1](./TECHNICAL-DESIGN.md) — các quyết định đề xuất và test scenarios được ghi riêng, chưa thay thế giả định sản phẩm.
Phạm vi đợt: [ROADMAP](./ROADMAP.md) D0–D10; quyết định: [DECISION-LOG](./DECISION-LOG.md) O10.

> **Bổ sung định hướng ngày 18/10/2026 (O11):** user yêu cầu mở rộng MVP với trọng tâm UX/UI cho vận hành production. D11 nghiên cứu nghiệp vụ (BA), thiết kế trải nghiệm/giao diện (PD) và roadmap theo ownership; [kế hoạch D11](./plans/D11-UX-PRODUCTION-PLAN.md) là bản đề xuất để review trước feature coding. Phạm vi chức năng D0–D10 bên dưới là baseline; tính năng đề xuất D11+ chưa tự trở thành yêu cầu được duyệt. Các phạm vi hủy và chính sách iOS local build vẫn giữ nguyên.

## 1. Mục tiêu

Xây dựng platform multi-tenant để doanh nghiệp và agency tự thiết lập sự kiện, phân phối vé, phục vụ người tham dự và kiểm soát vào cổng. Sản phẩm có web và ứng dụng native iOS phân phối qua Apple App Store. MFest là sự kiện pilot; sản phẩm không chứa tích hợp hoặc nghiệp vụ phụ thuộc TikTok.

Một tenant đại diện một tổ chức. Một tổ chức có nhiều event, nhiều nhân sự và nhận diện thương hiệu riêng. Các tenant dùng chung nền tảng nhưng dữ liệu, quyền và tài nguyên được kiểm soát độc lập.

Không bàn ngân sách hoặc giá dịch vụ trong PRD này.

## 2. Những gì đã chốt và giả định

### Đã chốt

- Phát triển theo mô hình multi-tenant, tùy chỉnh cho từng công ty và event.
- Có website và app iOS; chuẩn bị metadata / local signed archive để lên Apple App Store (D10). **Submit store** chỉ khi task riêng ủy quyền. Android native **hủy khỏi kế hoạch MVP** (ngoài phạm vi có chủ đích) — khách Android dùng web responsive.
- Giữ bài toán đổi mã, cấp QR, gửi vé, quản trị và check-in từ tài liệu gốc.
- Không tích hợp TikTok.
- Không bao giờ dùng Expo/EAS Cloud Build. Native iOS build chạy local bằng Xcode/xcodebuild hoặc fastlane trên Mac/runner macOS tự quản lý; không fallback lên Expo cloud.
- Thương hiệu platform là **Vemoki**, domain `vemoki.com`. App iOS dùng tên hiển thị Vemoki; bundle ID giữ `com.hangndat.ticket`.
- **MVP mở rộng (2026-10-17, O10):** ngoài D0–D6 còn D7 Offline Gate multi-device, D8 White-label, D9 Demo seed + UX/media, D10 App Store metadata. **Hủy khỏi MVP:** Android native; payment/refund/chuyển nhượng; seat map; Apple/Google Wallet.

### Giả định thiết kế, cần xác nhận

- Baseline: một app chung của platform, chế độ khách / nhân viên theo quyền; **D8** bổ sung white-label qua cấu hình (không fork code per-tenant). Chi tiết chốt trong đợt D8.
- Khách có thể nhận và sử dụng vé bằng web/email, không bắt buộc cài app.
- Bản đầu tập trung vé miễn phí qua mã và khách mời import; **không** bán vé / thanh toán / refund / chuyển nhượng trong MVP.
- Check-in: online reserve/confirm là nền; **D7** mở rộng offline Gate multi-device theo design đợt (không phá invariant chống trùng đã chốt). App vẫn xem vé đã lưu khi offline.
- Một tenant sở hữu event. Agency quản lý nhiều công ty bằng membership trong nhiều tenant; chưa có mô hình đồng sở hữu event.

## 3. Người dùng và công việc cần hoàn thành

| Persona           | Công việc chính                                | Kết quả mong muốn                                |
| ----------------- | ---------------------------------------------- | ------------------------------------------------ |
| Platform Operator | Tạo/quản lý tenant, hạn mức, hỗ trợ vận hành   | Nhiều khách sử dụng đồng thời, không lẫn dữ liệu |
| Tenant Owner      | Quản lý công ty, thành viên, nhận diện         | Kiểm soát event và quyền nội bộ                  |
| Event Manager     | Tạo event, loại vé, nguồn phát, quota, publish | Tự chạy sự kiện trong phạm vi cấu hình           |
| CS                | Tìm yêu cầu/vé, xử lý lỗi, gửi lại email       | Hỗ trợ khách mà không sửa cấu hình hệ thống      |
| Supervisor        | Giám sát cổng, xử lý ngoại lệ                  | Giải quyết sự cố có lưu dấu vết                  |
| Scanner           | Quét và xác nhận check-in                      | Thao tác nhanh, kết quả rõ, không vào trùng      |
| Attendee          | Nhận vé, xem QR, xem thông tin event           | Dễ lấy vé và vào cổng trên web hoặc app          |

## 4. Phạm vi và nguyên tắc

### Release đầu / MVP mở rộng (bắt buộc)

Multi-tenant; membership/RBAC; event; branding theo cấu hình; nguồn mã; loại vé; quota; đổi vé; import khách mời; duyệt nếu cần; QR; email; ví vé trên app; push thông báo giao dịch; check-in trên app và web dự phòng; CS; dashboard; audit; hardening/UAT (D5); UX/UI (D6); **offline Gate multi-device (D7)**; **white-label cấu hình (D8)**; **demo seed + UX/media còn lại (D9)**; **chuẩn bị metadata App Store + local signed archive (D10)** — không tự submit store.

Mỗi đợt D0–D10 khi đóng: headless UAT + local iOS build + deploy prod (nếu ủy quyền) + artifact evidence + cập nhật GitHub Project — xem [ROADMAP §4.1](./ROADMAP.md).

### Ngoài phạm vi có chủ đích (không làm trong MVP)

- **Android native** / Google Play — khách Android dùng web responsive; camera web theo ma trận trình duyệt được kiểm thử.
- **Bán vé và thanh toán, refund; chuyển nhượng vé.**
- **Seat map.**
- **Apple Wallet / Google Wallet.**

### Sau MVP (tầm nhìn dài hạn — chưa lên lịch)

Workflow builder tổng quát; marketplace template; SSO doanh nghiệp; hệ thống billing tự động; tên miền và email sender riêng cho tenant (bổ sung O07). Không liệt kê Android/payment/seat/Wallet như backlog MVP.

Các mục «ngoài phạm vi» và «sau MVP» chưa phải cam kết release. Thay đổi white-label / offline Gate chi tiết phải cập nhật tiêu chí nghiệm thu đợt tương ứng trước khi triển khai.

### Nguyên tắc

- Quy tắc nghiệp vụ dùng chung giữa web và app, được backend thực thi.
- Tùy chỉnh qua cấu hình có schema và phiên bản; không fork code theo tenant.
- Loại vé biểu diễn quyền lợi; nguồn phát hành biểu diễn kênh phân phối. Hai khái niệm độc lập.
- Mọi kết quả quan trọng có trạng thái rõ và khả năng truy vết.
- Thao tác thử lại không được tạo thêm vé hoặc check-in lần hai.

## 5. Ma trận module theo nền tảng

Ký hiệu: Có = thuộc release đầu; — = không thuộc giao diện đó.

| Module                           | Web khách | Web quản trị   | App khách | App nhân viên      |
| -------------------------------- | --------- | -------------- | --------- | ------------------ |
| Thông tin event, FAQ, điều khoản | Có        | Biên tập       | Có        | Xem                |
| Đổi mã, xem kết quả yêu cầu      | Có        | Hỗ trợ         | Có        | —                  |
| Xem vé/QR, gửi lại email         | Có        | Hỗ trợ         | Có        | Tra cứu theo quyền |
| Ví vé, vé đã lưu offline         | —         | —              | Có        | —                  |
| Push giao dịch/nhắc sự kiện      | —         | Soạn lịch nhắc | Có        | Thông báo vận hành |
| Công ty, thành viên, phân quyền  | —         | Có             | —         | —                  |
| Event, branding, template        | —         | Có             | —         | —                  |
| Mã, quota, import/export, duyệt  | —         | Có             | —         | —                  |
| Scan và xác nhận vào cổng        | —         | Có, màn Gate   | —         | Có                 |
| Dashboard                        | —         | Đầy đủ         | —         | Tóm tắt theo quyền |
| Xử lý ngoại lệ                   | —         | Supervisor     | —         | Supervisor         |
| Quản trị platform                | —         | Khu vực riêng  | —         | —                  |

App là trải nghiệm native có camera, ví vé, lưu vé và push; không chỉ đóng website trong WebView. App có thể chuyển chế độ khách/nhân viên nếu tài khoản có quyền; chuyển chế độ không tự cấp quyền mới.

## 6. Các module và yêu cầu chức năng

### M01 — Tenant và cách ly dữ liệu

- Platform Operator tạo, kích hoạt, tạm ngưng tenant và đặt hạn mức.
- Tenant có slug duy nhất, tên, logo, contact, múi giờ mặc định và cấu hình thương hiệu.
- Người dùng chỉ xem tenant mình tham gia; mọi màn hình vận hành hiển thị rõ tenant/event đang chọn.
- Khi tenant bị ngưng: ngừng thao tác quản trị/phát vé theo chính sách; việc tiếp tục hiển thị vé và check-in phải có chính sách vận hành rõ, không tự vô hiệu vé đã phát ngoài ý muốn.
- API, export, file, cache, worker, báo cáo và push đều phải có tenant context được xác minh.

Nghiệm thu: dùng ID của tenant khác trong API, URL, job hoặc file request không lấy/sửa được dữ liệu; có kiểm thử truy cập chéo trên mọi nhóm tài nguyên.

### M02 — Identity và quyền

- Khách xác minh email qua OTP hoặc magic link; mã có hạn dùng và giới hạn thử/gửi.
- Có thể bắt đầu đổi mã trước, nhưng phải xác minh email trước khi cấp vé; yêu cầu chưa xác minh không giữ quota.
- Nhân viên đăng nhập bằng tài khoản được mời; admin dùng MFA. Provider và phương thức đăng nhập nhân viên chốt trong thiết kế kỹ thuật.
- **Web, bổ sung O24 (25/10/2026):** tài khoản có membership nhân viên hợp lệ chuyển thẳng Portal khi đăng nhập web khách, kể cả tài khoản đồng thời sở hữu vé; không tạo/tiếp tục phiên attendee web. Ticket owner chỉ có role `Attendee` vẫn dùng web khách. O02 chuyển chế độ trong app iOS giữ nguyên.
- Discovery quyền không xác minh được phải có lỗi/thử lại an toàn, không hạ thành attendee; header không giữ identity/quyền của phiên trước khi đổi hoặc xác minh lại phiên. Chi tiết audience/cookie/BFF: [O24](./DECISION-LOG.md#o24--nhân-viên-đăng-nhập-web-chuyển-thẳng-portal-25102026).
- Membership tenant và phân công event là hai phạm vi khác nhau; quyền mặc định từ chối.
- Owner quản lý thành viên; Event Manager chỉ quản lý event được giao; CS không thay quota; Scanner không export hoặc sửa vé.
- Thu hồi membership phải chặn thao tác mới kể cả thiết bị còn phiên đăng nhập.
- Logout trên thiết bị dùng chung xóa dữ liệu vé/khách và token cục bộ.
- Người dùng app có luồng yêu cầu xóa tài khoản; dữ liệu giữ lại để vận hành/audit phải có chính sách cụ thể.

Nghiệm thu: UI ẩn chức năng thiếu quyền và backend vẫn từ chối khi gọi trực tiếp; thu hồi quyền có hiệu lực với request tiếp theo.

### M03 — Event lifecycle

- Tạo, sửa, nhân bản event; bản nhân bản không mang theo mã, khách, vé, check-in hoặc nhân sự nếu chưa chủ động chọn cấu hình được phép.
- Trường: tên, slug, thời gian, timezone, địa điểm, nội dung, contact, trạng thái hiển thị.
- Trạng thái nội dung: DRAFT → PUBLISHED → ARCHIVED. Hủy event là trạng thái nghiệp vụ riêng có thông báo cho khách.
- Cửa sổ đổi vé và cửa sổ check-in cấu hình độc lập; publish không đồng nghĩa đang mở đổi vé.
- Event private truy cập bằng link, không xuất hiện trong danh sách công khai; private không được coi là cơ chế bảo mật dữ liệu.
- Đóng đổi vé không ngăn sử dụng vé đã cấp.
- Thay đổi thời gian/địa điểm sau khi phát vé cần xác nhận, audit và tùy chọn gửi thông báo.

Nghiệm thu: event chưa publish không xuất hiện công khai; các mốc thời gian áp dụng đúng timezone và kiểm tra tại backend.

### M04 — Branding và nội dung

- Brand của event kế thừa tenant và cho override logo, màu, banner, contact.
- Template section cố định cho hero, thông tin, đổi vé, hướng dẫn, FAQ và điều khoản; cấu hình ẩn/hiện và thứ tự được hỗ trợ.
- Draft, preview và publish nguyên tử; có lịch sử và rollback cấu hình tương thích.
- Web và app dùng cùng dữ liệu/nội dung và token thương hiệu trong bộ component tương ứng.
- Release đầu hỗ trợ subdomain tenant và đường dẫn event. Tên/icon của app trên store là thương hiệu platform theo giả định app chung.
- Không chấp nhận JavaScript/CSS tùy ý. Nội dung rich text và upload được kiểm tra trước hiển thị.
- Lưu phiên bản điều khoản người dùng đã đồng ý.

Nghiệm thu: sửa draft không đổi nội dung đang chạy; publish cập nhật đúng event; cache không đưa brand hoặc nội dung tenant khác vào trang.

### M05 — Loại vé, nguồn phát hành và quota

- Event có nhiều loại vé, mỗi loại có tên, quyền lợi, thời gian hợp lệ và quota.
- Nguồn phát hành có tên, quota và các loại vé được cấp: VIP/Brand/Fandom chỉ là ví dụ dữ liệu.
- Mỗi mã gắn event, nguồn, loại vé, hạn dùng và trạng thái; release đầu một mã cấp một vé.
- Quota tổng event, loại vé và nguồn phải cùng cho phép trước khi cấp vé; quota không áp dụng có thể để không giới hạn nhưng phải cấu hình rõ.
- Giới hạn vé/email cấu hình theo event, không mặc định cố định hai vé cho mọi khách.
- Không giảm quota xuống thấp hơn số đã cấp cộng số đang giữ hợp lệ.
- Quy tắc nguồn/loại vé đã được dùng không được sửa khiến vé cũ đổi quyền lợi ngầm.

Nghiệm thu: nhiều request tranh suất cuối không vượt bất kỳ quota nào; quota được hoàn/giữ đúng theo chính sách hủy, không tính bằng cache làm nguồn dữ liệu chính.

### M06 — Import mã và khách mời

- Import CSV với template, mapping trường, xem trước và báo lỗi theo dòng.
- Phát hiện mã trùng trong cùng event; không ghi đè mã đã dùng. Cùng chuỗi mã ở event khác được phân biệt bằng event context.
- Job import có idempotency và báo cáo số thành công/thất bại; dữ liệu lỗi có file tải về theo quyền.
- Import khách mời tạo invitation; thao tác cấp vé riêng và có preview quota cần dùng.
- Mời khách qua link một lần, có hạn dùng và xác minh email; import không tự tạo tài khoản truy cập cho khách.

Nghiệm thu: retry cùng job không thêm dữ liệu trùng; file quá hạn hoặc tenant khác không tải được báo cáo import.

### M07 — Redemption và duyệt

- Khách chọn event, nhập mã, xác minh email, hoàn thành trường bắt buộc và đồng ý điều khoản.
- Mẫu đăng ký hỗ trợ text, email, phone, select, checkbox; không hỗ trợ công thức hoặc logic tùy ý trong bản đầu.
- Hai chế độ nguồn: tự động duyệt hoặc chờ quản trị duyệt.
- Yêu cầu chờ duyệt chưa chiếm quota; hiển thị rõ chưa đảm bảo suất. Khi duyệt phải kiểm tra quota lại. Event Manager có thể từ chối kèm lý do phù hợp để hiển thị.
- Mã được gắn với một yêu cầu pending tại một thời điểm; yêu cầu từ chối/hết hạn giải phóng mã theo chính sách nguồn. Một mã đã cấp vé không tự tái dùng khi hủy vé.
- Cấp vé qua transaction gồm kiểm tra mã, giới hạn, quota, tạo vé và ghi outbox gửi thông báo.
- Idempotency scope theo event và thao tác; retry trả cùng kết quả đã tạo.
- Ưu tiên suất theo thứ tự transaction cấp vé thành công; không cam kết FIFO theo lúc mở form hoặc request đến.
- Phản hồi phân biệt: sai mã, hết hạn, mã đã dùng, pending, hết quota, đóng cổng và lỗi có thể thử lại. Không lộ email/người sở hữu vé cho người chưa xác thực.

Nghiệm thu: hai tài khoản dùng một mã chỉ một yêu cầu được giữ/cấp hợp lệ; retry sau timeout không tạo thêm vé; lỗi gửi email không rollback vé.

### M08 — Ticket và ví vé

- Vé có ID nội bộ, mã hiển thị khó đoán, event, loại vé, chủ sở hữu và nguồn.
- QR chứa token ký có phiên bản và ngữ cảnh event; không nhúng email/PII. Backend kiểm tra trạng thái hiện tại kể cả chữ ký hợp lệ.
- Vé hiển thị tên event, người tham dự, loại vé, thời gian, địa điểm, QR, hướng dẫn và trạng thái.
- Web truy cập qua phiên đã xác thực hoặc link đổi lấy phiên có hạn; không tra cứu thông tin cá nhân chỉ bằng email và mã vé.
- App có My Tickets, chi tiết event và lưu vé đã lấy về để mở khi không có mạng. Hiển thị thời điểm đồng bộ và cảnh báo trạng thái có thể đã thay đổi.
- Thu hồi/hủy vé được audit. Phát hành lại xoay token và vô hiệu QR cũ.
- Bản đầu không chuyển nhượng và không tự sửa email sở hữu vé sau phát hành; CS dùng quy trình có quyền và lưu log nếu cần sửa theo policy được duyệt.

Nghiệm thu: QR bị thu hồi, sai event, giả chữ ký hoặc đã dùng bị từ chối; lưu offline không đồng nghĩa được xác nhận vào cổng offline.

### M09 — Email và push

- Email cấp vé có QR, link xem vé, hướng dẫn và contact event.
- Template có biến được cho phép, preview và kiểm tra trước publish; fallback về template mặc định.
- Gửi qua queue với retry giới hạn, backoff, log và xử lý lỗi cuối; có chống gửi trùng theo sự kiện thông báo.
- Gửi lại có cooldown, hạn mức tenant và giới hạn người dùng; không tạo vé hoặc token mới chỉ vì resend.
- App xin quyền push trong ngữ cảnh phù hợp; từ chối push vẫn dùng được vé.
- Push cho cấp vé, thay đổi event và lịch nhắc; payload tối thiểu, mở đúng event sau kiểm tra quyền. Không gửi quảng cáo trong release đầu.
- Theo dõi accepted/delivered/bounced khi nhà cung cấp hỗ trợ; không gọi trạng thái accepted là khách đã nhận hoặc đã đọc.

Nghiệm thu: tắt push hoặc email lỗi không chặn xem vé; token thiết bị bị thu hồi không nhận nội dung của tài khoản đăng nhập trước.

### M10 — Gate và check-in

- Nhân viên chọn tenant/event được phân công, cổng và phiên vận hành; luôn hiển thị context đang hoạt động.
- Camera scan trên app; web Gate hỗ trợ camera trên danh sách trình duyệt đã kiểm thử. Có nhập mã thủ công theo quyền.
- Quy trình: scan → backend validate và giữ ngắn hạn → hiển thị kết quả → xác nhận phát vòng/cho vào → commit check-in.
- Reservation TTL mặc định đề xuất 30 giây, cấu hình hệ thống; chỉ phiên giữ hợp lệ được xác nhận. Hủy/timeout giải phóng hold. Reservation dùng thời gian server.
- Nếu vé đang được nhân viên khác giữ: trả kết quả riêng, không báo đã check-in.
- Xác nhận đồng thời chỉ có một thành công; retry cùng operation trả kết quả cũ.
- Chế độ đầu tiên: một lượt vào cho toàn event, không re-entry. Check-in theo phiên/ngày và nhiều checkpoint là giai đoạn sau.
- Màn kết quả dùng chữ, icon, màu và phản hồi rung/âm tùy cài đặt; không chỉ dựa vào màu.
- Khi mất mạng không hiển thị thành công giả. Khi timeout xác nhận, tra trạng thái operation trước khi yêu cầu làm lại.
- Supervisor được hoàn tác check-in nhầm theo policy, bắt buộc lý do; giữ lịch sử gốc. Không cho Scanner tự override vé giả/sai event/thu hồi.
- Log gồm staff, gate, device/session, timestamp, kết quả và operation ID.

Nghiệm thu: hai cổng scan một vé không thể cùng commit; app restart sau timeout vẫn đối soát được kết quả; logout/thu hồi quyền chặn xác nhận tiếp.

### M11 — CS, báo cáo và vận hành event

- Tìm theo mã, email, tên hoặc ID trong tenant/event được cấp quyền; che PII với role không cần xem đầy đủ.
- Hiển thị timeline yêu cầu, vé, gửi email, check-in và thao tác hỗ trợ.
- Dashboard: mã khả dụng, pending, vé đã cấp/hủy, quota còn lại, email lỗi, check-in thành công, từ chối theo lý do/cổng.
- Báo cáo có định nghĩa chỉ số và thời gian cập nhật; dashboard gần realtime mục tiêu trễ không quá 10 giây trong tải pilot.
- Export chạy nền, có filter, audit, link tải có hạn và bảo vệ CSV formula injection.
- Dữ liệu tổng hợp không được tiết lộ dữ liệu tenant khác.

Nghiệm thu: tổng vé/quota/check-in đối soát được với nguồn giao dịch; export không vượt phạm vi quyền.

### M12 — Platform Operations

- Quản lý tenant, hạn mức event/nhân sự/email/import và feature flag.
- Xem tình trạng API, queue, email và lỗi theo tenant mà không mặc định mở PII.
- Truy cập hỗ trợ vào tenant phải có lý do, thời hạn, quyền cụ thể và audit; không impersonate âm thầm.
- Hạn mức tenant không được làm mất dữ liệu giao dịch đã xác nhận; gửi email chậm có trạng thái rõ.

## 7. Luồng end-to-end cần demo

1. Operator tạo hai tenant độc lập; Owner mời nhân sự.
2. Manager tạo event từ template, chỉnh brand, tạo loại vé/nguồn/quota và import mã.
3. Preview, publish và mở đổi vé theo lịch.
4. Khách đổi vé trên web; xác minh email; nhận QR qua email.
5. Cùng khách đăng nhập app, thấy đúng vé đã nhận trên web.
6. Khách lưu vé và mở QR khi offline.
7. Staff quét bằng app, xác nhận và thấy dashboard cập nhật trên web.
8. Staff khác thử lại cùng QR, thấy đã check-in; Supervisor xử lý tình huống nhầm có lý do.
9. CS gửi lại email, xem timeline; Manager export đối soát.
10. Chạy cùng luồng cho tenant thứ hai với brand khác, không lẫn dữ liệu.

## 8. Mô hình dữ liệu khái niệm

- User: identity toàn platform; không đồng nghĩa được truy cập tất cả tenant.
- Tenant, Membership, EventAssignment: tổ chức và phạm vi quyền.
- Event, EventConfigVersion, BrandConfig, TermsVersion: cấu hình có phiên bản.
- TicketType, IssuanceSource, QuotaBucket: quyền lợi, kênh phát và quota.
- RedemptionCode, Invitation, RedemptionRequest: đầu vào và yêu cầu cấp vé.
- Attendee: thông tin người tham dự trong tenant/event; không tự chia sẻ hồ sơ giữa doanh nghiệp.
- Ticket, TicketCredential: vé và token có thể xoay/thu hồi.
- Gate, StaffSession, CheckInReservation, CheckInOperation, CheckIn: vận hành cổng.
- Notification, DeliveryAttempt, DeviceRegistration: email/push và lịch sử gửi.
- ImportJob, ExportJob, AuditLog, OutboxEvent: tác vụ và truy vết.

Mọi entity thuộc tenant phải có tenant_id; entity thuộc event có event_id và ràng buộc đảm bảo event cũng thuộc cùng tenant. Không tin tenant_id hoặc user_id do client tự khai báo.

Trạng thái tách biệt:

- RedemptionRequest: PENDING_VERIFICATION → PENDING_REVIEW hoặc PROCESSING → ISSUED / REJECTED / EXPIRED. Lỗi tạm có thể retry, không đánh đồng với bị từ chối.
- Ticket: ACTIVE / REVOKED / CANCELLED. Check-in là bản ghi riêng, không trộn với trạng thái email.
- Notification: QUEUED / ACCEPTED / DELIVERED / BOUNCED / FAILED tùy khả năng provider.
- Reservation: HELD / CONFIRMED / RELEASED / EXPIRED.

## 9. Yêu cầu phi chức năng

Các chỉ tiêu tải dưới đây là baseline đề xuất để thiết kế và test, chưa phải nhu cầu đã được người dùng xác nhận.

| Nhóm          | Tiêu chí release                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Pilot tải     | 2 event đồng thời, 20.000 vé/event, 50 thiết bị scan/event                                                                                      |
| API nghiệp vụ | p95 không quá 1 giây ở 50 lượt cấp vé/giây và 20 lượt xác nhận check-in/giây tổng, loại thời gian provider ngoài; phải xác định môi trường test |
| Tính đúng     | Không vượt quota, không cấp trùng mã, không xác nhận trùng vé trong concurrency test                                                            |
| Khả dụng      | Mục tiêu 99,9%/tháng cho API; theo dõi riêng cửa sổ event, có runbook và cảnh báo                                                               |
| Khôi phục     | Mục tiêu RPO ≤ 15 phút, RTO ≤ 2 giờ; phải diễn tập restore trước pilot                                                                          |
| Thiết bị      | Web responsive; chốt ma trận iOS/browser trước UAT, thử camera trên thiết bị thật                                                               |
| Accessibility | Luồng chính hỗ trợ screen reader, tăng cỡ chữ, focus và tương phản; không dùng màu làm tín hiệu duy nhất                                        |
| Bảo mật       | TLS, secrets ngoài source, rate limit, MFA admin, kiểm tra file, log không chứa OTP/QR token/PII thô                                            |
| Dữ liệu       | Có retention, xóa/anonymize, thời hạn file export và chính sách backup; giá trị cụ thể cần chốt                                                 |
| Quan sát      | Request/operation ID, metric theo tenant/event, cảnh báo queue chậm, email lỗi và scan lỗi tăng                                                 |
| Tương thích   | API có phiên bản, hỗ trợ mobile release đang lưu hành; migration không làm app cũ hỏng đột ngột                                                 |

SLO không thay thế việc test thực tế đường truyền và camera tại địa điểm tổ chức.

## 10. Tech stack đề xuất — quyết định kỹ thuật ban đầu

Đây là đề xuất để triển khai PRD, không khóa phiên bản thư viện trước bước technical design.

| Lớp                   | Đề xuất                                                            | Vai trò                                                                         |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Web                   | Next.js + React + TypeScript                                       | Portal public, tenant admin, platform admin, web Gate                           |
| Mobile                | React Native + Expo + TypeScript + Expo Router                     | App native iOS, ví vé, camera, push, deep link                                  |
| Backend               | NestJS + TypeScript, REST + OpenAPI                                | API chung, RBAC, tenant context, nghiệp vụ và tích hợp                          |
| Kiến trúc backend     | Modular monolith; worker chạy riêng                                | Dễ giữ transaction nhất quán, triển khai độc lập worker; chưa cần microservices |
| Database              | PostgreSQL                                                         | Nguồn dữ liệu chuẩn cho quota, vé, check-in, cấu hình                           |
| Tenant isolation      | Shared schema + tenant keys + PostgreSQL RLS                       | Backend authz là lớp chính, RLS là lớp bảo vệ bổ sung                           |
| ORM/migration         | Prisma, SQL migration khi cần                                      | Schema, truy vấn; transaction và tenant context phải được review cụ thể         |
| Queue/cache           | Redis + BullMQ                                                     | Email, import/export, rate limit; không làm nguồn chuẩn cho quota/check-in      |
| Tính nhất quán tác vụ | Transactional outbox trong PostgreSQL                              | Không mất tác vụ gửi thông báo sau khi cấp vé thành công                        |
| File                  | MinIO (S3-compatible) private + signed URLs                        | Asset, QR render nếu cần, import/export; self-host                              |
| Email                 | SMTP adapter (Mailpit dev; Postal/Postfix trên VPS)               | Gửi và trạng thái; **không** SaaS transactional                                 |
| Push                  | expo-notifications UI + **APNs trực tiếp** từ worker               | Device token DB; **không** Expo Push Service                                    |
| Identity              | Keycloak self-host (OIDC)                                          | Auth Code + PKCE; Nest verify JWKS; **không** Clerk/Auth0                       |
| Mobile local          | SecureStore cho token; local database/cache cho ví vé              | Phân vùng theo tài khoản và dọn khi logout                                      |
| Monorepo              | pnpm workspace + Turborepo                                         | Chia sẻ API types, schema, domain helpers, brand tokens                         |
| Vận hành              | Container API/worker trên VPS; Postgres/Redis self-host; Caddy TLS | Tách staging/production; **không** managed DB/CDN SaaS MVP                      |
| Quan sát              | OpenTelemetry + error tracking                                     | Trace, metric, lỗi web/app/API                                                  |
| Mobile delivery       | Local Xcode/xcodebuild hoặc fastlane; App Store Connect/TestFlight | Build ký số trên Mac/runner macOS tự quản lý; không Expo/EAS Cloud Build        |

Chia sẻ type, validation, API client và token thương hiệu giữa web/app; UI web và native được xây theo trải nghiệm từng nền tảng. Backend là nơi quyết định quyền, quota và trạng thái.

RLS phải sử dụng tenant context trong transaction khi chạy qua connection pool; app role không sở hữu bảng hoặc có BYPASSRLS. Worker và export cũng chịu cùng policy. Redis key và object path có tenant namespace, nhưng namespace không thay thế authorization.

Authentication dùng **Keycloak self-host (OIDC)**; mobile Auth Code + PKCE và SecureStore. Không tự xây giao thức identity. Không dùng IdP SaaS (Clerk/Auth0/…). Ngoại lệ nền tảng: Apple App Store / APNs; DNS registrar user mua.

Tham chiếu kỹ thuật chính thức:

- Next.js App Router: https://nextjs.org/docs/app/getting-started
- Expo local development: https://docs.expo.dev/guides/local-app-development/
- Expo distribution: https://docs.expo.dev/distribution/introduction/
- Apple Push Notification service: https://developer.apple.com/documentation/usernotifications
- Keycloak server: https://www.keycloak.org/documentation
- PostgreSQL row security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

## 11. Phát hành app và vận hành đa nền tảng

- Có development, staging và production environments; test data tách production.
- Xác định chủ sở hữu tài khoản Apple Developer/App Store Connect, signing credentials, iOS bundle ID, store assets và support URL trước phát hành.
- UAT qua TestFlight trên thiết bị thật, gồm camera, deep link, push, offline ví vé và thu hồi session.
- Universal/App Links mở đúng event/vé sau xác thực; chưa cài app vẫn có web fallback. Không cam kết deferred deep link qua lần cài mới trong release đầu.
- Có privacy policy, luồng yêu cầu xóa tài khoản, mô tả quyền camera/notification và tài khoản review với dữ liệu demo.
- Cấu hình brand/nội dung là dữ liệu server; thay đổi native capability đi qua bản build/store mới. OTA chỉ dùng cho cập nhật tương thích runtime sau khi có chiến lược release.
- Backend không buộc nâng cấp app giữa giờ sự kiện trừ tình huống bảo mật nghiêm trọng; có minimum-supported-version policy và thông báo phù hợp.
- Store submission hoàn tất không đồng nghĩa store đã duyệt. Milestone phát hành phải theo dõi riêng submitted/approved/available.

## 12. Tiêu chí release tổng thể

- Hai tenant chạy đồng thời và qua bộ kiểm thử isolation API/file/cache/job/export.
- Một event có thể được thiết lập, preview, publish và vận hành không cần sửa code.
- Web đổi vé và app hiển thị cùng một vé, cùng quy tắc và trạng thái.
- Đạt kiểm thử tranh quota, trùng mã, trùng check-in, retry và recovery sau timeout.
- Không mất vé khi email/push hoặc worker gián đoạn.
- App iOS được test qua TestFlight; release công khai theo dõi trạng thái duyệt thực tế.
- Role tests, backup restore, monitoring, support và incident runbook hoàn tất.
- Pilot MFest chạy bằng cấu hình chung; không tồn tại logic hardcode tên nhóm vé hoặc tenant.

## 13. Chỉ số thành công

- Tỷ lệ người có mã hợp lệ hoàn tất nhận vé; phân biệt lỗi nghiệp vụ và lỗi hệ thống.
- Thời gian từ bắt đầu đổi mã đến nhìn thấy QR; không gộp thời gian chờ duyệt thủ công.
- Thời gian scan đến xác nhận, tỷ lệ retry và lỗi camera/mạng theo thiết bị.
- Số lần cấp vượt quota, cấp trùng hoặc check-in trùng: mục tiêu bằng 0.
- Thời gian tenant tự tạo/publish event và số thao tác cần platform hỗ trợ.
- Tỷ lệ vé mở được trên app/web, email bounce và độ trễ queue.
- Không dùng tỷ lệ cài app làm điều kiện để khách nhận vé thành công.

## 14. Thứ tự triển khai

1. Foundation: identity, tenant isolation, RBAC, audit, event/config version và contract API.
2. Web end-to-end: nguồn mã, quota, redemption, QR, email và CS.
3. Mobile end-to-end: đăng nhập, event, đổi vé, ví vé, deep link, push và offline display.
4. Gate: app scan, reservation/confirm, web fallback, supervisor và dashboard.
5. Hardening: load/concurrency/security test, device UAT, restore drill và phát hành iOS lên App Store.
6. Pilot: vận hành MFest và một tenant demo thứ hai để kiểm chứng tính tổng quát.

Các bước là thứ tự phụ thuộc sản phẩm, chưa phải lịch hoặc cam kết thời gian.

## 15. Quyết định còn mở

| ID  | Câu hỏi                                    | Baseline tạm thời                      | Ảnh hưởng                                               |
| --- | ------------------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| O01 | App chung hay app riêng từng công ty?      | Một app chung có hai chế độ theo quyền | Branding store, release pipeline, identity và deep link |
| O02 | Có cần app riêng cho staff?                | Staff trong app chung                  | UX, quyền và phân phối thiết bị                         |
| O03 | Tải, số tenant/event và số cổng thực tế?   | Theo baseline pilot ở mục 9            | Capacity, SLO và kế hoạch test                          |
| O04 | Form cần dữ liệu và ngôn ngữ nào?          | Tiếng Việt; schema sẵn sàng mở rộng    | Nội dung, email và quyền riêng tư                       |
| O05 | Có cần tái nhập cổng, nhiều ngày/phiên?    | Một vé một lượt toàn event             | Ticket entitlement và check-in model                    |
| O06 | Retention, vị trí lưu dữ liệu, SLA hỗ trợ? | **Đã chốt (MVP)** 18/10/2026 — xem Decision Log O06 | Hạ tầng, vận hành và lifecycle dữ liệu                  |
| O07 | Cần custom domain/sender ngay release đầu? | Subdomain và sender platform           | DNS, xác minh sở hữu và deliverability                  |
| O08 | Tổ chức có cần database riêng?             | Shared database/schema có RLS          | Deployment và isolation tier                            |

PRD đủ để review phạm vi và dựng user flow. Các giả định chưa xác nhận phải được chốt trước khi khóa thiết kế chi tiết liên quan, không được coi là yêu cầu đã được người dùng duyệt.
