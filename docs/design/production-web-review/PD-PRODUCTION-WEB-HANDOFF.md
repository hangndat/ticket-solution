# PD — Handoff visual/UX production-grade (public web Vemoki)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` · `docs/agents/roles/product-design.md` |
| Live | https://app.vemoki.com |
| Tip đối chiếu | `origin/main` @ `d16ee368c68b2a6de12a6461e94acd8208dda192` (fetch lúc viết) |
| Scope | Docs-only — **không** implement `apps/web` trong Task PD này |
| BA sync | Cùng thư mục `docs/design/production-web-review/` — vocabulary bên dưới; nếu BA artifact xuất hiện sau, ưu tiên **cùng tên flow/state**, không đổi brand tokens |
| Architecture impact | Không |

**Vấn đề (user):** câu chữ tạm ổn nhưng UI **không giống trang web production** — còn cảm giác tool/ops.

**Không làm trong đợt này:** redesign toàn marketing site (`apps/web/src/marketing/*`), Android, màn ngoài MVP guest/attendee public.

---

## Brand tokens hiện có (giữ — không invent palette)

Nguồn: `brand/vemoki/tokens.json` → `apps/web/app/globals.css` `:root`

| Token | Giá trị | Vai trò |
| --- | --- | --- |
| `--ink` | `#22241f` | Text / primary fill button |
| `--paper` | `#f7f6f1` | Nền |
| `--signal` | `#9b3a18` | Accent wordmark ↗, card action |
| `--focus` | `#235fd0` | Focus ring (a11y) |
| Display | Syne (`--font-display`) | Wordmark / H1 |
| Body | Be Vietnam Pro (`--font-body`) | Copy |

**Hướng dẫn brand:** giữ O09 Vemoki (ink/paper/signal). Đây là brand đã chốt — **không** đổi sang purple/indigo AI-default, **không** thay Syne bằng serif cream-terracotta cliché mới. Paper+signal gần “warm editorial” nhưng được cứu bởi Syne geometric + mark V; task web là **hierarchy + atmosphere + bớt ops chrome**, không rewrite palette.

Spacing scale đã có: `--space-1`…`--space-8` (4→72). Radius brand: `--radius-sm: 2px` (sắc, không pill).

---

## 1. User flow (public web)

Persona chính: **Khách / Attendee** trên product surface `data-surface="product"` (không marketing locale).

### 1.1 Guest browse → event → redeem / auth

```text
[/] Home catalog
  ├─ CTA «Đổi mã lấy vé» → [/redeem]     (intent đã có mã)
  ├─ Nav «Nhận lời mời» → [/claim]
  ├─ Nav «Đăng nhập» → [/auth]
  └─ Event row/card → [/t/{tenant}/events/{slug}]
        ├─ Đọc hero + chi tiết + FAQ
        ├─ (intent) quay [/] hoặc vào [/redeem] / [/auth]
        └─ Error: unreachable / invalid → SurfaceState + «Về trang chủ»
```

### 1.2 Signed-in account

```text
[/auth] (đã login) → CTA «Tài khoản» [/account] | «Đổi mã» | «Trang chủ» | Đăng xuất
Nav khi authenticated: «Tài khoản» thay «Đăng nhập» (đã có sau UI-realism)
Staff soft-deny (?notice=admin_denied|gate_denied) → notice trên Home — giữ copy BA/ops, **không** phong cách alert hệ thống giữa catalog
```

### 1.3 Điểm đau “tool-like” (quan sát live)

| # | Surface | Hiện trạng | Cảm giác |
| --- | --- | --- | --- |
| T1 | Home footer aside | «**Danh sách từ máy chủ.**» | Ops / status panel |
| T2 | Global footer | «Đổi mã lấy vé · **Cổng kiểm soát vé**» | Gate product, không event discovery |
| T3 | Meta description | nhắc «cổng kiểm soát vé» | Trust/SEO lệch guest |
| T4 | Home event list | `event-row` + banner `object-fit: contain` letterbox | Catalog admin, không poster sự kiện |
| T5 | Event detail hero | 2 cột text + poster inset | Layout tool, thiếu full-bleed atmosphere |
| T6 | `/auth` | H2 «Thao tác» + `SurfaceState` empty dưới CTA | Console session, không welcome |
| T7 | Nav guest | 3 link text bằng nhau (Đổi mã / Claim / Đăng nhập) | Utility bar |
| T8 | Home 1st viewport | Wordmark hero khổ lớn + H1 lớn + intro + CTA, **không** media sự kiện | Brand OK nhưng thiếu “sự kiện thật”; dễ đọc như landing doc |

Touch web vs iOS: cùng published catalog / redeem; shell khác — Task này chỉ web public.

---

## 2. Trạng thái UI (bảng)

Copy gợi ý VI — đồng bộ `PUBLIC_EVENT_COPY` / BA; chỉ chỉnh tone khi BA chốt synonym.

### 2.1 Home catalog (`apps/web/app/page.tsx`)

| State | Khi nào | Nội dung UI / copy gợi ý |
| --- | --- | --- |
| empty | Catalog 0 sự kiện published | SurfaceState empty — title/detail `PUBLIC_EVENT_COPY.homeEmpty`; **không** notice «máy chủ» |
| loading | (hiện SSR; nếu thêm client refresh) | Skeleton 2–3 cover cards (ratio 16:9), không spinner giữa trang |
| ready | ≥1 event | Grid/list cover + org + tên + địa điểm; CTA card «Xem sự kiện» |
| error / retry | unreachable / invalid | SurfaceState error + link «Thử lại» (= reload `/`) hoặc «Đổi mã lấy vé» |
| denied | `?notice=admin_denied\|gate_denied` | Aside riêng **dưới** hero, trên catalog — tone người dùng, không `state-error` đỏ hệ thống trừ khi BA yêu cầu |

### 2.2 Event detail (`…/events/[eventSlug]/page.tsx`)

| State | Khi nào | Nội dung UI / copy gợi ý |
| --- | --- | --- |
| empty | N/A (404) | `notFound()` |
| loading | ISR / navigation | Prefer soft transition; optional skeleton hero media |
| ready | published ok | Full-bleed/hero media + title + when/where + sections + FAQ |
| error / retry | unreachable / invalid | SurfaceState + «Về trang chủ» (đã có) |
| denied / expired | ngoài scope public publish | Không surface trên guest detail |

### 2.3 Auth (`apps/web/app/auth/*`)

| State | Khi nào | Nội dung UI / copy gợi ý |
| --- | --- | --- |
| empty | signed-out | Brand wordmark nhỏ + H1 «Đăng nhập» + 1 câu intro + primary «Đăng nhập» (+ secondary «Đổi mã» optional). **Bỏ** H2 «Thao tác» và SurfaceState empty trùng ý |
| loading | fetch `/api/bff/me` | SurfaceState loading «Đang tải phiên…» (giữ) |
| ready | signed-in | «Đã đăng nhập» + subjectHint ngắn + CTA group; **một** dòng status tối đa — không double empty panel |
| error / retry | network / non-2xx | SurfaceState error + «Đăng nhập» / «Về trang chủ» |
| denied / unconfigured | OIDC thiếu (prod) | Notice fail-closed user-facing; **không** lộ env var names trên production (dev `<details>` OK) |

---

## 3. Visual direction production

### 3.1 Hierarchy — first viewport (Home)

Một composition (không dashboard):

1. **Nav** — wordmark trái; phải: tối đa 2 text links guest + 1 nút outline/primary «Đăng nhập» (hoặc «Tài khoản»).
2. **Hero band** — brand wordmark **hoặc** H1 (không cả hai khổ display cạnh tranh). Khuyến nghị: wordmark nav đủ brand → hero dùng **một** H1 ngắn + 1 câu + 1 CTA; **hoặc** giữ wordmark-hero rồi hạ H1 xuống size body-lead.
3. **Dominant visual** — ngay dưới/ cạnh hero: **cover sự kiện thật** (event đầu tiên hoặc collage 1 ảnh full-bleed), không chỉ gradient paper.
4. **Không** trong 1st viewport: notice ops, footer tagline gate, danh sách metadata dày.

```text
┌──────────────────────────────────────────────────────────┐
│ vemoki↗          Đổi mã · Nhận lời mời    [ Đăng nhập ] │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Điều tốt đẹp đưa chúng ta lại gần.                      │
│  Một câu hỗ trợ.                    [ Đổi mã lấy vé ]    │
│                                                          │
│ ████████████ FULL-BLEED / WIDE COVER (event #1) ████████ │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [cover]  Org · Event name · Place          Xem sự kiện↗ │
│  [cover]  …                                              │
└──────────────────────────────────────────────────────────┘
  (footer: vemoki↗ · Sự kiện & vé — không «cổng kiểm soát»)
```

### 3.2 Surfaces — chỉ rõ vấn đề + target

| Surface | Vấn đề live | Target production |
| --- | --- | --- |
| **Nav** | Utility links ngang hàng | Wordmark nổi; «Đăng nhập» = control rõ; staff links chỉ khi capability |
| **Auth page** | Session console («Thao tác», empty state dư) | Welcome ngắn + primary CTA; signed-in = next actions sạch |
| **Event cards (home)** | Row + contain letterbox + logo trùng banner | Cover card: banner `object-fit: cover` crop center, max-height ~180–220px; logo nhỏ **hoặc** bỏ logo trên card nếu banner đã mang brand; gap `--space-5` giữa cards |
| **Event detail hero/media** | Poster inset 2-cột, contain | Media plane rộng (full container width), min-height ~280–360px; `cover` mặc định cho atmosphere; `contain` **chỉ** khi banner có chữ/logo quan trọng (flag nội dung / class `poster-preserve`) — không letterbox xám `--ink-faint` lớn |
| **Footer** | «Cổng kiểm soát vé» | Guest: «vé & sự kiện» / tagline brand; **không** quảng bá Gate trên mọi trang public |
| **Notice boxes** | «Danh sách từ máy chủ» luôn hiện khi ready | Xóa trên happy path; chỉ hiện khi empty/error/denied cần giải thích |

### 3.3 Media rules (chốt cho web)

| Use | Fit | Ghi chú |
| --- | --- | --- |
| Home card banner | `cover` + `center` | Atmosphere discovery (P0) |
| Event hero banner | `cover` default; `contain` nếu `poster-preserve` | Tránh crop logo chữ khi cần |
| Logos | luôn `contain` | Không crop mark |
| Alt | decorative trên card (`alt=""`) OK nếu tên event trong text; hero: alt mô tả ngắn |

### 3.4 Motion

Giữ `rise-in` nhẹ; tôn trọng `prefers-reduced-motion` (thêm `@media` tắt transform nếu chưa có — P1).

---

## 4. Handoff implement (Role `web`)

**Ownership:** chỉ `apps/web`. Không đụng API/mobile. Không redesign `src/marketing/*` trừ khi copy footer/meta dùng chung.

### 4.1 P0 — visual “production” (làm trước)

| # | Thay đổi | Files / surfaces gợi ý |
| --- | --- | --- |
| P0-1 | Xóa aside ready-path «Danh sách từ máy chủ» (hoặc chỉ hiện khi empty) | `apps/web/app/page.tsx` |
| P0-2 | Footer + meta guest: bỏ «Cổng kiểm soát vé»; thay tagline sự kiện/vé | `apps/web/app/layout.tsx` |
| P0-3 | Home cards: banner `cover` (class mới hoặc override `.event-banner-card`); giảm letterbox; spacing card | `apps/web/app/globals.css`, optional `page.tsx` markup |
| P0-4 | Event detail: hero media full-width atmosphere (`cover` default) | `…/events/[eventSlug]/page.tsx`, `globals.css` (`.poster-media`, `.hero`) |
| P0-5 | Auth: bỏ H2 «Thao tác»; bỏ SurfaceState empty trùng dưới CTA signed-out; signed-in bỏ panel empty thứ hai | `apps/web/app/auth/auth-session.tsx` |
| P0-6 | Home 1st viewport: giảm cạnh tranh wordmark-hero vs H1; đưa cover event vào band trên-the-fold | `page.tsx`, `globals.css`, `hero-wordmark` |

### 4.2 P1 — polish (sau P0)

| # | Thay đổi | Files |
| --- | --- | --- |
| P1-1 | Nav: primary control style cho Đăng nhập / Tài khoản | `site-chrome.tsx`, `globals.css`, `nav/capabilities` labels only |
| P1-2 | `prefers-reduced-motion` cho `rise-in` | `globals.css` |
| P1-3 | OG image URL localhost trên live — fix `metadataBase` / public origin | `layout.tsx` / env `WEB_PUBLIC_ORIGIN` (flag coordinator nếu cần config) |
| P1-4 | Skeleton loading nếu thêm client catalog refresh | `page.tsx` / shared skeleton |

### 4.3 Spec spacing / type (good enough MVP)

- Home hero margin-top: giữ `--space-8` hoặc hạ `--space-7` nếu thêm cover band.
- Card gap: `--space-5`–`--space-6`; border-bottom hairline OK (editorial), tránh card shadow/pill.
- H1 home: một cấp display; intro ≤ ~2 dòng, `max-width` ~36–38rem.
- Button primary: ink fill / paper text (đã có); min 44×44 giữ UX-10.
- **Không** thêm Inter, purple gradient, glow, `rounded-full` clusters.

### 4.4 Tiêu chí nghiệm thu UI (web headless)

Given live hoặc local web trên tip implement:

1. Home ready: **không** chuỗi «Danh sách từ máy chủ» trong DOM guest happy path.
2. Footer guest: **không** «Cổng kiểm soát vé».
3. Screenshot 1280×800 Home: first viewport có brand + ≤1 display headline + CTA + media/cover sự kiện (không notice ops).
4. Event detail: hero media chiếm chiều ngang container, không letterbox xám lớn mặc định.
5. `/auth` signed-out: không H2 «Thao tác»; một primary «Đăng nhập».
6. Keyboard: tab tới CTA/nav thấy `--focus` ring; contrast ink/paper AA.

Map UAT: `scripts/web-uat.sh` / Playwright headless → `apps/web/.uat-artifacts/` (không headed mouse).

### 4.5 Good enough / out of scope

- Đủ khi guest path hết ops chrome + cover atmosphere; không cần redesign marketing landing.
- Không đổi token màu O09 trừ bug contrast.
- Nội dung demo trùng banner giữa 2 event = data/seed — ghi nhận trust risk, không bắt web fake ảnh khác nhau.

---

## 5. A11y / trust

| Chủ đề | Yêu cầu |
| --- | --- |
| Contrast | ink trên paper / paper trên ink button; signal trên paper cho text link — kiểm thủ công AA |
| Focus | Giữ `outline: 3px solid var(--focus)`; không `outline: none` |
| Hit target | CTA / auth buttons ≥44×44 (đã UX-10) |
| Announce | SurfaceState error/loading `role`/`aria-live` giữ; auth `aria-live="polite"` |
| Reduced motion | P1 — tắt `rise-in` transform |
| Không lộ debug | Prod: không env names, không JSON `/me`, không monospace subject đầy đủ; subjectHint đã truncate — OK |
| Cảm giác «sự kiện thật» | Cover crop + bỏ copy máy chủ/cổng; meta/footer nói vé & sự kiện; tránh chrome «ops» trên guest |
| robots | `noindex` hiện tại — chấp nhận pilot; khi public SEO: coordinator/BA quyết định, không tự index trong Task visual |

**Automated vs manual:** contrast/focus/ Dom strings = automated + headless screenshot; “cảm giác production” = review screenshot P0 checklist.

---

## Vocabulary đồng bộ BA

Dùng chung trong thư mục này:

- **Guest browse**, **published catalog**, **event detail**, **redeem**, **claim**, **auth session**, **account**
- States: `empty` · `loading` · `ready` · `error` · `denied`
- Surfaces: `home`, `event-detail`, `auth`, `nav`, `footer`, `notice`
- Tránh synonym lệch: «máy chủ» / «cổng» trên guest happy path = **ops** — BA copy nên ưu tiên «sự kiện đã xuất bản», «vé», «đăng nhập»

Nếu BA artifact đặt tên khác: cập nhật bảng map 1 dòng trong PR follow-up — không fork hai bộ state.

---

## DoD role PD (checklist)

| # | Mục | Status |
| --- | --- | --- |
| 1 | User flow | ✅ §1 |
| 2 | Trạng thái UI | ✅ §2 |
| 3 | Visual direction + surfaces | ✅ §3 (map role «Accessibility» + visual; a11y chi tiết §5) |
| 4 | Handoff implement web | ✅ §4 + P0 |
| 5 | A11y / trust | ✅ §5 |

*(Role file gom a11y thành mục 3; Task này tách visual §3 + a11y §5 cho rõ P0 visual.)*

---

## Evidence quan sát

- Live HTML Home/Auth/Event (2026-10-18): classes `home-hero`, `event-row`, `notice` «Danh sách từ máy chủ», footer gate, auth «Thao tác» + `surface-state state-empty`.
- Tokens: `brand/vemoki/tokens.json`, `globals.css` D6 mapping.
- Bối cảnh gần: UI realism PR #391 (contain media, bỏ demo chrome) — **đúng hướng trust** nhưng contain trên card/hero làm mất atmosphere production; Task web kế tiếp điều chỉnh fit theo §3.3.
- Headless screenshot: optional; Playwright không có sẵn trong worktree lúc viết — web implementer chụp khi làm P0.
