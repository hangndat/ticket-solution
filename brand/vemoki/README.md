# Pack thương hiệu Vemoki

Canonical tokens: `tokens.json` (**Electric Violet v3** — ink `#141020` · paper `#FFFFFF` · signal/primary `#6C35FF` · focus `#5B22F0`; display **Sora** · body **Be Vietnam Pro**). Bộ đã duyệt: `docs/design/electric-violet/`. Nguồn platform nằm ngay trong thư mục này, không phụ thuộc runtime vào docs hoặc thư mục cá nhân.

| File | Vai trò | Kích thước |
| --- | --- | --- |
| `master.svg` | Master đã duyệt, outlined paths | vector |
| `mark.svg` / `mark-mono.svg` / `mark-white.svg` | Glyph màu/đen/trắng | vector |
| `lockup.svg` / `lockup-white.svg` | Mark + wordmark outlined | vector |
| `mark.png` | Glyph nền trong | 960×660 |
| `splash-icon.png` | Glyph nền trong, có khoảng trống | 512×512 |
| `lockup.png` | Wordmark + mark | 760×200 |
| `og.png` | Open Graph / banner mẫu | 1200×630 |
| `email-header.png` | Header email | 600×160 |
| `app-icon.png` | App icon nguồn | 1024×1024 |

Upload event (logo/banner) phải tuân `docs/ops/MEDIA-ASSET-CHECKLIST.md` và `ASSET_LIMITS` (PNG/JPEG/WebP, ≤5 MiB). SVG **không** đi qua C-B upload.

Tái xuất: `python3 brand/vemoki/scripts/generate-brand-assets.py` (Python 3.10+, Pillow, CairoSVG và thư viện Cairo; Mac hiện dùng Homebrew Cairo). Script đọc `sources/electric-violet/*.svg` và token JSON, render 4× rồi thu về kích thước đích; chỉ ghi artifact trong `brand/vemoki`. Nguồn SVG sao chép từ master/variants Electric Violet đã duyệt, không trace lại, không dựng wordmark bằng font, không dùng raster Live Pulse cũ. Các nguồn cũ ngoài thư mục Electric Violet được giữ để truy xuất lịch sử và không được generator đọc.

Tái xuất CSS token dùng script hiện có: `pnpm --filter @ticket/ui typecheck`. Màu trạng thái destructive/admit/unknown giữ nguyên ý nghĩa và giá trị.
