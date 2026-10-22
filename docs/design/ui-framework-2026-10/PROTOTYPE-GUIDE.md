# PROTOTYPE-GUIDE.md (D-2)

Từ Issue #789 / quyết định user 2026-10-22: PD **không** giao HTML/CSS BEM tĩnh để FE port nguyên văn (`marketing-uplift.css` — audit W-04).

---

## Định dạng bàn giao

| Ưu tiên | Định dạng | Khi dùng |
| --- | --- | --- |
| 1 | **JSX + Tailwind** trong app hoặc story dev | Slice đã adopt Tailwind / shadcn |
| 2 | **HTML + Tailwind CDN** + class token | Spec PD thuần (như `header-mobile-sheet.html`) — class phải map 1:1 token |
| 3 | Figma / screenshot + bảng token + tên component | Khi không cần tương tác |

**Cấm:** file `.css` riêng với BEM `.mkt-*` / `.btn-*` mới cho handoff.

---

## Đặt file

```text
docs/design/<slug>/
  README.md              # index handoff
  TOKENS.md | *.md       # spec
  prototype/
    <feature>.html       # mở file:// hoặc static server
    capture-screenshots.mjs
docs/reviews/assets/PR<n>-<slug>/
  *.png                  # evidence viewport × locale × state
```

Slug Epic #786: `ui-framework-2026-10`. Evidence gắn PR docs (`PR<n>-pd-ui-framework`).

---

## Đặt tên

| Loại | Quy ước | Ví dụ |
| --- | --- | --- |
| Prototype HTML | `<surface>-<feature>.html` | `header-mobile-sheet.html` |
| Ảnh | `<surface>-<viewport>-<locale>-<state>.png` | `mkt-390-vi-closed.png` |
| Token trong class | Tailwind theme: `bg-ink`, `rounded-sm`, `p-4` | Khớp [TOKENS.md](./TOKENS.md) |
| Component | Ghi rõ `@ticket/ui` / shadcn | `Button`, `Sheet`, `SheetContent` |

---

## Class / token trong prototype

- Màu: `text-ink`, `bg-paper`, `bg-signal`, `border-line`, `text-muted-foreground` (map `muted`).
- Radius: `rounded-sm|md|lg|xl` theo bảng 8/12/18/24.
- Space: `p-2|3|4|5`, `gap-2|3|4|5` (4px grid); header gap `gap-5` = 20px (`space.xl`).
- Typography: `font-display` (Sora), `font-sans` (Be Vietnam Pro).

Prototype CDN: khai báo `@theme` / CSS variables đồng bộ JSON đề xuất trong TOKENS.md.

---

## Checklist trạng thái (mỗi component tương tác)

| State | Mô tả |
| --- | --- |
| default | Đóng menu, focus không trong sheet |
| open | Sheet mở, overlay, scroll body khóa |
| focus | Tab vào trigger → vào sheet; ring `focus-visible:ring-2 ring-focus` |
| hover | CTA / link (pointer) |
| reduced-motion | Không slide dài; fade ngắn hoặc none |

Copy **VI + EN** cho control user-facing. Viewport tối thiểu: **390, 360, 320** cho mobile chrome.

---

## Checklist trước `Chờ duyệt`

- [ ] Mở prototype trong browser (file hoặc `npx serve`).
- [ ] Ảnh evidence khớp nhãn (kích thước, locale, open/closed).
- [ ] Spec markdown link prototype + liệt kê `data-testid` / component shadcn.
- [ ] Không hex/px lạ ngoài bảng token (trừ `1px` border).
- [ ] `prefers-reduced-motion` đã ghi trong spec.

---

## Tham chiếu mẫu chuẩn

- Live Pulse v2: `docs/design/visual-identity-v2/`
- Marketing uplift (legacy BEM — **không nhân bản**): `docs/design/ui-uplift-2026-10/`
- Evidence marketing nav: `docs/reviews/assets/PR779-marketing-uplift/`
