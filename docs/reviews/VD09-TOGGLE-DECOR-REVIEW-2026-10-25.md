# VD-09 — VI/EN toggle + neon edge decor (review)

**Ngày:** 25/10/2026 · **Reviewer:** Mira (`reviewer-uiux`, dispatch độc lập) · **Implementer (commit):** hangndat · **Worktree:** `vd09-marketing-neon`

## Scope / phiên bản

| Trường | Giá trị |
| --- | --- |
| Exact SHA | `5bc8b4bff597229f7349e005a2f57b47d7430f11` |
| Diff reviewed | `00fa6803..5bc8b4bf` (`apps/web` only) |
| Route | `/marketing`, `/marketing/en` (sales neon surface) |
| Mẫu tham chiếu | `/Users/admin/Downloads/f4fcebf5-c34f-4e95-8e51-78e4bdb2891a.png` |
| User steering | VI/EN toggle phải cực phải header (desktop + mobile), giữ `#interest` khi đổi locale; không nút primary **Đăng ký tư vấn** ở header / mobile sheet; hero/footer CTA tư vấn vẫn hoạt động; decor bong bóng + ribbon neon mép trang, không che chữ/form, không overflow ngang |

## Checks / evidence

| Check | Lệnh / công cụ | Kết quả |
| --- | --- | --- |
| Production build | `pnpm --filter @ticket/web build` @ SHA trên | PASS |
| Typecheck | `pnpm --filter @ticket/web typecheck` | PASS |
| Layout regression (node:test) | `node --import tsx --test apps/web/tests/fe-layout-regression.test.ts` | 7/7 PASS (gồm locale toggle rightmost) |
| Playwright full-page + overflow | `node apps/web/tests/vd09-neon-evidence.mjs http://127.0.0.1:3000` | overflow **0px** @ 1440, 768, 390, 320 |
| Interest CTA path | `node apps/web/tests/vd09-neon-interest-click.mjs` | PASS desktop + mobile (`#interest`, form ≥5 inputs, Escape đóng) |
| Reviewer runtime (toggle, decor DOM, mobile sheet) | Playwright Chromium @ prod server :3000 | PASS (chi tiết bảng dưới) |
| Asset size (decor mới) | `page-edge-decor-left.png` **33 022 B** (~32 KiB); không thêm asset nặng cho bubbles (CSS) | OK perf |
| Evidence integrity | `bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/vd09-toggle-decor-2026-10-25` | OK (8 file, không trùng nội dung) |

### Viewport matrix (reviewer capture)

| Viewport | Locale | Overflow | Decor `data-testid="marketing-neon-edge-decor"` |
| --- | --- | --- | --- |
| 1440×900 | VI | 0px | 2 strip `img` + 4 `.mkt-neon-float-bubble` |
| 768×1024 | VI | 0px | same |
| 390×844 | VI | 0px | same |
| 320×568 | VI | 0px | same |

### Locale / a11y

- Từ `/marketing#interest`: `mkt-locale-en` → `href="/en#interest"`.
- Từ `/marketing/en#interest`: `mkt-locale-vi` → `href="/#interest"`.
- `aria-current="true"` trên locale active (VI @ 1440, EN @ 390).
- Tab keyboard đạt focus `mkt-locale-vi` trong header (≤25 Tab từ load).
- Toggle crop: `docs/reviews/assets/vd09-toggle-decor-2026-10-25/locale-toggle-vi-1440.png`, `locale-toggle-en-390.png`.

### Header / mobile chrome

- Không link/nút **Đăng ký tư vấn** / **Register for consultation** primary trong `[data-testid="mkt-header"]`.
- Mobile sheet (`mkt-nav-mobile-menu`): 5 link + **Đăng nhập** ghost; không `.mkt-neon-btn-primary` / gradient advisory trong sheet. Nav **Tư vấn** → `#interest` (đúng steering: bỏ primary header/sheet, không bỏ anchor nav).

### Screenshot hashes (reviewer assets)

| File | SHA-256 (đầu 16 ký tự) |
| --- | --- |
| `decor-hero-1440.png` | `7c5208b9e9f2ee86` |
| `decor-hero-390.png` | `0d76a3b761e443b8` |
| `locale-toggle-vi-1440.png` | `7359c15db458a0dc` |
| Full page (reviewer re-run, tham chiếu) | `marketing-vi-1440-full.png` → `a807b526314dce06` |

Full-page reviewer captures lưu tại `apps/web/tests/evidence-vd09-neon/` khi chạy script (không commit); artifact chính thuộc `docs/reviews/assets/vd09-toggle-decor-2026-10-25/`.

## Đối chiếu mẫu PNG (điểm, không inflate)

| Tiêu chí | Desktop (1440) | Mobile (390) |
| --- | --- | --- |
| Bong bóng / sphere sáng, glossy | **8/10** — 4 bubble CSS + sphere trong hero composite; đọc rõ mép trái/phải hero | **7/10** — bubble mép + hero art; nhỏ hơn mock nhưng vẫn thấy trên nền tối |
| Ribbon neon translucent (magenta–violet–blue–orange) | **7/10** — strip PNG full-height hai mép + ribbon trong hero PNG; ít “quấn” qua lưới card/product như mock | **7/10** — strip hẹp hơn (`max-width` mobile) vẫn đọc được |
| Không che copy/CTA/form | **10/10** — `pointer-events-none`, `z-0`, content `z-index` cao hơn | **10/10** |
| Palette vs reference | Khớp hướng neon tối; không lệch brand | Khớp |

**Tổng hợp decor:** đạt steering “rõ trên desktop và mobile”; không bằng độ dày ribbon **nội section** của file reference (mock có ribbon chạy ngang giữa card grid và quanh mockup laptop).

## Findings

| ID | Loại | Mức | Vấn đề | Tác động | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| VD09-UX-01 | `lệch mẫu/AC` | **Thấp** (không chặn) | Ribbon giữa các block (events → product → CTA) mỏng hơn mock reference; decor chủ yếu strip dọc hai mép + hero artwork | Trang vẫn “neon”; thiếu một phần nhịp chuyển section như mock | PD chấp nhận hoặc bổ sung asset ribbon ngang nhẹ (optional) |
| — | — | — | Toggle, hash, header CTA removal, overflow, interest path | — | **Đạt AC steering** |

Không finding `chrome` / `a11y` / `IA` chặn merge trong scope.

## Limitations

- Không chạy `ui-chrome-wrap-probe.js` qua Orca browser page ID (session Playwright headless Chrome đủ cho overflow + visual).
- `prefers-reduced-motion`: chỉ xác nhận qua CSS (`animation: none` trên bubbles); không chụp OS setting.
- Pilot / thiết bị thật: ngoài scope review này.

## Verdict

**PASS** — SHA `5bc8b4bff597229f7349e005a2f57b47d7430f11` đáp ứng steering toggle + decor + hành trình interest; gap VD09-UX-01 là lệch mẫu mức thấp, không phải known gap chặn AC bắt buộc.
