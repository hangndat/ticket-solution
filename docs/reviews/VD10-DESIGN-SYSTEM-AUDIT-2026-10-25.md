# VD10 — Kiểm toán Design System (toàn surface)

**Ngày:** 2026-10-25 · **Persona:** Liv (product-design)  
**Baseline repo:** worktree `vd09-marketing-neon` @ `fdbae22a993e73a9f64c7140ec708d26f19e90ca`  
**SoT thiết kế:** `docs/design/vemoki-unified-v1/` (`DESIGN-ACCEPTANCE.md`, `VD-03-UI-IMPLEMENTATION-HANDOFF.md`, `design-system/product/{DESIGN-SYSTEM.md,tokens.json,implementation/*}`, `design-system/marketing/*` cho marketing only)  
**Phạm vi:** READ-ONLY — inventory lệch chuẩn + evidence; **không** sửa app code trong task này.

## Tóm tắt điều hành

Neon marketing (VD-09) đã áp gradient CTA trên hero/product/final CTA, nhưng **cùng trang marketing** vẫn còn nút Live Pulse `primary` phẳng (demo lặp, form lead, support). Consumer web dùng **`variant="brand"` phẳng** hầu hết CTA trong khi một số chỗ (event sidebox) đã có gradient tùy biến qua `className` — không thống nhất `PrimaryAction` trong `DESIGN-SYSTEM.md` §3.1. Portal đã nâng Live Pulse nhưng **`colorPrimary` vẫn là signal đỏ** thay vì violet/blue enterprise trong `portal-antd-theme.ts`, và **default terracotta `#9b3a18`** còn trong form brand/onboarding. iOS dùng shared `Button` nhưng **destructive** và **deny** lệch semantic gate colors.

## Phương pháp

| Bước | Chi tiết |
| --- | --- |
| Static | `rg` legacy hex/class; đọc `@ticket/ui` primitives, `apps/*/src/theme`, surface modules |
| Runtime | `pnpm --filter @ticket/web build && start` @ `:3000`; portal auth @ `:3013` (đã chạy local); Playwright `scripts/web-uat.mjs screenshot` |
| iOS | Không chạy simulator (chi phí); đối chiếu code + preview SoT `design-system/product/previews/attendee-mobile-thumb.png` |
| Evidence | `docs/reviews/assets/vd10-audit/*.png` |

### Evidence screenshots (local HEAD)

| File | Mô tả |
| --- | --- |
| `web-marketing-hero-1440.png` | Marketing neon hero + gradient CTA |
| `web-marketing-demo-cta-1440.png` | Section `#demo` — CTA `primary` phẳng |
| `web-marketing-interest-submit-1440.png` | Form lead — submit `primary` phẳng |
| `web-consumer-home-1440.png` | Catalog attendee — CTA `brand` phẳng |
| `web-redeem-1440.png` | Redeem — mix `primary` / `secondary` |
| `web-design-system-dev-1440.png` | `/dev/design-system` (404 route prod build; trang vẫn render) |
| `portal-auth-1440.png` | Portal login card |
| `portal-shell-1440.png` | Shell portal (copy từ evidence VD-09 brand, cùng worktree) |
| `ios-design-ref-attendee-thumb.png` | Tham chiếu handoff (không phải simulator) |

---

## Quyết định cần user / coordinator

| ID | Câu hỏi | Gợi ý từ handoff |
| --- | --- | --- |
| **DEC-01** | Consumer web: `PrimaryAction` dùng **gradient signal** (như event sidebox) hay **solid signal** (`brand` / `primary` hiện tại)? | VD-03: attendee web «restrained neon» — gradient có kiểm soát, không full marketing neon |
| **DEC-02** | Portal primary button: giữ **signal đỏ** (`brand/vemoki/tokens.json`) hay chuyển **`#7C4DED` / `#397DFF`** như `portal-antd-theme.ts`? | Handoff §0: portal «solid blue or violet», không copy marketing gradient |
| **DEC-03** | Marketing form lead: submit dùng **neon gradient** (scoped) hay **product primary** trên nền tối? | Marketing scoped CSS chỉ khi `data-vemoki-marketing='neon-v1'`; form nên đọc được trên ink |
| **DEC-04** | Default tenant `primaryColor` placeholder: đổi từ `#9b3a18` sang signal Live Pulse hay neutral `#E11D48`? | Terracotta = legacy pre–VD-07 |

---

## Lô triển khai (1 worker / slice)

| Batch | Slice | Phạm vi ước lượng | Finding IDs |
| --- | --- | --- | --- |
| **B-WEB-MKT** | `apps/web` marketing | Neon CTA parity trên sales page + legal/support chrome | DS-WEB-01 … DS-WEB-08 |
| **B-WEB-ATT** | `apps/web` consumer | Thống nhất `Button` variants, inputs, banners, surface states | DS-WEB-09 … DS-WEB-18 |
| **B-WEB-PLAT** | `apps/web` (nếu còn) | Dual-run / legacy admin notice | DS-WEB-19 … DS-WEB-20 |
| **B-PORTAL-THEME** | `apps/portal` theme | Ant Design token + radius + primary hue | DS-PORTAL-01 … DS-PORTAL-06 |
| **B-PORTAL-FORMS** | `apps/portal` tenant/event | Brand defaults, onboarding, settings | DS-PORTAL-07 … DS-PORTAL-09 |
| **B-IOS-UI** | `apps/mobile` | Button semantics, gate colors, list CTAs | DS-IOS-01 … DS-IOS-06 |

---

## Findings — Web (`DS-WEB-xx`)

| ID | Sev | Surface | Vấn đề | SoT / target | Evidence |
| --- | --- | --- | --- | --- | --- |
| **DS-WEB-01** | High | Marketing `/marketing` § `#demo` | CTA «Xem demo» dùng `Button variant="primary"` **không** class `mkt-neon-btn-primary` → nút đỏ phẳng Live Pulse trên nền paper | `mkt-neon-btn-primary` + `--vm-cta-gradient` (`marketing-neon.css` L94–103) | `cta.tsx` L30–32; `web-marketing-demo-cta-1440.png` |
| **DS-WEB-02** | High | Marketing `#interest` | Submit form `variant="primary"` — cùng lỗi trên nền ink/neon | Scoped `.mkt-neon-btn-primary` hoặc token product rõ ràng (DEC-03) | `interest-form.tsx` L349–357; `web-marketing-interest-submit-1440.png` |
| **DS-WEB-03** | Med | Marketing hero | `Button` vẫn `variant="primary"` dưới `mkt-neon-btn-primary` — gradient chỉ nhờ `!important` CSS; hover/focus từ CVA `primary` có thể chồng | Neon primary = gradient + radius 12px; tách variant `marketingPrimary` hoặc `variant="ghost"` + class neon | `hero.tsx` L33–36; `variants.ts` L18–19 |
| **DS-WEB-04** | Med | Marketing chrome | Trang privacy/support: header CTA «Demo» `variant="primary"` (không neon) | `marketing/chrome.tsx` L99–102; support/legal tương tự | `legal-pages.tsx` L61–65 |
| **DS-WEB-05** | Low | Marketing mobile nav | Hamburger = raw `<button>` + `marketingNavMenuToggle`, không `@ticket/ui` focus ring chuẩn | `Button variant="ghostOnInk"` hoặc icon button size `sm` | `marketing-mobile-nav-menu.tsx` L47–52 |
| **DS-WEB-06** | Med | Marketing `outcomes` / `cta` legacy sections | Section outcomes CTA `secondaryOnInk`; repeat demo `primary` — không neon scoped | Chỉ sales page bật neon; xác nhận section còn mount trên `/marketing` | `outcomes.tsx` L61; `cta.tsx` (xem DS-WEB-01) |
| **DS-WEB-07** | Low | Marketing interest retry | Alert destructive + `Button secondary` — OK product, nhưng contrast trên ink cần kiểm | `Alert` + `SecondaryAction` quiet | `interest-form.tsx` L140–144 |
| **DS-WEB-08** | Low | Marketing secondary CTA | `InterestCtaLink` = `<a class="mkt-neon-btn-secondary">` không qua `Button` — intentional; document pattern | Giữ nếu a11y pass | `hero.tsx` L45–52 |

| **DS-WEB-09** | High | Consumer catalog/home | Hầu hết CTA `variant="brand"` = **flat `--brand`** / signal, không gradient `PrimaryAction` attendee | `attendeeEventSideboxCta` pattern hoặc `primary` CVA + token (DEC-01) | `page.tsx` L97–165; `wallet/*`; `web-consumer-home-1440.png` |
| **DS-WEB-10** | Med | Event detail sidebox | CTA «Đổi mã» `variant="primary"` + **override gradient** `attendeeEventSideboxCta` — đúng hướng nhưng **khác** wallet/redeem | Thống nhất một variant (vd. `brand` + shared gradient class) | `events/[eventSlug]/page.tsx` L248–249; `attendee-detail-surface.ts` L127–131 |
| **DS-WEB-11** | Med | Redeem flow | Mix `primary`, `secondary`, `brand` trên cùng flow — khó predict hierarchy | COPY-GUIDE + một primary/secondary pair | `redeem-form.tsx` L1177–1316; `web-redeem-1440.png` |
| **DS-WEB-12** | Med | Catalog search | Raw `<input>` + custom focus shadow `rgba(37,99,235,0.15)` thay `@ticket/ui` `Input` | `Input` primitive + `--color-focus` | `home-catalog-grid.tsx` L79–88; `attendee-surface.ts` L118–121 |
| **DS-WEB-13** | Low | Catalog time filter | Hidden native `<select>` (a11y fallback) — OK; đảm bảo style không lộ | FilterChip đã đúng DS | `home-catalog-grid.tsx` L106–124 |
| **DS-WEB-14** | Med | `SurfaceState` | Border `border-2`, radius implicit — lệch card radius 16 / alert spec | `SurfaceState` package hoặc `rounded-2xl` + `border-line` | `surface-state.tsx` L14–17; wallet/ticket pages |
| **DS-WEB-15** | Low | Error/empty pages | `not-found` / `error` dùng `brand` — consistent với consumer nhưng flat | Align DEC-01 | `not-found.tsx` L28; `error.tsx` L25 |
| **DS-WEB-16** | Med | Auth/claim/account | Session/claim panels: `primary`/`brand` mix; notices dùng custom `attendeeNoticeError` không `Alert` | `@ticket/ui` `Alert` + buttons | `session-panel.tsx`; `claim-form.tsx` |
| **DS-WEB-17** | Low | Ticket state chips | `attendeeTicketStateTag` font **0.68rem** — design «never 10px for critical labels» (12px min metadata) | `text-xs` (12px) minimum | `attendee-detail-surface.ts` L204–205 |
| **DS-WEB-18** | Low | Dev page copy | `/dev/design-system` ghi «Prod routes still use legacy CSS» — outdated sau VD-04 | Cập nhật copy khi sweep | `dev/design-system/page.tsx` L40 |

| **DS-WEB-19** | High | Legacy dual-run (web) | `DualRunBanner` dùng class **`notice`** không còn trong `globals.css` (CSS chỉ trong archive BEM) → banner **unstyled** | `Alert` / `ContextBanner` token hoặc Tailwind utility block | `dual-run-banner.tsx` L33–37; archive `docs/design/ui-uplift-2026-10/.../app-uplift-bem.css` L1123 |
| **DS-WEB-20** | Low | Platform/admin redirect | Không còn UI admin trên web (proxy 410/redirect) — finding DS-WEB-19 chỉ khi banner được mount trong test/env | ADR-20 | `proxy.ts`, `legacy-cutover.ts` |

### Ghi chú primitives (`@ticket/ui`)

| ID | Sev | Vấn đề | Target |
| --- | --- | --- | --- |
| **DS-WEB-21** | Med | `buttonVariants.primary` hover đổi sang **ink** — không có trong product HTML prototypes | Giữ hover signal/ink theo DEC-01 |
| **DS-WEB-22** | Low | `rounded-md` on buttons — mapped `--radius-md` 12px OK; card `rounded-md` vs spec card 16 | `rounded-2xl` / `radius.lg` on cards (`cardVariants`) |

---

## Findings — Portal (`DS-PORTAL-xx`)

| ID | Sev | Surface | Vấn đề | SoT / target | Evidence |
| --- | --- | --- | --- | --- | --- |
| **DS-PORTAL-01** | High | Global theme | `vemokiTheme.token.colorPrimary` = **signal `#E11D48`** | `portal-antd-theme.ts` `colorPrimary: '#7C4DED'` (DEC-02) | `apps/portal/src/theme/vemoki.ts` L20–22 |
| **DS-PORTAL-02** | Med | Theme typography/color | `ink`/`paper`/`muted` lệch vài bước so với quiet enterprise (`#172039`, `#F6F8FC`, `#53607B`) | `implementation/portal-antd-theme.ts` L15–18 | `vemoki.ts` L7–14 |
| **DS-PORTAL-03** | Low | Button radius | `components.Button.borderRadius: 10` vs token `borderRadius: 12` | Align 12 | `vemoki.ts` L30–37 |
| **DS-PORTAL-04** | Med | Auth page | Inline `style={{ maxWidth, margin }}` on Card; primary button default Ant | ProLayout / shared auth template | `app/auth/page.tsx` L43–61; `portal-auth-1440.png` |
| **DS-PORTAL-05** | Low | Dual-run banner | Ant `Alert` info — đúng component; copy legacy link OK | Giữ; đảm bảo spacing token | `dual-run-banner.tsx` L22–38 |
| **DS-PORTAL-06** | Med | Tables/forms ops | Nhiều `style={{ minWidth }}` on Select/Input — bypass density token | ProComponents + theme `controlHeight: 44` | `ops/panels/*.tsx` (pattern) |

| **DS-PORTAL-07** | High | Event config / brand | Default/fallback `primaryColor: '#9b3a18'` terracotta | `brand.signal` hoặc tenant-neutral | `config/page.tsx` L97–112, L313 |
| **DS-PORTAL-08** | High | Onboarding / settings | Placeholder `#9b3a18` trên color field | `#E11D48` hoặc sample từ SoT | `onboarding/[tenantId]/page.tsx` L171, L412; `settings/page.tsx` L197 |
| **DS-PORTAL-09** | Low | Tests fixture | `readiness.test.ts` still asserts `#9b3a18` | Update khi đổi default | `tests/readiness.test.ts` L61 |

---

## Findings — iOS (`DS-IOS-xx`)

| ID | Sev | Surface | Vấn đề | SoT / target | Evidence |
| --- | --- | --- | --- | --- | --- |
| **DS-IOS-01** | High | `Button` destructive | `destructive` style: border `colors.accent` (signal pink), không `brand.destructive` / gate deny `#B3213A` | DESIGN-SYSTEM gate deny + `destructive` token | `components/ui/button.tsx` L161–165 |
| **DS-IOS-02** | Med | Gate colors map | `colors.deny: brand.signal` — deny outcomes should use **deny red** not signal | `staff-mobile` `--vm-deny` | `theme/colors.ts` L25–26 |
| **DS-IOS-03** | Med | Events feed cards | `PublishedEventCard` dùng `Pressable` + custom layout, không shared card CTA `Button` | Event card + one primary link | `screens/events.tsx` L47–74 |
| **DS-IOS-04** | Low | Primary button | `primary` = flat `colors.accent` (signal) — OK Live Pulse; thiếu gradient attendee (optional DEC-01 mobile) | `tokens.generated.ts` signal | `button.tsx` L152–155 |
| **DS-IOS-05** | Low | Focus ring | Focus = 2px border `colors.focus` — spec web 3px outline | `focus` 3px equivalent | `button.tsx` L173–175 |
| **DS-IOS-06** | Low | Simulator evidence | Chưa chụp runtime iOS tại SHA này | VD-05/06 UAT khi fix batch | `ios-design-ref-attendee-thumb.png` |

---

## Ma trận surface đã inventory

| Domain | Routes / files chính | Trạng thái DS |
| --- | --- | --- |
| Marketing | `app/marketing/**`, `src/marketing/**` | Neon partial (hero/product/final); CTAs paper/lead/support lệch |
| Consumer | `/`, `/wallet`, `/redeem`, `/claim`, `/invite`, `/t/.../events`, `/t/.../tickets`, `/account` | Live Pulse + `@ticket/ui`; CTA variant split |
| Web error | `not-found`, `error` | `SurfaceState` + `brand` |
| Portal auth/shell | `/auth`, layout shell | Ant + Live Pulse; primary hue lệch handoff |
| Portal tenant | `/t/[tenantId]/**`, onboarding | Tables Pro; terracotta defaults |
| Portal platform | `/platform/**` | Ant primary/danger standard |
| iOS attendee | `screens/events`, `my-tickets`, `ticket-detail`, redeem | Button component; list pressables |
| iOS staff gate | `src/gate/**`, staff screens | Semantic colors cần chỉnh deny/destructive |

---

## Không nằm scope (đúng spec)

- **Marketing neon trên product apps** — handoff cấm; không đề xuất port gradient marketing vào portal/scanner.
- **Production VPS** — audit repo local, không prod.
- **Sửa code / PR** — chỉ artifact này + screenshots.

---

## Checks (audit task)

| Check | Kết quả |
| --- | --- |
| SHA | `fdbae22a993e73a9f64c7140ec708d26f19e90ca` |
| Web build + start | Pass (`next build`, `:3000`) |
| Screenshots | `docs/reviews/assets/vd10-audit/` (9 files) |
| Verdict (audit) | **FAIL** — đủ finding High để mở các batch B-WEB-* / B-PORTAL-* / B-IOS-* |

*Reviewer implementation: coordinator giao worker web/portal/ios theo batch trên; PD không implement.*
