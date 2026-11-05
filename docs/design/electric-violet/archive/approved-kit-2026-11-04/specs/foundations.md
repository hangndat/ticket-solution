# Electric Violet — Foundations (spec đề xuất, chưa phải token SoT)

Trạng thái: **đề xuất** từ brand user đã duyệt (logo suite Electric Violet, 2026-11-04). Đây **không phải** bản thay thế đã merge cho `brand/vemoki/tokens.json` (hiện là **Live Pulse v2** — xem `docs/design/visual-identity-v2/`, token SoT runtime). Mọi bảng dưới đây **trỏ về** `brand/vemoki/tokens.json` làm đích tích hợp qua `brand/vemoki/scripts/generate-brand-assets.py` hiện có — spec này không tạo token SoT thứ hai, không tạo generator mới.

Portal (`apps/portal`) **ngoài phạm vi** — giữ nguyên Ant Design mặc định theo O26 (Decision Log), không áp bất kỳ token nào dưới đây.

## 0. Trạng thái màu — đã duyệt vs. đề xuất vs. runtime hiện hành

| Màu | Giá trị | Trạng thái | Căn cứ |
| --- | --- | --- | --- |
| Electric Violet (primary) | `#6C35FF` | **Đề xuất, khớp mắt với board đã duyệt** — không phải hex đo từ file vector gốc (không có nguồn vector gốc) | Khớp bằng mắt (color picker trên raster `sources/approved-logo-suite.png`, vùng fill chip "ELECTRIC VIOLET") |
| Ink (near-black) | `#141020` | **Đề xuất, khớp mắt** | Chip "NEAR-BLACK" cùng board |
| Neutral gray | `#D7D6E0` | **Đề xuất, khớp mắt** — board ghi "NEUTRAL GRAY" không kèm hex | Chip "NEUTRAL GRAY" |
| White | `#FFFFFF` | Xác định | Chip "WHITE" |
| Primary hiện hành (Live Pulse v2, runtime) | `#7C4DED` | **Runtime hiện tại** trong `brand/vemoki/tokens.json` (`colors.primary`) | Đọc trực tiếp file |
| Signal/CTA hiện hành (Live Pulse v2) | `#E11D48` | **Runtime hiện tại** | `tokens.json` `colors.signal` |

User chỉ duyệt 4 màu trên board (Electric Violet, Neutral gray, White, Near-black) — **không** duyệt gradient, không duyệt thêm sắc độ phụ nào khác. Mọi derived tone dưới đây (50–900) là suy ra tuyến tính từ 4 màu gốc, không phải màu mới được duyệt riêng; đánh dấu `(derived)`.

## 1. Primitive tokens (đề xuất)

```json
{
  "color.violet.50": "#F2EEFF (derived)",
  "color.violet.100": "#E3DAFF (derived)",
  "color.violet.300": "#A98CFF (derived)",
  "color.violet.500": "#6C35FF",
  "color.violet.600": "#5B22F0 (derived, hover/pressed)",
  "color.violet.700": "#4A1AC2 (derived)",
  "color.ink.900": "#141020",
  "color.ink.700": "#312C45 (derived)",
  "color.ink.500": "#5C5774 (derived, muted text)",
  "color.neutral.200": "#D7D6E0",
  "color.neutral.100": "#EFEEF4 (derived)",
  "color.white": "#FFFFFF"
}
```

Legacy Live Pulse v2 tương đương (để đối chiếu, không phải mapping bắt buộc 1:1 vì hướng art direction khác nhau):

| Live Pulse v2 (`tokens.json`) | Electric Violet primitive gần nhất | Lệch |
| --- | --- | --- |
| `ink` `#0B1220` | `color.ink.900` `#141020` | Gần, Electric Violet ấm/tím hơn một chút |
| `paper` `#F4F6F8` | `color.neutral.100` `#EFEEF4` (derived) | Paper Live Pulse trung tính xanh nhạt; neutral Electric Violet trung tính tím nhạt — **khác tông**, không dùng thay thế trực tiếp |
| `signal` `#E11D48` (đỏ-hồng) | — | **Không tương đương** — Electric Violet không có accent đỏ/hồng trong board đã duyệt; nếu cần accent thứ 2 (destructive/urgent) phải escalate coordinator, không tự chọn |
| `focus` `#2563EB` | — | Board không duyệt màu focus riêng; đề xuất giữ `color.violet.600` làm focus ring hoặc escalate nếu cần tách biệt CTA/focus |
| `primary` `#7C4DED` | `color.violet.500` `#6C35FF` | Cùng họ tím, lệch ánh sáng — đây chính là lý do Task này tồn tại: chuẩn hóa về Electric Violet |

**Chưa quyết:** board không có ảnh nào cho success/warning/error/info hoặc admission states (queued/unknown). Mục 2 giữ nguyên ý nghĩa cũ (xem bảng legacy→mới), **không tự suy ra màu mới cho các state này** từ palette 4 màu — đây là khoảng trống cần escalate nếu phase sau cần.

## 2. Semantic tokens (đề xuất) — giữ nguyên MEANING, không đổi state cũ thành khác nghĩa

| Semantic | Token nguồn | Giá trị | Giữ nguyên từ |
| --- | --- | --- | --- |
| `color.bg.canvas` | `color.white` | `#FFFFFF` | — |
| `color.bg.surface` | `color.neutral.100` | `#EFEEF4` (derived) | — |
| `color.text.primary` | `color.ink.900` | `#141020` | — |
| `color.text.muted` | `color.ink.500` | `#5C5774` (derived) | — |
| `color.border.default` | `color.neutral.200` | `#D7D6E0` | — |
| `color.action.primary` | `color.violet.500` | `#6C35FF` | — |
| `color.action.primary.hover` | `color.violet.600` | `#5B22F0` (derived) | — |
| `color.action.focusRing` | `color.violet.600` | `#5B22F0` (derived) | **Chưa duyệt riêng** — đề xuất tạm, escalate nếu cần tách màu focus khỏi CTA |
| `color.status.success` | *(giữ ý nghĩa hệ thống hiện có — không đổi hex ở đây, chỉ map khi tích hợp)* | — | **BẮT BUỘC giữ nghĩa**: `admit` (đã vào cổng) — xem Quy tắc bên dưới |
| `color.status.warning` | *(giữ ý nghĩa)* | — | `unknown` |
| `color.status.error` | *(giữ ý nghĩa)* | — | `destructive` |
| `color.status.info` | *(giữ ý nghĩa)* | — | informational, không phải admission |

### Quy tắc bắt buộc — không đổi ý nghĩa state admission

`queued` (đang xếp hàng/đang xử lý) và `unknown` (chưa xác định) **không bao giờ** hiển thị bằng token `success`/`admit`. Đây là invariant nghiệp vụ (Gate/ticket admission), không phải lựa chọn thẩm mỹ — spec Electric Violet không đổi quy tắc này, chỉ đổi màu nền/token bên dưới nó. Component "notice/status" ở `components.md` áp quy tắc này cụ thể.

Bảng legacy (`tokens.json` hiện hành) → đề xuất mới, giữ nguyên vai trò:

| Vai trò | Legacy (Live Pulse v2) | Đề xuất Electric Violet |
| --- | --- | --- |
| `destructive` (error/từ chối) | `#8A1F1F` | giữ tông đỏ đất tương tự, ví dụ `#8A1F1F` (không đổi — board không duyệt đỏ mới) |
| `admit` (đã vào cổng — success) | `#1B7F4A` | giữ tông xanh lá tương tự (không đổi — board không duyệt xanh lá mới) |
| `unknown` (chưa xác định/đang xử lý) | `#8A6D3B` | giữ tông vàng-nâu tương tự (không đổi) |

**Lý do không đổi 3 màu state này:** board Electric Violet chỉ duyệt palette thương hiệu (tím/đen/trắng/xám), không đề cập state semantics. Tự suy ra đỏ/xanh lá/vàng mới từ palette tím sẽ là "invent" ngoài phạm vi được duyệt — vi phạm rule của Task. Giữ nguyên 3 hex legacy cho đến khi có quyết định PD riêng.

## 3. Component tokens (đề xuất, trỏ semantic ở trên)

| Component token | Nguồn semantic |
| --- | --- |
| `button.primary.bg` | `color.action.primary` |
| `button.primary.bg.hover` | `color.action.primary.hover` |
| `button.primary.fg` | `color.white` |
| `field.border` | `color.border.default` |
| `field.border.focus` | `color.action.focusRing` |
| `chip.bg.selected` | `color.action.primary` |
| `chip.bg.default` | `color.bg.surface` |
| `row.divider` | `color.border.default` |

## 4. Typography

| Role | Font | License/nguồn | Cấm |
| --- | --- | --- | --- |
| Display / wordmark / H1 | **Sora** (ExtraBold 800 cho hero/wordmark, Bold 700 cho H1-H2) | `apps/web/fonts/Sora-Variable.ttf`, OFL — `apps/web/fonts/OFL-Sora.txt` | Không dùng font không rõ license |
| Body / form / list | **Be Vietnam Pro** (Regular 400, Medium 500, SemiBold 600) | `apps/web/fonts/BeVietnamPro-*.ttf`, OFL — `apps/web/fonts/OFL-BeVietnamPro.txt` | — |

**Sửa citation (EV-04):** `brand/vemoki/*.ttf` **không tồn tại** trong repo — đã kiểm tra lại qua `ctx_glob`. Nguồn font thật là `apps/web/fonts/` (mirror tại `apps/mobile/assets/fonts/` cho iOS/RN), cả hai OFL, đã dùng cho Live Pulse v2. **Không đổi font pipeline** — tái dùng nguyên hai family này cho Electric Violet, chỉ đổi màu/geometry logo. Font gốc trong ảnh board đã duyệt **không xác định được** (không phải Sora chính xác). Lưu ý: logo SVG (`../logo/svg/*.svg`) **không còn phụ thuộc font này** — wordmark trong logo đã là vector trace thật (xem `../logo/README.md`); Sora/Be Vietnam Pro chỉ còn áp dụng cho UI chữ sống (heading, body, form) ngoài phạm vi logo.

### Type scale (đề xuất, derive từ `tokens.json` hiện có — không invent đơn vị mới)

| Token | Size / Line height | Dùng |
| --- | --- | --- |
| `type.display` | 40–56px / 1.05, Sora 800 | Hero wordmark, marketing H1 |
| `type.h1` | 28px / 1.2, Sora 700 | Page title |
| `type.h2` | 20px / 1.3, Sora 700 | Section title |
| `type.body` | 16px / 1.5, Be Vietnam Pro 400 | Nội dung chính |
| `type.bodyStrong` | 16px / 1.5, Be Vietnam Pro 600 | Nhãn, label quan trọng |
| `type.caption` | 13px / 1.4, Be Vietnam Pro 500 | Meta, timestamp, trạng thái phụ |

## 5. Spacing / radius / motion — tái dùng nguyên `tokens.json.space` và `tokens.json.radius`

Không invent thang đo mới. `space` (2/4/8/12/16/20/24/32/48/72) và `radius` (`sm`8 `md`12 `lg`18 `xl`24) trong `brand/vemoki/tokens.json` áp dụng nguyên cho Electric Violet — board đã duyệt cũng thể hiện góc bo nhẹ (không bo tròn hoàn toàn, không vuông gắt), khớp với `radius.md`/`radius.lg` hiện có.

**Motion:** chưa có screen động nào trong board đã duyệt để suy ra motion riêng. Đề xuất tái dùng motion budget hiện có của Live Pulse v2 (`docs/design/visual-identity-v2/visual-notes.md` mục 0 — fade-in nhẹ, hover ink↔accent ngắn), chỉ đổi màu đích sang `color.action.primary`. **`prefers-reduced-motion: reduce` / Reduce Motion bắt buộc tắt transform kéo dài**, giữ cut sang trạng thái tĩnh — không đổi quy tắc này.

## 6. Escalation

Thiếu token (màu thứ 5, state semantics mới, font khác) hoặc cần đổi IA → coordinator; không tự ADR, không tự chọn màu mới ngoài 4 màu board đã duyệt.
