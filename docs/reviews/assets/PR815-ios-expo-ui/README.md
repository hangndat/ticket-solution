# PR #815 — @expo/ui gate sheet / segmented (iOS)

Device: **D11-Gate-UAT** (iPhone 17 Pro class), iOS 26.5 sim, `__DEV__` dev client `com.hangndat.ticket`.

| File | When | Route / state |
| --- | --- | --- |
| `before-main/01-event-list-picker-iphone17pro.png` | `origin/main` @ f831845a | `/uat/gate-expo-ui-before` — list `StaffEventPicker` |
| `before-main/02-history-modal-slide.png` | f831845a | Same fixture — RN `Modal` slide history |
| `before-main/03-manual-entry-modal-slide.png` | f831845a | Same fixture — RN `Modal` slide manual entry |
| `after/01-fixture-segmented-iphone17pro.png` | branch tip | `/uat/gate-expo-ui` — `SegmentedControl` (MFest selected) |
| `after/02-segmented-workshop-selected.png` | branch tip | Fixture home (segment visible) |
| `after/03-history-bottom-sheet.png` | branch tip | `@expo/ui` `BottomSheet` history |
| `after/04-manual-entry-bottom-sheet.png` | branch tip | `@expo/ui` `BottomSheet` manual entry + keyboard |
| `after/05-confirm-modal-fade.png` | branch tip | `StaffManualConfirmSheet` — RN Modal (giữ native confirm) |

Capture: `orca emulator attach D11-Gate-UAT`, Metro dev client `:8081`, `xcrun simctl openurl` + `simctl io screenshot`.
