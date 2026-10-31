# Pack thương hiệu Vemoki

Canonical tokens: `tokens.json` (**Live Pulse v2** — ink `#0B1220` · paper `#F4F6F8` · signal `#E11D48` · focus `#2563EB`; display **Sora** · body **Be Vietnam Pro**). PD freeze: `docs/design/visual-identity-v2/`. Raster/SVG dưới đây là nguồn platform (không thay bằng CDN SaaS — ADR-14 MinIO self-host).

| File | Vai trò | Kích thước |
| --- | --- | --- |
| `mark.svg` / `mark-mono.svg` | Glyph | vector |
| `lockup.png` | Wordmark + mark | 760×200 |
| `og.png` | Open Graph / banner mẫu | 1200×630 |
| `email-header.png` | Header email | 600×160 |
| `app-icon.png` | App icon nguồn | 1024×1024 |

Upload event (logo/banner) phải tuân `docs/ops/MEDIA-ASSET-CHECKLIST.md` và `ASSET_LIMITS` (PNG/JPEG/WebP, ≤5 MiB). SVG **không** đi qua C-B upload.

Regenerate raster/SVG: `python3 brand/vemoki/scripts/generate-brand-assets.py` (Python + Pillow). Nguồn Logo Kit nằm trong `sources/`, sao chép nguyên bản từ VD09 `95a5d8a3`: mark từ `apps/web/public/marketing/neon/vemoki-v-mark.png`, OG từ `apps/web/app/opengraph-image.png`, icon từ `apps/web/app/icon.png`. Script dùng font đã có trong `apps/web/fonts` và chỉ ghi các artifact trong `brand/vemoki`; không sửa demo Web.
