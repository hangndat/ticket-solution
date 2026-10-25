# UI/UX review — VD-09 neon marketing header, logo PNG, locale chrome

| Field | Value |
| --- | --- |
| Reviewer | Mira (`reviewer-uiux`), dispatch `task_0a4e4aca48e1` |
| Independence | Review độc lập implementer (`hangndat`); không sửa `apps/web` trong phiên |
| **Exact SHA** | **`4b2ae3b5f7cedd3923e7d210b5369a059e072854`** (includes **`31021060b8f50d767f968bb4c9aab8728ba6b5ae`**) |
| Worktree | `vd09-marketing-neon` |
| Scope | Marketing sales chrome: header lockup (PNG V @ 34–40px), nav/login/menu, locale `<select>`, overflow @ 1440/768/390/320; hero/page CTAs & `#interest` (hành vi, không đổi copy hero) |
| Mẫu V mark | User attachment `orca-paste-1792908528274-96498a72-b8c4-4904-b643-ab908460f4c6.png` (broad rounded blue-violet base, magenta-purple left, orange-coral right, **no black square**) |
| Runtime asset | `apps/web/public/marketing/neon/vemoki-v-mark.png` @ SHA |

## Checks / evidence

| Check | Method | Result |
| --- | --- | --- |
| Evidence integrity | `bash docs/agents/tools/ui-evidence-check.sh apps/web/tests/evidence-vd09-neon` | **OK** — 13 files, không trùng nội dung |
| Full-page VI/EN | `marketing-vi-1440-full.png`, `marketing-vi-390-full.png`, `marketing-en-1440-full.png`, `marketing-en-390-full.png` | Header khớp AC (xem bảng dưới) |
| Overflow probe | `vd09-neon-evidence.mjs` (`scrollWidth - clientWidth`) + `marketing-vi-768-overflow.png`, `marketing-vi-320-overflow.png` | **Pass** — không thấy horizontal overflow trên ảnh; script đo overflow (implementer `REPORT.md`: 0px @ 1440/390/768/320) |
| Logo @ 34px vs mẫu user | `logo-mark-34px.png` (từ `vd09-logo-icon-preview.mjs`) so với attachment | **Pass** — cùng silhouette gradient, không ô đen |
| Lockup crops | `logo-1440-wordmark.png`, `logo-390-wordmark.png`, `logo-320-wordmark.png`, `logo-1440-mark-only.png` | Mark PNG trong suốt, wordmark trắng |
| Locale = native select, rightmost | `locale-switch.tsx`, `chrome.tsx`, ảnh full-page | `<select data-testid="mkt-locale-select">` sau `</nav>`; VI/EN là option, không toggle |
| Không primary «Đăng ký tư vấn» trên header / mobile sheet | `chrome.tsx`, `marketing-mobile-nav-menu.tsx`, `fe-layout-regression.test.ts` | Không `MarketingDesktopInterestCta`; sheet chỉ link text «Tư vấn»/«Consult» + ghost login |
| `#interest` + form | `vd09-neon-interest-click.mjs`, `marketing-host.test.ts` (`localeSwitchHref` + hash), `marketing-interest-hash.test.ts` | Automated pass (implementer); reviewer không chạy lại Playwright trong phiên |
| SSR locale control | `fe-layout-regression.test.ts` | Native select + `selected` option |

### SHA-256 (evidence @ worktree HEAD reviewed)

| File | SHA-256 |
| --- | --- |
| User attachment (paste) | `374ed77959d58a2f649facbc37702c6b9e0f4ff6bdc8aef8520a7eb0ed625365` |
| `vemoki-v-mark.png` (committed @ `4b2ae3b5`) | `70b183ec33b6372ce0b8e5e5ba4b3d6f8391abb1f8dbe8f04ae1045971840349` |
| `logo-mark-34px.png` | `b4ce4493b24cac1b0b942775b6d7a7874c72036afcdfa9891a47414e91f7ec2c` |
| `logo-1440-wordmark.png` | `b921ecd25240eb4881ba66ed6ccc0e2c6c823ff8eb0d66cec07a95d73565cf21` |
| `logo-390-wordmark.png` | `ff7a1ae939125f74567fbca291327695df58067c4f7f5ff9b3880e118aa01209` |
| `logo-320-wordmark.png` | `d7e4e055d8948276243a4fae19a22d86a8415ff927bd3102602741fd969dd1c1` |
| `marketing-vi-1440-full.png` | `9c08b2b1dc29df7b3b7c68eafc7c0ddab8c5115717f71655b62cabb23eb94b31` |
| `marketing-vi-390-full.png` | `80dd0d38632179271a96029167c609cfa6905d051dde308291cd696524dee62d` |

Byte hash attachment ≠ repo PNG (paste có thể re-encode); runtime dùng `vemoki-v-mark.png`. Đối chiếu **hình** @ `logo-mark-34px.png` khớp mẫu user (gradient, đáy tròn rộng, không square).

## Header acceptance (coordinator bar)

| Requirement | Verdict | Evidence |
| --- | --- | --- |
| Không nút primary «Đăng ký tư vấn» trên header desktop | **Pass** | `marketing-vi-1440-full.png`, `marketing-en-1440-full.png` — nav text «Tư vấn»/«Consult» + «Đăng nhập»/«Log in»; CTA gradient chỉ ở hero/footer |
| Không primary «Đăng ký tư vấn» trong mobile sheet | **Pass** | `marketing-mobile-nav-menu.tsx` — không `Button variant="primary"`; chỉ `InterestCtaAnchor` text + ghost login |
| Language selector rightmost (desktop & mobile chrome) | **Pass** | Full-page: `VI`/`EN` `<select>` là control cuối header (sau menu ☰ @ mobile) |
| Single `<select>`, không VI/EN toggle | **Pass** | `locale-switch.tsx`; ảnh không có segmented toggle |
| Nav / login / menu usable | **Pass** | Desktop: links + login; mobile: ☰ + login @768 (`marketing-vi-768-overflow.png`); sheet structure trong code |
| VI↔EN giữ `#interest` | **Pass** | `localeSwitchHref('en','sales','#interest')` → `/en#interest`; `LocaleSwitch` đọc `window.location.hash` |
| Page CTA «Đăng ký tư vấn» / form interest | **Pass** | Hero outline CTA + `vd09-neon-interest-click.mjs` (implementer) |
| Không overflow ngang | **Pass** | Overflow shots @ 768/320 + full-page mobile |

## Findings

| ID | Loại | Severity | Vấn đề | Tác động | Evidence | Chặn? |
| --- | --- | --- | --- | --- | --- | --- |
| — | — | — | Không có finding chặn trong scope header/logo/locale | — | — | — |

**Ghi chú không chặn (known gap ngoài AC):**

- **L-01:** Reviewer không mở lại mobile sheet trong browser phiên này; sheet AC dựa trên source + pattern mobile nav trước đó + absence primary CTA trong component.
- **L-02:** Hero/footer vẫn có «Đăng ký tư vấn» / «Book a consult» (outline) — đúng product, ngoài yêu cầu «không trên header».

## Logo scoring (header lockup only)

Thang 100: symbol vs mẫu user 40 · transparency/chrome 25 · proportion @ viewport 20 · crispness 15.

| Viewport | Score | Ghi chú |
| --- | ---: | --- |
| **Desktop 1440** | **97/100** | PNG user asset: gradient trái tím-hồng, phải cam, đáy tím xanh rộng; không black square. Mark `2.5rem` (~40px) sắc. −3: so với paste, glow/neon art hơi “phẳng” khi scale nhỏ (chấp nhận raster). |
| **Mobile 390** | **96/100** | Lockup `logo-390-wordmark.png` cân; mark `2.375rem`. −4: @34px base (`2.125rem` @ &lt;390) viền ribbon mềm hơn mock zoom (xem `logo-mark-34px.png`). |

**320 crispness:** `logo-320-wordmark.png` — không clip wordmark; mark vẫn đọc được.

## Verdict

| Area | Verdict |
| --- | --- |
| Header chrome (nav, locale, no header interest primary, overflow) | **PASS** |
| Logo PNG vs user definitive attachment @ 34px | **PASS** |
| **Overall (scope task)** | **PASS** |

Pilot ready / DoD merge: **không** kết luận trong artifact này — chỉ UI/UX read-only @ `4b2ae3b5`.
