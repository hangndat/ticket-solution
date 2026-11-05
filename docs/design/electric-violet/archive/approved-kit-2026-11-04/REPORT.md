# Electric Violet — Report (Liv · product-design)

Trạng thái: **handoff docs/design local**, task user giao trực tiếp trong chat (2026-11-04), **không** claim production/acceptance/UAT PASS. Artifact chỉ ghi trong `docs/design/electric-violet/**`; không sửa `brand/vemoki/**`, `apps/**`, `packages/**` theo scope Task.

## Bản hiện tại — vector master mượt theo yêu cầu user mới

User phản hồi PNG chưa nét sau EV-05 và explicit yêu cầu sửa master. Đây là bước chất lượng mới có thẩm quyền, **không reset** lịch sử fix **2/2** + ngoại lệ export **1/1**. Bản trace contour cũ nằm trong `archive/trace-svg/` để đối chiếu; `logo/master.svg` và 10 SVG biến thể hiện tại dùng đúng hai path sạch fit từ mask approved bằng Potrace 1.16 (cạnh thẳng dài + cubic Bézier, không font, không raster embed). Màu, layout/clear space EV-05, và identity approved giữ nguyên. Script tái xuất: `tools/build_logo.py`; chi tiết cỡ PNG và phụ thuộc ở `logo/README.md`.

| Phần | Lệnh path cũ → mới (M/L/C/Z, kể cả lệnh lặp ngầm) | Điểm path cũ → mới (gồm control point) | IoU mới với mask approved | Ngưỡng |
| --- | ---: | ---: | ---: | ---: |
| Mark | 628 → 39 | 626 → 83 | **0.99534** | ≥0.97 |
| Wordmark | 948 → 139 | 939 → 256 | **0.99167** | ≥0.97 |

Phương pháp đo: cùng ROI 950×250 của approved logo-suite, raster SVG 4× rồi downsample Lanczos, so alpha >127 với mask nguồn >127; không warp/fit lại theo metric. `proof/approved-old-clean.png` đối chiếu approved / trace cũ / vector sạch. `proof/{mark,wordmark}-100-light-dark.png` là 100% ở canvas 243×64 px; `proof/{mark,wordmark}-800-old-new.png` là render native 8× các vùng cạnh chéo, notch và e/m/o (trái cũ/phải mới, trên trắng/dưới tối). Đã mở proof bằng tool: mép bậc pixel của bản cũ biến thành cạnh thẳng và curve mượt, giữ đặc điểm hình học board. Ở 100%, khác biệt nhỏ do pixel cuối cùng vẫn phải rasterize; khi phóng 800%, cải thiện hình học rõ ràng.

PNG xuất trực tiếp từ SVG sạch và khử răng cưa: `png/sizes/mark-h24/h48/h96.png`, `horizontal-primary-h32/h64/h128.png`, `horizontal-primary-w2048/w4096.png`. Bộ 10 PNG gốc cũng regenerate, icon source 1024×1024 opaque theo thiết kế; logo còn lại có alpha. ZIP hiện có **34 file** gồm `master.svg`, 10 SVG, PNG thường/cỡ dùng thật/presentation và README, mỗi entry được kiểm byte-exact với disk; archive không đưa vào ZIP. Kiểm control-hull của path Bézier **sau toàn bộ transform**: **10/10 SVG** nằm trong viewBox, margin nhỏ nhất **4px** ở lockup ngang; stacked còn **≥21.8px** kể cả control point (render alpha còn ≥28.5px). Script cũng raster alpha cô lập khỏi nền để kiểm clipping trực quan. Preview desktop 1440 và mobile 390 đã chụp lại bằng Chrome headless sau thay SVG; tile stacked không cắt chữ (ảnh crop `preview/evidence/stacked-tile-crop.png`).

Giới hạn: source approved chỉ là raster, nên master sạch là reconstruction theo silhouette, không phải file vector gốc. PDF/screenshot có thể nội suy khác PNG xuất bởi CairoSVG; SVG master là nguồn để xuất lại ở cỡ mong muốn. Chưa tích hợp hay kiểm trên app runtime.

Kiểm preview bằng Impeccable detector sau khi cập nhật dòng provenance: còn cảnh báo sẵn có về một cặp chữ nhạt trên tím 4.3:1, cấp heading h2→h4, decorative repeating gradient và mật độ em dash; các phần này không thuộc yêu cầu sửa hình học logo và chưa được tính là nghiệm thu accessibility của prototype.

**Bản sửa batch 2/2** theo `.orca-metrics/electric-violet/fix-batch-2.md`. Batch 1 (`.orca-metrics/electric-violet/fix-batch-1.md`, EV-01..EV-04) đã **sai**: coordinator mở lại EV-01 sau khi tự xem `mark-comparison.png`/`horizontal-primary.png` batch 1 — silhouette mark rõ ràng lệch board (nhánh phải thành tam giác vát thay vì cạnh trên ngang, đáy trái thành nhọn thay vì ngang), và REPORT batch 1 **claim sai** "khớp rõ / lệch <5px", mâu thuẫn trực tiếp với ảnh so sánh của chính nó. Batch 2 đổi hẳn phương pháp dựng mark (contour trace từ mask màu thay vì đo 9 vertex bằng mắt) và sửa crop wordmark bị cắt chữ V. Fix budget batch 2 đã dùng hết: **2/2**.

**Ngoại lệ đơn lẻ (EV-05)** theo `.orca-metrics/electric-violet/diagnosis-export-exception.md` — coordinator chẩn đoán riêng `logo/png/stacked.png` bị cắt nửa dưới chữ (lỗi canvas/export, không phải lỗi trace/identity), cho phép **1 lượt ngoại lệ** theo `docs/agents/workflows/review.md` §4, không reset fix budget 2/2. Xem mục **EV-05** cuối file.

## CRG / LeanCTX scope

- CRG: `list_graph_stats_tool` tại `repo_root=/Users/admin/SideProject/ticket-solution/main-3`, graph fresh tại HEAD `2f76bab8983709b36a2bfb8b749fbe54a5eb82ef` (khớp base SHA giao), `head_matches_build=true`. Chạy query `file_summary` cho `brand/vemoki/tokens.json` (0 kết quả — file JSON không có node code, đúng kỳ vọng, không phải lỗi).
- LeanCTX: mọi đọc source/docs dùng `ctx_read`/`ctx_search`/`ctx_glob` theo policy. Hai ảnh đã duyệt nằm ngoài path project (`agent-session-attachments`, `codex-accounts` generated_images) — mở trực tiếp qua `ctx_read` (viewer), không scan thư mục attachment.
- Hai ảnh gốc được sao chép nguyên bản vào `sources/approved-concept-board.png` và `sources/approved-logo-suite.png`.

## Files bàn giao

```
docs/design/electric-violet/
├── sources/approved-concept-board.png       # ảnh gốc 01/ELECTRIC VIOLET
├── sources/approved-logo-suite.png          # board logo suite đầy đủ user duyệt — input duy nhất cho trace
├── sources/approved-hero-roi.png            # ROI x300..1250,y150..400 (950x250), chứa trọn mark+wordmark (batch 2/2)
├── sources/violet-mask.png / dark-mask.png  # mask HSV nhị phân dùng làm input findContours (batch 2/2, audit)
├── sources/mark-comparison.png              # APPROVED/RENDERED/OVERLAY-DIFF — mark (batch 2/2, thay bản batch 1 sai)
├── sources/wordmark-comparison.png          # APPROVED/RENDERED/OVERLAY-DIFF — wordmark, không còn cắt chữ V (batch 2/2)
├── archive/trace-svg/*.svg                   # bản trace bậc pixel lịch sử, không trong ZIP
├── logo/master.svg                          # master hiện tại: cạnh thẳng + cubic Bézier
├── logo/README.md                           # provenance, fidelity, IoU, clear space, min size, nền/contrast
├── logo/svg/{mark,mark-mono-black,mark-mono-white}.svg
├── logo/svg/{horizontal-primary,horizontal-mono-black,horizontal-mono-white}.svg
├── logo/svg/{stacked,reversed-on-violet,app-icon,app-icon-source}.svg
├── logo/png/<cùng tên>.png                  # alpha trong suốt thật (trừ app-icon-source.png, full-bleed có chủ đích)
├── logo/png/sizes/*.png                      # cỡ 24/48/96, 32/64/128, 2K/4K từ master
├── logo/png/presentation/*.png              # chỉ để xem mono trên nền tương phản, KHÔNG phải asset production
├── logo/vemoki-electric-violet-logo-kit.zip # ZIP tải được (master/svg/png/README, byte-exact)
├── proof/*.png                              # approved/old/clean, 100% và 800% nền sáng/tối
├── tools/build_logo.py                      # tái xuất geometry, PNG, proof, ZIP và checks
├── specs/foundations.md                     # primitive→semantic→component tokens, typography, spacing/radius/scale/motion
├── specs/components.md                      # button, field/search, chips, event/ticket row, notice/status, QR surface
├── preview/index.html                       # prototype self-contained, chỉ <img src> tới logo/svg (không inline path cũ), VI, dữ liệu giả có nhãn
├── preview/evidence/desktop-1440.png        # chụp lại sau master sạch
├── preview/evidence/mobile-390.png          # chụp lại sau master sạch
├── preview/evidence/stacked-tile-crop.png   # crop tile desktop, trọn chữ
└── REPORT.md                                # file này
```

## Đối chiếu với ảnh đã duyệt (sau batch 2/2 — rút lại claim sai của batch 1)

**Batch 1 đã claim sai, chính thức rút lại:** "silhouette, cạnh đáy, nhánh phải, khe cắt chéo khớp rõ với board; lệch ước tính <5px" — **sai**. Ảnh `sources/mark-comparison.png` của batch 1 (đã bị ghi đè bằng ảnh batch 2 đúng) thực tế cho thấy nhánh phải render thành tam giác dài vát lên (board: cạnh trên gần ngang) và đáy nhánh trái render thành điểm nhọn (board: cạnh đáy gần ngang) — sai lệch hình dạng rõ, không phải lệch vài pixel. Nguyên nhân: batch 1 dựng path bằng cách đo 9 vertex bằng mắt trên ảnh phóng to, không phải trace pixel.

**Batch 2 — phương pháp mới, định lượng được:** mark và wordmark đều dựng bằng **contour trace trực tiếp từ mask màu** của `sources/approved-logo-suite.png` (không còn đo mắt):

- ROI rộng `x300..1250,y150..400` (950×250) — đủ chứa trọn mark + toàn bộ "Vemoki", xuất `sources/approved-hero-roi.png` để verify nguồn không bị cắt trước khi trace.
- Mark: mask HSV `V>150 & S>100` → `cv2.connectedComponentsWithStats` xác nhận đúng **2** thành phần (hai mảng gấp) → `cv2.findContours(RETR_CCOMP)` + `approxPolyDP(epsilon=0.25px)`.
- Wordmark: mask HSV `V<100` → xác nhận đúng **7** thành phần (V,e,m,o,k, thân i, chấm i), bbox tự động từ mask (không còn crop cứng `x655` từng cắt mất một phần nét trái chữ V ở batch 1 — đây chính là vấn đề EV-02 "còn vấn đề crop" coordinator nêu).
- Mark và wordmark dùng **chung một coordinate space ROI** (translation thuần, có hiệu chỉnh `translate(0.5,0.5)` do lệch nửa-pixel giữa lưới contour và pixel-center SVG, tìm bằng sweep offset).

**Kiểm định định lượng (yêu cầu bắt buộc):** IoU giữa mask nguồn và mask render-từ-SVG (4x supersample rồi downsample, cùng scale/coordinate, chỉ translation):

| Phần | IoU | Ngưỡng | Kết quả |
| --- | --- | --- | --- |
| Mark | **0.9902** | ≥ 0.98 | PASS |
| Wordmark | **0.9854** | ≥ 0.98 | PASS |

Threshold: mask nguồn nhị phân tại `V>150&S>100` (mark)/`V<100` (word); mask render từ diff-với-nền-trắng `>30` ở 4x rồi `INTER_AREA` downsample, nhị phân tại 127/255. Đã **mở cả hai ảnh comparison bằng tool và xem trực tiếp** cạnh trên nhánh phải, cạnh đáy trái, notch trước khi báo cáo — khớp rõ với board, không còn mâu thuẫn như batch 1. Bằng chứng: `sources/mark-comparison.png`, `sources/wordmark-comparison.png` (nhãn APPROVED/RENDERED/OVERLAY-DIFF, nền trắng, cùng kích thước).

**Lắp ráp lockup:** `horizontal-primary.svg` và các biến thể ngang khác dùng chung đúng path `mark_d`/`word_d` nguồn trong coordinate space ROI — không crop riêng, không offset đoán lại.

Màu: `#6C35FF` / `#141020` / `#D7D6E0` / `#FFFFFF` lấy bằng color-pick mắt trên 4 chip màu của board — **không có file vector gốc để đo hex chính xác**; `specs/foundations.md` §0 ghi rõ trạng thái "đề xuất, khớp mắt" cho từng giá trị, không ghi là đã đo.

## Contrast đã tính (WCAG, công thức relative luminance chuẩn)

| Cặp | Ratio | Ngưỡng | Kết quả |
| --- | --- | --- | --- |
| ink `#141020` / white `#FFFFFF` (body text) | 18.67:1 | AA text 4.5:1 | PASS rộng |
| ink `#141020` / neutral-100 `#EFEEF4` (text trên surface) | 16.19:1 | AA 4.5:1 | PASS |
| ink-500 muted `#5C5774` / white (caption) | 6.84:1 | AA 4.5:1 | PASS |
| white / violet-500 `#6C35FF` (chữ nút CTA) | 5.85:1 | AA 4.5:1 | PASS |
| white / violet-600 `#5B22F0` (hover CTA) | 7.16:1 | AA 4.5:1 | PASS |
| violet-500 `#6C35FF` / white (ghost button / link text) | 5.85:1 | AA 4.5:1 | PASS |
| **success badge text `#1B7F4A` / bg `#E6F4EC` (hex gốc legacy)** | **4.43:1** | AA 4.5:1 | **FAIL sát ngưỡng** — đã sửa trong preview: badge text dùng `#146B3C` thay vì `#1B7F4A` trên nền badge này → 5.79:1 PASS. Token semantic `admit` ở `foundations.md` **không đổi** (vẫn giữ nguyên `#1B7F4A` theo legacy) — chỉ chỉnh màu chữ hiển thị trên badge nhạt này, ghi rõ bằng comment trong `preview/index.html`. |
| **warning badge text `#8A6D3B` / bg `#F7F0E2`** | **4.28:1** | AA 4.5:1 | **FAIL sát ngưỡng** — sửa tương tự: `#6E4F20` → 6.61:1 PASS trong preview |
| error badge text `#8A1F1F` / bg `#F4E6E6` | 7.54:1 | AA 4.5:1 | PASS |
| violet-600 `#5B22F0` focus ring / white (non-text UI component) | 7.16:1 | 3:1 | PASS |
| neutral-200 border `#D7D6E0` / white | 1.44:1 | — | Decorative border, không phải essential UI boundary bắt buộc 3:1 (shape/label vẫn phân biệt state) |

**Finding thực đã sửa trong preview:** hai badge success/warning với hex legacy gốc (`admit`/`unknown` nguyên bản) dưới ngưỡng AA text khi đặt trên nền pastel đề xuất; preview dùng biến thể đậm hơn chỉ cho text-on-badge, không đổi token semantic. Khi tích hợp thật, component "notice/status" (`specs/components.md` §5) cần áp cùng cách xử lý này hoặc chọn nền badge đậm hơn.

## Giới hạn chưa kiểm

1. **Vector fidelity:** không có nguồn vector gốc (Figma/AI/SVG) của logo suite đã duyệt — chỉ có raster. Bản batch 2/2 lịch sử dùng contour polygon và có facet khi phóng lớn; master hiện tại đã fit cạnh thẳng/Bézier, IoU mark 0.99534 / wordmark 0.99167 với mask approved. Đây vẫn là **reconstruction nội bộ** theo silhouette raster đã duyệt, không phải claim trùng pixel-exact với vector gốc không tồn tại.
2. **Typography trong logo — đã giải quyết:** không SVG nào trong `logo/svg/` còn dùng `<text>`/font-family nữa; wordmark là path thật, không phụ thuộc font khi mở ở máy khác (xem Changelog EV-02). Sora/Be Vietnam Pro chỉ còn dùng cho chữ sống trong `preview/index.html` và `specs/foundations.md` — không ảnh hưởng tới logo.
3. **Citation font — đã sửa (EV-04):** bản đầu dẫn `brand/vemoki/Sora-Variable.ttf`/`brand/vemoki/BeVietnamPro-*.ttf` — **các file này không tồn tại**, đã verify qua `ctx_glob` (0 kết quả). Đường dẫn đúng là `apps/web/fonts/` (mirror `apps/mobile/assets/fonts/`), đã sửa trong `specs/foundations.md`, `logo/README.md`, và `preview/index.html` (`@font-face url()`); preview đã chụp lại, font hiển thị đúng (xem `preview/evidence/`).
4. **App icon mask:** `logo/svg/app-icon.svg` (PREVIEW, bo `rx=64`) dùng `rx` xấp xỉ, không phải mask HIG/Material thật. Bản `app-icon-source.svg` (full-bleed, vuông, không bo) là nguồn thật cho pipeline nền tảng tự áp mask — chưa chạy qua pipeline iOS/Android thật, chưa kiểm safe-area.
5. **Runtime chưa kiểm:** chưa chạy trên `apps/web`/`apps/mobile` thật — đây là docs/spec, không phải code. Chưa test VoiceOver/TalkBack, Dynamic Type, zoom 200%, dark mode thật, hoặc thiết bị thật. Preview chỉ chụp Chromium headless desktop 1440×1000 và mobile 390×844 (xem `preview/evidence/`).
6. **Skill `impeccable` — đã nạp (EV-04):** đọc được tại path chính xác coordinator cung cấp (`.../codex-accounts/98ff12be-1ee8-41b8-94e2-9e21ac05283b/home/skills/impeccable/SKILL.md`), không scan home/attachment root. Bản đầu báo "unavailable" là sai — skill tồn tại ở path cụ thể đó, chỉ không nằm trong catalog skill mặc định của session. Nội dung skill (design review playbook cho UI tương tác) chỉ **reference phù hợp** theo Task — không áp dụng trực tiếp vì Task này là logo/spec/prototype tĩnh, không phải sửa UI tương tác đang chạy.
7. **Không đối chiếu được** `docs/design/design-system/Vemoki-Brand-Guidelines-v1.pdf` và `docs/design/design-system/vemoki-design-system-v0.1/` (ghi trong skill vemoki-design-system là **untracked** tại thời điểm lập skill, không tồn tại trong working tree hiện tại khi kiểm tra lại). Không phụ thuộc vào hai nguồn này; dùng hai ảnh user duyệt trong chat làm brand input duy nhất cho Task, theo đúng chỉ dẫn Task.
8. **Phân biệt với draft brand khác:** skill `vemoki-design-system` còn ghi nhận một draft brand *khác* đã từng được đề cập ("Connect V", Indigo `#5635E8` / Lime `#C5F52A` / Ink `#19152E`) — **đây không phải Electric Violet**. Electric Violet (`#6C35FF` tím, không Indigo/Lime) là hướng user duyệt cho Task này; không trộn hai đề xuất.

## Đối chiếu token cũ (runtime hiện hành)

`brand/vemoki/tokens.json` hiện là **Live Pulse v2** (`ink #0B1220`, `paper #F4F6F8`, `signal #E11D48`, `primary #7C4DED`, `focus #2563EB`) — SoT runtime cho `apps/web`/`apps/mobile` ngoài Portal, đã freeze theo `docs/design/visual-identity-v2/`. Electric Violet là **đề xuất mới**, chưa merge, chưa thay runtime này.

Contract generator thật (`packages/ui/scripts/generate-tokens.mjs`, đã kiểm kê, không sửa) đọc đúng 10 khoá màu bắt buộc từ `tokens.json`: `ink, paper, signal, primary, focus, line, muted, destructive, admit, unknown` + `radius/shadow/space/breakpoints` pass-through, xuất `packages/ui/src/generated/vemoki-theme.css`. Mapping khi tích hợp (không tự sửa, chỉ đề xuất cho coordinator):

| Key generator (`tokens.json`) | Live Pulse v2 hiện tại | Đề xuất Electric Violet | Ghi chú |
| --- | --- | --- | --- |
| `ink` | `#0B1220` | `#141020` | Gần, ấm/tím hơn |
| `paper` | `#F4F6F8` | `#EFEEF4` (derived neutral-100) | Khác tông (xanh nhạt → tím nhạt) — cần xác nhận PD trước khi đổi |
| `signal` | `#E11D48` (đỏ-hồng CTA) | **Không có tương đương đã duyệt** | Electric Violet board không duyệt accent đỏ/hồng; nếu `signal` đổi nghĩa thành CTA tím thì trùng `primary` — cần coordinator quyết định có giữ `signal` khác `primary` hay không |
| `primary` | `#7C4DED` | `#6C35FF` | Trọng tâm đổi màu của Task |
| `focus` | `#2563EB` (xanh dương) | **Chưa duyệt riêng** | Board không có màu focus; đề xuất tạm `#5B22F0` (derived) hoặc escalate |
| `line` | `#D7DFE9` | `#D7D6E0` | Gần, tông trung tính đổi nhẹ |
| `muted` | `#5B687B` | `#5C5774` (derived) | Gần |
| `destructive` | `#8A1F1F` | **Giữ nguyên** | Không đổi — board không duyệt màu error mới |
| `admit` | `#1B7F4A` | **Giữ nguyên** | Không đổi — invariant nghiệp vụ Gate |
| `unknown` | `#8A6D3B` | **Giữ nguyên** | Không đổi |

**Không tạo token SoT thứ hai** — bảng trên chỉ là mapping đề xuất, đích tích hợp vẫn là `brand/vemoki/tokens.json` qua generator hiện có khi coordinator duyệt.

## Mapping/migration theo owner

| Owner | Việc khi được giao Task coding riêng | Không thuộc Task này |
| --- | --- | --- |
| Coordinator | Reconcile Electric Violet vs. Live Pulse v2 freeze (`docs/design/visual-identity-v2/`) và `Epic #766`; quyết định có cập nhật `brand/vemoki/tokens.json` + chạy lại `generate-brand-assets.py`/`generate-tokens.mjs` hay không | Không tự chạy generator trong Task này (chỉ ghi `docs/design/electric-violet/**`) |
| Web (`apps/web`) | Nếu được duyệt: cập nhật `@theme`/CSS vars theo mapping trên, đối chiếu `packages/ui` component hiện có với `specs/components.md` | Không đổi IA, không thêm route |
| iOS (`apps/mobile`) | Map 10 hex vào theme RN hiện có theo cùng mapping; regenerate icon/splash theo `logo/svg/app-icon.svg` qua pipeline iOS chuẩn (asset catalog, không chèn SVG thẳng) | Không đổi Gate/Scanner (ngoài scope O23) |
| Portal | **Out — không áp dụng gì từ Task này** | Giữ Ant Design/ProComponents mặc định theo O26 |

## Changelog — findings batch 1/2 (EV-01..EV-04)

Nguồn: `.orca-metrics/electric-violet/fix-batch-1.md`.

| # | Mức | Finding | Đóng bằng (batch 1) | Trạng thái thật |
| - | --- | --- | --- | --- |
| EV-01 | Chặn | Hình học logo (`horizontal-primary.png` bản đầu) lệch rõ mẫu approved | Đo 9 vertex bằng mắt trên crop 3x, dựng path mới | **REOPENED bởi coordinator, rồi đóng lại ở batch 2/2** — bản đóng batch 1 **vẫn sai** (nhánh phải thành tam giác vát, đáy trái thành nhọn, claim "khớp rõ/lệch<5px" trong REPORT là sai). Xem bảng batch 2/2 bên dưới để biết cách đóng thật. |
| EV-02 | Chặn | Wordmark không khớp tỷ lệ/độ đậm mẫu; SVG dùng `<text font-family=Sora>` phụ thuộc font máy | Thay bằng outline trace (threshold → `findContours` → `approxPolyDP`) | **Một phần đúng** (hết phụ thuộc font) **nhưng còn lỗi crop** — crop cứng `x655` cắt mất một phần nét trái chữ "V". Sửa ở batch 2/2 (bbox tự động từ mask, không crop cứng). |
| EV-03 | Quan trọng | PNG không có alpha thật; thiếu mono lockup ngang; app-icon preview lẫn với nguồn full-bleed | Render alpha thật; thêm mono horizontal; tách `app-icon-source.svg` | **Giữ nguyên, không bị ảnh hưởng bởi batch 2/2** — chỉ re-render lại PNG theo geometry mới, cấu trúc file không đổi. |
| EV-04 | Quan trọng | Report claim sai "skill impeccable unavailable"; citation font sai path | Đọc đúng skill tại path cho; sửa citation sang `apps/web/fonts/` | **Giữ nguyên, đã verify lại đúng ở batch 2/2.** |

## Changelog — findings batch 2/2 (EV-01 reopened, EV-02 crop)

Nguồn: `.orca-metrics/electric-violet/fix-batch-2.md`. Fix budget đã dùng: **2/2 (hết)**.

| # | Mức | Finding | Đóng bằng | Bằng chứng |
| - | --- | --- | --- | --- |
| EV-01 (reopened) | Chặn | Batch 1 dựng mark bằng 9 vertex đo mắt → silhouette lệch rõ board (nhánh phải vát thay vì cạnh trên ngang; đáy trái nhọn thay vì ngang); REPORT batch 1 claim "khớp rõ/lệch<5px" là **claim sai**, mâu thuẫn ảnh so sánh của chính nó | **Đổi hẳn phương pháp**: mask màu HSV (`V>150&S>100`) trên ROI rộng `x300..1250,y150..400` của board gốc → xác nhận đúng 2 connected component → `cv2.findContours(RETR_CCOMP)` + `approxPolyDP(epsilon=0.25px)` — không còn đo mắt, không còn tự chọn lại hình học | IoU mark **0.9902** (≥0.98); `sources/mark-comparison.png` (APPROVED/RENDERED/OVERLAY-DIFF, đã mở bằng tool và xem cạnh trên nhánh phải/cạnh đáy trái/notch trước khi báo cáo) |
| EV-02 (crop fix) | Chặn | Wordmark crop cứng `x655` trong batch 1 cắt mất một phần nét trái chữ "V" của "Vemoki" | Bbox wordmark **tự động** từ mask `V<100` trong cùng ROI (xác nhận đúng 7 component: V,e,m,o,k,thân i,chấm i) — không còn toạ độ crop đoán trước; trace cùng phương pháp `findContours`+`approxPolyDP` | IoU wordmark **0.9854** (≥0.98); `sources/wordmark-comparison.png` cho thấy trọn chữ "V" không còn bị cắt, kể cả `sources/approved-hero-roi.png` xuất trước khi trace để verify nguồn |
| Đồng nhất artifact | Quan trọng | Report/README batch 1 còn claim sai; cần đồng nhất SVG/PNG/ZIP/preview sau khi đổi geometry | Rút lại claim sai trong `logo/README.md`/`REPORT.md` (mục trên); render lại toàn bộ 10 SVG biến thể dùng chung path mới; render lại toàn bộ PNG (`png/` + `png/presentation/`); rebuild `vemoki-electric-violet-logo-kit.zip`; chụp lại `preview/evidence/*` | File list ZIP khớp `svg/`+`png/`; preview chỉ `<img src>` tới `logo/svg/*` (không inline path cũ) — verify bằng `ctx_search` không thấy `<path d=`/`<svg` trong `preview/index.html` |

**Kết quả cuối của batch 2/2 (lịch sử):** mark IoU 0.9902, wordmark IoU 0.9854 — cả hai ≥ 0.98. Master hiện tại và số đo mới nằm ở đầu REPORT. Fix budget batch này đã dùng hết 2/2 theo assignment.

## EV-05 — lỗi export/canvas bị bỏ sót ở review đầu (ngoại lệ 1/1, không reset 2/2)

Nguồn: `.orca-metrics/electric-violet/diagnosis-export-exception.md`. Generic check trước đó (alpha channel, bounds tổng quát) chỉ kiểm cú pháp SVG/kênh alpha, **bỏ sót clipping theo viewBox** — lỗi này không được báo trong các lượt trước, ghi nhận công khai, không che giấu.

**Nguyên nhân (đã xác minh bằng tính bbox thật, không phải phỏng đoán):** `d` path của mark/wordmark hoàn toàn đúng (không đổi ở ngoại lệ này) — lỗi nằm ở `viewBox` + `translate` của từng file lắp ráp, khiến bbox sau transform vượt ra ngoài canvas.

| File | Lỗi trước | Bbox sau transform (trước sửa) | viewBox trước | Kết quả |
| --- | --- | --- | --- | --- |
| `stacked.svg` | `translate(-315.0,215)` cho nhóm wordmark | y: 288.5 → 416.5 | `0 0 608 350` | Cắt mất y=350→416.5 — **hơn nửa dưới mọi chữ cái** |
| `reversed-on-violet.svg` | `translate(-5.0,60)` cho nhóm wordmark (phát hiện thêm khi kiểm hồi quy cả 10 SVG theo yêu cầu, không nằm trong chẩn đoán gốc) | y: 133.5 → 261.5 | `0 0 960 240` | Cắt mất y=240→261.5 — đáy chữ bị cắt |

**Cách sửa (chỉ viewport/translation, không đổi `d`, màu, hay font):**

- `stacked.svg`: tính lại bbox thật của từng nhóm (`28,24`–`324,221` cho mark; `335,73`–`900,201` cho wordmark) từ chính path hiện có, dựng layout dọc với padding ~30px mọi phía + gap 30px giữa mark/wordmark, đổi `viewBox` sang `0 0 625 415`, `translate` mark → `(137.0,6.5)`, wordmark → `(-304.5,184.5)`. Bbox sau transform: mark `(165,30.5)`–`(461,227.5)`, wordmark `(30.5,257.5)`–`(595.5,385.5)` — cả hai nằm trọn trong canvas.
- `reversed-on-violet.svg`: áp lại đúng pattern đã đúng sẵn ở `horizontal-primary.svg` (viewBox offset trực tiếp theo bbox ROI gốc, một `translate(0.5,0.5)` dùng chung cho cả hai nhóm thay vì tính lại offset riêng dễ sai) — `viewBox="-12 -16 952 277"`, rect nền đổi theo đúng vùng này. Bbox sau transform: mark `(28.5,24.5)`–`(324.5,221.5)`, wordmark `(335.5,73.5)`–`(900.5,201.5)` — cả hai nằm trọn, ~40px padding quanh card.

**Kiểm hồi quy bắt buộc (toàn bộ 10 SVG, không chỉ 2 file bị báo):** viết script tính bbox path sau transform (bao gồm transform lồng nhau và `scale`) và so với `viewBox` của từng file. Kết quả sau sửa: **10/10 SVG — path bbox nằm trọn trong viewBox**, không còn clipping nào (bao gồm `mark.svg`, `mark-mono-black.svg`, `mark-mono-white.svg`, `horizontal-primary.svg`, `horizontal-mono-black.svg`, `horizontal-mono-white.svg`, `app-icon.svg`, `app-icon-source.svg`).

**Export lại và evidence:** `logo/png/stacked.png` và `logo/png/reversed-on-violet.png` render lại từ SVG đã sửa (alpha trong suốt, verify bằng mắt — xem ảnh, không chỉ số liệu); `preview/evidence/stacked-tile-crop.png` là crop riêng tile stacked trên nền trắng để đọc trọn "Vemoki"; `preview/evidence/desktop-1440.png` + `mobile-390.png` chụp lại toàn trang; ZIP `vemoki-electric-violet-logo-kit.zip` regenerate chứa đúng SVG/PNG mới.

**Trạng thái:** đã chứng minh toàn bộ chữ xếp dọc (và lockup trên card) không còn clipped bằng bbox tính toán + xem ảnh trực tiếp; silhouette logo không đổi (chỉ canvas/translation). Ngoại lệ 1/1 đã dùng, không reset fix budget 2/2 của batch chính.

## Không claim

Không claim production ready, pilot ready, acceptance PASS, hoặc UAT PASS. Đây là PD handoff — bước tiếp theo (nếu được giao) là Task coding riêng theo owner ở trên, có evidence runtime thật trước khi đổi trạng thái.
