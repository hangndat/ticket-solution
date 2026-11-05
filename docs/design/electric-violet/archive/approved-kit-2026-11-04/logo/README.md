# Vemoki — Electric Violet Logo Kit (handoff, chưa production)

Trạng thái: **asset handoff theo brand user đã duyệt trực tiếp trong chat (2026-11-04)**, chưa tích hợp vào `brand/vemoki/` runtime. Coordinator tích hợp qua `brand/vemoki/scripts/generate-brand-assets.py` sau khi review. Không claim production/pilot ready.

**Điểm vào bộ handoff:** file này (`logo/`) → `../specs/` (foundations/components) → `../preview/index.html` (prototype) → `../REPORT.md` (tổng hợp, checks, giới hạn).

## Bản master hiện tại — vector sạch theo yêu cầu chất lượng nét mới

User phản hồi PNG chưa nét và yêu cầu sửa geometry master sau khi đã chốt identity. `master.svg` hiện dùng đoạn thẳng dài và cubic Bézier được fit bằng Potrace 1.16 từ chính hai mask của ảnh approved (`../sources/violet-mask.png`, `dark-mask.png`); **không còn contour M/L bậc pixel làm master**. Mark vẫn có hai mảng gấp, cạnh trên ngang, đáy trái ngang, notch và góc bo; wordmark là path của đủ chữ “Vemoki”, giữ lỗ chữ e/o. Bản trace cũ chỉ lưu để đối chiếu trong `../archive/trace-svg/`, không nằm trong ZIP.

| Phần | Lệnh path cũ → mới (M/L/C/Z, kể cả lệnh lặp ngầm) | Điểm path cũ → mới (kể cả control point Bézier) | IoU master sạch với mask approved |
| --- | ---: | ---: | ---: |
| Mark | 628 → 39 | 626 → 83 | 0.99534 |
| Wordmark | 948 → 139 | 939 → 256 | 0.99167 |

IoU đo ở cùng ROI 950×250, render SVG 4× rồi downsample Lanczos, alpha >127 đối chiếu mask >127; cả hai vượt ngưỡng 0.97. Xem trực tiếp `../proof/approved-old-clean.png` (approved / trace cũ / clean vector), `../proof/mark-100-light-dark.png` và `wordmark-100-light-dark.png` (canvas 243×64 px ở 100%), cùng `mark-800-old-new.png` / `wordmark-800-old-new.png` (render vector native 8×, trái cũ/phải mới, trên nền trắng/dưới nền tối). Proof 800% cho thấy đường chéo, notch, góc bo và curve e/m/o mượt thay vì bậc 1px.

Tái xuất bằng `python3 docs/design/electric-violet/tools/build_logo.py` từ repo root. Cần Pillow, numpy, CairoSVG và Potrace 1.16; trên Mac design hiện tại script tự trỏ Cairo Homebrew cho CairoSVG. Script tái tạo 10 SVG từ archive template và đúng 2 path master, PNG alpha, cỡ dùng thật, proof, kiểm IoU/bounds và ZIP byte-exact. SVG là nguồn kích thước bất kỳ; PNG khử răng cưa là bản xuất, không upscale PNG cũ.

Các cỡ PNG trong `png/sizes/`: `mark-h24/h48/h96.png` và `horizontal-primary-h32/h64/h128.png` có **chiều cao hình thực** xấp xỉ đúng số px ghi trong tên (canvas lớn hơn để giữ padding); `horizontal-primary-w2048/w4096.png` có chiều rộng canvas 2K/4K. PNG thường dùng render vector ở 4× rồi Lanczos; 2K dùng 2×; 4K render trực tiếp bằng Cairo để tránh ảnh tạm cực lớn. `app-icon-source.png` 1024×1024 là field vuông opaque theo thiết kế; các logo còn lại có alpha trong suốt. `png/presentation/` chỉ là ảnh nền xem thử.

**Batch 2/2** theo `.orca-metrics/electric-violet/fix-batch-2.md` — batch 1/2 (`.orca-metrics/electric-violet/fix-batch-1.md`, EV-01..EV-04) đã bị coordinator **mở lại EV-01**: bản batch 1 dựng mark bằng 9 vertex đo mắt, kết quả silhouette lệch rõ board (nhánh phải thành tam giác vát thay vì cạnh trên ngang, đáy trái thành nhọn thay vì ngang) và REPORT batch 1 claim "khớp rõ / lệch <5px" là **sai**, mâu thuẫn với chính ảnh so sánh. Batch 2 đổi hẳn phương pháp — xem mục Provenance bên dưới và `../REPORT.md` mục Changelog.

**Ngoại lệ EV-05 (1 lượt duy nhất, không reset budget 2/2)** theo `.orca-metrics/electric-violet/diagnosis-export-exception.md`: `stacked.svg` và `reversed-on-violet.svg` có `viewBox`/`translate` sai khiến path wordmark vượt ra ngoài canvas (cắt nửa dưới chữ) — lỗi export/canvas, **không phải** lỗi trace/geometry. Đã sửa chỉ viewBox/translate (giữ nguyên `d` path), kiểm bbox sau transform của toàn bộ 10 SVG, không còn clipping. Chi tiết: `../REPORT.md` mục EV-05.

## Nguồn đã duyệt

Lưu nguyên bản tại [`../sources/`](../sources/):

- `approved-concept-board.png` — board "01 / ELECTRIC VIOLET" (concept gốc user duyệt đầu tiên)
- `approved-logo-suite.png` — board "Vemoki — Electric Violet · Logo Suite" (bộ logo đầy đủ user duyệt, **input duy nhất** cho trace)
- `approved-hero-roi.png` — ROI x300..1250,y150..400 (950×250) cắt từ board gốc, chứa trọn mark + toàn bộ chữ "Vemoki" (kể cả nét trái chữ V và dấu chấm "i") — ROI rộng, không phải bbox cứng từng glyph, dùng để verify nguồn không bị cắt trước khi trace
- `violet-mask.png` / `dark-mask.png` — mask nhị phân (HSV threshold) dùng làm input cho `cv2.findContours`, lưu lại để audit
- `mark-comparison.png` — **APPROVED / RENDERED / OVERLAY-DIFF** cho riêng mark (batch 2/2, thay bản batch 1 đã sai)
- `wordmark-comparison.png` — **APPROVED / RENDERED / OVERLAY-DIFF** cho riêng wordmark, dùng vùng đủ rộng để thấy trọn chữ V bên trái (không còn bị crop cắt như batch 1)

## Lịch sử provenance batch 2/2 — contour trace từ mask màu, trước bản master sạch

Toàn bộ `.svg` trong thư mục này là **vector thật dựng từ raster đã duyệt** — không nhúng raster, không dùng `<text>`/font sống, không phụ thuộc font máy khi mở ở máy khác.

**Phương pháp (áp dụng như nhau cho cả mark và wordmark, batch 2/2):**

1. ROI rộng `x300..1250,y150..400` của `approved-logo-suite.png` (1536×1024) — đủ lớn để chứa trọn mark và toàn bộ "Vemoki", không phải bbox khít từng phần dễ cắt nhầm.
2. **Mark:** mask màu bằng HSV — `V>150 & S>100` (violet sáng+bão hoà cao, phân biệt với nền sáng-nhạt-bão-hoà và chữ tối). `cv2.connectedComponentsWithStats` xác nhận đúng 2 thành phần (hai mảng gấp trái/phải).
3. **Wordmark:** mask màu bằng HSV — `V<100` (tối, không phân biệt bão hoà). `cv2.connectedComponentsWithStats` xác nhận đúng 7 thành phần (V, e, m, o, k, thân i, chấm i) — tự động tìm bbox trọn chữ, **không dùng crop tọa độ đoán trước** (batch 1 từng cắt mất một phần nét trái chữ V vì crop cứng ở x655).
4. Cả hai mask trace bằng `cv2.findContours(RETR_CCOMP)` (giữ đúng lỗ chữ e/o) + `cv2.approxPolyDP(epsilon=0.25px)` — xấp xỉ rất sát (epsilon tính bằng pixel gốc, không làm thẳng cạnh cong bằng ít điểm) → path SVG `fill-rule="evenodd"`.
5. Mark và wordmark **dùng chung một không gian toạ độ ROI pixel** (950×250) — không crop riêng, không offset đoán. Một `translate(0.5,0.5)` được áp cho cả hai nhóm để sửa lệch nửa-pixel giữa toạ độ lưới-contour và quy ước pixel-center khi SVG rasterize (phát hiện qua sweep dịch chuyển, xem dưới).

**Kiểm định định lượng (yêu cầu bắt buộc batch 2/2 — IoU ≥ 0.98 riêng từng phần):**

Dựng mask nhị phân từ SVG render ở 4x rồi downsample (anti-alias-robust), so với mask nguồn ở cùng scale/toạ độ (chỉ translate, không warp/fit khác):

| Phần | IoU đo được | Ngưỡng | Kết quả |
| --- | --- | --- | --- |
| Mark | **0.9902** | ≥ 0.98 | PASS |
| Wordmark | **0.9854** | ≥ 0.98 | PASS |

Threshold dùng: mask nguồn nhị phân hoá ở `V>150&S>100` (mark) / `V<100` (wordmark) trên ảnh gốc; mask render lấy từ diff-với-nền-trắng `>30` trên canvas 4x rồi `INTER_AREA` downsample về 1x, nhị phân hoá tại 127/255. Lệch nửa-pixel (contour-grid vs. SVG pixel-center) được tìm bằng sweep dịch chuyển ±1.5px quanh gốc và chọn offset tối đa hoá IoU — đây là hiệu chỉnh căn lưới hợp lệ (translation thuần), không phải "fit lại hình" để qua ngưỡng. Ảnh bằng chứng: `../sources/mark-comparison.png`, `../sources/wordmark-comparison.png` (đã mở bằng tool và xem trực tiếp cạnh trên nhánh phải/cạnh đáy trái/notch trước khi báo cáo).

**Khác biệt còn lại của bản batch 2/2 lịch sử:** viền mỏng do anti-alias ở biên contour — nhìn trong overlay-diff là đường viền mảnh bao quanh silhouette, không phải lệch khối. Polygon dày đặc của bản đó lộ facet khi phóng lớn; master hiện tại đã thay bằng cạnh thẳng và Bézier, xem proof 800% ở trên.

**Màu:** `#6C35FF` (Electric Violet) và `#141020` (ink gần đen) là giá trị **đề xuất chuẩn hóa** khớp mắt với board đã duyệt, **không phải hex đo được từ file vector gốc** (không có). Xem `../specs/foundations.md` để biết trạng thái và căn cứ chọn.

**Font (chỉ còn áp dụng ngoài logo):** không SVG nào trong thư mục này còn phụ thuộc font — toàn bộ chữ là path. Sora/Be Vietnam Pro chỉ còn dùng cho UI chữ sống trong `../preview/index.html` (heading, body, form) và trong `../specs/foundations.md`, tại `apps/web/fonts/*.ttf` (OFL) — `brand/vemoki/*.ttf` không tồn tại trong repo (sửa từ batch 1).

## File

### SVG thật (vector, không font, không raster nhúng) — `svg/`

| File | Vai trò | Nền khuyến nghị | Ghi chú |
| --- | --- | --- | --- |
| `horizontal-primary.svg` | Lockup ngang chính (mark + wordmark, màu Electric Violet) | paper `#F4F6F8` hoặc trắng | Mặc định cho header/app bar. Mark + wordmark cùng một coordinate space ROI (không crop riêng từng phần). |
| `stacked.svg` | Lockup dọc (mark trên, wordmark dưới, màu) | paper/trắng | Social avatar, splash hẹp — tái dùng đúng path nguồn, chỉ đổi transform layout |
| `mark.svg` | Glyph V màu Electric Violet, không chữ | sáng | Favicon lớn, watermark |
| `mark-mono-black.svg` | Glyph đơn sắc đen `#141020` | sáng/trung tính | In 1 màu, stamp |
| `mark-mono-white.svg` | Glyph đơn sắc trắng | nền tối/ảnh | Overlay trên media tối |
| `horizontal-mono-black.svg` | Lockup ngang đơn sắc đen | sáng/trung tính | Suite đã duyệt có bản mono cho cả lockup, không chỉ mark |
| `horizontal-mono-white.svg` | Lockup ngang đơn sắc trắng | nền tối | — |
| `reversed-on-violet.svg` | Lockup trắng trên nền Electric Violet (card bo góc) | `#6C35FF` | Banner, splash tối, email header — có nền `rx=16` bake sẵn, dùng như card, không phải app icon |
| `app-icon.svg` | **PREVIEW** — glyph trắng trên field Electric Violet bo góc | — | Chỉ để xem trước tỷ lệ; **không submit file này lên store** |
| `app-icon-source.svg` | **Nguồn thật** — field Electric Violet vuông full-bleed, không bo góc, không mask | — | Dùng làm input cho pipeline icon nền tảng (iOS/Android tự áp mask superellipse/circle khi build) |

### PNG — `png/` (export thật, alpha trong suốt) và `png/presentation/` (chỉ để xem, không phải asset thật)

`png/*.png` xuất trực tiếp từ SVG tương ứng với **alpha channel thật** (nền trong suốt), trừ `app-icon-source.png` vốn full-bleed/không alpha theo thiết kế (artwork vuông đặc kín cạnh).

`png/presentation/` chứa 4 file **chỉ để xem** mono-black trên nền sáng và mono-white trên nền tối (vì bản thân mono-trên-nền-cùng-màu sẽ vô hình) — **không phải** bản xuất production.

## Clear space và kích thước tối thiểu

- **Clear space:** tối thiểu bằng **1× chiều cao của mảng trái (leg trái) của glyph V** đo từ mép ngoài logo ra mọi phía — không UI element, text hoặc logo khác chạm vào vùng này.
- **Min size digital:** `mark` đơn lẻ ≥ 24×24px hiển thị thực (không phải canvas file); `horizontal-primary` ≥ 120px chiều rộng để wordmark còn đọc được.
- **Min size print:** `mark` ≥ 10mm chiều cao; lockup ngang ≥ 28mm chiều rộng.
- Dưới mức tối thiểu: dùng `mark` hoặc `app-icon-source`, không co lockup ngang đầy đủ.

## Nền và contrast

| Logo | Nền hợp lệ | Nền cấm |
| --- | --- | --- |
| `horizontal-primary` / `stacked` / `mark` (màu) | Trắng, paper sáng (`#F4F6F8` hoặc tương đương) | Nền tối, nền có texture rối, nền tím (dùng `reversed-on-violet` thay) |
| `mark-mono-black` / `horizontal-mono-black` | Nền sáng trung tính | Nền tối |
| `mark-mono-white` / `horizontal-mono-white` / `reversed-on-violet` | Nền tối hoặc Electric Violet `#6C35FF`+ | Nền sáng (mất contrast) |
| `app-icon-source` | Tự chứa nền, không đặt trên nền khác | — |

Contrast số đo (ink/paper/violet, badge trạng thái) nằm ở `../REPORT.md` — logo mark là graphic object nên không áp WCAG text-contrast, nhưng wordmark-as-text trong `preview/index.html` vẫn được đo như text.

## Lịch sử build batch 2/2 — đã được thay bằng `tools/build_logo.py`

Ở batch 2/2, chưa có pipeline tự động regenerate từ ảnh duyệt (script khi đó chạy thủ công, không phải CI). Quy trình lịch sử: crop ROI rộng từ `approved-logo-suite.png` → mask HSV (violet: `V>150&S>100`; dark: `V<100`) → `cv2.connectedComponentsWithStats` xác nhận đúng số thành phần kỳ vọng (2 cho mark, 7 cho wordmark) trước khi trace → `cv2.findContours(RETR_CCOMP)` + `approxPolyDP(epsilon=0.25px)` → path SVG `fill-rule=evenodd` dùng chung ROI coordinate space. Master hiện tại đã thay bước contour cuối bằng Potrace fit cạnh thẳng/Bézier và có script tái xuất ở trên. Khi coordinator tích hợp vào `brand/vemoki/`, đối chiếu lại geometry này với file gốc nếu có trước khi thay `brand/vemoki/mark.svg` hiện tại — xem mapping ở `../REPORT.md` §Mapping tích hợp.

## ZIP tải được

`vemoki-electric-violet-logo-kit.zip` (cùng thư mục) — chứa `master.svg`, toàn bộ `svg/` + `png/` (gồm `png/sizes/` và `png/presentation/`) + README này, regenerate từ master sạch. Archive trace cũ và proof không nằm trong ZIP.
