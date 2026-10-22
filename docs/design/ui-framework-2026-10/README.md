# UI framework handoff — Epic #786 / Issue #789

**Visual budget:** Có — chốt token chung web + mobile và spec header/menu mobile (shadcn `Sheet`).  
**Freeze:** Implementer không invent radius/spacing/shadow/semantic color ngoài [TOKENS.md](./TOKENS.md); thiếu token → escalate coordinator / PD.  
**Không sửa code app trong #789** — áp dụng token: #795; header Sheet: #794; mobile codemod: #797.

| Phần | File |
| --- | --- |
| D-3 Bảng token duy nhất + JSON đề xuất | [TOKENS.md](./TOKENS.md) |
| M-01 Map giá trị lẻ mobile | [MOBILE-ODD-VALUES.md](./MOBILE-ODD-VALUES.md) |
| Header + menu mobile (marketing + attendee) | [HEADER-MOBILE-SHEET.md](./HEADER-MOBILE-SHEET.md) |
| Prototype hi-fi (mở trình duyệt) | [prototype/header-mobile-sheet.html](./prototype/header-mobile-sheet.html) |
| D-2 Quy chuẩn prototype PD | [PROTOTYPE-GUIDE.md](./PROTOTYPE-GUIDE.md) |

**Evidence ảnh:** `docs/reviews/assets/PR789-pd-ui-framework/` (viewport × locale × trạng thái menu).  
**Nguồn audit:** `docs/reviews/FE-UI-FRAMEWORK-AUDIT-2026-10-22.md` (main qua #792); bản sao `/tmp/FE-UI-FRAMEWORK-AUDIT-2026-10-22.md`.  
**PR #784 FAIL:** `docs/reviews/PR784-EPIC766-770-HEADER-MOBILE-DOD-PD-2026-10-22.md` — spec này thay implementation #784.

**Brand giữ nguyên:** Live Pulse v2 — ink / paper / signal / focus, Sora + Be Vietnam Pro (`brand/vemoki/tokens.json`, `docs/design/visual-identity-v2/`).
