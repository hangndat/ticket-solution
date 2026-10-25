# VD11 web — coordinator UAT sau fix 1/2

Source web `6cad86645ae09f7e86fd7a2e0a47ea60c341456d`, report worker `bbbae980`, HEAD lúc kiểm `5dd42ec7` chỉ thêm O24 docs. Production build tại `localhost:3340` đã restart; API/Keycloak local thật, profile attendee `3404127c-616c-413e-a4d9-4971470077ee`. Không mock BFF.

## Header A→B đã quan sát được

1. Tab `1a54c9b8-fb47-46b7-9a7b-18723755d8f7` mở ví A (`attendee@example.com`), `/api/bff/me` 200, avatar đúng A, header 63px trong viewport pane ban đầu. Lưu tham chiếu DOM header.
2. Tab `e23dcd73-64b4-49ea-8fed-eb8a24765ceb` cùng profile thực hiện logout thật, chờ trở về trang chủ rồi authorization request mới. Nhập B (`no-access@example.com`) bằng form Keycloak thật; callback tới `/wallet`, `/me` 200 đúng B.
3. Tab B ban đầu hiển thị fallback «Đang tải nội dung», có hai hidden React streaming boundaries dù readyState complete và avatar B đã hydrate. Một lần Orca `screenshot` làm boundaries về 0, trang ví trống hiển thị bình thường. Không gọi React reveal callback hay sửa DOM/CSS để ép hiện. Đây là dấu hiệu scheduling/frame của browser cần reviewer đối chiếu, chưa có bằng chứng lỗi backend hoặc production loading vĩnh viễn.
4. Trở về tab A cũ, phát `visibilitychange`, `/me` 200 xác nhận B; sau 500ms avatar là B, không còn label A. Cùng DOM header, cao 63px. Sau đặt viewport rõ ràng 1440×900 DPR1, header 73px, scrollWidth1440, vẫn cùng DOM và avatar B.

Probe đọc DOM ngay trong cùng JS stack vừa dispatch event còn thấy label A trước React commit (`pendingHadA=true`). Không dùng số này làm bằng chứng ảnh/frame trong lúc request pending; phần pending/revoke dựa deferred regression tests và cần reviewer kiểm binding UI.

Ảnh đã mở kiểm tra: `/tmp/vd11-fixed-attendee-b-wallet-probe.png` (ví B trống sau frame), `/tmp/vd11-fixed-cross-tab-old-wallet-1440.png` (tab cũ sau đổi B). File probe có hậu tố `390` ở `/tmp/vd11-fixed-cross-tab-old-wallet-390.png` được chụp trước khi đặt viewport rõ ràng, **không dùng làm bằng chứng viewport390**.

## W-F04 — vấn đề dữ liệu ví qua đổi phiên, chờ reviewer xác minh

Sau bước 4, tab cũ có avatar B và `/me` đúng B nhưng vẫn hiển thị **6 ticket links/card của A**; fresh tab B cùng cookie chỉ có «Chưa có vé». Screenshot1440 và DOM `a[href*="/tickets/"]` count6 xác nhận. Chưa refresh toàn trang tab cũ trước khi thu bằng chứng. Đây là dữ liệu React/RSC đã render từ phiên trước; chưa kết luận backend cho B truy cập vé A, cũng chưa phân loại là regression mới hay lỗi có sẵn trước VD11.

**Coordinator coi đây là blocker cần đánh giá trước triển khai** theo PRD M02 logout trên thiết bị dùng chung và identity hiện hành. Reviewer độc lập xác minh, giữ ID `VD11-W-F04` nếu đúng, xác định vùng ảnh hưởng consumer private content/router cache và gom cùng các finding còn mở trước fix2/2. Không tự đóng W-F01..03 hoặc P-F03..04 từ report này. Không sửa source thêm trong quá trình UAT.

Hai tab coordinator trên đã đóng sau thu bằng chứng. Worker Higo đã đóng các tab của mình và settle/release. Chưa deploy.
