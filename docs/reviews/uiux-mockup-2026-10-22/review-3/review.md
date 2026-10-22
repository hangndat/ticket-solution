# Review UI/UX mockup — lần 3 (reviewer-uiux / Mira)

## Reviewer / độc lập

| Trường | Giá trị |
| --- | --- |
| Reviewer | Mira · ux — dispatch `task_b6a3a6ebc579` / `ctx_e188f40c0e63` |
| Độc lập | Session reviewer tách implementer prototype; không đọc artifact review lần 1–2 |
| Tác giả phần duyệt | PD / prototype `docs/design/ui-uplift-2026-10/` (coordinator giữ server) |

## Scope / phiên bản

| Trường | Giá trị |
| --- | --- |
| Epic | #770 (marketing), #766 (app attendee) |
| Paths | `docs/design/ui-uplift-2026-10/marketing/`, `docs/design/ui-uplift-2026-10/app/` |
| Exact SHA | `de08f97a4f6498b789d81bce2dbd88b4e6d2ffa5` (khớp `source-manifest.json`) |
| Loại review | Prototype HTML tĩnh — **không** thay thế runtime / pilot UAT |

## Mẫu / môi trường

| Trường | Giá trị |
| --- | --- |
| Server | `http://127.0.0.1:63783/marketing/`, `http://127.0.0.1:63783/app/` |
| Browser | Orca embedded tab `browserPageId=7e007860-5ad8-48e7-9591-5da0dfb2d1ff` (đã đóng cuối phiên) |
| Viewport | Desktop **1280** và Mobile **390** (nút trong khung prototype; đọc trạng thái active trên ảnh) |
| Locale | **VI** đường chính; **EN** spot-check marketing + app guest catalog |
| Persona / state | Đối chiếu bảng `screens` trong `docs/design/ui-uplift-2026-10/app/index.html` (dòng 255–271) trước khi kết luận quyền |

### Bảng state prototype (app)

| Nhãn UI | Role | Page |
| --- | --- | --- |
| Guest · Catalog | guest | catalog |
| User · Catalog | user | catalog |
| Event detail | user | detail |
| Redeem · gate | guest | redeem |
| Redeem · form / terms / success / error | user | redeem* |
| Wallet / Wallet empty | user / guest | wallet / wallet-empty |
| Ticket · QR | user | ticket |
| Loading / Error | guest | loading / error |

## Checks / evidence

**Skills:** `impeccable` (critique, không init PRODUCT/DESIGN); `web-design-guidelines` (không áp checklist code vì task chỉ mockup); Orca CLI + `uat-headless.mdc`.

**Lệnh Orca (mẫu):** `orca tab create --url http://127.0.0.1:63783/marketing/` → `orca exec --command "click @e3"` (Mobile 390) / `@e4` (Desktop 1280) → `screenshot '' <path>`; app: `goto http://127.0.0.1:63783/app/` → click nút state `@e6`…`@e20` → chụp.

**Marketing:** hierarchy/proposition/CTA (desktop + mobile), demo honesty, form đăng ký quan tâm (snapshot a11y tree — xem Limitations), EN header.

**App:** toàn bộ state bắt buộc trong task; nav đã đăng nhập desktop + mobile (user catalog); redeem journey; wallet / empty; ticket QR; loading + error.

### Bảng ảnh (hash SHA-256, nội dung đã mở lại và xác minh)

| File | SHA-256 | Nội dung thực tế đã xác minh |
| --- | --- | --- |
| `marketing-vi-desktop-1280.png` | `659cd60f5253a4cb2747397449e2f6ae30cde94b2aba2a58451957ee43795c44` | Khung **Desktop 1280** + **VI** active; URL `vemoki.com`; hero H1/CTA; disclaimer demo; nav đầy đủ |
| `marketing-vi-mobile-390.png` | `e2f252b02455a736e5171274ecf2d627593d16215e4e6ad168d109241d0384f8` | **Mobile 390** + **VI**; layout một cột; header chỉ logo + VI/EN + Đăng nhập + Đăng ký — **không** thấy link Tính năng/FAQ |
| `marketing-en-desktop-1280.png` | `44b24544e91d6847605acf45358a97a5980f513ca7c5634941bcfe2b72457a07` | **Desktop 1280** + **EN** active; menu EN (Features, FAQ, Register interest) |
| `app-guest-catalog-vi-desktop-1280.png` | `69e94ac9c0a3c7b1c8e0b5ee6ea9bea74e0b8f506ee7683b5923e15c14064f11` | State **Guest·Catalog** active; **VI**; URL `app.vemoki.com/`; nav guest (không Vé của tôi) |
| `app-guest-catalog-en-desktop-1280.png` | `0b3f6dcae260409a4964067dcee489cd7d82fb76d3be3d9e4be2976ebce2c053` | **Guest·Catalog** + **EN** active; nhãn Explore/Redeem code |
| `app-user-catalog-vi-desktop-1280.png` | `79b2b32ab50aea5b1d7752fc904736505dc69e2808690506f6d9c085949146f1` | **User·Catalog** + **VI**; nav user có **Vé của tôi**; avatar Minh Anh |
| `app-user-catalog-vi-mobile-390.png` | `d25fcf8b045c2a3c0434c812a59a99caf4d83ba3731f251151ee7395cc5774ab` | **User·Catalog** + **Mobile 390** + **VI**; chrome **≡ Menu** (nav thu gọn) |
| `app-event-detail-vi-desktop-1280.png` | `998da369173dd4f651f5d59083b53c1fa24eb23054c55b99c7402ac4d41d9aec` | **Event detail** user; URL path sự kiện; CTA xem vé |
| `app-redeem-gate-vi-desktop-1280.png` | `2f21df661bc1a6bbd69c4dc686a46e2232a5eb4ebf32bd2fa2ebe14382cc0b86` | **Redeem·gate** guest; CTA đăng nhập để tiếp tục |
| `app-redeem-form-vi-desktop-1280.png` | `416aeeb96b70649de24a593ad53f98d43d08974e87248117a42aaeec7f0cfa7b` | **Redeem·form** user; ô mã + nút xác nhận |
| `app-redeem-terms-vi-desktop-1280.png` | `94ff84eeac8602d572afe10e7158239de70d13c3dc91828a346448a3c96c59e5` | **Redeem·terms** user |
| `app-redeem-success-vi-desktop-1280.png` | `ed41492ac064edab423c5fc1b65195c8af875feb2a99a2604310fe2a2deaf1a6` | **Redeem·success** user |
| `app-redeem-error-vi-desktop-1280.png` | `dee4c6422e2fea7736e674afc62093562cdd54c75b950fad8c10c83ee01bc395` | **Redeem·error** user; hướng dẫn + Thử mã khác / Vé của tôi |
| `app-wallet-vi-desktop-1280.png` | `aedfa1ecef8709eddc5106b6fb47f7c2382898da9f6c735856617fe02083fa39` | **Wallet** user; lưới vé + DEMO nhãn |
| `app-wallet-empty-vi-desktop-1280.png` | `32eb22064afea7179366dbcfae5086ac2453aea6c727aa39f98bb99ae5d01175` | **Wallet empty** guest; empty state + CTA đổi mã |
| `app-ticket-qr-vi-desktop-1280.png` | `99dfca65a1f7fbdf2cf9e871347659fb3759c49814938e5114575506de1798a1` | **Ticket·QR** user; disclaimer mã minh họa |
| `app-loading-vi-desktop-1280.png` | `a6263650804792f7cde35f00c6e86c5ff4805ecdabea1925dadbd318e6671fdc` | **Loading** guest; skeleton + copy chờ |
| `app-error-vi-desktop-1280.png` | `eadfe9a778cfed67daac867446be0ebae5d6852a78fb3ebd49fdc4b3b577906f` | **Error** guest; thông báo lỗi + thử lại |

Tất cả hash **khác nhau**; không giữ ảnh lệch nhãn sau khi loại file form sai (xem Limitations).

## Điểm tốt (2–3)

1. **Trung thực demo:** banner dữ liệu mô phỏng, nhãn DEMO trên sự kiện/vé, FAQ marketing (“Demo có phải khách hàng thật?”), disclaimer QR minh họa — giảm rủi ro hiểu nhầm pilot.
2. **Hành trình redeem lỗi:** màn error có ngữ cảnh + hai hướng rõ (thử mã khác / vé đã có) — khớp tinh thần FE-BA-COHERENCE trong ghi chú prototype.
3. **Phân persona trong chrome:** guest vs user đổi nav đúng bảng `screens` (vd. guest không có “Vé của tôi”; user catalog desktop/mobile có menu đầy đủ hoặc ≡ Menu).

## Findings

| ID | Vấn đề | Tác động người dùng | Evidence | Mức độ | Điều kiện đóng |
| --- | --- | --- | --- | --- | --- |
| **UX-M3-01** | Marketing **mobile 390** ẩn toàn bộ `.mkt-nav-links` (Tính năng, Cách hoạt động, FAQ…) **không** có menu thay thế | Khách mobile không điều hướng tới section/FAQ; chỉ còn CTA đăng ký/đăng nhập | Ảnh `marketing-vi-mobile-390.png`; `marketing/css/marketing.css:1762-1764` | **Cao** (mockup marketing) | Thêm pattern menu mobile (drawer/hamburger) hoặc hiển thị anchor tối thiểu; xác nhận trên ảnh mobile 390 |
| **UX-M3-02** | Catalog: **dropdown** “Sắp diễn ra” **trùng** với **pill** “Sắp diễn ra / Tất cả” | Người dùng không biết control nào là nguồn sự thật; tăng gánh nhận thức | `app-guest-catalog-vi-desktop-1280.png`, `app-user-catalog-vi-mobile-390.png` | Trung bình | Gộp một control lọc hoặc phân vai rõ (vd. search vs sort); một ảnh desktop + mobile thể hiện quyết định |
| **UX-M3-03** | Locale **VI** nhưng ngày thẻ sự kiện dùng tháng tiếng Anh (“24 Oct”) | Cảm giác lẫn ngôn ngữ; giảm tin cậy bản địa hóa | `app-guest-catalog-vi-desktop-1280.png`, `app-wallet-vi-desktop-1280.png` | Thấp | Thống nhất format ngày VI (vd. “24 thg 10”) hoặc ghi rõ locale EN cho phần ngày |
| **UX-M3-04** | Nav header vs footer app: **“Đổi mã”** vs **“Đổi mã lấy vé”** cho cùng hành động | Quét mắt khó map cùng destination; không nghiêm trọng nhưng lệch nhãn | `app-guest-catalog-vi-desktop-1280.png` (footer), `app-redeem-gate-vi-desktop-1280.png` | Thấp | Chuẩn hóa một nhãn trong IA copy deck |
| **UX-M3-05** | Marketing **logged-in nav desktop 1280**: nhiều mục + locale + CTA — chưa thấy wrap trên ảnh nhưng mật độ cao | Rủi ro cắt chữ khi copy dài hoặc locale khác | `marketing-vi-desktop-1280.png`, `marketing-en-desktop-1280.png` | Thấp (theo dõi) | Soát chrome EN dài hơn ở mobile/desktop; chụp nếu wrap |

*(Tối đa ~8 — dừng ở 5 finding có evidence; không chấm điểm cảm tính.)*

## Ưu tiên xử lý

1. **UX-M3-01** — chặn trải nghiệm marketing mobile trong scope revamp.
2. **UX-M3-02** — trước khi implement catalog thật.
3. **UX-M3-03 / UX-M3-04** — polish copy/locale.

## Limitations

| Hạng mục | Ghi chú |
| --- | --- |
| Form đăng ký marketing | Không có ảnh riêng: `scroll`/`#interest` qua Orca không đổi viewport trong khung `.site` (ảnh tạm trùng hero đã **xóa**). Fields xác nhận qua `orca exec snapshot` ban đầu (Họ tên, Email công việc, Vai trò, checkbox privacy, Gửi đăng ký). |
| a11y runtime | Không keyboard/focus/contrast đo tự động; ảnh tĩnh. |
| `web-design-guidelines` | Không fetch checklist upstream (mockup-only). |
| Marketing mobile menu | Không mở drawer (không tồn tại trong mockup) — chỉ quan sát thiếu nav. |
| Claim invite / Account / Toast | Không chụp riêng; ngoài danh sách bắt buộc task nhưng đã cover journey chính. |

## Kết luận (scope mockup)

**Verdict: PASS with known gap**

Prototype đạt mục tiêu trình bày proposition, demo honesty và hành trình attendee cốt lõi trên desktop; chrome guest/user nhất quán với bảng state. Gap chính: **IA marketing mobile thiếu điều hướng nội trang (UX-M3-01)** và **lọc catalog trùng (UX-M3-02)**. Không kết luận pilot ready hay DoD runtime.

---

## Phản hồi về role/workflow

| Vị trí | Vấn đề | Đề xuất câu chữ |
| --- | --- | --- |
| `reviewer-uiux.md` bước 7, bullet khung `.browser` / `#site` | Đúng hướng nhưng chưa nói **cách** cuộn/click anchor *bên trong* iframe/khung khi `agent-browser` ref trên trang bọc | Thêm: “Ưu tiên `click` link anchor **trong** snapshot khung sản phẩm; nếu `scroll @ref` không đổi ảnh, ghi limitation — không đặt tên file theo section chưa thấy trong ảnh.” |
| `reviewer-uiux.md` bước 3 (chrome × viewport) | Task mockup marketing **cố ý** ẩn nav mobile — reviewer cần phân biệt **lỗi chrome** vs **thiết kế chưa có pattern** | Thêm: “Finding chrome: control bị cắt/chồng. Finding IA: thiếu đường tới mục tiêu (vd. FAQ) khi CSS `display:none` — ghi rõ loại.” |
| `ui-workflow.md` mục 4 + prototype | Workflow nhấn Orca browser nhưng Task Spec dài về hash/locale — trùng bước 7 role | Gộp checklist evidence 1 dòng trong Task Spec: “Một bảng ảnh + hash + mở lại ảnh” trỏ thẳng role bước 7, tránh lặp 3 nơi. |
| `ui-workflow.md` skills web | `web-design-guidelines` bắt fetch URL — với **mockup-only** gây nhiễu | Thêm dòng: “Review prototype HTML tĩnh: `web-design-guidelines` tùy chọn; critique + snapshot a11y đủ nếu không sửa code.” |
