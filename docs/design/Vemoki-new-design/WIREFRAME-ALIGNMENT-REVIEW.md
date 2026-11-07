# Đối chiếu wireframe iOS đã duyệt với Vemoki Design System mới (draft)

| Trường | Giá trị |
| --- | --- |
| Ngày review | 2026-11-05 |
| Base SHA | `67da5c550a1b3b572f4bf01c1a05bb70bceafa6c` (đã xác minh bằng `git rev-parse HEAD`; checkout `ios-approved-ui-20261105`) |
| Role / persona | `product-design` · Liv |
| Loại công việc | Review tĩnh tài liệu/HTML. Không chạy build, không chạy app, không đổi token/code/`originals/*.html`/`index.html`/`brand/vemoki/tokens.json` |
| Nguồn so sánh | `docs/design/Vemoki-new-design/` (GUIDELINES.md, tokens.json, vemoki.css, contrast-report.json, README.md) |
| Nguồn wireframe | `docs/design/mobile-approved-wireframes-2026-11-05/originals/*.html` (15 file, đã đọc toàn bộ) |
| SoT đối chiếu xung đột | `brand/vemoki/tokens.json` (version 3, tracked), `docs/DECISION-LOG.md` (O23, O27–O33, Bổ sung Electric Violet 04/11, Bổ sung iOS visual 05/11), `docs/architecture/ADR-MOBILE-WIREFRAMES-2026-11-05.md`, `docs/design/electric-violet/specs/foundations.md` |

## 0. Trạng thái nguồn (AC3)

- `docs/design/Vemoki-new-design/` **đang untracked** trong git (`?? docs/design/Vemoki-new-design/`). Trong báo cáo này nó được coi là **draft/đề xuất chưa tích hợp**, không phải SoT đã tích hợp hay đã duyệt runtime.
- GUIDELINES.md tự ghi “Chốt màu” trong tiêu đề. Đây là tự khai của draft; DECISION-LOG (04/11) không tham chiếu bộ này và ghi Electric Violet với `#6C35FF`. Báo cáo không xác nhận “chốt” cho bộ này.
- Wireframe `originals/*.html` là bản duyệt theo lượt (ADR: visual reference, không phải token SoT). Các giá trị dưới đây là giá trị **đọc trực tiếp từ HTML/CSS** trong file.
- Phương pháp: so khớp giá trị hex, font, px, radius, shadow đọc từ `style` của từng file; kích thước component ước tính từ CSS (padding + line-height) và được ghi là ước tính. Không đo bằng trình duyệt.

## 1. Tóm tắt

- **Mismatch:** khoảng 35 mục ghi “Lệch” (màu 11, typography 4, spacing/radius/shadow 6, component 10, trạng thái Gate/vé 4). Phần lớn không phải lỗi ở một file mà là các biến thể không thống nhất trong chính bộ wireframe (ví dụ ≥6 giá trị nền “primary-soft”, ≥4 giá trị đỏ).
- **Xung đột SoT:** **Có.** Primary `#7038FF` (Vemoki-new-design) khác `#6C35FF` (SoT v3, DECISION-LOG 04/11, và wireframe). Radius, typography, ink/line/muted, trạng thái semantic và spacing cũng khác. Chi tiết ở mục 10, không tự quyết.
- **Không kiểm được / không có mẫu:** focus, hover/pressed/disabled, dark mode, toast, pagination, table, motion, contrast của màu wireframe, nội dung `index.html` (ảnh WebP nhúng). Xem mục 7.

## 2. Màu và token (AC1)

| # | Hạng mục | Vemoki-new-design (giá trị · vị trí) | Wireframe iOS (giá trị · file/selector) | Kết quả |
| --- | --- | --- | --- | --- |
| A1 | Primary (CTA, selected) | `#7038FF` · `tokens.json` `themes.light.primary`; `vemoki.css` `:root --primary` | `#6c35ff` · ví dụ `wallet…hybrid-ac.html` `.button`, `.nav .active`; `remaining…html` `--violet` | Lệch (≈ SoT v3 `#6C35FF`) — xem D1 |
| A2 | Primary hover / pressed | `#6028E8` / `#5120C5` | Không có state hover/pressed trong HTML | Không kiểm được |
| A3 | Text (ink) | `#17151F` · GUIDELINES §04 `text` | Màu body: `#1b1725` (wallet), `#191621` (account), `#1b1722` (privacy), `#191622` (redeem), `#141020` (remaining `--ink`) | Lệch (≥5 giá trị; không hex nào khớp `#17151F`) |
| A4 | Text phụ | `text-secondary` `#625E70` | Subtitle `.sub` = `#777180` (wallet) — trùng `disabled-text` của GUIDELINES; meta `#716b7a`, `#77707d`, `#746c79` | Lệch (dùng nhầm token disabled cho subtitle) |
| A5 | Nền màn hình | `background` `#FAFAFC` | `.phone{background:#faf9fc}` (hầu hết file) | Lệch nhẹ (`#FAF9FC` ≠ `#FAFAFC`) |
| A6 | Viền | `border` `#DEDCE6` | `#e8e5ed` (wallet `.hero`), `#e9e6ed` (`.row`), `#e6e0ec` (account `.identity`), `#e5e0e9` (claim `.field`) | Lệch |
| A7 | Viền control (input) | `control-border` `#858091` | `gate-manual` `.input` `1.5px #bda9e5`; `redeem` `.input` `1.5px #bba7e6`; `gate-history` `.input` `1px #ded8e2` | Lệch (viền tím nhạt, không dùng control-border) |
| A8 | Nền/chữ “primary soft” (chip, badge, pill) | `primary-soft` `#F1EBFF`; `on-primary-soft` `#5120C5` | Nền: `#e9ddff` (wallet `.pill`, gate-scan `.chip.on`), `#ebe2ff` (account/explore `.badge`), `#eee7fb` (privacy `.chip`), `#eee9ff` (remaining `.pill`), `#e8ddff` (account `.avatar`). Chữ: `#5929c9`, `#5d30c8`, `#5b2dc9`, `#4e20bb` | Lệch (≥6 biến thể, không có `#F1EBFF`) |
| A9 | Success / admit | `success` `#137A4B`; `success-bg` `#EAF8F0` (GUIDELINES §04); SoT `admit` `#1B7F4A` | `gate-scan-status` `.result.admit` `#d9f0e1`/`#195b38`; `gate-manual` `.result.green` `#e1f2e6`/`#205d3b`; `gate-scan` `.result` `#e4f3e9` + `.badge` `#2e8b58`; `gate-history` `.dot.green` `#dff2e6`/`#287249`; `ticket-detail` `.pill` `#e6f4ea`/`#2d7b50` | Lệch (≥5 cặp nền/chữ; không khớp token nào) |
| A10 | Error / destructive | `error` `#BE263B`; `error-bg` `#FFF0F2`; nút destructive “nền error” (§07); SoT `destructive` `#8A1F1F` | `remaining` `--red:#a42d43`, `--redbg:#fff0f2`; `gate-scan-status` `.result.deny` `#f8dfe2`/`#8e2631`; `gate-manual` `.result.red` `#fae5e8`/`#8e2933`; `gate-history` `.dot.red` `#fae5e8`/`#a13640`; nút xóa `account-deletion` `.cta` `#b53e51` | Lệch (≥4 đỏ; nút xóa không dùng `#BE263B`) |
| A11 | Warning / unknown | `warning` `#8A5700`; `warning-bg` `#FFF5D6`; SoT `unknown` `#8A6D3B` | `gate-scan-status` `.result.unknown` `#fff0d6`/`#815919`; `gate-manual` `.result.yellow` `#fff1d8`/`#80571a`; `gate-history` `.dot.amber` `#fff0d4`/`#90641a`; `remaining` `--amberbg:#fff5df`/`#865d13`; `claim-invitation` `.pending-pill` `#fff3dc`/`#906319` | Lệch (≥5 cặp) |
| A12 | Info | `info` `#2459BA`; `info-bg` `#EDF3FF` | Không có màu info trong 15 HTML | Không có mẫu |
| A13 | Focus ring | `focus` `#7038FF`; `:focus-visible` 3px, offset 3 (`vemoki.css`) | Không có style focus trong HTML tĩnh | Không kiểm được |
| A14 | Dark theme | `[data-theme="dark"]` đầy đủ (`vemoki.css`, `tokens.json`) | Không có mẫu dark | Không có mẫu |
| A15 | Wordmark | GUIDELINES §02 và README: không gõ chữ V thay master | `remaining…html` tile 04 `<span class="brand"><b>V</b> Vemoki</span>` | Lệch (vi phạm quy tắc logo) |

## 3. Typography (AC1)

| # | Hạng mục | Vemoki-new-design | Wireframe iOS | Kết quả |
| --- | --- | --- | --- | --- |
| B1 | Font family | Be Vietnam Pro; fallback `system-ui, sans-serif` (`tokens.json` `font`; `vemoki.css` `--font-ui`) | 15/15 file: `-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif` (`body`; `remaining` dùng shorthand `font:` tương đương) | Lệch → D3 |
| B2 | Thang cỡ chữ | display 48/60/700; h1 36/48/700; h2 28/40/600; h3 22/32/600; body 16/26/400; small 14/22/400; caption 12/18/500 | Tiêu đề 23–27px (wallet `h1` 26px; explore `h1` 27px; gate-manual `h2` 24px); card title 17–25px; body 11–13px; meta 10–11px; caption/ref 9–10px. Không có body 16/26 | Lệch |
| B3 | Độ đậm | 400, 500, 600, 700 (`tokens.json` `font.weights`) | 750, 800, 850, 900 (wallet `.title` 850, `.pill` 800; `ticket-detail` `.event` 850) | Lệch |
| B4 | Cỡ tối thiểu cho giá, mã vé, hướng dẫn | ≥14px (GUIDELINES §05) | Hướng dẫn thao tác 10px (`gate-scan` `.hint`, `gate-manual` `.hint`); mã tham chiếu 9px (`ticket-detail` `.ref`) | Lệch |
| B5 | Override cỡ chữ mobile | Display 36/46, h1 28/38 (GUIDELINES §05) | Không có trong `tokens.json` | Gap token (ghi ở D3) |
| B6 | Số cột (tabular numerals) | Khi cần căn cột (§05) | Không có `font-variant-numeric`; không có bảng số cột | Không có mẫu |

## 4. Spacing, radius, shadow, breakpoint (AC1)

| # | Hạng mục | Vemoki-new-design | Wireframe iOS | Kết quả |
| --- | --- | --- | --- | --- |
| C1 | Thang spacing | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (`tokens.json` `spacing`) | Padding/gap ngoài thang: 9, 10, 11, 13, 15, 17, 19, 22, 25px (ví dụ wallet `.row` `padding:10px 11px`; account `.row` `padding:13px 12px`; gate-scan `.status` `margin-bottom:13px`) | Lệch |
| C2 | Lề màn hình / gutter | Lề 16, gap 16 (§06) | `padding: 8px 16px` (wallet, explore); 15–17px ở các file khác | Khớp một phần |
| C3 | Radius control | 12 (`radius.control`; `--radius-control`) | Nút 10px (wallet `.button`), 11px (gate-scan `.button`, gate-manual `.button`/`.action`, redeem `.cta`), 13px (remaining `.field`), 14px (remaining `.btn`); input 10–12px | Lệch (10/11/13/14 ≠ 12) |
| C4 | Radius card | 16 (`radius.card`; `.vm-card`) | 12 (wallet `.row`), 13 (account `.group`), 14 (event `.facts`, claim `.preview`), 15 (redeem `.card`), 16 (remaining `.group`), 17 (wallet `.hero`, `ticket-detail` `.ticket`) | Lệch |
| C5 | Radius dialog / sheet | 24 (`radius.dialog`) | 17px (`gate-manual` `.sheet`) | Lệch |
| C6 | Radius chip / pill | 999 (`radius.pill`) | 18px (`gate-scan` `.chip`); 20px (wallet `.pill`, privacy `.chip`) | Lệch nhẹ (hiển thị gần pill, không đúng token) |
| C7 | Shadow nổi | `0 8px 24px rgba(23,21,31,.08)` (§06) | `0 4px 10px #2116330a` (wallet `.hero`). SoT `soft` khác nữa: `0 24px 64px rgba(20,16,32,.12)` | Lệch → D9 |
| C8 | Breakpoint | Mobile <768; tablet 768–1023; desktop ≥1024 (§06) | Media query 700–1050px chỉ cho layout của board, không phải breakpoint app | Không áp dụng cho app |

## 5. Component spec (AC1)

| # | Thành phần | Quy định (Vemoki-new-design) | Wireframe iOS | Kết quả |
| --- | --- | --- | --- | --- |
| D-1 | Primary button | Cao tối thiểu 48, pad ngang 20, chữ 16/600 (§07; `.vm-button` `min-height:48px`) | wallet `.button` 12px/850, padding 11px ≈ 37px cao (ước tính); gate-manual `.button` 11px, padding 13px ≈ 39px; remaining `.btn{min-height:45px}` 14px/750 | Lệch |
| D-2 | Secondary | Nền surface + `control-border` (`.vm-button.secondary`) | remaining `.btn.secondary` nền `#f0edfa`, chữ `#4d24b2`; gate-scan-status `.action.secondary` nền `#f5f1f8`; claim `.button-outline` viền `#d8d1e0` | Lệch |
| D-3 | Disabled | Nền `disabled-bg`, chữ `disabled-text` (`.vm-button:disabled`) | Không có mẫu disabled | Không có mẫu |
| D-4 | Input | Cao ≥48; label trên, gap 8; helper gap 4; viền `control-border`; radius 12 (`.vm-input`) | gate-manual `.input` cao 48 ✓, viền `1.5px #bda9e5`, radius 11; redeem `.input` cao 51, radius 12, viền `#bba7e6`; gate-history `.input` cao 43 (<48) | Lệch (viền, radius; cao 43 ở history) |
| D-5 | Input lỗi | `aria-invalid` + `aria-describedby`; viền `--error` (`.vm-input[aria-invalid=true]`) | Không có trạng thái lỗi input trong HTML | Không có mẫu |
| D-6 | Card | Pad 24; viền 1px `--border`; radius 16 (`.vm-card`) | Pad 10–17px (xem C4) | Lệch |
| D-7 | Tab / bottom nav | 3–5 mục, nhãn văn bản; icon 20/24 cùng một bộ, không trộn 3D/outline (§06, §07) | Cao 54–58px; nhãn 9–10px; icon là ký tự Unicode (⌕ ▤ ◯ ⊞ ◷ ▦ ⌨ ▣) | Lệch (icon không đúng bộ 20/24; nhãn <12px) |
| D-8 | Nhãn tab | Guest: Sự kiện + Đổi mã; verified: + Vé của tôi (O28) | wallet nav: **Khám phá** / Vé của tôi / **Tài khoản** — khác O28. Explore và các file khác dùng Sự kiện / Đổi mã / Vé của tôi | Lệch với DECISION-LOG (ADR đã nói không chép literal) |
| D-9 | Dialog / bottom sheet | Title, nội dung, hành động; có nút đóng; trap focus; desktop tối đa 560; có backdrop (§07, §06) | `gate-manual` `.sheet`: có backdrop `#130f1aa8` và nút Hủy; radius 17; không có nút đóng riêng | Một phần |
| D-10 | Toast / inline alert | Toast xác nhận ngắn; lỗi cần hành động giữ inline (§07) | Không có toast trong 15 HTML. Thông báo dạng notice/result inline | Không có mẫu toast |
| D-11 | Event card | Ảnh 16:9; tên tối đa 2 dòng ở danh sách; badge tình trạng (§07) | explore `.feature-art{height:133px}` trên khoảng 302px nội dung ≈ 2.3:1 (ước tính). Không có badge tình trạng | Lệch |
| D-12 | Ticket card | Tên sự kiện, thời gian, người tham dự, loại vé, mã tham chiếu, QR, trạng thái riêng (§07) | wallet `.hero`: sự kiện, giờ/địa điểm, loại và mã (`Vé thường · #042`), pill trạng thái; **thiếu người tham dự**. `ticket-detail`: **thiếu giờ/địa điểm, loại vé, người tham dự** | Lệch (thiếu trường) |
| D-13 | QR | Đen trên trắng, không gradient, không che bằng logo, bắt đầu từ 240×240 CSS px (§08) | `ticket-detail` `.qr{width:197px;height:197px}` (border-box, tổng 197px); nền `repeating-linear-gradient`; nhãn “QR minh hoạ” đè lên vùng mã (`.qr em`) | Lệch (197 ≠ 240; placeholder dùng gradient, cần bỏ khi triển khai) |
| D-14 | Khung camera / quét | §08 không quy định token | `gate-scan` `.camera{background:#24252b}`; góc `#dad6df` | Không có token (ghi nhận) |
| D-15 | Empty | Giải thích + CTA (§07) | remaining 04, 05, 06: icon, tiêu đề, mô tả, CTA | Khớp |
| D-16 | Loading | Skeleton cùng layout đích (§07) | remaining 01: spinner + hai dòng skeleton ở giữa màn, không cùng layout đích | Một phần |
| D-17 | Error / retry | Có cách thử lại, giữ dữ liệu đã nhập (§07) | remaining 07: giữ mã `ABCD–1234`, có “Thử lại” | Khớp |
| D-18 | Search / filter | Giữ query, nút clear dễ thấy, số kết quả (§07) | explore `.search`: không có clear, không có số kết quả. gate-history: có ghi chú “12 lượt đã tải”, không có clear | Lệch |
| D-19 | Nút xóa / xác nhận | Nút nền error; xác nhận khi không hoàn tác (§07) | account-deletion: bước xác nhận riêng ✓; nút `#b53e51` (không `#BE263B`) | Một phần |
| D-20 | Checkbox điều khoản | Vùng chạm 48; checked rõ bằng hình (§07) | `.check` 17×17 trong hàng `.terms` có padding 11px | Một phần |
| D-21 | Pagination / table | §07 | Không có mẫu | Không có mẫu |
| D-22 | Focus, keyboard, ARIA | Focus 3px offset 3; label thật; aria (§10) | HTML tĩnh; không có thuộc tính ARIA | Không kiểm được |
| D-23 | Motion | 120/180/240ms ease-out; `prefers-reduced-motion` (§10; `vemoki.css`) | Không có `transition` hay `@keyframes` trong 15 HTML | Không có mẫu |

## 6. Trạng thái Gate và vé (AC1, §08)

| # | Trạng thái | Quy định (GUIDELINES §08–§09) | Wireframe iOS | Kết quả |
| --- | --- | --- | --- | --- |
| E1 | Hợp lệ | success + tên + loại vé | `gate-scan-status` “Được vào”: chỉ có “Máy chủ xác nhận lượt vào cổng”, **không có tên hay loại vé** | Lệch |
| E2 | Đã sử dụng | warning + thời điểm | `gate-history` `.dot.red` “Vé đã được sử dụng”; `gate-scan-status` deny ví dụ “đã check-in trước đó” (đỏ); legend `gate-scan` “Đỏ · Không cho vào … đã check-in trước đó” | Lệch (đỏ thay vì warning) — xem D12 |
| E3 | Chưa xác minh / offline | neutral hoặc info + hướng xử lý | `unknown` dùng vàng/amber (`.result.unknown`, `.legend .amber`) | Lệch (amber thay vì neutral/info) — xem D12 |
| E4 | Copy trạng thái | “Check-in thành công”; “Vé này đã được sử dụng”; “Chưa thể xác minh vé. Kiểm tra kết nối và thử lại.” (§09) | “ĐÃ GHI NHẬN CHECK-IN / Được vào”; “Không cho vào”; “CHƯA CÓ XÁC NHẬN / Chưa rõ” + “Đối soát” | Lệch copy |
| E5 | Không báo xanh khi chưa có xác nhận backend | Khóa thao tác lặp; không báo thành công trước khi backend xác nhận (§08; ADR) | `gate-scan-status`, `gate-manual`: queued/unknown không xanh; “Được vào” chỉ sau kết quả máy chủ | Khớp |
| E6 | Chờ đồng bộ | Không có trong GUIDELINES; O31 và ADR: không cho vào | `gate-scan-status` `.result.unknown` “LƯU TRÊN MÁY”, amber, không có token riêng | Ghi nhận |

## 7. Không kiểm được / không có mẫu

- **Trạng thái tương tác:** hover, pressed, disabled, focus-visible, dark mode, motion — HTML tĩnh không có.
- **Thành phần không có mẫu:** toast, pagination, table, info color, tabular numerals.
- **Contrast:** `contrast-report.json` có 18 cặp (9 light, 9 dark), đều tính trên bảng `#7038FF`. Không có `#6C35FF`, không có màu trạng thái của wireframe, không có cặp non-text (viền control `#858091` ≈ 3.8:1 trên `#FFFFFF`, tính tay; focus ring chưa có số). Ước tính tay: trắng trên `#6C35FF` ≈ 5.8:1 — **chưa đo bằng công cụ**.
- **`index.html`:** ảnh WebP nhúng, không tách được giá trị token. Đối chiếu dùng 15 HTML gốc.
- **`GUIDELINES.html`:** không đối chiếu (bản trình bày của GUIDELINES.md).
- **Font:** bộ mới không kèm file font; không kiểm sự tồn tại/giấy phép của font trong repo trong lượt này.
- **Tỷ lệ mockup:** khung điện thoại 326–350 CSS px, chưa xác nhận tỷ lệ với pt của thiết bị. Số px trong báo cáo là giá trị trong HTML.

## 8. Ghi nhận tài liệu (không phải xung đột token)

- `docs/design/electric-violet/specs/foundations.md` ghi runtime hiện hành là Live Pulse v2 (`#7C4DED`, `#E11D48`), trong khi `brand/vemoki/tokens.json` v3 đã là Electric Violet. Tài liệu này cần cập nhật.
- `docs/architecture/source-and-migration.md` (kiểm kê 26/10) ghi `tokens.json` là Live Pulse v2. Tài liệu này cũng lỗi thời so với v3.
- `brand/vemoki/tokens.json` có `colors.signal` = `#6C35FF` nhưng trường `signal` ở đầu file = `""`.
- `vemoki.css` có `--motion: 180ms`, GUIDELINES có 120/180/240. Chỉ có một giá trị trong CSS; `tokens.json` có đủ ba.

## 9. Kết quả

- Số mục “Lệch” theo bảng: 35 (mục 2–6; không tính “Khớp”, “Không có mẫu”, “Không kiểm được”, “Gap token”).
- Có xung đột SoT: **Có** (D1–D9 ở mục 10).
- Điểm không kiểm được: focus và state tương tác, toast, pagination, table, dark mode, contrast màu wireframe, `index.html`, `GUIDELINES.html`, font trong repo.
- Chưa sửa: token, code, `originals/*.html`, `index.html`, `brand/vemoki/tokens.json`, `apps/**`. Chưa mở Issue/PR.

## 10. Cần Coordinator quyết định

Mục này là mục cuối. Báo cáo không tự chọn nguồn nào đúng; mỗi mục ghi giá trị hai bên.

| # | Vấn đề | Vemoki-new-design (draft, untracked) | SoT tracked / quyết định hiện có / wireframe | Ảnh hưởng |
| --- | --- | --- | --- | --- |
| D1 | **Màu primary** | `#7038FF` (`tokens.json` `themes.light.primary`; `vemoki.css` `--primary`; GUIDELINES §03/§04; `contrast-report.json`; hover `#6028E8`) | `#6C35FF` (`brand/vemoki/tokens.json` `colors.primary` và `colors.signal`; DECISION-LOG 04/11 `signal=primary=#6C35FF`; wireframe `#6c35ff`) | Mọi cặp contrast và state hover/pressed của draft được tính trên `#7038FF` |
| D2 | **Radius** | control 12, card 16, dialog 24, pill 999 (`tokens.json` `radius`) | SoT `sm` 8, `md` 12, `lg` 18, `xl` 24 (`brand/vemoki/tokens.json` `radius`). Wireframe dùng 10–17, khớp không bên nào | Thang tên và số khác nhau; cần chọn thang và ánh xạ tên |
| D3 | **Typography** | Be Vietnam Pro, fallback `system-ui`; không có Sora; không có override mobile trong token | SoT `display` = Sora, `body` = Be Vietnam Pro (`brand/vemoki/tokens.json` `typography`); DECISION-LOG 04/11 “Sora/Be Vietnam Pro”; `foundations.md` Sora 800/700; wireframe dùng font hệ thống | Cần chốt có dùng Sora cho display không và cỡ mobile (36/46, 28/38) |
| D4 | **Ink, viền, muted** | `text` `#17151F`; `border` `#DEDCE6`; `text-secondary` `#625E70` | `ink` `#141020`; `line` `#D7D6E0`; `muted` `#5C5774` (SoT v3; DECISION-LOG 04/11 ghi rõ các giá trị này) | Mọi chữ và viền đều lệch vài đơn vị; cần một bộ |
| D5 | **Nền và paper** | `background` `#FAFAFC`; `surface` `#FFFFFF` | `paper` `#FFFFFF` “canvas trắng” (DECISION-LOG 04/11); wireframe `#faf9fc` | Cần xác định canvas là trắng hay `#FAFAFC` |
| D6 | **Focus** | `focus` `#7038FF` (light) / `#B59AFF` (dark) | `focus` `#5B22F0` (SoT v3; DECISION-LOG 04/11 `focus=#5B22F0`) | Ring focus khác màu CTA trong SoT, giống nhau trong draft |
| D7 | **Trạng thái màu** | `error` `#BE263B`; `success` `#137A4B`; `warning` `#8A5700` | `destructive` `#8A1F1F`; `admit` `#1B7F4A`; `unknown` `#8A6D3B` (SoT v3; DECISION-LOG 04/11: “giữ nguyên”). Wireframe dùng ≥4 đỏ, ≥5 xanh, ≥5 vàng khác nhau | Gate là trạng thái nghiệp vụ; cần PD và Coordinator chốt bộ màu |
| D8 | **Spacing** | 0–96, gồm 40, 64, 80, 96 | `xxs` 2, `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `2xl` 24, `3xl` 32, `4xl` 48, `5xl` 72 (SoT v3). Wireframe dùng 9–25px ngoài thang | Thang khác nhau ở 2, 40, 64, 72, 80, 96 |
| D9 | **Shadow và breakpoint** | Shadow `0 8px 24px rgba(23,21,31,.08)`; breakpoint 768/1024 (+1280 trong `tokens.json`) | Shadow `0 24px 64px rgba(20,16,32,.12)`; breakpoint `sm` 640, `md` 768, `lg` 1024, `xl` 1280 (SoT v3) | Hai bộ không tương thích; cần chọn một |
| D10 | **Logo và wordmark** | Không có master logo; cấm gõ chữ V thay master | SoT có `mark.svg`; DECISION-LOG 04/11 dùng path đã duyệt. `remaining…html` có chữ V gõ tay | Cần xác nhận nguồn logo hiện hành và sửa wireframe trước khi triển khai |
| D11 | **Màu CTA theo sự kiện** | Không có quy tắc | `event-detail` dùng `#245b47` cho nút chính “Đổi mã nhận vé” và box vé đã có, ghi “dùng màu sự kiện”. DECISION-LOG 04/11: branding từ dữ liệu sự kiện đã publish; platform chrome là Electric Violet | Cần xác nhận nút chính có dùng màu sự kiện hay token platform |
| D12 | **Trạng thái đã dùng và chưa rõ** | GUIDELINES §08: đã sử dụng = warning; chưa xác minh = neutral/info | Wireframe: đã dùng = đỏ (E2); chưa rõ = amber (E3). Hai file gate khác nhau về màu “admit” (A9) | Cần PD và Coordinator chốt; không tự đổi O23/O31/O32 |
| D13 | **Tab bar wallet A+C** | Guest/verified theo O28 (không có “Tài khoản” ở tab) | `wallet…hybrid-ac.html` có “Khám phá” và “Tài khoản” trong nav (D-8). ADR đã nói không chép literal | Ghi nhận; cần xác nhận khi triển khai |
