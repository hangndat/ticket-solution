# Vemoki — Cinematic Ticket Journey · MVP chờ review

> Trạng thái: **MVP chờ review**, không deploy. Public `/experience` và `/en/experience`, vẫn noindex và ngoài sitemap. Bàn giao hiện tại: [MVP-REVIEW.md](MVP-REVIEW.md). Các phần dưới giữ lịch sử visual spike.
> Nền marketing đã đồng bộ lại ngày 30/10: VD-09 + chỉnh sửa VD-10, nguồn `95a5d8a354da349c186e3137a9644c1fb31d96f4`. Ảnh trong `frames/after/` thuộc lượt spike trước đồng bộ; ảnh header/logo hiện tại ở `frames/brand-sync/`.
> Tham chiếu nguyên tắc: [MengTo/kage](https://github.com/MengTo/kage) — chỉ nguyên tắc (sticky stage, layer depth, caption theo chương); không dùng source/artwork.

## Xem local

| Locale | URL |
|--------|-----|
| vi | `http://127.0.0.1:3011/experience` |
| en | `http://127.0.0.1:3011/en/experience` |

(Port3011 phục vụ production build local; điều kiện analytics/performance trong báo cáo MVP.)

## Hướng visual

- **Asset:** 4 plate photoreal tạo bằng AI, cùng một địa điểm hư cấu "LUMEN NIGHT" — chi tiết nguồn/quyền/dung lượng: [asset-manifest.md](asset-manifest.md).
- **Palette:** navy `#03040c`, violet `#9b4dff`, cyan `#28d4ef` (scan), amber `#ffb547` (đèn lồng, "hợp lệ"). Typography Sora + Be Vietnam Pro; ticket HTML giữ từ Phase 1.
- **2.5D:** mọi plate nằm trong một cover box 3:2 dùng chung → overlay (glow trụ cổng, quầng sáng cửa) ghim theo % ảnh. Camera đẩy về tâm cửa (`50% 52%`); haze 2 lớp + bokeh đèn lồng làm tiền cảnh. Chỉ animate `transform`/`opacity`/`clip-path` (wipe cửa). Không Three.js, không video seek.

## Storyboard (progress 0 → 1, track 620dvh desktop / 520dvh mobile)

| Chương | Progress | Plate | Nhịp |
|--------|----------|-------|------|
| Invitation | 0.00–0.18 | `ticket-night` | **Vé + headline hiện ngay khi tải** (không chờ cuộn); cuộn làm vé thẳng lại, sheen quét. |
| Arrival | 0.16–0.40 | `gateway-closed` | Crossfade sang lối đèn lồng, camera tiến tới cổng; bokeh tiền cảnh lướt qua. |
| Gateway | 0.40–0.62 | `gateway-closed` → `gateway-open` | Glow cyan trên trụ khi quét QR → "Hợp lệ", trụ chuyển amber → vé tan, cửa **wipe mở từ tâm** để lộ sân khấu. |
| The Moment | 0.62–0.86 | `stage-main` | Đẩy qua cổng, stage hiện ra; light sweep + pulse amber. |
| Vemoki + CTA | 0.86–1.00 | `stage-main` (scrim) | "Từ tấm vé đến khoảnh khắc." + CTA demo / đăng ký quan tâm. |

Portrait dùng push nhẹ hơn (gate 1→1.14) để giữ biển LUMEN NIGHT trong khung; màn ngang thấp (`max-height:560px`) đưa vé sang phải và thu nhỏ typography.

## Progressive enhancement

| Trường hợp | Hành vi |
|-----------|---------|
| Không JS | Server HTML = 4 still frame + brand, CTA dùng được, đủ h1/h2 |
| `prefers-reduced-motion` | Giữ still frame; không animation chạy (`document.getAnimations()` = 0) |
| JS + motion | Sau hydrate nâng cấp sang scroll journey; frame 1 giống hệt still |

## Ảnh trước / sau

| Cảnh | Trước (SVG, Phase 1) | Sau (AI plates) |
|------|----------------------|-----------------|
| Ticket — desktop | `frames/before-svg/desktop-010.webp` | `frames/after/desktop-000.webp` |
| Ticket — mobile | `frames/before-svg/mobile-010.webp` | `frames/after/mobile-000.webp` |
| Gateway — desktop | `frames/before-svg/desktop-053.webp` | `frames/after/desktop-053.webp`, `desktop-058.webp` (cửa đang mở) |
| Gateway — mobile | `frames/before-svg/mobile-053.webp` | `frames/after/mobile-053.webp` |
| Stage — desktop | `frames/before-svg/desktop-070.webp`, `-095` | `frames/after/desktop-080.webp`, `-095` |
| Stage — mobile | `frames/before-svg/mobile-080.webp`, `-095` | `frames/after/mobile-080.webp`, `-095` |
| Màn ngang thấp 844×390 | — | `frames/after/landscape-000/053/095.webp` |
| Reduced motion | `frames/before-svg/desktop-reduced-full.webp` | `frames/after/desktop-reduced-full.webp`, `mobile-reduced-full.webp` |

Frames chụp bằng `node apps/web/scripts/journey-frames.mjs http://127.0.0.1:3010 <out>` (artefact thiết kế; UAT chạy trong Orca browser — xem bên dưới).

## UAT (Orca embedded browser) — 2026-10-30

Tab `orca tab create` → page `f881d60e…`, dev server `next dev --port 3010` (worktree `3d-scene`, chưa commit). Kết quả chỉ áp dụng cho Chromium của Orca.

| Kiểm tra | Kết quả |
|----------|---------|
| Mở đầu thấy vé + h1 không cần cuộn (390×844, 923×1059, 844×390) | PASS |
| Cuộn tiến/lùi qua scan → cửa mở → stage (mobile): trạng thái caption/brand giống hệt tại cùng vị trí | PASS |
| Low landscape 844×390 không chồng vé/headline | PASS (sau fix) |
| Chuyển VI↔EN giữ trong journey, `<html lang>` đồng bộ | PASS |
| Keyboard: Tab từ đầu trang bỏ qua CTA đang ẩn (`inert`); ở cuối Tab tới `cta-demo` → `cta-interest` | PASS |
| CTA đích: `cta-demo` → `PRODUCT_ORIGIN/?demo=1`; `cta-interest` → `/#interest` (`/en#interest`) | PASS |
| Analytics: click 2 CTA → `POST /api/marketing/events` 200, server log `cta_click {cta-demo|cta-interest}` | PASS (port 3010) |
| Reduced motion (media emulation) | PASS |
| No-JS: server HTML đủ h1/h2, 2 CTA có href, không `inert` | PASS (kiểm qua HTML; Orca không tắt được JS) |
| Console error / request lỗi (≥400) trong journey | PASS — 0 error; 2 warning có sẵn của root layout (`scroll-behavior: smooth`) |
| `noindex, follow` | PASS |

## Quyết định cần review

1. Hướng 2.5D + AI plates có đạt chất lượng mong muốn?
2. Quyền sử dụng ảnh AI + tên "LUMEN NIGHT" (xem manifest).
3. Public route `/journey` (chưa map) sau khi duyệt.

## Bàn giao sau khi phục hồi phiên — 2026-10-30

Claude dừng do giới hạn phiên sau khi hoàn tất UAT và đóng tab do agent mở. Codex tiếp nhận và chạy lại các kiểm tra trên working tree hiện tại:

| Kiểm tra | Kết quả |
|----------|---------|
| `git diff --check` | PASS |
| `pnpm --filter @ticket/web typecheck` | PASS |
| `pnpm --filter @ticket/web lint` | PASS |
| `pnpm --filter @ticket/web test` | PASS — 317 tests, 0 fail |
| HTTP hai route VI/EN | 200; HTML có h1 và noindex |
| 16 asset AVIF/WebP | HTTP 200; nội dung tải về khớp file local |
| Evidence trước/sau | 13 ảnh trước, 15 ảnh sau có trên đĩa |

Kết quả UAT phía trên là evidence của phiên Claude, không phải một lượt browser UAT mới của Codex. Server port 3010 được giữ để review.

### File thay đổi

- Route mới: `apps/web/app/marketing/{journey,en/journey}/page.tsx`.
- Module mới: `apps/web/src/marketing/journey/` (experience, scenes, timeline, ticket, plate, assets, copy, CSS và art).
- Asset mới: `apps/web/public/marketing/journey/` — 16 file AVIF/WebP.
- Tích hợp: `apps/web/src/marketing/chrome.tsx`, `links.ts`, `locale-switch.tsx`, `seo/metadata.ts`.
- Kiểm tra và capture: `apps/web/tests/marketing-host.test.ts`, `apps/web/scripts/journey-frames.mjs`.
- Bàn giao: `docs/design/cinematic-journey/` — README, manifest, prompts, ảnh trước/sau.

### Findings còn mở

- **Blocker kỹ thuật đã xác nhận:** chưa ghi nhận trong các kiểm tra trên. Chưa có verdict review độc lập; đây là mốc bàn giao visual spike, không phải nghiệm thu phát hành.
- **Gate tiếp theo:** người dùng duyệt chất lượng và tính nhất quán visual trước Phase 2.
- **Chưa xác minh:** Safari, thiết bị thật, FPS/Core Web Vitals và thao tác browser với JavaScript tắt; no-JS mới kiểm tra server HTML.
- **Cải thiện:** độ nét trên màn lớn/DPR cao và chi tiết đám đông AI cần designer xem ở kích thước thật; xem manifest.

Chưa commit, merge hoặc deploy. Không mở rộng Phase 2.

## Đồng bộ marketing/logo đã duyệt — 30/10/2026

- Nguyên nhân lệch: HEAD `21a0b8ab` của worktree journey chỉ có VD-04; landing VD-09, logo kit `a8a14349` và CTA/contrast VD-10 ở dòng nhánh khác.
- Nguồn pin: `hangndat/vd09-marketing-neon` tại `95a5d8a354da349c186e3137a9644c1fb31d96f4`. Cây marketing ở `hangndat/vd11-integration` trùng nguồn này tại thời điểm đối chiếu.
- Đồng bộ module marketing, ảnh neon, favicon/app icon/OG và CSS import. Giữ nguyên root layout, auth/attendee, backend và shared UI hiện tại.
- Journey giữ route riêng, noindex, VI/EN, cảnh và asset; dùng logo header/footer mới cùng nút demo neon. Không gắn decor viền của landing lên cảnh journey.
- Hai sửa đổi tương thích lint hiện tại: trạng thái dialog đăng ký đọc hash bằng `useSyncExternalStore`; component nút neon bỏ prop variant có thể ghi đè thiết kế.
- Test tích hợp mới nằm trong `apps/web/tests/marketing-neon.test.ts`, được script test hiện tại chạy: kiểm logo, bốn section landing VI/EN và locale journey.

### Kiểm tra sau đồng bộ

| Kiểm tra | Kết quả |
|----------|---------|
| TypeScript / lint / `git diff --check` | PASS |
| Web tests | 319/319 PASS |
| Orca: landing và journey, viewport 923×1059 và 390×844 | Logo mới hiện; không tràn ngang theo DOM |
| Orca: journey VI → EN | Giữ `/marketing/en/journey`, `html lang=en` |
| Orca: đăng ký quan tâm desktop/mobile | Mở dialog/sheet với `#interest`; Escape đóng và bỏ hash |
| Journey metadata | `noindex, follow` |
| Detector thiết kế | Hai warning gradient text thuộc mẫu neon đã duyệt; giữ mẫu theo yêu cầu đồng bộ |

Evidence mới: [landing desktop](frames/brand-sync/landing-desktop.png), [landing mobile](frames/brand-sync/landing-mobile.png), [journey desktop](frames/brand-sync/journey-desktop.png), [journey mobile](frames/brand-sync/journey-mobile.png).

Browser page `e95ca31e-c935-4025-b275-9da439a8aad4`, lệnh Orca `tab create`, `exec set viewport`, `snapshot`, `click`, `wait --url`, `eval`, `screenshot`, `keypress Escape`. Port scan: execution host `local`, port `3010`, PID `79923`, `kind=workspace`, `owner.confidence=cwd`, owner path là worktree này. Evidence là working tree chưa commit, không phải verdict exact-SHA độc lập. Chưa chạy lại toàn bộ UAT chuyển cảnh/analytics, Safari hoặc performance trong lượt đồng bộ này.

Xem landing đúng phiên bản tại `http://127.0.0.1:3010/marketing`; xem spike tại `http://127.0.0.1:3011/experience`.
