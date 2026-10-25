# VD10 — design system + logo kit, đồng bộ đầy đủ web/portal lên production (2026-10-25)

- Mã triển khai: `6a4b6d55` (web, portal, packages/ui, brand). HEAD nhánh `hangndat/vd09-marketing-neon` gồm thêm review/mobile không thuộc deploy.
- Review: [VD10-DS-REVIEW-2026-10-25.md](VD10-DS-REVIEW-2026-10-25.md) revalidation **PASS** @ `6a4b6d55` (Mira); [VD10-IOS-REVIEW-2026-10-25.md](VD10-IOS-REVIEW-2026-10-25.md) **PASS with known gap** @ `a0d94d8c` (James, không deploy — iOS cần build local).
- Quyết định user: DEC-01 gradient tiết chế cho nút chính web khách/iOS; DEC-02 portal `#7C4DED`; DEC-03 form/demo marketing gradient neon; DEC-04 tenant mặc định `#E11D48`. Logo kit mới thay toàn bộ brand master, bỏ ↗ mặc định sau wordmark.

## Thay đổi so với lần trước

Trước đợt này production web/portal chạy cây VPS cũ hơn `main` (thiếu VD-04 attendee web, VD-07 portal theme) + overlay VD09. Đợt này **đồng bộ toàn bộ** file runtime `apps/web`, `apps/portal`, `packages/ui`, `brand/` (86 file) theo repo. API/worker/packages backend đã khớp repo trước deploy (kiểm SHA-256) nên không đổi. Không có `package.json` thay đổi → không `pnpm install`.

## Quy trình

1. Backup `/opt/vemoki/backup/vd10-pre-20261025-0826.tgz` (mode 600; web, portal, packages/ui, brand không gồm node_modules/.next) + `ui-dist-pre-vd10`.
2. Áp `brand/`, `packages/ui` tại chỗ; `pnpm --filter @ticket/ui build` trong `vemoki-runtime:local`; CSS token sinh ra khớp SHA repo.
3. Candidate `apps/{web,portal}-buildtest-vd10` + overlay; kiểm SHA-256 toàn bộ file runtime khớp repo (0 mismatch); `next build` exit 0 cả hai.
4. Candidate 3117/3118: marketing, consumer (/, wallet, redeem, claim, account, event), portal auth/favicon 200; 404 đúng; Playwright qua tunnel 1440/390 overflow 0.
5. Swap giữ `.data`; cây cũ tại `/opt/vemoki/backup/{web,portal}-pre-vd10-tree-20261025-0826`; restart riêng `vemoki-web-1`, `vemoki-portal-1` → running exit 0. Dọn file `._*` macOS từ overlay trước.

## Kiểm tra sau triển khai

| Kiểm tra | Kết quả |
| --- | --- |
| vemoki.com /marketing, /en, favicon; app.vemoki.com /, /redeem, /wallet; portal.vemoki.com /auth, favicon; api /v1/health | 200 |
| `vd09-neon-interest-click.mjs https://vemoki.com` | OK |
| Playwright live 1440/390 marketing/app/portal | overflow 0; không còn wordmark `vemoki ↗` trong header |
| Drift VPS vs repo (web/portal/ui/brand) sau deploy | 0 file lệch |

Ảnh live: [marketing 1440](assets/vd09-production/vd10-live-marketing-1440.png), [app 1440](assets/vd09-production/vd10-live-app-1440.png), [app 390](assets/vd09-production/vd10-live-app-390.png), [portal 1440](assets/vd09-production/vd10-live-portal-1440.png).

## Rollback

Dừng service, `mv` cây `*-pre-vd10-tree-20261025-0826` về `apps/`, giải nén `vd10-pre-20261025-0826.tgz` cho packages/ui + brand và khôi phục `ui-dist-pre-vd10`, start lại.

## Giới hạn

- Không đăng nhập tài khoản thật sau deploy; smoke route công khai + Playwright.
- Media demo đã seed trên MinIO (nếu có logo/banner cũ) chưa re-seed; brand/prod tenant không đổi.
- iOS: VD10-IOS-R-01 (thiếu evidence wallet QR, gate scan, account, Dynamic Type) và R-02 (banner cover crop) còn mở; cần build/UAT iOS local.
- Không push/PR theo yêu cầu chủ dự án.
