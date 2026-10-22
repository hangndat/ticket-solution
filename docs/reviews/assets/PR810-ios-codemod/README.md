# PR #810 — iOS codemod UI evidence (#797)

**Device:** iPhone 15 Pro sim `F191CF59-4B73-44E5-BFA8-4CE439EB31AD` · Orca `emulator attach` + `xcrun simctl io` screenshot.  
**Runtime:** Expo Go + Metro dev bundle (không rebuild native).

## Metro / bundle

| Pass | Worktree | Git | Port | Mở app |
| --- | --- | --- | --- | --- |
| **before** | `/Users/admin/SideProject/ticket-solution/main` (`origin/main`) | `d0491e43` | **8082** | `exp://127.0.0.1:8082` |
| **after** | `uif-797-ios-codemod` (PR #810 branch) | tip PR | **8081** | `exp://127.0.0.1:8081` |

Lệnh: `CI=1 REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 pnpm --filter @ticket/mobile exec expo start --dev-client --port <port>` từ root monorepo. Điều hướng: `exp://127.0.0.1:<port>/--/<route>`.

## Ảnh (cặp before / after)

| Before (`before-main/`) | After (`after/`) | Route | State |
| --- | --- | --- | --- |
| `events-before.png` | `events-after.png` | `/--/(events)` | Tab Sự kiện · guest |
| `event-detail-demo-before.png` | `event-detail-demo-after.png` | `/--/events/demo-mfest` | Fixture MFest |
| `account-before.png` | `account-after.png` | `/--/(tabs)/account` | Tab Tài khoản |
| `redeem-default-before.png` | `redeem-default-after.png` | `/--/redeem-global` | Guest · cổng đăng nhập redeem |

**Kiểm tra trùng hash:**  
`bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR810-ios-codemod/before-main`  
`bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR810-ios-codemod/after`

## Limitation (fixture / persona)

| Màn | Trạng thái |
| --- | --- |
| **my-tickets** | Guest sim redirect về catalog Sự kiện (giống PR #790) — không có ảnh riêng; dùng cặp `events-*` làm proxy. |
| **redeem-disabled** | CTA `global-redeem-cta-resolve` disabled (mã rỗng) cần phiên đã xác minh OIDC; guest chỉ thấy màn đăng nhập — không chụp disabled trong session này. |
| **ticket-detail** | Cần vé trong ví + API; không chụp. |
| **staff gate** | Cần fixture gate / phiên staff; không chụp. |

## Thay đổi thị giác (map lẻ PD — so sánh cặp ảnh)

Chỉ các vùng map **10→12**, **6→8**, **14→12**, **22→20** (v.v.) có thể khác pixel; grid token giữ nguyên.

| Vùng trên ảnh | Thuộc tính cũ → token | File UI chính |
| --- | --- | --- |
| Gap/padding list event card, search chrome | `10` → `space.md` (12), `6` → `space.sm` (8) | `screens/events.tsx` |
| Padding section event detail, CTA block | `14`/`10` → `space.md` | `screens/event-detail.tsx` |
| Typography body copy | `fontSize: 15/17` → `typography.subhead` / `body` | nhiều `Text` |
| Account rows / section spacing | `10`/`12` → `space.*` | `screens/account.tsx`, `account-grouped-section.tsx` |
| Redeem sign-in stack | `16`/`12` → `space.lg` / `space.md` | `screens/global-redeem.tsx` |
| Gate sticky (không có ảnh staff) | `gap: 10` → `space.sm` (8) ngoại lệ PD | `gate/staff-gate-ops-sticky.tsx` |

**Gợi ý reviewer:** zoom `events-*` và `event-detail-*` — khoảng cách card/list và cỡ chữ phụ có thể lệch 1–2px so với before.

## SHA evidence

- Before bundle: `origin/main` @ `d0491e43e2d6dac0e16d80ca69ccea8fb2a5bbba`
- After bundle: tip PR #810 (xem commit evidence trong PR)
