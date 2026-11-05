# Electric Violet — foundation ready (local)

Coordinator đã thực hiện trực tiếp phần root tooling sau các attempt worker thất bại; không nhận các dispatch failed là succeeded. Base HEAD `51bd5a5b77ba6fdeeac011a0982dd6770f7bdac5`, worktree `/Users/admin/SideProject/ticket-solution/main-3`. Chưa commit/deploy. Scope chỉ `brand/vemoki`, generated CSS của `packages/ui` và báo cáo này.

## Nguồn canonical cho Web/iOS

Nguồn đã promote: `brand/vemoki/sources/electric-violet/`. Bảy SVG nguồn khớp byte với master/variants đã duyệt trong `docs/design/electric-violet/logo`; không trace hoặc vẽ lại. Generator chỉ đọc nguồn trong brand và `tokens.json`, không phụ thuộc runtime vào docs, fonts hoặc thư mục cá nhân. Wordmark là outlined paths.

| Asset tại `brand/vemoki/` | Dùng cho | Kích thước/nền |
| --- | --- | --- |
| `master.svg` | Master | vector |
| `mark.svg`, `mark-mono.svg`, `mark-white.svg` | Glyph màu/đen/trắng | vector, viewBox `18 14 320 220` |
| `lockup.svg`, `lockup-white.svg` | Header và wordmark | vector |
| `mark.png` | Glyph raster | 960×660, alpha |
| `lockup.png` | Lockup raster | 760×200, alpha |
| `splash-icon.png` | Splash glyph | 512×512, alpha, padding |
| `app-icon-source.svg`, `app-icon.png` | App icon | 1024×1024, PNG RGB opaque, nền violet full bleed |
| `og.png` | Open Graph | 1200×630, RGB nền trắng |
| `email-header.png` | Header email | 600×160, RGB nền trắng |

SHA-256 `mark.svg`: `64a773cce4c3569a2a5927d7eee4063217cd6e54453f95de36613b975e908003`; `lockup.svg`: `a62973b6b48e711b6d438f807c0dc481fe27320441f17842ce12457c08bf0df4`; `app-icon.png`: `d1c485cdca6653f3d71dd86a7f7490bcd7a47eee1bfa03e87e9faaeedd95b7a9`; `splash-icon.png`: `63d91253ddd2fb7e6fbe72b7f4d2949fa55f0f28a0c37d4b3409de8bc0f07b9e`.

## Token contract

SoT `brand/vemoki/tokens.json`: Electric Violet v3; ink `#141020`, paper `#FFFFFF`, signal/primary `#6C35FF`, focus `#5B22F0`, line `#D7D6E0`, muted `#5C5774`. Destructive `#8A1F1F`, admit `#1B7F4A`, unknown `#8A6D3B` giữ nguyên. Schema, typography Sora/Be Vietnam Pro, spacing/radius/breakpoints và surface paths giữ nguyên. Shadow chuyển cùng ink. Generated outputs: `packages/ui/src/generated/vemoki-theme.css` và `vemoki-root.snapshot.css` qua generator hiện có.

## Kiểm chứng

- `python3 brand/vemoki/scripts/generate-brand-assets.py`: exit 0. Render CairoSVG ở 4× rồi downsample bằng Pillow; dependencies hiện có trên host, không install mới. Cách dùng trong `brand/vemoki/README.md`.
- `pnpm --filter @ticket/ui typecheck`: exit 0, chạy generator token và TypeScript.
- `python3 .orca-metrics/electric-violet/verify-foundation.py`: exit 0. Kiểm mapping và trạng thái, bảy nguồn khớp byte đã duyệt, SVG dùng curves không text/image/external href, kích thước PNG, alpha/padding và RGB opaque, CSS chứa token mới, tái xuất lần hai khớp SHA-256 từng output.
- Đã xem ảnh thực tế lockup, app icon, OG và email; không cắt glyph/wordmark, nền đúng và giữ hình đã duyệt.
- `git diff --check -- brand/vemoki packages/ui/src/generated`: exit 0.
- CRG incremental update + stats fresh đúng base HEAD và query `file_summary` generator sau thay đổi; không embeddings. GitNexus không cần thêm vì không còn câu hỏi tác động xuyên module trong scope này.

## Consumer handoff và giới hạn

Foundation ready cho Web/iOS sử dụng file thật tại brand; **chưa** áp asset/theme vào apps, chưa có runtime screenshot app hoặc independent review. Tenant/event branding và queued/unknown semantics phải giữ ở consumer. Portal ngoài scope. Web/iOS dùng HEAD hiện tại ở trên; base cũ trong spec là lịch sử. Không sửa nguồn logo hoặc package/root files trong task consumer.
