# UX-UI Phase 2 — Visual notes · a11y · freeze

Epic [#527](https://github.com/hangndat/ticket-solution/issues/527) · Issue [#528](https://github.com/hangndat/ticket-solution/issues/528)  
Flow / states / AC / triển khai: [`README.md`](./README.md)

**Baseline Phase 1:** [`../README.md`](../README.md) · [`../visual-notes.md`](../visual-notes.md)  
**Token freeze hiện hành:** Live Pulse v2 — [`../../visual-identity-v2/`](../../visual-identity-v2/) · [`brand/vemoki/tokens.json`](../../../../brand/vemoki/tokens.json)

---

## 0. Brand / visual budget (Phase 2)

**Không invent palette/font mới.** Phase 2 mở rộng surface; visual system = Live Pulse đã chốt ở Visual Identity v2. Phase 1 `visual-notes` (Syne / terracotta v1) chỉ là lịch sử Epic #471 — **coding Phase 2 bám Live Pulse**, không quay về v1.

### Tokens

| Token | Value | Dùng |
| ----- | ----- | ---- |
| `--ink` | `#0B1220` | Text chính, wordmark, border mạnh |
| `--paper` | `#F4F6F8` | Nền page / screen |
| `--signal` | `#E11D48` | CTA primary fill / accent punch |
| `--focus` | `#2563EB` | Focus ring, link nhấn (không thay signal CTA) |

Derived reuse: `--paper-deep`, `--ink-muted`, `--ink-faint`, `--space-1…8`, `--radius-sm`.  
**Tenant `primaryColor` / logo / banner** trên chi tiết sự kiện = accent cục bộ trong chrome Live Pulse — không thay ink/paper/signal toàn app; không invent token thứ 5 bắt buộc.

iOS: map bốn hex vào theme RN; icon/splash theo `brand/vemoki/surfaces`.

### Typography

| Role | Font | Cấm |
| ---- | ---- | --- |
| Display / wordmark / H1 | **Sora** | Inter, Roboto, Arial, system-only hero, **Syne** (display v1) |
| Body / form / list | **Be Vietnam Pro** | Default stack làm hero |
| Mono (mã phụ) | Secondary nhỏ | Mono làm display |

### Surfaces / atmosphere

- Nền: gradient nhẹ paper → paper-deep + radial signal rất nhạt — **không** flat-only.
- **Chi tiết sự kiện:** một composition first viewport — org/wordmark nhỏ + tên sự kiện (H1) + một support (ngày/địa điểm ngắn) + một nhóm CTA + một visual plane (banner full-bleed hoặc edge-to-edge). Không card cluster / dashboard meta trong hero.
- **Account / Claim:** typography + divider; card chỉ khi hit-target form / panel tương tác.
- **Home polish (optional #4):** first viewport khớp composition Phase 1 + tokens Live Pulse (Sora, signal hồng-đỏ) — không redesign IA.

### Anti-patterns (giữ + bổ sung Phase 2)

1. Purple-on-white / indigo glow AI-default  
2. Cream + terracotta v1 (`#9b3a18` / paper ấm `#f7f6f1`) trên surface mới  
3. Card cluster / dashboard trong first viewport event detail hoặc Home  
4. Overlay badge / sticker nổi trên banner sự kiện (nhãn demo cạnh text, không dán lên media)  
5. Invent font/palette ngoài bảng trên (kể cả giữ Syne)  
6. Lộ Nest / BFF / UUID thô trên chrome khách; jargon API trên error guest  
7. Account «utility strip» tối thiểu — Phase 2 yêu cầu **full visual** (hierarchy, spacing, CTA signal) không chỉ form xám  
8. iOS event-detail «floating card» dày (radius lớn + shadow đa lớp) thay composition typography + media plane

### Motion (2–3 intentional — Phase 2)

1. **Event detail:** fade-in nhẹ banner / hero copy (opacity)  
2. **Claim success / quyết định:** fade-in outcome notice (issued / pending / denied)  
3. **Account CTA:** hover/press ink↔signal ngắn (web); opacity press (iOS)

`prefers-reduced-motion: reduce` / Reduce Motion → tắt transform kéo dài; giữ cut opacity hoặc tĩnh.

### Priority screens (đúng 4 — freeze)

| # | Screen | Web | iOS |
| - | ------ | --- | --- |
| 1 | **Chi tiết sự kiện công khai** | `/t/[tenantSlug]/events/[eventSlug]` | `event-detail` (published; fixture chỉ demo nhãn rõ) |
| 2 | **Tài khoản** | `/account` | `account` — **full visual** (phiên, đăng xuất, xóa TK, privacy; iOS + push status) |
| 3 | **Claim / nhận lời mời** | `/claim` | `claim` — deep-link / fragment intent còn trong sản phẩm |
| 4 | **Polish Phase 1 — Home first viewport** | `/` | Events shell tương ứng — chỉ Live Pulse + composition gap; không màn mới |

**OUT Phase 2:** portal, Gate/Scanner staff, Admin Event Manager, O13 marketing redesign, Android, payment, deploy, store, invent Role graphic, route/IA mới (escalate Architect nếu thật sự cần).

### Freeze

**Implementer không invent visual / màn / token ngoài khối mục 0 này (Live Pulse tokens, Sora / Be Vietnam Pro, surfaces, anti-patterns, motion, đúng 4 priority screens). Thiếu token hoặc cần route/IA mới ngoài surface đã có → escalate coordinator (Architect); không tự ADR / không spawn graphic riêng.**

---

## 3. Accessibility (WCAG 2.2 AA)

| Hạng mục | Yêu cầu PD Phase 2 |
| -------- | ------------------- |
| Contrast | ink/paper; signal fill → chữ paper/white đủ AA; tenant primary trên paper kiểm AA hoặc kèm ink text |
| Focus (web) | `:focus-visible` ring `focus` ≥2–3px + offset trên CTA/link/input/FAQ `<summary>` |
| Focus (iOS) | VoiceOver: brand/org → title → CTA → sections → FAQ/terms |
| Keyboard | Tab: skip → nav → hero CTA → details → FAQ → claim/account controls |
| Hit target | ≥44×44 CSS px / pt (CTA, FAQ summary, claim submit, account actions) |
| Labels | Form claim + account deletion: label visible; lỗi `aria-describedby` / hint |
| Live regions | Claim outcome + account session/deletion errors: `role="alert"` / `aria-live`; iOS announce tương đương |
| Media | Banner/logo alt text; không chỉ màu cho trạng thái claim |
| Reduced motion | Bắt buộc nếu ship motion mục 0 |
| Lang | `<html lang="vi">` (web attendee); iOS copy VI |

| Automated | Manual |
| --------- | ------ |
| axe / Playwright labels, contrast smoke | First viewport event composition + brand test |
| Tab order claim/account | VoiceOver claim outcome + account session |
| | iOS hit targets CTA account/claim |

Handoff PD **không** = a11y production pass — coding đo trên exact SHA.

---

## Composition sketch — Event detail (web ∥ iOS)

```text
┌─────────────────────────────────────────────┐
│ [vemoki↗] · org name          ← chrome mỏng │
├─────────────────────────────────────────────┤
│ ████ banner full-bleed / edge-to-edge ████  │
│  EVENT NAME (H1)                            │
│  ngày · địa điểm (1 support)                │
│  [Đổi mã lấy vé]  [Nhận lời mời]  [Chi tiết]│
├─────────────────────────────────────────────┤
│ Thông tin (dl) · sections · FAQ · terms     │
│ ← Tất cả sự kiện                            │
└─────────────────────────────────────────────┘
```

iOS: cùng hierarchy; **không** bọc cả khối trong card shadow dày — media plane + typography stack.

---

## Composition sketch — Account (full visual)

```text
┌─────────────────────────────────────────────┐
│ SiteNav / shell · [vemoki↗]                 │
├─────────────────────────────────────────────┤
│  Tài khoản (H1 Sora)                        │
│  support: phiên · privacy link              │
│  ┌─ Phiên ─────────────────────────────┐    │
│  │ status · email (secondary)           │    │
│  │ [Đăng nhập] / [Đăng xuất] [Đổi mã]  │    │
│  └──────────────────────────────────────┘    │
│  Yêu cầu xóa tài khoản (H2)                 │
│  panel deletion states (reuse pattern)      │
│  (iOS) Push status · Privacy CTA            │
└─────────────────────────────────────────────┘
```

---

## DoD visual (PD Phase 2)

- [x] Tokens Live Pulse + path nguồn (không invent)  
- [x] Typography Sora / Be Vietnam Pro + font cấm  
- [x] Surfaces + anti-patterns Phase 2  
- [x] Motion 2–3 + reduced-motion  
- [x] Priority screens = **4** + câu freeze  
- [x] A11y checklist mục tiêu AA  
