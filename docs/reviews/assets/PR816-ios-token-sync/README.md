# PR #816 — iOS token sync + D-4 light-only (#814)

**Device:** iPhone 17 Pro sim `F191CF59-4B73-44E5-BFA8-4CE439EB31AD` · `xcrun simctl io` screenshot after `openurl` (Metro dev client).

## Metro / bundle

| Pass | Worktree | Git | Port |
| --- | --- | --- | --- |
| **before** | `/Users/admin/SideProject/ticket-solution/main` | `7d4650b6` (`origin/main`) | **8082** |
| **after** | `uif-814-ios-token-sync` (PR #816) | `086ba11e` | **8081** |

`CI=1 REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 EXPO_PUBLIC_ALLOW_FIXTURE_EVENTS=1 pnpm --filter @ticket/mobile exec expo start --dev-client --port <port>`

Deep link: `exp://127.0.0.1:<port>/--/<route>`

## Ảnh

| Before (`before-main/`) | After (`after/`) | Route | State |
| --- | --- | --- | --- |
| `events-before-light.png` | `events-after-light.png` | `/--/(tabs)/(events)` | OS light · tab Sự kiện |
| `redeem-global-before-light.png` | `redeem-global-after-light.png` | `/--/redeem-global` | OS light · guest redeem (Button + Input) |
| `events-before-dark.png` | `events-after-dark.png` | `/--/(tabs)/(events)` | **OS dark** · D-4: app giữ light chrome |
| `redeem-global-before-dark.png` | `redeem-global-after-dark.png` | `/--/redeem-global` | **OS dark** · D-4 |

**Kiểm tra:**  
`bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR816-ios-token-sync/before-main`  
`bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/PR816-ios-token-sync/after`

## Limitation

| Màn | Trạng thái |
| --- | --- |
| **Staff gate chrome** (F02 `staff-gate-chrome`) | Cần phiên staff UAT + MeEvents — không chụp trong pass này (giống PR #810). F02 gate: `pickerRow` radius `md`, padding `space.* + space.xxs`. |

## Thay đổi thị giác mong đợi

- **D-4:** Sau PR, `userInterfaceStyle: 'light'` — cặp `*-dark.png` trên **after** vẫn nền sáng khi OS dark (so với **before** có thể đổi theo `automatic`).
- **F02:** Button/input/gate padding chỉ đổi khi giá trị cũ `±2` khác token tổng (`space.xxs`); redeem-global light pair chủ yếu CTA/input spacing.
