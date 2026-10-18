# O13 — Handoff Product Design: trang bán platform Vemoki

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Role | `product-design` (`docs/agents/roles/product-design.md`) |
| Epic / quyết định | [DECISION-LOG O13](../../DECISION-LOG.md#o13--trang-bán-platform-gtm--tách-subdomain-18102026) |
| Research | [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md](../../plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md) |
| Tokens | [`brand/vemoki/tokens.json`](../../../brand/vemoki/tokens.json) |
| Ownership coding | **web** (`apps/web`) — host-aware marketing trên `vemoki.com` |
| Non-goals | Payment / pricing table · Android native · Wallet · seat map · claim pilot khách thật · deploy prod từ PD |

**Mục tiêu handoff:** unblock coding web trang bán Owner + Agency (VI + EN) ngay sau artifact này (O13 #7).

---

## Artifact trong thư mục

| File | DoD PD |
| ---- | ------ |
| [flow.md](./flow.md) | (1) User flow |
| [states.md](./states.md) | (2) Trạng thái UI |
| [visual-notes.md](./visual-notes.md) | (3) a11y + (5) hướng dẫn triển khai / visual |
| [copy-vi-en.md](./copy-vi-en.md) | (4) Copy + AC quan sát được; locale VI/EN |
| [prototype/](./prototype/) | HTML tĩnh reviewable (không = runtime) |

---

## DoD role product-design (checklist)

- [x] **User flow** — prospect Owner/Agency; CTA demo + quan tâm; locale; privacy/support; đăng nhập → app
- [x] **States** — sales page, form quan tâm, demo CTA, locale switch, privacy/support tối thiểu
- [x] **Accessibility** — WCAG 2.2 AA notes (contrast tokens, focus, keyboard, labels, reduced-motion)
- [x] **UI AC** — checklist headless + map UAT web
- [x] **Implementation handoff** — IA/sections, tokens, ownership web, contract flags, MVP “good enough”
- [x] **Copy VI + EN** — mọi string marketing trên page
- [x] **Privacy + Support** trong IA tối thiểu

**Không trong PD:** sửa `apps/web` feature code; DNS/OIDC (architect); deploy prod.

---

## IA — sitemap marketing (`vemoki.com`)

| Route | Mục đích | Locale |
| ----- | -------- | ------ |
| `/` (hoặc `/vi`) | Sales 1-page Owner + Agency | VI default |
| `/en` | Cùng sales, copy EN | EN |
| `/privacy` · `/en/privacy` | Privacy policy tối thiểu (ASC + trust) | VI + EN |
| `/support` · `/en/support` | Support / liên hệ hỗ trợ tối thiểu | VI + EN |

**Product (không redesign trong O13):** `app.vemoki.com` — auth, admin, redeem, gate, event guest, demo fixture. Link từ marketing chỉ deep-link + nhãn giả lập.

### Locale model (chốt PD)

- Path prefix: VI = `/` (không bắt buộc `/vi`); EN = `/en…`.
- Switcher trong header: `VI | EN` — giữ cùng section hash khi đổi locale nếu có.
- Product app vẫn mặc định VI (O04); trang bán **không** phụ thuộc i18n product.

---

## Sections — sales page (một job / section)

### First viewport (hero) — một composition, brand-first

| Phần tử | Quy tắc |
| ------- | ------- |
| Brand | Wordmark **vemoki** + signal `↗` — hero-level (không chỉ nav) |
| Headline | 1 câu outcome organizer (in-person + Gate) |
| Support | 1 câu ngắn: multi-tenant · white-label khách · Gate có audit |
| CTA group | **Primary A:** Xem demo → `https://app.vemoki.com` (+ nhãn giả lập cạnh CTA) · **Primary B:** Đăng ký quan tâm → `#interest` / form · **Secondary:** Đăng nhập → `https://app.vemoki.com/auth` |
| Visual | Một plane full-bleed (UI Gate/redeem/admin atmosphere) — **không** card cluster, collage, overlay badge, stats |

**Cấm first viewport:** pricing, danh sách event công khai, logo “khách hàng”, schedule, địa chỉ, dashboard widgets.

### Below fold (thứ tự cố định)

1. **Ai dùng** — Owner · Agency · (Gate staff / Attendee chỉ ngữ cảnh, không phải buyer)
2. **Luồng vận hành** — Tạo event → mã/invite → đổi mã → QR → Gate → ops (asOf-honest)
3. **White-label** — khách thấy brand org/event; Vemoki ở marketing / account
4. **An toàn vận hành** — tenant isolation, deny-by-default, chống trùng / audit (ngôn ngữ buyer)
5. **Demo giả lập** — giải thích fixture + CTA demo lại + banner “Demo giả lập”
6. **CTA lặp** + footer: Privacy · Support · App Store (khi có) · locale

Form **Đăng ký quan tâm** nằm section 6 (anchor `#interest`) — có thể sticky CTA trên mobile trỏ về form.

---

## Host / link contract (PD → web; DNS = architect)

| Từ | Đến | Ghi chú UI |
| -- | --- | ---------- |
| CTA Xem demo | `https://app.vemoki.com/` (hoặc path demo fixture architect/web chốt) | Badge/text: VI `Demo giả lập` / EN `Simulated demo` |
| Đăng nhập | `https://app.vemoki.com/auth` | Secondary |
| Form quan tâm | POST marketing (web chọn: API route / form service) — **không** payment | States trong [states.md](./states.md) |
| Privacy / Support | cùng host marketing | P0 cùng wave sales |

**Flag coordinator:** nếu architect chưa chốt exact demo URL path → web dùng `https://app.vemoki.com/` + query `?demo=1` tạm; PD không block.

---

## Messaging boundaries (nhắc ngắn)

**Được:** invite/mã · QR · Gate · multi-tenant · agency membership · white-label · web + iOS · demo giả lập có nhãn.

**Cấm trên page:** bán vé/thanh toán/refund · seat · Wallet · Android app · marketplace · “real-time tuyệt đối” · logo/case study từ demo seed như khách thật · số liệu bịa.

Chi tiết copy: [copy-vi-en.md](./copy-vi-en.md).

---

## UI acceptance (quan sát được)

| ID | Given / When / Then |
| -- | ------------------- |
| AC-1 | Given `/` VI, When load, Then first viewport hiện brand vemoki hero-level + 1 headline + 1 support + CTA Xem demo **và** Đăng ký quan tâm |
| AC-2 | When click Xem demo, Then điều hướng `app.vemoki.com` và gần CTA/section demo có nhãn giả lập (VI/EN) |
| AC-3 | When submit form quan tâm hợp lệ, Then trạng thái success (không claim “đã onboard khách”) |
| AC-4 | When `/en`, Then mọi string marketing EN (không sót VI cứng) |
| AC-5 | When `/privacy` và `/support` (và `/en/…`), Then HTTP 200 + nội dung tối thiểu (không 404) |
| AC-6 | Page **không** chứa pricing table / Android / Wallet / seat / logo khách từ demo như social proof |
| AC-7 | Brand test: bỏ nav vẫn nhận Vemoki (mark/wordmark/signal) trong first viewport |

### Map UAT headless (web)

```bash
# Sau khi web ship marketing routes (không chạy từ PD artifact):
scripts/web-uat.sh screenshot https://vemoki.com/ apps/web/.uat-artifacts/o13-sales-vi.png
scripts/web-uat.sh screenshot https://vemoki.com/en apps/web/.uat-artifacts/o13-sales-en.png
# Form: Playwright flow empty/error/success — ownership web
# curl privacy/support → 200
```

Prototype tĩnh: mở `prototype/index.html` (file://) để review composition — **không** thay UAT prod.

---

## Implementation order (MVP good enough)

1. Shell marketing: tokens CSS vars, locale switch, footer Privacy/Support links
2. Hero brand-first + CTA cả hai + secondary login
3. Sections 1–5 (static content từ copy file)
4. Form quan tâm + states
5. Privacy + Support pages tối thiểu (VI+EN)
6. Demo badge + outbound links `app.`
7. Headless UAT + PR

**Good enough:** static sections + working form + privacy/support 200. Chưa CMS, chưa pricing, chưa logo wall khách thật.

---

## Prototype

| File | Nội dung |
| ---- | -------- |
| [prototype/index.html](./prototype/index.html) | Sales VI + form states + locale link |
| [prototype/en.html](./prototype/en.html) | Sales EN |
| [prototype/privacy.html](./prototype/privacy.html) | Privacy stub VI |
| [prototype/support.html](./prototype/support.html) | Support stub VI |
| [prototype/css/o13.css](./prototype/css/o13.css) | Tokens + layout |

Nhãn prototype: `demo:sales-pd` — không phải runtime; không claim a11y đạt chuẩn cho đến khi web ship + audit.

---

## Liên kết

- Tokens: `ink #22241f` · `paper #f7f6f1` · `signal #9b3a18` · `focus #235fd0`
- Font gợi ý (khớp web hiện tại): display **Syne** · body **Be Vietnam Pro** — không Inter/Roboto/tím gradient mặc định
- Brand assets: `brand/vemoki/mark.svg`, `lockup.png`, `og.png`
