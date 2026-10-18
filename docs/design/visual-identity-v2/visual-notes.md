# Visual Identity v2 — Live Pulse · visual notes · freeze

Epic [#486](https://github.com/hangndat/ticket-solution/issues/486) · Issue [#487](https://github.com/hangndat/ticket-solution/issues/487)  
Flow / states / AC / triển khai: [`README.md`](./README.md)

---

## 0. Brand / visual budget

**Art direction:** Live Pulse — ink sâu gần-đen xanh, paper cool sáng, signal hồng-đỏ “nhịp”, focus xanh tin cậy.  
**Nguồn chốt:** [`brand/vemoki/tokens.json`](../../../brand/vemoki/tokens.json) (`version: "2"`, `artDirection: "Live Pulse"`)  
Wordmark: `vemoki` + signal `↗` · Glyph: `mark.svg` (punch = signal)

### Tokens

| Token | Value | Dùng |
| ----- | ----- | ---- |
| `--ink` | `#0B1220` | Text chính, wordmark, border mạnh |
| `--paper` | `#F4F6F8` | Nền page / screen |
| `--signal` | `#E11D48` | CTA primary fill / accent punch / mark dot |
| `--focus` | `#2563EB` | Focus ring, link nhấn (không thay signal CTA) |

**Supersedes v1:** `#22241f` / `#f7f6f1` / `#9b3a18` / `#235fd0` — không dùng lại trên surface mới sau merge freeze.

Derived (reuse tên hiện có trên web nếu đã có): `--paper-deep`, `--ink-muted`, `--ink-faint`, spacing `--space-1…8`, `--radius-sm` — derive từ ink/paper mới, **không** invent tên token thứ 5 bắt buộc.

iOS: map bốn hex vào theme RN; splash/icon theo `surfaces` trong tokens (regenerate raster ngoài PR docs nếu lệch màu).

### Typography

| Role | Font | Cấm |
| ---- | ---- | --- |
| Display / wordmark / H1 | **Sora** | Inter, Roboto, Arial, system-only hero, **Syne** (display v1 — thay khi đụng surface) |
| Body / form / list | **Be Vietnam Pro** | Default stack làm hero |
| Mono (mã phụ) | Secondary nhỏ | Mono làm display |

### Surfaces / atmosphere

- Nền: gradient nhẹ paper → paper-deep + radial **signal** rất nhạt — không flat-only một màu.
- Marketing / Home hero: **một** composition — brand hero-level + một headline + một support + một nhóm CTA + một visual plane full-bleed khi landing.
- Đổi mã / Ví / chi tiết: typography + divider mỏng; card chỉ khi hit-target tương tác (form, ticket row).

### Anti-patterns (cấm)

1. Purple-on-white / indigo glow AI-default  
2. Cream + terracotta v1 (`#9b3a18` / paper ấm `#f7f6f1`) trên surface mới  
3. Card cluster / dashboard trong first viewport hero/Home  
4. Overlay badge / sticker trên hero media  
5. Invent font/palette ngoài bảng trên (kể cả giữ Syne làm display)  
6. Lộ Nest / BFF / UUID thô trên chrome khách  

### Motion (2–3 intentional)

1. **Hero / Home:** fade-in nhẹ visual plane hoặc wordmark (opacity)  
2. **Đổi mã success:** fade-in thẻ vé / chuyển ví ngắn  
3. **CTA:** hover/press ink↔signal ngắn (web); opacity press (iOS)

`prefers-reduced-motion: reduce` / Reduce Motion → tắt transform kéo dài; giữ cut opacity hoặc tĩnh.

### Priority screens (đúng 5)

| # | Screen | Web | iOS |
| - | ------ | --- | --- |
| 1 | **Marketing hero** | O13 sales (`vemoki.com`) first viewport | — |
| 2 | **Home công khai** | `/` | Events shell |
| 3 | **Đổi mã** | `/redeem` | `redeem` |
| 4 | **Ví / danh sách vé** | list phụ | `my-tickets` **primary** |
| 5 | **Chi tiết vé + QR** | `/t/…/tickets/[id]` | `ticket-detail` |

Không redesign trong freeze này: Admin, Gate/Scanner, Portal, màn `/auth` product (chỉ redirect mỏng).

### Freeze

**Implementer không invent visual ngoài khối mục 0 này (tokens Live Pulse, type Sora / Be Vietnam Pro, surfaces, anti-patterns, motion, 5 priority screens). Thiếu token hoặc cần màu/font/màn mới → escalate coordinator; không tự ADR / không spawn graphic riêng.**

---

## Composition sketch (Home — Live Pulse)

```text
┌─────────────────────────────────────────────┐
│ skip · [vemoki↗]     Đổi mã · Đăng nhập     │
├─────────────────────────────────────────────┤
│  vemoki↗          ← brand hero-level        │
│  HEADLINE (1)                               │
│  support one-liner                          │
│  [Đổi mã lấy vé]  [Đăng nhập]               │
│                                             │
│  ████ atmosphere / event visual ████        │
├─────────────────────────────────────────────┤
│ Danh sách sự kiện (typography + divider)    │
└─────────────────────────────────────────────┘
```

Paper `#F4F6F8` · ink `#0B1220` · CTA signal `#E11D48` · focus ring `#2563EB`.

---

## DoD visual (PD)

- [x] Tokens Live Pulse + path nguồn `brand/vemoki/tokens.json`  
- [x] Display Sora · body Be Vietnam Pro · cấm liệt kê  
- [x] Surfaces + anti-patterns + motion + reduced-motion  
- [x] 5 priority screens web∥iOS map  
- [x] Câu freeze chốt implementer  
- [x] mark.svg punch = `#E11D48`
