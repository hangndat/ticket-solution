# #838 / PR #841 — Xác minh bổ sung của coordinator

Trạng thái: **chờ revalidation độc lập**, không tự cấp DoD/UI PASS. Source HEAD `7f6fe6784ecda61e901b0ea42f918df588c811ad`, app-tree `dd2c5c4af1b3c0b0ba880da464a11a67e7618d5b`, BUILD_ID `i7MxSxPuL7tWOl9T867GB`, portal PID `29702` port3413; API3418, Keycloak8488, Postgres58438. Dữ liệu fixture local, đăng nhập Keycloak/MFA thật; không mock auth hoặc thay policy.

## Bộ đếm và quyết định

Lượt sửa tự động **2/2**, ngoại lệ **1/1 đã dùng**, chỉ evidence, không đổi product code. [Checkpoint dừng](https://github.com/hangndat/ticket-solution/issues/838#issuecomment-6357342628), [chẩn đoán và quyết định ngoại lệ](https://github.com/hangndat/ticket-solution/issues/838#issuecomment-6357399707). Hạn ngoại lệ 04:44 UTC đã qua khi phiên tiếp tục lúc05:09; không tự gia hạn hay mở đợt sửa mới. User yêu cầu “tiếp tục đi”; coordinator đóng gói kết quả đã thu và giao một lượt review độc lập. Lần chụp lại nhằm bỏ hover overlay thất bại do submenu chưa mở, không có ảnh mới và không retry. Nếu review FAIL, giữ Bị chặn và trình quyết định, không tự fix tiếp.

## Bằng chứng đã thu

Canonical assets: `assets/portal-fix-838/coordinator/`, JSON `evidence/`. Mỗi ảnh matrix có actual pathname, htmlLang, account, innerWidth/innerHeight, tên đơn vị/sự kiện dài và probe chrome. Cả10 ảnh đã được coordinator mở xem ở phiên thu bằng chứng.

| Viewport | VI | EN | Giới hạn |
| --- | --- | --- | --- |
| 390×844 | verified-vi-long-guests-390x844.png | verified-en-long-guests-390x844.png | Tab Import EN bị clip: F04 nit đã có, ngoài PA01 |
| 430×932 | verified-vi-long-guests-430x932.png | verified-en-long-guests-430x932.png | Context label/select stack |
| 768×1024 | verified-vi-long-guests-768x1024.png | verified-en-long-guests-768x1024.png | Popup nav hover phủ một phần body; chỉ đánh giá header/context, không claim rest-state toàn trang |
| 1024×900 | verified-vi-long-guests-1024x900.png | verified-en-long-guests-1024x900.png | Tên dài, context theo hàng |
| 1440×1000 | verified-vi-long-guests-1440x1000.png | verified-en-long-guests-1440x1000.png | Tên dài |

- F01: `locale-open-proof`, `locale-selected-en`, `locale-selected-vi`: mở account, hover submenu thật, click locale; đo htmlLang/account/storage thật. Matrix đi route trực tiếp để tạo state, không giả là control journey.
- F02: `copy-provider-vi-current-build`: DOM bản build mới xác nhận nhà cung cấp tiếp nhận khác khách nhận email; “không giữ suất”. Source đã sửa trong batch2; reviewer kiểm VI/EN và alias compatibility.
- F03 keyboard: `keyboard-tenant-focus/open`, `tenant-option-active`, `tenant2-after-keyboard-select`, `event2-options-keyboard`, `event2-after-keyboard-select`: focus combobox, ArrowDown/Enter native, tenant2/event2 pathname và tên dài đúng. Quan sát tenant đầu có event1 transient; bản event2 sau mới là state hoàn chỉnh. `keyboard-account-open`, `keyboard-tabs-after-account`: Enter mở menu, Tab đi skip link → tenant → event. Không router.push/hash để thay control.
- F03 tabs: `tabs-import-before`, `tabs-export-vi-after`, `tabs-pending-after`, `tabs-import-return`: Import filter hiện, Export/Pending ẩn, quay Import hiện lại; Export VI có aria “Mã yêu cầu xuất”, placeholder “Nhập mã yêu cầu xuất”. Fixture có3 tabs; không bịa tab Notifications.
- F03 PA06: `motion-reduce`: native media reduce=true; node DOM tạm dùng production class spinner, computed animation none/0s. Đây là CSS fixture, không phải loading route. Reset no-preference không hiệu lực (vẫn true), không claim baseline false; quan sát trùng được loại khỏi canonical evidence.

## Hiệu chỉnh handoff và kiểm tra

Handoff `PORTAL-FIX-838-BATCH-2.md` ghi PID47426/build9b22 là runtime cũ; runtime hiện tại ở đầu báo cáo này. Không đổi verdict FAIL lịch sử trong `PORTAL-FIX-838-DOD-UX.md`.

- `final-locale-journey-vi` thực tế render EN; đổi thành `diagnostic-attempted-vi-rendered-en`. Không dùng làm bằng chứng VI.
- Ảnh postcopy, JSON SHA-only và focus-attempt đang ở onboarding; đổi tên `diagnostic-onboarding-*`, không chứng minh Guests/copy/focus.
- Trường `captureSHA` của matrix worker là HEAD nền khi source chưa commit; hiệu chỉnh thành `captureBaseHEAD`, không gán SHA build giả.

Matrix chrome probe issues=[]; không document overflow trong state đã đo. Kiểm duplicate hash trên thư mục phẳng gồm ảnh và JSON sau khi loại quan sát motion trùng. Source portal không thay đổi so với7f6fe678. Batch2 worker báo lint,131tests,build PASS; đây là checks của worker tại source đó, chưa phải CI trên tip mới. CI tip mới do coordinator cung cấp.

Reviewer đọc diff từ8014, mở ảnh và spot-check độc lập F01/F02/F03. Còn cần quan sát độc lập: Export EN accessible name, UTC runtime VI/EN (formatter unit test đã có), back/deeplink semantics theo behavior hiện có. Không sửa source, không hạ acceptance. Không claim physical device, tất cả roles, pilot ready hoặc production readiness.
