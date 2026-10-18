# O13 — Visual notes · a11y · implementation

---

## 1. Brand & tokens

Nguồn: [`brand/vemoki/tokens.json`](../../../brand/vemoki/tokens.json)

| Token | Value | Dùng |
| ----- | ----- | ---- |
| `--ink` | `#22241f` | Text chính, wordmark |
| `--paper` | `#f7f6f1` | Nền page (có texture/gradient nhẹ — không flat-only nếu có thể) |
| `--signal` | `#9b3a18` | CTA primary fill / accent punch |
| `--focus` | `#235fd0` | Focus ring, links nhấn |

Assets: `mark.svg`, `lockup.png`, `og.png`. Signal chữ `↗` khớp wordmark.

### Typography (khớp `apps/web` hiện có)

| Role | Font | Tránh |
| ---- | ---- | ----- |
| Display / wordmark / H1 | **Syne** (`--font-display`) | Inter, Roboto, Arial, system-only hero |
| Body | **Be Vietnam Pro** (`--font-body`) | Default stack làm hero |

### Anti-patterns (user frontend design rules)

- Không purple-on-white / indigo glow AI-default
- Không cream+terracotta+serif broadsheet clone lệch token (dùng đúng ink/paper/signal đã chốt)
- Không card cluster / dashboard trong first viewport
- Không overlay badge nổi trên hero media (demo badge cạnh CTA text, không sticker trên ảnh)
- Hero: brand + 1 headline + 1 support + CTA group + 1 visual plane — hết

### Motion (2–3 intentional)

1. Hero visual: fade/slow ken-burns rất nhẹ (opacity/scale)
2. CTA hover: ink/signal shift ngắn
3. Form success: fade-in message

Tất cả tôn trọng `prefers-reduced-motion: reduce` → tắt transform/animation, giữ opacity cut.

---

## 2. Layout composition

```text
┌─────────────────────────────────────────────┐
│ skip link                                   │
│ [vemoki↗]     VI|EN   Demo · Quan tâm · Login│
├─────────────────────────────────────────────┤
│                                             │
│  vemoki↗          ← brand hero-level        │
│  HEADLINE                                   │
│  support one-liner                          │
│  [Xem demo] [Đăng ký quan tâm]  Đăng nhập   │
│  Demo giả lập                               │
│                                             │
│  ████ full-bleed product atmosphere ████    │
│                                             │
├─────────────────────────────────────────────┤
│ Ai dùng → Luồng → White-label → An toàn     │
│ → Demo giả lập → Form #interest → CTA lặp   │
│ Footer: Privacy · Support · attendee link   │
└─────────────────────────────────────────────┘
```

**Below fold lists:** dùng hàng typography + divider mỏng hoặc numbered steps — **không** ép thành card grid marketing trừ khi cần hit-target form controls.

**Breakpoint:** mobile stack CTA full-width; desktop CTA ngang; visual có thể dưới copy trên mobile (vẫn một composition, không side-panel card).

---

## 3. Accessibility (WCAG 2.2 AA mục tiêu)

| Hạng mục | Yêu cầu PD |
| -------- | ---------- |
| Contrast | ink trên paper; signal button text ≥ AA (nếu signal fill: dùng chữ paper/white kiểm contrast; điều chỉnh shade nếu fail) |
| Focus | `:focus-visible` ring 2px `focus` + offset; mọi CTA/link/form |
| Keyboard | Tab order: skip → locale → nav → hero CTAs → sections → form → footer |
| Hit target | CTA / checkbox ≥ 44×44 CSS px |
| Labels | Mọi input có `<label>` visible; lỗi gắn `aria-describedby` / `aria-invalid` |
| Live regions | Form error/success: `role="alert"` hoặc `aria-live="polite"` |
| Locale switch | `aria-label` Language; current `aria-current="page"` hoặc `true` |
| Demo badge | Không chỉ màu — có text; `role="status"` ở demo banner |
| Reduced motion | CSS media query bắt buộc nếu có motion |
| Lang | `<html lang="vi">` / `lang="en"` theo route |

### Manual vs automated

| Automated | Manual |
| --------- | ------ |
| axe/lighthouse contrast, labels, lang | Brand-first first viewport judgment |
| Tab order smoke | Screen reader form error announce |
| | Keyboard only submit + retry |
| | Mobile hit targets |

Prototype HTML **không** chứng minh a11y production.

---

## 4. Implementation handoff (web)

| Hạng mục | Chỉ dẫn |
| -------- | ------- |
| Ownership | `apps/web` only — marketing routes / host-aware. Không `apps/mobile` cho sales. |
| Host | `vemoki.com` = sales+privacy+support; outbound `app.vemoki.com`. DNS/OIDC = architect. |
| i18n | Dictionary từ [copy-vi-en.md](./copy-vi-en.md); path `/en`. |
| Form backend | Web chọn route handler hoặc service; PD không khóa vendor. Rate-limit + honeypot khuyến nghị. |
| Demo URL | Default `https://app.vemoki.com/`; query `?demo=1` tạm nếu cần. Nhãn luôn từ `badge.demo`. |
| OG/SEO | `brand/vemoki/og.png` + meta title/description theo locale. |
| Privacy/Support | Stub copy đủ ship 200; pháp lý mở rộng sau OK. |
| Contract flags | (1) Exact demo path (2) Support mailbox thật (3) Form POST schema — escalate coordinator nếu thiếu trước merge. |

### Thứ tự implement

Xem [README.md](./README.md) § Implementation order.

### Good enough MVP

- Hero + 6 sections + form states + privacy/support VI+EN + demo labels
- Chưa: CMS, pricing, logo wall, blog, chatbot

---

## 5. Prototype mapping

| Spec | Prototype |
| ---- | --------- |
| Hero brand-first | `prototype/index.html` `#hero` |
| Form states | Review chips / buttons trong `#interest` (PD only) |
| EN | `prototype/en.html` |
| Privacy/Support | `prototype/privacy.html`, `support.html` |
| Tokens/CSS | `prototype/css/o13.css` |

---

## 6. DoD a11y + visual (PD)

- [x] Contrast tokens documented
- [x] Focus/keyboard/labels/live regions/reduced-motion listed
- [x] Hero composition rules + anti-patterns
- [x] Fonts + motion budget
- [x] Web ownership + MVP cut line
