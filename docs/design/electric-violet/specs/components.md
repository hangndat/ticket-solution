# Electric Violet — Component/pattern spec (đề xuất, tối thiểu)

Trạng thái: đề xuất, chưa code complete. Chỉ phủ **flow sản phẩm đang có** (catalog/Home công khai, Đổi mã, Ví/vé) theo `docs/design/visual-identity-v2/README.md` §1 — **không** thêm mua vé, discovery filter hay điều hướng mới dù mockup trong board tham khảo có search bar/chip filter ("Music/Art/Community"): đó là mockup minh hoạ hướng thị giác, không phải IA mới được duyệt. Token dẫn từ `../specs/foundations.md`.

## 1. Button

**Anatomy:** label (Be Vietnam Pro SemiBold 600) + icon tuỳ chọn, padding `space.md` ngang / `space.sm` dọc, radius `radius.md` (12px).

**Variants:** `primary` (fill `color.action.primary`, chữ trắng), `secondary` (viền `color.border.default`, nền `color.bg.canvas`, chữ `color.text.primary`), `ghost` (không viền, chữ `color.action.primary`).

**States:** default / hover (`primary.bg.hover`) / pressed (giảm 8% lightness, không invent token mới — derive runtime) / focus-visible (ring 2px `color.action.focusRing` + 2px offset) / disabled (opacity 40%, không tương tác) / loading (spinner thay label, giữ kích thước).

**Interaction:** Enter/Space kích hoạt khi focus; không double-submit khi đang loading.

**A11y:** `role="button"` hoặc `<button>` thật; label mô tả hành động (không chỉ "OK"); hit target ≥44×44 trên mobile.

**Responsive:** full-width trên mobile khi là CTA chính của form; inline trên desktop.

**Copy mẫu (VI):** "Đổi mã lấy vé", "Xem vé", "Thử lại".

## 2. Field / Search

**Anatomy:** label phía trên (Be Vietnam Pro Medium 500, `color.text.muted`), input box viền `field.border`, placeholder `color.text.muted`, icon search/clear tuỳ ngữ cảnh.

**Variants:** `text` (mã đổi vé), `search` (icon kính lúp trái, nút clear phải khi có giá trị).

**States:** default / focus (viền `field.border.focus` + ring nhẹ) / filled / error (viền + caption dùng token error hiện hành — xem bảng legacy ở foundations §2, **không** đổi sang tím) / disabled.

**Interaction:** search debounce theo pattern hiện có của catalog (không đổi logic, chỉ đổi style); error caption xuất hiện dưới field, `aria-describedby` trỏ tới caption.

**A11y:** `<label for>` hoặc `aria-label`; lỗi dùng `aria-invalid="true"` + `aria-describedby`; `aria-live="polite"` cho caption lỗi động (redeem form).

**Responsive:** full-width trên mobile; max-width ~420px trên desktop cho form đổi mã.

**Copy mẫu:** "Nhập mã sự kiện", "Tìm sự kiện…", "Mã không hợp lệ, kiểm tra lại."

## 3. Chips (filter/category — chỉ style, không IA mới)

**Anatomy:** pill radius full, padding ngang `space.lg`, chữ `type.bodyStrong`.

**Variants:** `selected` (fill `color.action.primary`, chữ trắng), `default` (nền `color.bg.surface`, chữ `color.text.primary`).

**States:** default / hover (viền nhạt) / selected / focus-visible (ring) / disabled.

**Interaction:** single-select hoặc multi-select theo component hiện có ở catalog — spec này chỉ đổi token màu, **không đổi hành vi filter hiện tại**.

**A11y:** `role="button"` hoặc checkbox pattern tuỳ hành vi gốc; `aria-pressed`/`aria-checked` tương ứng.

**Responsive:** horizontal scroll trên mobile khi quá nhiều chip, không wrap gây lệch layout.

**Copy mẫu:** theo category thật của catalog hiện có (không invent category "Music/Art/Community" từ mockup tham khảo — đó là dữ liệu minh hoạ của ảnh board, không phải category sản phẩm thật).

## 4. Event / ticket row

**Anatomy:** ảnh/thumbnail trái (nếu có), tên sự kiện (`type.bodyStrong`), meta phụ (ngày/giờ/venue, `type.caption` `color.text.muted`), trạng thái bên phải (badge, xem §5).

**Variants:** `catalog-row` (danh sách sự kiện công khai), `ticket-row` (vé trong Ví, có trạng thái vé).

**States:** default / hover (nền `color.bg.surface` nhẹ, không đổi trên touch) / pressed/navigating / empty (placeholder ảnh + tên "Đang cập nhật") / loading (skeleton).

**Interaction:** toàn hàng là tap target dẫn tới chi tiết sự kiện/vé; không nested interactive control chồng focus.

**A11y:** cả hàng là một link/button có accessible name gồm tên sự kiện + ngày; không đọc trùng lặp khi screen reader duyệt.

**Responsive:** list 1 cột mobile; có thể 2 cột desktop cho catalog (không đổi breakpoint hiện có của `tokens.json.breakpoints`).

**Copy mẫu:** "Đêm nhạc Vemoki Live — 20:00, 12/12 · Nhà hát Thành phố".

## 5. Notice / status (badge trạng thái vé — invariant bắt buộc)

**Anatomy:** pill nhỏ, icon tuỳ chọn + label ngắn, `type.caption` SemiBold.

**Trạng thái và token bắt buộc** (giữ nguyên ý nghĩa từ foundations §2 — không đổi):

| Trạng thái vé | Token | Màu (giữ legacy, không đổi sang tím) |
| --- | --- | --- |
| Đã vào cổng (admit) | `color.status.success` | xanh lá giữ nguyên (`#1B7F4A` tương đương) |
| Đang xử lý / hàng đợi (`queued`) | `color.status.warning` hoặc neutral — **không bao giờ** `success` | vàng-nâu/neutral, không xanh lá |
| Chưa xác định (`unknown`) | `color.status.warning` | vàng-nâu giữ nguyên (`#8A6D3B` tương đương) |
| Từ chối/hết hạn (`destructive`) | `color.status.error` | đỏ đất giữ nguyên (`#8A1F1F` tương đương) |
| Thông tin chung | `color.status.info` | trung tính/`color.action.focusRing` |

**Quy tắc bắt buộc:** `queued` và `unknown` không bao giờ render bằng token success — đây là invariant nghiệp vụ admission (Gate), áp dụng xuyên component này, không phải lựa chọn style.

**A11y:** không chỉ dựa màu — kèm icon hoặc label chữ; `role="status"` nếu cập nhật động; contrast text/nền badge ≥ 4.5:1 (xem số đo thực tế ở `../REPORT.md`).

**Responsive:** badge không bị cắt chữ trên mobile — ưu tiên label ngắn.

## 6. QR surface (hiển thị vé — Attendee only, không phải Gate/Scanner)

**Phạm vi:** chỉ **hiển thị** QR vé cho attendee (`ticket-detail`), **không** phải UI quét/scan — Gate/Scanner thuộc iOS Staff, ngoài scope O23 và ngoài Task này.

**Anatomy:** khung vuông bo `radius.lg`, nền trắng bắt buộc (contrast quét QR), QR code giữa, meta vé (tên sự kiện, tên người giữ vé nếu có) phía trên/dưới khung.

**States:** ready (QR hiển thị) / loading (skeleton vuông) / hết hạn/đã dùng (QR bị làm mờ + overlay label trạng thái, **không** gợi ý "quét lại" — theo `docs/design/visual-identity-v2/README.md` §2) / lỗi tải.

**Interaction:** không tương tác (QR tĩnh để quét); có thể có nút "Lưu vào Wallet" tuỳ nền tảng nếu đã có sẵn, không invent action mới.

**A11y:** `accessible name` = "Mã QR vé [tên sự kiện]" (giữ nguyên yêu cầu từ visual-identity-v2 §3); không chỉ dựa vào hình ảnh — meta text đi kèm luôn hiển thị, không ẩn trong QR.

**Responsive:** QR tối thiểu 200×200px hiển thị thực trên mobile để quét được; không co nhỏ hơn.

**Dữ liệu demo:** mọi QR trong preview/prototype phải là dữ liệu giả có nhãn rõ ("DEMO — không phải vé thật"), không được trông như vé thật có thể dùng.
