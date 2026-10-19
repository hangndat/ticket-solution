# UX-UI Phase 3 — Visual notes · a11y · freeze

Epic [#546](https://github.com/hangndat/ticket-solution/issues/546) · Issue [#547](https://github.com/hangndat/ticket-solution/issues/547)  
Flow / states / AC / triển khai: [`README.md`](./README.md)

**Baseline Phase 1–2:** [`../README.md`](../README.md) · [`../phase-2/`](../phase-2/)  
**Token freeze hiện hành:** Live Pulse v2 — [`../../visual-identity-v2/`](../../visual-identity-v2/) · [`brand/vemoki/tokens.json`](../../../../brand/vemoki/tokens.json)

---

## 0. Brand / visual budget (Phase 3)

**Không invent palette/font mới.** Phase 3 mở rộng surface còn lại; visual system = **Live Pulse** đã chốt. Coding bám bảng dưới — không quay Syne / terracotta v1.

### Tokens

| Token | Value | Dùng |
| ----- | ----- | ---- |
| `--ink` | `#0B1220` | Text chính, wordmark, border mạnh |
| `--paper` | `#F4F6F8` | Nền page / screen |
| `--signal` | `#E11D48` | CTA primary fill / accent punch |
| `--focus` | `#2563EB` | Focus ring, link nhấn (không thay signal CTA) |

Derived reuse: `--paper-deep`, `--ink-muted`, `--ink-faint`, `--space-1…8`, `--radius-sm`.  
**Không** invent token thứ 5 bắt buộc. Marketing host dùng cùng bốn hex — không palette O13 riêng.

iOS (staff thin): map bốn hex vào theme RN hiện có; không invent màu deny riêng ngoài ink/signal/paper.

### Typography

| Role | Font | Cấm |
| ---- | ---- | --- |
| Display / wordmark / H1 | **Sora** | Inter, Roboto, Arial, system-only hero, **Syne** |
| Body / form / list | **Be Vietnam Pro** | Default stack làm hero |
| Mono (mã phụ / token) | Secondary nhỏ | Mono làm display |

### Surfaces / atmosphere

- Nền: gradient nhẹ paper → paper-deep + radial signal rất nhạt — **không** flat-only.
- **Invite:** typography + divider; card chỉ quanh form controls / hit-target. First viewport: H1 + một support + login CTA + form — không dashboard.
- **Staff thin:** Notice deny / loading full-bleed paper; CTA signal «Về Sự kiện» — **không** preview scanner / QR canvas.
- **Marketing chrome:** một composition sales first viewport (brand hero-level + 1 headline + 1 support + CTA group + visual plane). Privacy/support: typography stack, không card cluster.
- **Redeem residual:** giữ composition Phase 1; chỉ siết token/font Live Pulse nếu còn sót v1.

### Anti-patterns (giữ + bổ sung Phase 3)

1. Purple-on-white / indigo glow AI-default  
2. Cream + terracotta v1 (`#9b3a18` / paper ấm `#f7f6f1`) trên surface Phase 3  
3. Card cluster / dashboard trong first viewport invite hoặc marketing sales  
4. Overlay badge / sticker trên hero marketing  
5. Invent font/palette ngoài bảng trên (kể cả giữ Syne)  
6. Lộ Nest / BFF / Keycloak / UUID thô trên chrome khách (invite + marketing)  
7. Redesign Gate scanner / staff scan outcome canvas trong Task Phase 3  
8. Redesign O13 sales IA/copy/structure — chỉ token + type + contrast  
9. Staff thin nhìn như «Gate lite» (camera, scan input, admit/deny canvas)

### Motion (2–3 intentional — Phase 3)

1. **Invite:** fade-in outcome notice (success / denied / network)  
2. **Staff thin deny:** fade-in Notice + assertive announce (không bounce)  
3. **Marketing / Redeem CTA:** hover/press ink↔signal ngắn (web); opacity press (iOS redeem)

`prefers-reduced-motion: reduce` / Reduce Motion → tắt transform kéo dài; giữ cut opacity hoặc tĩnh.

### Priority screens (đúng 4 — freeze)

| # | Screen | Web | iOS |
| - | ------ | --- | --- |
| 1 | **Nhận lời mời thành viên** | `/invite` (+ `InviteAcceptForm`) | **Không** màn native riêng — deep-link / mở web `/invite` (không invent route iOS) |
| 2 | **Staff thin soft-entry** | *Không* redesign `/gate` | `staff-access` — eligibility → redirect tab staff **hoặc** deny VI + «Về Sự kiện» |
| 3 | **Marketing sales chrome** | Host marketing `SalesPage` / `MarketingChrome` (token + type Live Pulse) | — |
| 4 | **Redeem residual polish** | `/redeem` — chỉ gap Live Pulse còn sót sau Phase 1–2 | `redeem` — cùng phạm vi residual |

**OUT Phase 3 (cấm trong coding Task):**

| OUT | Lý do |
| --- | ----- |
| `apps/portal` | Epic OUT |
| Gate scanner redesign (`/gate`, iOS `staff` scan) | Không attendee-facing soft-entry |
| O13 sales redesign (IA/copy/sections) | Token consistency only; handoff O13 giữ nguyên |
| Android | Epic OUT |
| Admin Event Manager / platform console | Ngoài 4 màn |
| `/claim` guest ticket invite | Đã Phase 2 — không gộp với membership `/invite` |
| Payment · deploy · store · invent Role graphic | Epic OUT |
| Route/IA mới | Escalate Architect |

### Freeze

**Implementer không invent visual / màn / token ngoài khối mục 0 này (Live Pulse tokens, Sora / Be Vietnam Pro, surfaces, anti-patterns, motion, đúng 4 priority screens). Không redesign portal / Gate scanner / O13 sales / Android. Thiếu token hoặc cần route/IA mới → escalate coordinator (Architect); không tự ADR / không spawn graphic riêng.**

---

## 3. Accessibility (WCAG 2.2 AA)

| Hạng mục | Yêu cầu PD Phase 3 |
| -------- | ------------------- |
| Contrast | ink/paper; signal fill → chữ paper/white đủ AA trên invite CTA, staff CTA, marketing CTA |
| Focus (web) | `:focus-visible` ring `focus` ≥2–3px trên invite login/submit/input + marketing nav/CTA |
| Focus (iOS) | VoiceOver staff-access: Notice title → body → CTA «Về Sự kiện» |
| Keyboard | Tab invite: skip → nav → login → token field → submit → result |
| Hit target | ≥44×44 CSS px / pt (invite submit, staff CTA, marketing CTA) |
| Labels | Invite token input label visible; lỗi `aria-describedby` / SurfaceState |
| Live regions | Invite outcome + staff deny: `role="alert"` / `aria-live` / `accessibilityLiveRegion` |
| Copy guest-safe | Không Keycloak/Nest/BFF trên chrome; UUID membership chỉ secondary nếu bắt buộc |
| Reduced motion | Bắt buộc nếu ship motion mục 0 |
| Lang | `<html lang="vi">` (invite + marketing VI); marketing EN giữ `lang` đúng locale |

| Automated | Manual |
| --------- | ------ |
| axe / Playwright labels, contrast smoke invite + marketing | First viewport marketing brand composition |
| Tab order `/invite` | VoiceOver staff-access deny |
| | iOS hit target CTA staff thin |

Handoff PD **không** = a11y production pass — coding đo trên exact SHA.

---

## Composition sketch — Invite (web)

```text
┌─────────────────────────────────────────────┐
│ SiteNav · [vemoki↗]                         │
├─────────────────────────────────────────────┤
│  Nhận lời mời thành viên (H1 Sora)          │
│  support: đúng email đã được mời            │
│  [Đăng nhập]  → /api/auth/login?return=/invite
│  ┌─ Mã lời mời ────────────────────────┐    │
│  │ input (từ #token / parked)           │    │
│  │ [Nhận lời mời]                       │    │
│  └──────────────────────────────────────┘    │
│  SurfaceState: empty / loading / result     │
│  ← Trang chủ                                │
└─────────────────────────────────────────────┘
```

Phân biệt: **`/invite` = membership tổ chức**; **`/claim` = vé mời khách** (Phase 2 — không trộn).

---

## Composition sketch — Staff thin (iOS)

```text
┌─────────────────────────────────────────────┐
│  (loading) Đang kiểm tra quyền nhân viên    │
│  — hoặc —                                   │
│  Notice DENY                                │
│  Không có quyền Nhân viên                   │
│  body VI fail-closed                        │
│  [Về Sự kiện]  ← signal CTA                 │
└─────────────────────────────────────────────┘
  eligible → Redirect /(tabs)/staff  (không skin scanner ở đây)
```

---

## Composition sketch — Marketing sales (token only)

```text
┌─────────────────────────────────────────────┐
│ MarketingChrome · locale switch             │
├─────────────────────────────────────────────┤
│  vemoki↗  (hero-level)                      │
│  HEADLINE (1) · support (1)                 │
│  [CTA product] [CTA login]                  │
│  ████ visual plane ████                     │
├─────────────────────────────────────────────┤
│ sections hiện có — KHÔNG đổi IA/copy đợt này│
└─────────────────────────────────────────────┘
```

Chỉ map ink/paper/signal/focus + Sora / Be Vietnam Pro. Structure/copy = O13 / marketing hiện hành.

---

## DoD visual (PD Phase 3)

- [x] Tokens Live Pulse + path nguồn (không invent)  
- [x] Typography Sora / Be Vietnam Pro + font cấm  
- [x] Surfaces + anti-patterns Phase 3  
- [x] Motion 2–3 + reduced-motion  
- [x] Priority screens = **4** + câu freeze  
- [x] A11y checklist mục tiêu AA  
