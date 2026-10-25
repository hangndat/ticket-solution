# UI/UX review — VD-09 Neon marketing landing

| Field | Value |
| --- | --- |
| Reviewer | Mira (`reviewer-uiux`), dispatch `task_1482f7204eab` |
| Independence | Reviewer ≠ implementer (Higo / fix batches `c3a1da5`, `d238356`) |
| Exact SHA | `d238356ff72bab0790dc5184428a7b46e2611544` |
| Prior review | `c3a1da5ccfdf7f75895a1b0e0dbe9d0d691e4a14` → FAIL 94 / 90 |
| Scope | `apps/web` marketing neon sales page — `/marketing`, `/marketing/en` |
| AC bar | Desktop + mobile each ≥ **95/100** vs approved art (layout 30 · imagery 25 · typography 15 · color/effect 15 · spacing 10 · details 5) |

## Mẫu / môi trường

| Viewport | Reference (repo path) |
| --- | --- |
| Desktop 1440 | `docs/design/vemoki-unified-v1/reference/approved-neon-desktop.png` |
| Mobile 390 | `docs/design/vemoki-unified-v1/design-system/marketing/mobile.png` |

Runtime evidence (Chrome channel Playwright — `vd09-neon-evidence.mjs` trên build production, commit `d238356`):

| File | SHA-256 |
| --- | --- |
| `apps/web/tests/evidence-vd09-neon/marketing-vi-1440-full.png` | `97e2e9cea818e7e60e2bdce1146532b55d63aee71ff576e79e3853e26f57927b` |
| `apps/web/tests/evidence-vd09-neon/marketing-vi-390-full.png` | `54de9238c9fa0c8ed9434406890dfcdfee82f761e55cbd8d7af265ff7b45ca44` |
| `apps/web/tests/evidence-vd09-neon/marketing-en-1440-full.png` | `62fd76ccbb338ac722dd79c14fef992164a564ff6db70e4d6b33f5ca07c3a8f7` |
| `apps/web/tests/evidence-vd09-neon/marketing-en-390-full.png` | `e2bd44e7824bdbd72a48f22e935711414051791cdb6054e0dd5ca6c34efc1a36` |
| `apps/web/tests/evidence-vd09-neon/marketing-vi-768-overflow.png` | `0951e5554fd1426d34dc82a5503833b156ec511e7ce09571c7867892f5032a4a` |
| `apps/web/tests/evidence-vd09-neon/marketing-vi-320-overflow.png` | `b7f749b074a04a3b819020e885bb507db12748ec6d3ee0ae28c5d0919b0a60bf` |

`bash docs/agents/tools/ui-evidence-check.sh apps/web/tests/evidence-vd09-neon` → **OK** (7 files, không trùng nội dung).

Methods: đối chiếu ảnh mẫu vs evidence VI/EN; đọc diff `c3a1da5..d238356` (`neon-final-cta.tsx`, `marketing-neon.css`, `interest-cta-link.tsx`, `marketing-interest-hash.ts`, `marketing-interest-provider.tsx`); impeccable critique **single-context**; runtime smoke Playwright trên `next start` @ `http://127.0.0.1:3000` — `vd09-neon-interest-click.mjs` (reviewer re-run, SHA build hiện tại trùng `d238356`); overflow từ evidence + script; unit `marketing-interest-hash.test.ts` trong suite `@ticket/web test`.

## Điểm độc lập (không kế thừa estimate worker)

### Desktop 1440 — **95/100** (PASS vs 95)

| Tiêu chí | Điểm | Ghi chú |
| --- | ---: | --- |
| Layout | 29/30 | Hero 2 cột, lưới events, product split khớp IA; final CTA full-bleed crowd + script phải. Vẫn không có control carousel desktop như art tĩnh. |
| Imagery | 23/25 | `hero-composite-v2` + `final-cta-crowd-v2`; script **Good Events / Brighter Together** trên band (F10). Hero vẫn lệch nhẹ floating UI mock. |
| Typography | 13/15 | Headline/gradient ổn; eyebrow final khác nhịp mock một chút. |
| Color / effect | 15/15 | Neon + scrim CTA; flourish script desktop đạt hướng mẫu (F10 đóng). |
| Spacing | 10/10 | Không form sáng full-page; nhịp section ổn. |
| Details | 5/5 | 4 trust chips; locale/login là chrome sản phẩm. Nav lệch nhãn mock (F03, không chặn bar nếu chấp nhận product chrome). |

### Mobile 390 — **95/100** (PASS vs 95)

| Tiêu chí | Điểm | Ghi chú |
| --- | ---: | --- |
| Layout | 29/30 | Stack hero, 2×2 events, feature grid khớp `mobile.png`; **final CTA = inset card bo 22px** (crowd ẩn ≤640px), nội dung căn giữa — F08 đóng về IA. |
| Imagery | 23/25 | Hero `hero-figure` + decor; card gradient/ripple khớp mock; không crowd photo trên mobile (đúng CSS). |
| Typography | 14/15 | Headline VI/EN khớp; `hero.demo_note` (provenance) không có trên PNG tĩnh. |
| Color / effect | 15/15 | Ba vòng `mkt-neon-final-ripple` + viền neon card; đạt hướng mock (F08). |
| Spacing | 10/10 | Overflow 0px (320/768/390 evidence + reviewer overflow re-check qua evidence script trên build). |
| Details | 4/5 | Hamburger + locale pill (chrome); CTA final copy product (`Đăng ký tư vấn`) vs mock `Liên hệ tư vấn` nhỏ. |

## Checks chức năng / a11y

| Check | Kết quả | Evidence |
| --- | --- | --- |
| Horizontal overflow 320 / 768 / 390 / 1440 | **Pass** (0px) | Evidence PNG + `vd09-neon-evidence.mjs` output |
| VI landing | **Pass** | `marketing-vi-*-full.png` |
| EN `/marketing/en` | **Pass** | `marketing-en-1440-full.png`, `marketing-en-390-full.png` |
| Permanent interest section removed | **Pass** | Không `mkt-lead-section` trên full-page capture |
| Interest UI host | **Pass** | `#interest` + `MarketingInterestProvider`; dialog/sheet ≥5 inputs khi mở |
| CTA demo href | **Pass** | `data-testid` `cta-demo*` + `demoHref` |
| Click hero / final / nav `#interest` CTA | **Pass** | Reviewer: `node apps/web/tests/vd09-neon-interest-click.mjs` → OK (hero, final, nav desktop; hero+final mobile; ≥5 inputs; hash `#interest`; Escape clears) |
| Deep link `/marketing#interest` | **Pass** | Cùng script `assertDeepLink` |
| Escape đóng dialog | **Pass** | Cùng script |
| Focus trap / tab order trong dialog | **Chưa đo** | Limitation L02 |
| `ui-chrome-wrap-probe.js` | **Chưa chạy** | Limitation L02 |

## Revalidation F01–F10 (SHA `d238356`)

| ID | Trạng thái | Ghi chú |
| --- | --- | --- |
| F01 Final CTA crowd / full bleed (desktop) | **Đóng** | Giữ từ `c3a1da5`; `marketing-vi-1440-full.png` |
| F02 Hero composite | **Đóng** (delta nhỏ) | Không đổi substantive batch 2 |
| F03 Nav / brand vs art | **Mở** (Medium) | `chrome.tsx` product anchors; mock: Bảng giá / Tài nguyên |
| F04 Bốn chips | **Đóng** | `TRUST_KEYS` ×4 |
| F05 EN evidence | **Đóng** | EN PNG trong evidence folder |
| F06 Focus / keyboard journey | **Mở** (Low) | Escape chứng minh; full tab journey chưa |
| F07 Dialog thay form full-page | **Đóng** | Provider + sheet/dialog |
| F08 Mobile final card + ripples | **Đóng** | `neon-final-cta.tsx` + `marketing-neon.css` @max-width 640px; `marketing-vi-390-full.png` vs `mobile.png` |
| F09 Click CTA mở dialog | **Đóng** | `InterestCtaLink` + `openInterest()` + `setInterestHashInHistory` / synthetic `hashchange`; Playwright click path pass |
| F10 Desktop script flourish | **Đóng** | `mkt-neon-final-script` + copy `neon.final.script.*`; desktop PNG |

## Findings (còn lại / đã đóng)

| ID | Loại | Severity | Chặn ≥95? | Vấn đề | Evidence | Điều kiện đóng |
| --- | --- | --- | --- | --- | --- | --- |
| F03 | lệch mẫu/AC | Medium | Không (đã chấp nhận trong details) | Nav desktop lệch mock tĩnh; chrome sản phẩm hợp lệ. | `approved-neon-desktop.png` vs `chrome.tsx` | PD quyết pixel-match vs product chrome. |
| F06 | a11y | Low | Không | Focus order / visible focus toàn journey chưa runtime. | — | Orca keyboard smoke + probe. |

**Đã đóng batch `d238356`:** F08, F09, F10; tiếp tục đóng F01, F02, F04, F05, F07 từ `c3a1da5`.

## Verdict

**PASS** — Desktop **95/100**, Mobile **95/100**; đạt ngưỡng **95/100** mỗi viewport. F09 (consultation CTA click), F08 (mobile card/ripples), F10 (desktop script) đã revalidate trên SHA `d238356`. Còn delta không chặn: F03 nav labels (product chrome), F06 keyboard journey, `hero.demo_note` mobile, carousel desktop tĩnh, copy CTA final nhỏ vs mock.

## Limitations

- L02: Chưa chạy `ui-chrome-wrap-probe.js` / Orca keyboard UAT đầy đủ.
- L03: Functional dialog/overflow xác minh reviewer bổ sung bằng Playwright local trên `next start` (không thay gate UAT milestone Orca tab).
- L04: Điểm mobile/desktop ở ngưỡng 95 — không inflate; carousel desktop và hero floating UI vẫn là delta visual nếu PD yêu cầu pixel-perfect sau acceptance.
- Interest form chỉ xuất hiện trong overlay; không có trên full-page screenshot (đúng thiết kế).

## Code delta reviewed (`c3a1da5` → `d238356`)

- `interest-cta-link.tsx`, `marketing-interest-hash.ts`, `marketing-interest-provider.tsx` — F09 hash/sync + click open.
- `neon-final-cta.tsx`, `marketing-neon.css` — F08 mobile card/ripples; F10 desktop script; crowd ẩn mobile.
- `vd09-neon-interest-click.mjs`, `marketing-interest-hash.test.ts` — regression click path + hash helper.
