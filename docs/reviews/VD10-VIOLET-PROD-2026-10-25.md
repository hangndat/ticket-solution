# VD10 — product primary tím #7C4DED lên production (2026-10-25)

- Mã: `e8eeb584` (web, portal, packages/ui, brand). Review: [VD10-VIOLET-REVIEW-2026-10-25.md](VD10-VIOLET-REVIEW-2026-10-25.md) **PASS** (Mira; V-01..03 thấp).
- Quyết định user: nút chính web khách + portal + iOS = tím đặc `#7C4DED`; đỏ chỉ cho lỗi/từ chối/xóa; marketing neon giữ nguyên. Thay DEC-01/DEC-04 trước.

## Triển khai

1. Backup `/opt/vemoki/backup/violet-pre-20261025-0845.tgz` + `ui-dist-pre-violet-20261025-0845`; cây cũ `{web,portal}-pre-violet-tree-20261025-0845`.
2. Đồng bộ 18 file runtime + **3 script build** (`packages/ui/scripts/generate-tokens.mjs`, `brand/vemoki/scripts/generate-brand-assets.py`, `apps/web/scripts/generate-opengraph-neon.py`).
   - Sự cố bắt được trước swap: danh sách đồng bộ ban đầu loại `scripts/` nên generator cũ trên VPS sinh lại CSS token cũ; kiểm SHA phát hiện lệch `vemoki-theme.css`; đã đồng bộ script, build lại ui (CSS khớp repo) và build lại web trước khi swap.
3. `next build` web/portal exit 0; candidate 3117/3118 200; `/redeem` nút `rgb(124,77,237)` solid.
4. Swap giữ `.data`, restart riêng `vemoki-web-1`, `vemoki-portal-1` → running.

## Sau triển khai

| Kiểm tra | Kết quả |
| --- | --- |
| vemoki.com/marketing, app.vemoki.com /, /redeem, /wallet, portal /auth, api health, Keycloak discovery | 200 |
| app /redeem "Tiếp tục", portal "Đăng nhập nhân sự" 1440/390 | `rgb(124, 77, 237)` solid |
| marketing "Xem demo" | gradient neon (không đổi) |
| `vd09-neon-interest-click.mjs` | OK |
| Overflow 1440/390 | 0 |
| Drift VPS vs repo (web/portal/ui/brand runtime) | 0 |

Ảnh: [redeem](assets/vd09-production/violet-live-redeem-1440.png), [portal](assets/vd09-production/violet-live-portal-1440.png).

## Hạ tầng cùng ngày

- VPS chậm ~2m44s, không NTP → OTP Keycloak báo sai mã. Đã cài `chrony`, bật `chronyd`, `makestep`; giờ lệch 0s (`chronyc tracking`).

## Giới hạn

- iOS (`4f3e4109`) chỉ trong repo; James đang review (tab icon màu xanh lá cần kiểm). Cần build iOS local.
- Không push/PR theo yêu cầu chủ dự án.
