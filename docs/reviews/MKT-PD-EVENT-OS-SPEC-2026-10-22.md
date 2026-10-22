# MKT-PD — Event Operating System · Spec trang bán Vemoki (Epic #770)

| Trường | Giá trị |
| --- | --- |
| Ngày | 2026-10-22 |
| Role | `product-design` |
| Task | `task_8b0d9b9f2b04` |
| Epic | [#770](https://github.com/hangndat/ticket-solution/issues/770) — marketing site |
| Cost tier | `standard` |
| Architecture impact | **Không** (docs-only); handoff FE host-aware `apps/web` |
| Quyết định user | Live Pulse **v2** (không Midnight Indigo); buyer **agency + enterprise**; 8 section IA cố định; VI + EN; demo/số liệu có nhãn; không testimonial/logo khách giả |
| Căn cứ | [O13 DECISION-LOG](../DECISION-LOG.md#o13--trang-bán-platform-gtm--tách-subdomain-18102026), [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH](../plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md), [O13 PD pack](../design/o13-platform-sales/), [FE-PD-ACETERNITY-DS-2026-10-22.md](./FE-PD-ACETERNITY-DS-2026-10-22.md), [ADR-22](../ops/ADR-22-WEB-DS-ACETERNITY.md), [`brand/vemoki/tokens.json`](../../brand/vemoki/tokens.json), [PRD](../PRD.md), [RELEASE-CHECKLIST §Cấm](../ops/RELEASE-CHECKLIST.md) |
| Ghi chú nguồn | Task cite `FE-MARKETING-REQ-AUDIT-2026-10-22.md` — **chưa có file** trong worktree; yêu cầu audit được hấp thụ qua O13 + research + quyết định user Epic #770 |

---

## Tóm tắt điều hành

1. **Category mới (messaging):** «**Event Operating System**» — hệ điều hành vận hành sự kiện trực tiếp (invite → vé/QR → cổng → ops), **không** marketplace, **không** CRM/pipeline. Giữ toàn bộ rào O13 (anti-marketplace, demo giả lập, buyer Owner/Agency/enterprise ops).
2. **IA ship:** 8 section theo thứ tự user — Hero/Product Preview → Trust → Feature Bento → How It Works → Solutions by Audience → Business Outcomes (demo có nhãn) → FAQ → CTA/Footer.
3. **Handoff FE:** Copy keys paste-ready, layout 1280/390, map component shadcn + Aceternity **có chọn lọc**, motion budget marketing, ảnh product **thật** từ `docs/reviews/assets` (ưu tiên `app-*`, không mock số liệu).

**Đề xuất 1 dòng DECISION-LOG (coordinator chốt):**

> **2026-10-22 — O13 / Epic #770:** Trang `vemoki.com` định vị **Event Operating System** (agency + enterprise, in-person ops); giữ anti-marketplace & demo có nhãn; visual **Live Pulse v2**; IA 8 section theo spec `MKT-PD-EVENT-OS-SPEC-2026-10-22.md`.

---

## 1. Định vị «Event Operating System» đối chiếu O13

### 1.1 Một câu category (working)

| Locale | Copy |
| --- | --- |
| **VI** | **Vemoki** là **hệ điều hành sự kiện** (Event Operating System) multi-tenant — từ mã mời đến cổng có audit, cho tổ chức và agency chạy sự kiện trực tiếp. |
| **EN** | **Vemoki** is an **Event Operating System** — multi-tenant in-person ops from invite codes to an audited gate, for organizations and agencies. |

**Khác O13 cũ (chỉ «nền tảng»):** EOS nhấn **chuỗi vận hành end-to-end** và **buyer enterprise/agency**, không đổi host (`vemoki.com` sales · `app.vemoki.com` product) hay CTA (demo + quan tâm).

### 1.2 Messaging hierarchy

| Tầng | VI | EN | Ghi chú |
| --- | --- | --- | --- |
| **Eyebrow** (optional, nhỏ trên H1) | Hệ điều hành sự kiện trực tiếp | In-person event operating system | Không dùng «SaaS all-in-one» / «#1» |
| **Headline (H1)** | Vận hành sự kiện từ mã mời đến cổng — trên một hệ điều hành | Run events from invite to gate — on one operating system | Giữ outcome; có thể rút gọn mobile |
| **Subhead (1 câu)** | Multi-tenant cho agency và doanh nghiệp sự kiện: khách thấy thương hiệu của bạn; cổng có audit, không phụ thuộc marketplace. | Multi-tenant for agencies and enterprise event teams: your brand in front of guests; audited gate — not a marketplace. | Khớp O13 support line |
| **Proof points (3 bullet, trung thực)** | ① Mã mời → đổi vé → QR ký theo sự kiện (PRD M02–M04) · ② Cổng chống trùng + audit (M06–M07, D7 offline multi-device) · ③ Tách tenant + RLS + deny-by-default (O08) | ① Invite → redeem → event-scoped signed QR · ② Duplicate-safe gate + audit · ③ Tenant isolation + RLS + deny-by-default | **Không** số % bịa |
| **CTA primary A** | Xem demo | View demo | → `https://app.vemoki.com/` + nhãn giả lập |
| **CTA primary B** | Đăng ký quan tâm | Register interest | → `#interest` |
| **CTA secondary** | Đăng nhập | Log in | → `https://app.vemoki.com/auth` |
| **Demo disclaimer** (cạnh CTA / banner) | Demo giả lập — không phải khách hàng thật. | Simulated demo — not a real customer. | O13 #4; `role="status"` |

### 1.3 Thuật ngữ nhất quán VI / EN

| Khái niệm | VI (ưu tiên) | EN | Tránh |
| --- | --- | --- | --- |
| Category | Hệ điều hành sự kiện / Event Operating System | Event Operating System (EOS) | «Nền tảng all-in-one», «super app» |
| Buyer | Chủ tổ chức · Agency · Đội vận hành doanh nghiệp | Tenant Owner · Agency · Enterprise event ops | «Người mua vé» |
| Guest | Khách tham dự | Attendee / guest | Gọi guest là «khách hàng» trang bán |
| Issuance | Mã mời / nguồn mã | Invite code / code source | «Bán vé online» (MVP) |
| Admission | Cổng / check-in | Gate / check-in | «Turnstile SaaS» hype |
| Ops data | Số liệu vận hành (kèm *cập nhật lúc*) | Ops metrics (with *as of*) | «Real-time tuyệt đối» |
| Demo | Demo giả lập / dữ liệu mô phỏng | Simulated demo / illustrative data | «Case study», «đối tác» từ seed |
| Product host | Ứng dụng Vemoki | Vemoki app | Gộp sales + redeem trên một URL |

### 1.4 Điều KHÔNG được claim (rào cứng)

| # | Cấm | Nguồn |
| --- | --- | --- |
| 1 | Marketplace / discovery «sự kiện gần bạn» | O13, PRD positioning |
| 2 | Thanh toán, refund, chuyển nhượng, bán vé trả phí trên platform | O10 |
| 3 | Seat map, Apple/Google Wallet pass, app Android native | O10 |
| 4 | Logo wall / testimonial / «X khách hàng tin dùng» từ demo seed | O13 #4 |
| 5 | Capacity **50k concurrent** hoặc SLA khách hàng chưa benchmark | RELEASE-CHECKLIST §Cấm; O03 |
| 6 | SLA support/RPO/RTO như cam kết hợp đồng trên landing (chỉ mô tả thiết kế khi có link privacy/O06) | O06 — không marketing hóa số chưa drill |
| 7 | «Real-time tuyệt đối» cho dashboard — dùng *asOf* / pilot latency PRD | PRD §dashboard; O13 trust |
| 8 | Self-serve ACTIVE tenant từ form marketing | O17 / O13 onboarding |
| 9 | Enterprise SSO / custom domain / billing (chưa MVP) | O07, O16 non-goals |
| 10 | CRM, pipeline ROI, UTM suite như Splash | Dashboard research |

---

## 2. Design system & motion (Live Pulse v2)

| Token | Value | Dùng |
| --- | --- | --- |
| `--ink` | `#0B1220` | Text, wordmark |
| `--paper` | `#F4F6F8` | Page bg (gradient/texture nhẹ OK) |
| `--signal` | `#E11D48` | CTA primary |
| `--focus` | `#2563EB` | Focus ring 3px |
| Display / body | **Sora** / **Be Vietnam Pro** | `next/font` |

**Motion budget (marketing only):** ≤2 hiệu ứng/section; hero fade/ken-burns nhẹ ≤300ms; CTA hover ≤150ms; **⛔** `background-beams`, `3d-card-effect`, parallax, shader Pro ([FE-PD-ACETERNITY-DS](./FE-PD-ACETERNITY-DS-2026-10-22.md) §3.4). `UiMotionProvider` bọc island marketing, `MotionConfig reducedMotion="user"`.

**Anti-patterns:** purple AI-default, card cluster trong first viewport, overlay badge trên ảnh product (demo label **cạnh** CTA text).

---

## 3. Accessible patterns (toàn trang)

| Hạng mục | Yêu cầu |
| --- | --- |
| **Document language** | `<html lang="vi">` hoặc `en` theo route `/` vs `/en` |
| **Skip link** | Đầu DOM → `#main` |
| **Landmarks** | `<header>` nav · `<main id="main">` · `<footer>`; một `<nav aria-label="…">` primary |
| **Heading order** | Một **H1** (hero); mỗi section **H2**; H3 cho card bento / audience / FAQ question title |
| **Contrast** | Ink on paper ≥ **4.5:1** body; signal button dùng chữ trắng/paper — verify AA; muted text dùng derived `--muted` đủ contrast |
| **Focus** | `:focus-visible` ring 3px `--focus` + offset; không `outline: none` without replacement |
| **Touch** | CTA / accordion trigger ≥ **44×44** CSS px |
| **FAQ accordion** | Pattern [WAI-ARIA Accordion](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/): `button` header `aria-expanded`, `aria-controls` → panel `id`; optional `role="region"` + `aria-labelledby`; **one or many** expanded OK (khuyến nghị one-at-a-time mobile) |
| **Live regions** | Form interest: errors `role="alert"`; success `aria-live="polite"` |
| **Images** | Product preview: `alt` mô tả màn hình thật (VI/EN); decorative atmosphere `alt=""` |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` tắt transform/loop; giữ opacity state change |

---

## 4. Spec theo section (8)

Thứ tự DOM = thứ tự scroll. Anchor IDs gợi ý cho locale switch hash.

---

### Section 1 — Hero / Product Preview

| | |
| --- | --- |
| **Mục đích** | ≤30s: category EOS + outcome + dual CTA; **preview sản phẩm thật** (không collage dashboard giả). |
| **Anchor** | `#top` (hero) |

#### Copy (keys `copy.ts`)

| Key | VI | EN |
| --- | --- | --- |
| `hero.eyebrow` | Hệ điều hành sự kiện trực tiếp | In-person event operating system |
| `hero.headline` | Vận hành sự kiện từ mã mời đến cổng — trên một hệ điều hành | Run events from invite to gate — on one operating system |
| `hero.sub` | Multi-tenant cho agency và doanh nghiệp sự kiện. Khách thấy thương hiệu của bạn; cổng có audit, không phụ thuộc marketplace. | Multi-tenant for agencies and enterprise event teams. Your brand for guests; audited gate — not a marketplace. |
| `hero.cta.demo` | Xem demo | View demo |
| `hero.cta.interest` | Đăng ký quan tâm | Register interest |
| `hero.cta.login` | Đăng nhập | Log in |
| `hero.demo_note` | Demo giả lập — không phải khách hàng thật. | Simulated demo — not a real customer. |
| `hero.preview.caption` | Giao diện thật từ ứng dụng Vemoki (môi trường pilot). | Actual Vemoki app UI (pilot environment). |

#### Layout

| Viewport | Composition |
| --- | --- |
| **Desktop 1280** | Grid 12 col: col 1–6 brand + H1 + sub + CTA row + demo note; col 7–12 **single** product frame (16:10), subtle paper shadow — **không** side-by-side 3 mockups |
| **Mobile 390** | Stack: brand → H1 → sub → CTAs full-width → demo note → product frame full-bleed width, max-height ~42vh `object-fit: cover` top |

#### Product preview — ảnh thật (đề xuất)

| Ưu tiên | File (repo path) | Màn hình | Ghi chú |
| --- | --- | --- | --- |
| **P1 Hero desktop** | `docs/reviews/assets/mpr-web-mockup-uat-2026-10-20/app-redeem-desktop.png` | Đổi mã / redeem | UI product thật; crop bỏ nav attendee nếu cần focus form |
| **P1 Hero mobile** | `docs/reviews/assets/mpr-web-mockup-uat-2026-10-20/app-redeem-mobile.png` | Redeem mobile | Cùng cặp |
| **P2 Alternate / carousel tab** | `docs/reviews/assets/fe-refactor-gate-2026-10-21/gate-desktop-manual.png` | Gate staff manual check-in | Nhấn EOS «cổng» |
| **P2 mobile gate** | `docs/reviews/assets/fe-refactor-gate-2026-10-21/gate-mobile.png` | Gate mobile | |
| **P3 Admin ops** | `docs/reviews/assets/mpr-web-mockup-uat-2026-10-20/app-admin-desktop.png` | Admin shell | Chỉ khi tab «Quản trị» — không default hero |
| **Tránh làm hero** | `mock-*` trong cùng folder | — | Dùng `app-*` trước; mock chỉ fallback |
| **Di chuyển khi ship** | Copy vào `apps/web/public/marketing/` hoặc `brand/vemoki/marketing/` | — | FE task; giữ attribution trong README |

**Không:** ảnh có số liệu KPI nhìn như khách thật; sticker «+300%»; fake notification counts.

#### Components

| Khối | Nguồn |
| --- | --- |
| Wordmark + signal ↗ | **N** `VemokiLockup` (token) |
| CTA group | **S** `Button` variants `primary`/`secondary` |
| Product frame | **N** `ProductPreviewFrame` (border `--line`, optional **A** hero fade wrapper — vendored `hero-sections-free` opacity only) |
| Locale | **N** link group VI \| EN |

#### Motion

Hero plane fade-in 300ms once; preview image **không** ken-burns nếu reduced-motion.

#### States

Default · loading skeleton cho image · broken image → fallback static + caption vẫn hiện.

---

### Section 2 — Trust

| | |
| --- | --- |
| **Mục đích** | Trust sớm sau hero — **chỉ** claims có evidence nội bộ (không logo khách). |
| **Anchor** | `#trust` |

#### Copy

| Key | VI | EN |
| --- | --- | --- |
| `trust.title` | Tin cậy cho vận hành cổng thật | Built for real gate operations |
| `trust.lead` | Thiết kế cho sự kiện trực tiếp — không dashboard «ảo real-time». | Designed for in-person events — not vanity real-time dashboards. |
| `trust.tenant.title` | Tách tenant | Tenant isolation |
| `trust.tenant.body` | PostgreSQL shared schema + **RLS** và phân quyền deny-by-default theo tenant. | Shared PostgreSQL with **RLS** and deny-by-default tenant authz. |
| `trust.gate.title` | Cổng chống trùng | Duplicate-safe admission |
| `trust.gate.body` | Check-in ghi audit; QR ký theo sự kiện; thu hồi vé vô hiệu mã cũ. | Audited check-in; event-scoped signed QR; revocation rotates tokens. |
| `trust.offline.title` | Cổng khi mạng yếu | Gate when connectivity is limited |
| `trust.offline.body` | **D7:** luồng cổng multi-device có thiết kế offline — không hứa «luôn online 100%». | **D7:** multi-device gate designed for limited connectivity — not «100% online only». |
| `trust.honest.title` | Số liệu trung thực | Honest metrics |
| `trust.honest.body` | Dashboard ops kèm mốc *cập nhật lúc*; pilot mục tiêu trễ ≤10s — không «tức thì tuyệt đối». | Ops views show an *as of* time; pilot target latency ≤10s — not absolute instant. |
| `trust.security.title` | Bảo mật vận hành | Security baseline |
| `trust.security.body` | TLS, rate limit, MFA admin, log không chứa token QR/OTP thô (PRD §security). | TLS, rate limits, admin MFA, logs exclude raw QR/OTP tokens (PRD). |

**Nguồn nội bộ:** PRD §4–§7, O08, D7, O06 (mô tả — không quote SLA như sales promise).

#### Layout

| 1280 | 3 cột equal (`grid-cols-3`), icon line mono 24px, title H3, body muted |
| 390 | 1 cột stack; divider `--line` giữa items |

#### Components

**N** `TrustColumn` hoặc **S** `Card` variant outline — **⛔** `evervault-card`, logo cloud.

#### Motion

None hoặc stagger fade 150ms (tắt reduced-motion).

#### States

Static.

---

### Section 3 — Feature Bento Grid

| | |
| --- | --- |
| **Mục đích** | 5–7 ô năng lực **có trong PRD/MVP** — không hứa tính năng OUT. |
| **Anchor** | `#features` |

#### Cells (7) — verified PRD

| # | Key | Title VI | Title EN | Body VI (ngắn) | Body EN | PRD |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `bento.invite` | Mã mời → vé | Invite → ticket | Nguồn mã, quota, đổi mã có xác minh email. | Code sources, quotas, redeem with verified email. | M02–M03 |
| 2 | `bento.qr` | Vé & QR ký | Signed QR tickets | Token ký theo sự kiện; không nhúng PII trong QR. | Event-scoped signed tokens; no PII in QR payload. | M04 |
| 3 | `bento.gate` | Cổng & audit | Gate & audit | Quét iOS/web dự phòng; chống trùng; log staff/device. | iOS scan + web fallback; duplicate block; staff/device audit. | M06–M07 |
| 4 | `bento.offline` | Cổng multi-device | Multi-device gate | Thiết kế offline D7; vé xem offline trên app. | D7 offline gate design; ticket display offline in app. | D7, PRD |
| 5 | `bento.admin` | Quản trị sự kiện | Event administration | Sự kiện, loại vé, import khách, email vé. | Events, ticket types, guest import, ticket email. | M01, M05 |
| 6 | `bento.whitelabel` | White-label khách | Guest white-label | Brand org/event trên trang khách; platform ở marketing/IdP. | Org/event brand on guest surfaces; platform on marketing/IdP. | D8 |
| 7 | `bento.ops` | Ops & báo cáo | Ops reporting | Dashboard gần real-time pilot; báo cáo có định nghĩa chỉ số. | Near real-time pilot dashboard; defined metrics in reports. | M08, §dashboard |

**Không thêm ô:** payment, seat, Wallet, Android, marketplace, CRM.

#### Copy section chrome

| Key | VI | EN |
| --- | --- | --- |
| `bento.title` | Năng lực vận hành trong một hệ | Operations capabilities in one system |
| `bento.lead` | Mỗi khối là luồng thật trong sản phẩm — không slide «tương lai». | Each tile is a real product flow — not a future roadmap slide. |

#### Layout

| 1280 | Bento **asymmetric**: row1 span-2 invite + span-1 qr + span-1 gate; row2 offline span-1 + admin span-2 + whitelabel span-1; row3 ops full width banner tile — tham khảo layout `bento-grid` Aceternity **không** 3D tilt |
| 390 | 1 col; invite + gate featured height; rest equal cards |

#### Components

**A** `bento-grid` (Free, vendored, flat hover border only) + **N** `FeatureBentoCell` + **S** `Card`.

#### Motion

Hover border-color 150ms only.

#### States

Default; optional `aria-describedby` per cell for screen readers.

---

### Section 4 — How It Works

| | |
| --- | --- |
| **Mục đích** | Workflow EOS 5 bước — anti-marketplace note. |
| **Anchor** | `#how-it-works` |

#### Copy (reuse O13 `workflow.*` + EOS)

| Key | VI | EN |
| --- | --- | --- |
| `how.title` | Cách hệ điều hành chạy | How the operating system runs |
| `how.lead` | Một chuỗi ops — từ chuẩn bị đến cổng. | One ops chain — from prep to the gate. |
| `how.step1` | Tạo sự kiện & loại vé / nguồn mã | Create the event, ticket types, and code sources |
| `how.step2` | Phát hành mã hoặc import khách | Issue invites or import guests |
| `how.step3` | Khách đổi mã → nhận QR | Guests redeem → receive QR |
| `how.step4` | Cổng quét, chống trùng, ghi audit | Gate scans, blocks duplicates, writes audit |
| `how.step5` | Theo dõi ops với mốc *cập nhật lúc* | Track ops with an honest *as of* timestamp |
| `how.note` | Không phải marketplace «tìm sự kiện gần bạn». | Not a «events near you» marketplace. |

#### Layout

| 1280 | Horizontal **numbered steps** (1–5) với connector line `--line`; hoặc vertical timeline trái |
| 390 | Vertical numbered list; step number in circle 32px |

#### Components

**N** `StepsTimeline` — **⛔** `container-scroll-animation`.

#### Motion

Optional step reveal on scroll (opacity only, once).

#### States

Static.

---

### Section 5 — Solutions by Audience

| | |
| --- | --- |
| **Mục đích** | Agency + enterprise buyer; staff/guest **ngữ cảnh** (không CTA bán cho attendee). |
| **Anchor** | `#solutions` |

#### Copy

| Key | VI | EN |
| --- | --- | --- |
| `solutions.title` | Giải pháp theo đối tượng | Solutions by audience |
| `solutions.lead` | Trang này dành cho người mua vận hành — không phải khách cầm vé. | This page is for operations buyers — not guests holding a ticket. |
| `solutions.owner.title` | Chủ tổ chức / doanh nghiệp | Tenant Owner / enterprise |
| `solutions.owner.body` | Nhiều sự kiện trong một tổ chức: phát hành mã, email vé, theo dõi cổng, báo cáo ops. | Multiple events in one org: codes, ticket email, gate tracking, ops reports. |
| `solutions.agency.title` | Agency sự kiện | Event agency |
| `solutions.agency.body` | Membership nhiều tenant — một hệ điều hành, nhiều thương hiệu khách, không fork code. | Membership across tenants — one OS, many client brands, no code forks. |
| `solutions.staff.title` | Nhân sự cổng | Gate staff |
| `solutions.staff.body` | Quét QR trên iOS; web dự phòng; audit theo sự kiện. | Scan on iOS; web fallback; per-event audit. |
| `solutions.guest.title` | Khách tham dự | Attendees |
| `solutions.guest.body` | Đổi mã trên web/iOS dưới brand sự kiện — footer link «Bạn có mã mời?» | Redeem on web/iOS under event brand — see footer attendee link. |

#### Layout

| 1280 | 2×2 grid: Owner + Agency **emphasized** (paper elevated); Staff + Guest muted border |
| 390 | Stack; Owner & Agency first |

#### Components

**S** `Card` + **N** audience icon (lucide: `building-2`, `users`, `scan`, `ticket`)

#### Motion

None.

#### States

Static.

---

### Section 6 — Business Outcomes

| | |
| --- | --- |
| **Mục đích** | Minh họa lợi ích ops — **chỉ số DEMO** có nhãn pháp lý rõ; không bằng chứng khách. |
| **Anchor** | `#outcomes` |

#### Copy

| Key | VI | EN |
| --- | --- | --- |
| `outcomes.title` | Kết quả vận hành (minh họa) | Operational outcomes (illustration) |
| `outcomes.disclaimer` | **Minh hoạ — dữ liệu mô phỏng, không phải khách hàng thật.** | **Illustration — simulated data, not real customers.** |
| `outcomes.lead` | Số dưới đây giải thích loại chỉ số bạn theo dõi trong pilot — không phải benchmark đã ký hợp đồng. | Figures below show the kinds of metrics you track in pilot — not contracted benchmarks. |
| `outcomes.metric1.label` | Thời gian xử lý check-in (p50) | Check-in handling time (p50) |
| `outcomes.metric1.value` | ~1,2 giây | ~1.2s |
| `outcomes.metric2.label` | Lượt quét trùng bị chặn (phiên demo) | Duplicate scans blocked (demo session) |
| `outcomes.metric2.value` | 14 |
| `outcomes.metric3.label` | Vé đã cấp / cổng mở (fixture) | Tickets issued / gates open (fixture) |
| `outcomes.metric3.value` | 1.240 / 3 |
| `outcomes.chart.caption` | Biểu đồ minh họa luồng vào cổng theo giờ — dữ liệu giả lập. | Illustrative hourly entry chart — simulated data. |

#### Trình bày an toàn

- Banner disclaimer **luôn visible** phía trên metrics (`role="status"`).
- Typography: label > value; value dùng `font-display` nhưng **không** animation count-up.
- **Không** sparkline giống stock ticker; bar chart tĩnh CSS hoặc SVG đơn giản.
- Footnote link: «Xem demo giả lập» → app + `badge.demo`.

#### Layout

| 1280 | Disclaimer full width → 3 stat columns → wide chart below |
| 390 | Disclaimer sticky top of section (optional) → stats stack → chart scroll horizontal **disabled** (fit width) |

#### Components

**N** `DemoMetric` + **S** `Alert` variant info for disclaimer — **⛔** fake «Wall Street» dashboards.

#### Motion

None on numbers.

#### States

Static; chart `aria-hidden="true"` if purely decorative + caption carries meaning.

---

### Section 7 — FAQ

| | |
| --- | --- |
| **Mục đích** | 10 câu thật — giảm nhầm marketplace/payment/enterprise claims. |
| **Anchor** | `#faq` |

#### Copy (accordion items)

| Key | Q VI | A VI | Q EN | A EN |
| --- | --- | --- | --- | --- |
| `faq.1` | Vemoki có phải marketplace bán vé không? | Không. Vemoki là hệ vận hành in-person: mã mời, QR, cổng — không «tìm sự kiện» công khai như marketplace. | Is Vemoki a ticket marketplace? | No. Vemoki is in-person ops: invites, QR, gate — not public event discovery like a marketplace. |
| `faq.2` | Có thanh toán hoặc bán vé trả phí trên nền tảng? | MVP không có checkout, refund hay chuyển nhượng trên platform. | Paid checkout on the platform? | MVP has no checkout, refunds, or transfers on-platform. |
| `faq.3` | Demo có phải khách hàng thật? | Không. Demo hiện tại là fixture giả lập để xem sản phẩm. | Is the demo a real customer? | No. Current demos are simulated fixtures to explore the product. |
| `faq.4` | Ai là người mua trang này? | Tenant Owner, agency và đội vận hành doanh nghiệp — không phải khách cầm vé. | Who is this page for? | Tenant owners, agencies, and enterprise ops teams — not ticket-holding guests. |
| `faq.5` | Khách đổi mã ở đâu? | Trên `app.vemoki.com` (web/iOS) dưới brand sự kiện — link từ footer marketing. | Where do guests redeem? | On `app.vemoki.com` (web/iOS) under the event brand — see marketing footer. |
| `faq.6` | Cổng hoạt động khi mạng yếu? | Có thiết kế cổng multi-device offline (D7); không hứa mọi tình huống «online only». | Gate with poor connectivity? | Multi-device offline gate is in scope (D7); we do not promise «online only» for every edge case. |
| `faq.7` | White-label nghĩa là gì? | Khách thấy brand org/sự kiện; Vemoki hiện ở marketing, tài khoản và đăng nhập. | What does white-label mean? | Guests see org/event brand; Vemoki appears on marketing, account, and sign-in. |
| `faq.8` | Dữ liệu tenant có tách biệt? | Có — shared PostgreSQL với RLS và phân quyền deny-by-default (O08). | Is tenant data isolated? | Yes — shared PostgreSQL with RLS and deny-by-default authz (O08). |
| `faq.9` | Có app Android? | MVP tập trung iOS cho scanner; Android native không trong phạm vi O10. | Android app? | MVP focuses on iOS for scanning; native Android is out of scope (O10). |
| `faq.10` | Làm sao bắt đầu sau khi gửi form quan tâm? | Chúng tôi liên hệ email — onboarding tenant **ACTIVE** qua Operator, không tự kích hoạt từ form marketing. | After interest form, what's next? | We follow up by email — tenant **ACTIVE** is via Operator, not auto from the marketing form. |

#### Layout

| 1280 | `max-w-3xl` centered accordion |
| 390 | Full width; tap targets 44px |

#### Components

**S** `Accordion` (Radix/shadcn) — pattern APG ở §3.

#### Motion

Accordion height transition ≤200ms; reduced-motion → instant toggle.

#### States

Collapsed default; optional `defaultValue` first item for SEO không bắt buộc.

---

### Section 8 — Conversion CTA / Footer

| | |
| --- | --- |
| **Mục đích** | Đóng funnel: form quan tâm + CTA lặp + legal + attendee escape hatch. |
| **Anchor** | `#interest` (form), `#footer` |

#### Copy — reuse O13 `interest.*`, `cta.repeat.*`, `footer.*`, `nav.privacy`, `nav.support`

| Key | VI | EN |
| --- | --- | --- |
| `cta.title` | Sẵn sàng xem vận hành thật? | Ready to see real operations? |
| `cta.lead` | Xem demo giả lập hoặc để lại thông tin — chúng tôi liên hệ onboarding. | Try the simulated demo or leave your details — we’ll follow up on onboarding. |
| `footer.attendee` | Bạn có mã mời? Đổi vé trên ứng dụng | Have an invite code? Redeem on the app |
| `footer.tagline` | vemoki↗ · Event Operating System cho sự kiện trực tiếp | vemoki↗ · Event Operating System for in-person events |

Form fields: name, work email, org, role (Owner / Agency / Other), notes optional, consent checkbox — **đầy đủ** trong [`copy-vi-en.md`](../design/o13-platform-sales/copy-vi-en.md).

#### Layout

| 1280 | Split: trái CTA repeat + demo badge; phải form `max-w-md`; footer full bleed links |
| 390 | CTA stack → form full width → footer stack center |

#### Components

**S** `Input`, `Label`, `Field`, `Checkbox`, `Button`, form `Alert` errors; **N** footer columns.

#### Motion

Form success fade-in 200ms.

#### States

idle · validating · submitting · success · error (map [`states.md`](../design/o13-platform-sales/states.md))

---

## 5. Chrome chung (header / locale / meta)

| Key | VI | EN |
| --- | --- | --- |
| `meta.title` | Vemoki — Hệ điều hành sự kiện trực tiếp | Vemoki — In-person Event Operating System |
| `meta.description` | EOS multi-tenant cho agency và doanh nghiệp: mã mời, QR, cổng có audit. Thương hiệu của bạn phía khách. | Multi-tenant EOS for agencies and enterprises: invites, QR, audited gate. Your brand in front of guests. |

Header nav: Demo · Quan tâm · Login · Privacy · Support · VI\|EN — contract O13 unchanged.

---

## 6. Handoff FE (Epic #770)

| Hạng mục | Chỉ dẫn |
| --- | --- |
| Routes | `/`, `/en`, `/privacy`, `/support` (+ EN) — host `vemoki.com` |
| Copy SoT | Section keys trong file này + merge `docs/design/o13-platform-sales/copy-vi-en.md` (form/legal) |
| DS | ADR-22 pipeline; marketing islands Tailwind + `@ticket/ui`; Aceternity chỉ section hero/bento như bảng |
| Assets | Copy ảnh `app-*` từ `docs/reviews/assets/...` → `public/marketing/`; ghi `SOURCES.md` |
| UAT | Screenshot 1280 + 390 VI/EN; axe contrast; accordion keyboard; form states |
| Out of scope | Pricing, CMS, chatbot, logo wall, Android/WALLET claims |

### Checklist PD DoD

- [x] EOS positioning vs O13 + messaging hierarchy
- [x] VI/EN glossary + forbidden claims
- [x] DECISION-LOG one-liner proposed
- [x] 8 sections: purpose, copy, layout 1280/390, components, motion, states
- [x] Real product preview asset paths
- [x] Bento 7 cells PRD-verified
- [x] Business outcomes demo disclaimer pattern
- [x] FAQ 10 VI+EN
- [x] a11y patterns (headings, landmarks, accordion, contrast Live Pulse v2)

---

## 7. Phụ lục — Map component nhanh (marketing)

| Section | shadcn (S) | Aceternity (A) vendored | Custom (N) |
| --- | --- | --- | --- |
| Hero | Button | hero fade (optional) | Lockup, ProductPreviewFrame |
| Trust | Card | — | TrustColumn |
| Bento | Card | bento-grid layout | FeatureBentoCell |
| How | — | — | StepsTimeline |
| Solutions | Card | — | AudienceCard |
| Outcomes | Alert | — | DemoMetric, static chart |
| FAQ | Accordion | — | — |
| CTA/Footer | Form primitives | — | MarketingFooter |

---

*Artifact PD — không sửa `apps/*`. Implementer: worker web Epic #770 sau review coordinator.*
