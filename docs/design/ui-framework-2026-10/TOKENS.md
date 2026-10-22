# TOKENS.md — bảng token duy nhất (D-3)

**Phạm vi:** web (`apps/web`, `packages/ui`) + mobile (`apps/mobile/src/theme`).  
**Quyết định:** user 2026-10-22 — một nguồn `brand/vemoki/tokens.json`, radius theo marketing uplift (mới hơn legacy), spacing lưới 4, breakpoint Tailwind mặc định.  
**Không đổi** ink / paper / signal / focus / typography đã chốt Live Pulse v2.

---

## Radius

| Token | Giá trị | Tailwind (sau D-1 bỏ prefix) | Nguồn / lý do |
| --- | --- | --- | --- |
| `radius.sm` | **8px** | `rounded-sm` → map `@theme --radius-sm: 8px` | `marketing-uplift.css:26` — **chốt** thay legacy `2px` (`live-pulse-legacy.css:20`) khi migrate |
| `radius.md` | **12px** | `rounded-md` | `marketing-uplift.css:27` (legacy `8px`) |
| `radius.lg` | **18px** | `rounded-lg` | `marketing-uplift.css:28` (legacy `14px`) |
| `radius.xl` | **24px** | `rounded-xl` | `marketing-uplift.css:29` — hero frame, bento |

**Ghi chú:** Giá trị lẻ mobile `18` / `22` dùng cho **radius** → `radius.lg` (18). Không thêm token radius 22px.

---

## Shadow

| Token | Giá trị | Dùng khi | Nguồn |
| --- | --- | --- | --- |
| `shadow.soft` | `0 24px 64px rgba(11, 18, 32, 0.12)` | Card nổi, dropdown nhẹ | `marketing-uplift.css:30` (`--shadow-soft`) |
| `shadow.frame` | `0 32px 80px rgba(11, 18, 32, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.06) inset` | Hero device frame, modal marketing | `marketing-uplift.css:31` (`--shadow-frame`) |
| `shadow.none` | none | Flat surfaces, sheet panel | — |

Mobile `elevation` (WP-5): map `soft` → elevation 2, `frame` → elevation 4 (iOS shadow tuple trong theme TS).

---

## Space (lưới 4)

| Token | px | Legacy `--space-n` | Tailwind | Ghi chú |
| --- | --- | --- | --- | --- |
| `space.xxs` | **2** | — (mới) | `0.5` / `p-0.5` | Viền inset, divider mảnh |
| `space.xs` | **4** | `--space-1` | `1` | |
| `space.sm` | **8** | `--space-2` | `2` | |
| `space.md` | **12** | `--space-3` | `3` | |
| `space.lg` | **16** | `--space-4` | `4` | |
| `space.xl` | **20** | — (mới; lấp khoảng giữa 16–24) | `5` | Hàng header chrome, gap CTA–locale |
| `space.2xl` | **24** | `--space-5` | `6` | |
| `space.3xl` | **32** | `--space-6` | `8` | |
| `space.4xl` | **48** | `--space-7` | `12` | |
| `space.5xl` | **72** | `--space-8` | `18` | Section rhythm (giữ legacy) |

**Marketing-only (không đưa vào JSON gốc):** `--space-section: clamp(4rem, 8vw, 6.5rem)` — section padding marketing; FE giữ biến CSS hoặc `py-section` trong `@theme` khi uplift.

---

## Breakpoints

| Token | px | Tailwind | Chính sách |
| --- | --- | --- | --- |
| `bp.sm` | 640 | `sm:` | Mặc định — **chốt** cho UI mới |
| `bp.md` | 768 | `md:` | |
| `bp.lg` | 1024 | `lg:` | |
| `bp.xl` | 1280 | `xl:` | |

**900 / 960 trong `marketing-uplift.css`:** chỉ phục vụ bento/grid marketing desktop (≥900) và nav desktop (≥960). **Không** thêm `@media` px tay (audit W-06). Khi migrate marketing sang Tailwind:

- Layout ≥900 → `lg:` (1024) **hoặc** khai báo một lần trong `@theme`: `--breakpoint-mkt: 56.25rem` (900px) **chỉ** cho slice marketing, có comment PD + screenshot diff.
- Nav ≥960 → `xl:` (1280) nếu chấp nhận breakpoint cao hơn 24px; **khuyến nghị PD:** gộp về `lg:` + flex wrap để tránh breakpoint thứ 5 trừ khi harness chứng minh vỡ layout.

Header mobile spec (#789): chỉ dùng `max-sm` / viewport 320–390 — không phụ thuộc 900/960.

---

## Màu semantic (bổ sung)

| Token | Hex | Web hiện tại | Mobile | Quyết định |
| --- | --- | --- | --- | --- |
| `colors.line` | **#D7DFE9** | `vemoki-theme.css`, `marketing-uplift.css:20` | `brand.inkFaint` / separator mix | **Chốt** — thay `#dde3eb` legacy (`live-pulse-legacy.css:23`) và duplicate dòng 1931 marketing |
| `colors.muted` | **#5B687B** | `--muted`, `--ink-muted` legacy | `brand.inkMuted` / `colors.secondary` | Giữ — copy phụ |
| `colors.destructive` | **#8A1F1F** | `vemoki-theme.css`, `.state-error` | `deny` dùng `signal` cho scan; destructive cho form/error | Token form + alert; không đổi signal |
| `colors.admit` | **#1B7F4A** | success redeem dùng focus-mix (legacy) | `colors.admit` | **Chốt** cho outcome “được vào / thành công gate” — web align mobile khi migrate |
| `colors.unknown` | **#8A6D3B** | `.state-unknown` gray `#4a4a4a` (legacy) | `colors.unknown` | **Chốt** amber cho outcome nghiệp vụ; block UI generic `state-unknown` migrate sang token này + nền `color-mix(unknown 12%, paper)` |

---

## Typography & brand (tham chiếu, không đổi)

| Token | Giá trị | Nguồn |
| --- | --- | --- |
| `colors.ink` | `#0B1220` | `brand/vemoki/tokens.json` |
| `colors.paper` | `#F4F6F8` | idem |
| `colors.signal` | `#E11D48` | idem |
| `colors.focus` | `#2563EB` | idem |
| `typography.display` | Sora | idem |
| `typography.body` | Be Vietnam Pro | idem |

---

## Đề xuất mở rộng `brand/vemoki/tokens.json` (#795 áp dụng)

Khối dưới **không commit** trong #789 — chỉ handoff:

```json
{
  "radius": {
    "sm": "8px",
    "md": "12px",
    "lg": "18px",
    "xl": "24px"
  },
  "shadow": {
    "soft": "0 24px 64px rgba(11, 18, 32, 0.12)",
    "frame": "0 32px 80px rgba(11, 18, 32, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.06) inset"
  },
  "space": {
    "xxs": 2,
    "xs": 4,
    "sm": 8,
    "md": 12,
    "lg": 16,
    "xl": 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 48,
    "5xl": 72
  },
  "breakpoints": {
    "sm": 640,
    "md": 768,
    "lg": 1024,
    "xl": 1280
  },
  "colors": {
    "ink": "#0B1220",
    "paper": "#F4F6F8",
    "signal": "#E11D48",
    "focus": "#2563EB",
    "line": "#D7DFE9",
    "muted": "#5B687B",
    "destructive": "#8A1F1F",
    "admit": "#1B7F4A",
    "unknown": "#8A6D3B"
  }
}
```

Sinh CSS: mở rộng pipeline `vemoki-theme.css` + `apps/mobile/src/theme/tokens.ts` đọc cùng shape.

### Contract tên biến (web, `prefix(ui)`)

| Lớp | Tên trên `:root` | Ai dùng |
| --- | --- | --- |
| Tailwind `@theme` (có thể bị đổi thành `--ui-*` khi `prefix(ui)`) | `--color-*`, `--spacing-*`, `--radius-*`, … | Utility `ui:*`, primitives `@ticket/ui` |
| **Legacy contract** (khối `:root` sinh cùng file, không prefix) | Cùng tên `--color-*`, `--spacing-*`, … | `live-pulse-legacy.css`, `marketing-uplift.css` (`var(--color-line)`, `var(--spacing-lg)`, …) |
| Legacy alias ngắn | `--ink`, `--line`, `--space-4`, … | Rule CSS legacy trong `apps/web/app/*.css` (định nghĩa cục bộ, tham chiếu contract) |

Khi D-1 bỏ `prefix(ui)`, khối legacy contract vẫn hợp lệ (trùng giá trị với `@theme`); không sửa lại file legacy chỉ vì đổi prefix.

---

## Audit W-05 — tóm tắt xử lý

| Lệch | Xử lý |
| --- | --- |
| `--radius-sm` 2px vs 8px | Chốt **8px** (marketing) |
| `--line` #dde3eb vs #d7dfe9 | Chốt **#D7DFE9** |
| Spacing chỉ legacy | Bảng `space.*` trên + JSON |
| Shadow chỉ marketing | Đưa vào brand JSON |
| Breakpoint 900/960 | Giảm dần khi migrate; UI mới chỉ sm–xl |
