# iOS UI components (#790) — simulator evidence

Device: iPhone 17 Pro (`F191CF59-4B73-44E5-BFA8-4CE439EB31AD`), Orca `emulator attach`.

| File | Route / state |
| --- | --- |
| `events.png` | Tab Sự kiện — shared `Input` search (`events-search`) |
| `my-tickets.png` | Tab Vé của tôi |
| `account.png` | Tab Tài khoản |
| `redeem-via-cta.png` | Redeem flow entry |

## Pressable còn lại (không phải nút)

| File | Lý do |
| --- | --- |
| `screens/events.tsx` | `Link` + `Pressable` `asChild`, `accessibilityRole="link"` — vùng chạm thẻ sự kiện |
| `screens/my-tickets.tsx` | `Link` + `Pressable` `asChild` — hàng vé điều hướng |
| `gate/staff-manual-confirm-sheet.tsx` | Backdrop + sheet `stopPropagation` — không phải CTA |
| `gate/staff-gate-manual-entry.tsx` | Modal backdrop + sheet `stopPropagation` |
| `gate/staff-gate-history-sheet.tsx` | Modal backdrop + sheet `stopPropagation` |

VoiceOver: `orca emulator ax` xác nhận `events-search` label «Tìm tên sự kiện» và nút «Đổi mã lấy vé» trên catalog. Gate manual/redeem disabled states: cần phiên staff — reviewer UAT bổ sung khi có fixture gate.
