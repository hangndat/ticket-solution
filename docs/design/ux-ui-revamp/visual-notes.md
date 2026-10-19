# UX-UI Revamp — Visual notes · a11y · freeze

Epic [#471](https://github.com/hangndat/ticket-solution/issues/471) · Issue [#472](https://github.com/hangndat/ticket-solution/issues/472)  
Flow / states / AC / triển khai: [`README.md`](./README.md)

> **Lịch sử Phase 1.** Tokens/type dưới đây phản ánh freeze Epic #471 (Syne / palette v1). **Coding sau Visual Identity v2 + Phase 2** dùng Live Pulse tại [`../visual-identity-v2/`](../visual-identity-v2/) và [`phase-2/visual-notes.md`](./phase-2/visual-notes.md) — không invent token mới ngoài các freeze đó.

---

## 0. Brand / visual budget

Nguồn chốt lúc Phase 1: [`brand/vemoki/tokens.json`](../../../brand/vemoki/tokens.json) *(đã supersede bởi Live Pulse v2 — xem note trên)*  
Wordmark: `vemoki` + signal `↗` · Assets: `mark.svg`, `lockup.png`, `og.png`, `app-icon.png`

### Tokens

| Token | Value | Dùng |
| ----- | ----- | ---- |
| `--ink` | `#22241f` | Text chính, wordmark, border mạnh |
| `--paper` | `#f7f6f1` | Nền page / screen |
| `--signal` | `#9b3a18` | CTA primary fill / accent punch |
| `--focus` | `#235fd0` | Focus ring, link nhấn (không thay signal CTA) |

Derived (đã có trên web — reuse, không invent tên mới bắt buộc): `--paper-deep`, `--ink-muted`, `--ink-faint`, spacing `--space-1…8`, `--radius-sm: 2px`.

iOS: map cùng bốn màu ink/paper/signal/focus vào theme RN hiện có; icon/splash theo `brand/vemoki/surfaces` trong tokens.

### Typography

| Role | Font | Cấm |
| ---- | ---- | --- |
| Display / wordmark / H1 | **Syne** (`--font-display`) | Inter, Roboto, Arial, system-only hero |
| Body / form / list | **Be Vietnam Pro** (`--font-body`) | Default stack làm hero |
| Mono (nếu cần mã) | Chỉ secondary, nhỏ | Mono làm display |

### Surfaces / atmosphere

- Nền: gradient nhẹ paper → paper-deep + radial signal rất nhạt (khớp `apps/web` globals) — **không** flat-only một màu.
- Hero Home: **một** composition — brand hero-level + một headline + một support + một nhóm CTA + một visual plane (ảnh sản phẩm/sự kiện hoặc atmosphere), full-bleed khi là landing.
- List vé / form đổi mã: typography + divider mỏng; card chỉ khi cần hit-target tương tác (form controls, ticket row tappable).

### Anti-patterns (cấm đợt này)

1. Purple-on-white / indigo glow AI-default  
2. Cream + terracotta + serif broadsheet lệch token (dùng đúng ink/paper/signal đã chốt)  
3. Card cluster / dashboard trong first viewport Home  
4. Overlay badge / sticker nổi trên hero media (nhãn demo cạnh CTA text, không dán lên ảnh)  
5. Invent font/palette ngoài bảng trên  
6. Lộ Nest / BFF / UUID thô trên chrome khách (UUID chỉ secondary/selectable)

### Motion (2–3 intentional)

1. **Home / shell:** fade-in nhẹ visual plane hoặc wordmark (opacity)  
2. **Đổi mã success:** fade-in thẻ vé / chuyển ví mượt ngắn  
3. **CTA:** hover/press ink↔signal shift ngắn (web); opacity press (iOS)

Tất cả tôn trọng `prefers-reduced-motion: reduce` (web) / Reduce Motion (iOS) → tắt transform/animation kéo dài; giữ cut opacity hoặc trạng thái tĩnh.

### Priority screens (đúng 4)

| # | Screen | Web | iOS |
| - | ------ | --- | --- |
| 1 | **Home công khai** | `/` catalog + brand (+ CTA đăng nhập / notice auth) | Events shell tương ứng |
| 2 | **Đổi mã** | `/redeem` | `redeem` screen |
| 3 | **Ví / danh sách vé** | list tickets (phụ) + signed-out CTA | `my-tickets` **primary** |
| 4 | **Chi tiết vé + QR** | `/t/…/tickets/[id]` | `ticket-detail` |

**Gộp shell phiên (user chốt 19/10/2026):** không còn màn/product surface riêng `/auth`. Phiên = CTA trên Home / Đổi mã / Ví → `/api/auth/login?return=…` (web) hoặc OIDC sheet (iOS); quản lý phiên / đăng xuất trên `/account` (web) hoặc account trong shell iOS. Route `/auth` chỉ được giữ như **redirect mỏng** (OIDC error/logout landing → Home hoặc `return`) — không redesign, không nằm priority screens.

Không redesign trong đợt PD này: Admin, Gate/Scanner, Portal, marketing O13, invite/platform staff, trang auth riêng.

### Freeze

**Implementer không invent visual ngoài khối mục 0 này (tokens, type, surfaces, anti-patterns, motion, 4 priority screens). Không dựng lại UI `/auth` làm màn khách. Thiếu token hoặc cần màn/IA/route mới ngoài quyết định gộp phiên → escalate coordinator (Architect); không tự ADR / không spawn graphic riêng.**

---

## 3. Accessibility (WCAG 2.2 AA)

| Hạng mục | Yêu cầu PD |
| -------- | ---------- |
| Contrast | ink trên paper; signal fill → chữ paper/white đủ AA; điều chỉnh shade nếu fail khi code |
| Focus (web) | `:focus-visible` ring ≥2–3px `focus` + offset; mọi CTA/link/input |
| Focus (iOS) | VoiceOver order: brand → primary CTA → list → secondary |
| Keyboard | Tab: skip → nav → nội dung → form → footer; không trap |
| Hit target | CTA / hàng vé ≥ 44×44 CSS px / pt |
| Labels | Mọi input có label visible; lỗi `aria-describedby` / `accessibilityHint` |
| Live regions | Lỗi/success redeem & auth (trên màn gốc): `role="alert"` hoặc `aria-live`; iOS announce tương đương |
| QR | Không chỉ hình — accessible name «Mã QR vé [sự kiện]»; demo có text status |
| Reduced motion | Bắt buộc nếu ship motion mục 0 |
| Lang | `<html lang="vi">` (web attendee mặc định đợt này); iOS copy VI |

Prototype / handoff **không** = a11y production pass.

---

## Composition sketch (Home)

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

**Đăng nhập** (nav + hero CTA) → `/api/auth/login?return=/` — không land UI `/auth`.

Mobile: stack CTA full-width; visual dưới copy — vẫn một composition, không side-panel card.

---

## DoD visual (PD)

- [x] Tokens + path nguồn  
- [x] Typography + font cấm  
- [x] Surfaces + anti-patterns  
- [x] Motion 2–3 + reduced-motion  
- [x] Priority screens = 4 + gộp `/auth` + câu freeze 
- [x] A11y checklist mục tiêu AA  
