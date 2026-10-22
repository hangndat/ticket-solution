# iOS UI components (#790) — simulator evidence

Device: iPhone 17 Pro (`F191CF59-4B73-44E5-BFA8-4CE439EB31AD`), Orca `emulator attach` + `xcrun simctl io` screenshot (sau attach).

| File | Route / state |
| --- | --- |
| `events.png` | Tab Sự kiện — shared `Input` search (`events-search`) |
| `my-tickets.png` | Deep link `/(tabs)/my-tickets` (guest: shell catalog redirect; tab ẩn khi chưa có wallet access) |
| `account.png` | Tab Tài khoản |
| `redeem-via-cta.png` | Redeem entry từ CTA «Đổi mã lấy vé» trên catalog |
| `redeem-disabled.png` | `redeem-global` — CTA disabled khi chưa nhập mã (`global-redeem-cta-continue`, AX `enabled: false`) |

### Trước / sau (`origin/main`)

| Thư mục | Ghi chú |
| --- | --- |
| `before-main/` | Bundle Metro từ worktree `origin/main` (detached `fb3396fd`), port `8082` — events, account, redeem, my-tickets (cùng persona guest sim). |

Kiểm tra trùng hash: `bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR790-ios-ui-components/before-main` và `…/*.png` ở thư mục gốc (không gộp hai thư mục).

## Pressable còn lại (không phải nút)

| File | Lý do |
| --- | --- |
| `screens/events.tsx` | `Link` + `Pressable` `asChild`, `accessibilityRole="link"` — vùng chạm thẻ sự kiện |
| `screens/my-tickets.tsx` | `Link` + `Pressable` `asChild` — hàng vé điều hướng |
| `gate/staff-manual-confirm-sheet.tsx` | Backdrop + sheet `stopPropagation` — không phải CTA |
| `gate/staff-gate-manual-entry.tsx` | Modal backdrop + sheet `stopPropagation` |
| `gate/staff-gate-history-sheet.tsx` | Modal backdrop + sheet `stopPropagation` |

## Limitation (F03 — không chặn merge)

| Mục | Trạng thái |
| --- | --- |
| `ticket-detail` loading/disabled/error | Cần phiên attendee + vé trên API (prod `getApiBaseUrl` cố định); chưa chụp trong session guest sim. |
| Gate manual + VoiceOver staff | Cần fixture gate / phiên staff — reviewer UAT bổ sung khi có fixture. |
| Tab «Vé của tôi» đầy đủ | Cần OIDC + `/v1/me` thành công; guest chỉ thấy redirect catalog hoặc tab ẩn. |

VoiceOver (đã xác minh trên catalog): `orca emulator ax` — `events-search` «Tìm tên sự kiện», CTA «Đổi mã lấy vé».
