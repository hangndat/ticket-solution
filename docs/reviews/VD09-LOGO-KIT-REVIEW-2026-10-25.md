# UI/UX review — VD-09 Logo Kit (web + mobile)

| Field | Value |
| --- | --- |
| Reviewer | Mira (`reviewer-uiux`), dispatch `task_672bee3e06a8` |
| Independence | Review session khác implementer; implementation @ commits `5dc0c05a`, `a8a14349`, `8b815f26` (hangndat) |
| **Exact SHA** | **`8b815f2651155616dc21f2f1fbece560f42159d7`** |
| Worktree | `vd09-marketing-neon` |
| Diff reviewed | `0238c343..8b815f26` |
| Scope | `apps/web` + `apps/mobile` — favicon/OG, marketing lockup, product `BrandMark`, Expo icons/splash/demo logo |
| Reference | `docs/design/Vemoki-Logo-Kit/reference/approved-original.png` (master mark); không ship wordmark kit PNG “noisy” |

## Verdict

| Surface | Score | Verdict |
| --- | ---: | --- |
| Web | **90/100** | **PASS** |
| Mobile | **85/100** | **PASS** |
| **Overall** | — | **PASS** |

## Checks / evidence

| Check | Kết quả | Evidence |
| --- | --- | --- |
| `pnpm --filter @ticket/web build` @ SHA | Pass | Local production build (Next 16.4.2) |
| `pnpm --filter @ticket/web test` | Pass | 290/290 |
| `pnpm --filter @ticket/mobile` typecheck | Pass | `tsc --noEmit` exit 0 |
| Favicon `.ico` 16/32 (+48) | Pass | `favicon.ico` 3 entries 16×16, 32×32, 48×48; crops `favicon-render-16.png` / `favicon-render-32.png` đọc được @2x |
| `icon.png` 512 | Pass | 512×512, alpha OK cho adaptive |
| `apple-icon.png` 180 opaque + padding | Pass | Góc canvas opaque `#0B1220`; inset nội dung ~13px trên/dưới (`LTRB 1,13,1,13`) |
| `opengraph-image.png` 1200×630 | Pass | Mark trái, title/subtitle phải, margin 64px, không chồng chữ (`generate-opengraph-neon.py`) |
| Marketing header/footer lockup 1440/768/390/320 | Pass | Production `next start` + Playwright; crops `mkt-*` @ `docs/reviews/vd09-review-evidence-2026-10-25/` — **8 file, MD5 khác nhau**; `ui-evidence-check.sh` OK |
| Marketing (repo script) | Pass | `vd09-neon-evidence.mjs` → `logo-1440/390/320-wordmark.png` distinct SHA-256 @ reviewer regen |
| Product `BrandMark` raster light/dark | Pass | `vemoki-v-mark.png` + webp; screenshot light/dark; **không** còn `<circle>` signal đỏ trong mark |
| `logoUrl` tenant override | Pass | `brand-mark.tsx` + `branding-theme.test.ts` unchanged contract |
| CLS mark | Pass | `width`/`height` 128×111 + `object-contain` + `size-8` |
| Mobile `icon.png` 1024 opaque | Pass | RGB 1024×1024, không alpha |
| Splash icons transparent + nền config | Pass | RGBA bbox inset ~257–758; `app.config.ts` splash `#F4F6F8` / dark `#0B1220` |
| `demo/logo.png` | Pass | Wordmark sạch, không artifact kit |
| Không ship file Logo Kit thừa | Pass | Chỉ `vemoki-v-mark.png` / `.webp` trong `public/marketing/neon/` |
| Committed `evidence-vd09-brand-assets` header crops | **Fail (process)** | Xem finding VD09-LK-01 |

### Reviewer marketing crops (production build, local only — không commit)

| File | SHA-256 |
| --- | --- |
| `mkt-header-1440.png` | `439688c4f258173575b9950a662f66b009c9f5bcf64dae2583fd3e64753252f5` |
| `mkt-header-768.png` | `63515f7f43dd6f4301806ec792c2e7c1bd1650c7f3ddc6484ee74f4b06025ca2` |
| `mkt-header-390.png` | `e11b9850172833dc91fb15d12217cb8983e8d4c13ee274756edecfd97cbe9925` |
| `mkt-header-320.png` | `ea1f06336a2a0c47e567ece5e06c64c84bfa89cc469d585cd3cde29ff6781dce` |

Footer crops cùng thư mục (`mkt-footer-1440/768/390/320.png`) — hashes riêng, không trùng header.

## Findings

| ID | Loại | Mức | Vấn đề | Tác động | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| VD09-LK-01 | lệch mẫu/AC | **medium** | `apps/web/tests/vd09-brand-assets-evidence.mjs` chụp `[data-testid="site-wordmark"]` trên `/` (consumer catalog), không phải `[data-testid="mkt-wordmark"]` trên `/marketing`. Ba file `header-1440/390/320-wordmark.png` trong `evidence-vd09-brand-assets` **byte-identical** (MD5 `0b63843a93fc1eb79ae5a2be5ce977f1`, 9038 B) — không chứng minh responsive marketing lockup. | Evidence trong repo gây hiểu nhầm DoD; sản phẩm marketing vẫn đúng khi chụp đúng route. | Sửa script + regen evidence hoặc dùng `vd09-neon-evidence.mjs` `LOGO_SHOTS` làm nguồn chính thức. |
| VD09-LK-02 | asset | **low** | `splash-icon.png` và `splash-icon-dark.png` **cùng MD5** (`8d0e3fb1…`), ~171 KiB mỗi file; `icon.png` ~126 KiB. | Tăng bundle asset; dark/light dùng cùng bitmap (chấp nhận được vì mark trong suốt). | Tùy chọn: nén PNG hoặc tách variant nếu PD muốn contrast khác trên `#0B1220`. |

**Không ghi nhận:** `signalGlyph` `↗` sau chữ trong `site-wordmark` (consumer) — khác với **chấm đỏ** SVG cũ đã gỡ khỏi `BrandMark`. `data-testid="brand-mark-svg"` trên `<img>` — naming only, không ảnh hưởng UX.

## Limitations

- Không chạy UAT thiết bị thật / TestFlight; chỉ production build local + Playwright Chrome.
- Không pixel-diff `approved-original.png` 1254×1254 vs mark 128×111; đánh giá trực quan gradient V và không ship wordmark kit thô.
- Review evidence PNG marketing lưu local `docs/reviews/vd09-review-evidence-2026-10-25/` (gitignored path intent — chỉ artifact `.md` commit).

## Scoring notes (không chặn merge)

**Web (90):** OG/favicon/apple/marketing lockup raster đạt AC; product mark đúng hướng kit; trừ điểm evidence script sai surface (LK-01).

**Mobile (85):** Icon/splash/demo đạt AC kỹ thuật; trừ nhẹ vì trùng file splash và kích thước PNG lớn (LK-02).
