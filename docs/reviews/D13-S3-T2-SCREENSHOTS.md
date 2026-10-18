# D13 S3-T2 — Upload screenshots ASC (#323)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | **2026-10-18** |
| Issue | [#323](https://github.com/hangndat/ticket-solution/issues/323) · Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#306](https://github.com/hangndat/ticket-solution/issues/306) |
| Role | `ios` · `docs/agents/roles/ios.md` · Agent Cursor |
| Architecture impact | **Không** — ASC media ops |
| Tip SHA (evidence commit) | `283518b50f9966106736a20cf2a48de84b309180` |
| Base `main` lúc bắt đầu | `0899f879e7fe714ba98af7764116e5792ddf8c98` |
| Receipt JSON | [D13-S3-T2-SCREENSHOTS.json](./D13-S3-T2-SCREENSHOTS.json) |
| Cấm | EAS Cloud · submit/release · secrets trong git |

## Kết quả

- Retake headless Simulator (PNG D10 local **mất** → phải capture lại theo §1.2 plan).
- Upload ASC API locale **en-US** version `1.0.0` state **PREPARE_FOR_SUBMISSION**.
- **10/10** `assetDeliveryState=COMPLETE` (5 iPhone + 5 iPad).
- **Không** submit / **không** chọn build / **không** đổi Availability / **không** EAS.

## Slot ASC

| Slot checklist D10 | Pixels | ASC `screenshotDisplayType` | Set id | Count |
| --- | --- | --- | --- | --- |
| iPhone 6.9" (Dynamic Island large) | 1320×2868 | **`APP_IPHONE_67`** | `e605accf-1bc5-4f34-a4de-95b623d494ff` | 5 COMPLETE |
| iPad 13" | 2064×2752 | `APP_IPAD_PRO_3GEN_129` | `828098b7-df75-4606-bd5a-94604c36303c` | 5 COMPLETE |

**Ghi chú enum:** ASC API (key này) **không** có `APP_IPHONE_69`. Giá trị hợp lệ gần nhất cho 1320×2868 là `APP_IPHONE_67` (khớp [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) — Dynamic Island large). `APP_IPHONE_61` (medium, bắt buộc listing mới) **chưa** upload trong Task này — nếu Apple UI vẫn yêu cầu medium riêng, coordinator có thể scale từ large hoặc retake Pro.

## Capture (local, gitignored)

Root: `apps/mobile/.uat-artifacts/d13-asc/` · manifest: `…/manifest.json`

| Screen | iPhone path | iPad path |
| --- | --- | --- |
| Events | `iphone-6.9/01-events.png` | `ipad-13/01-events.png` |
| My tickets | `…/02-my-tickets.png` | `…/02-my-tickets.png` |
| Redeem | `…/03-redeem.png` | `…/03-redeem.png` |
| Event detail | `…/04-event-detail.png` | `…/04-event-detail.png` |
| Staff | `…/05-staff.png` | `…/05-staff.png` |

```bash
# Verify sizes on capture host
sips -g pixelWidth -g pixelHeight apps/mobile/.uat-artifacts/d13-asc/iphone-6.9/*.png
sips -g pixelWidth -g pixelHeight apps/mobile/.uat-artifacts/d13-asc/ipad-13/*.png
```

**Method:** `xcrun simctl io … screenshot` + AXe HID (`scripts/sim-uat.sh tap` / tọa độ) — **không** cliclick / Computer Use / EAS.

| Simulator | UDID |
| --- | --- |
| iPhone 17 Pro Max | `4ADE0D85-4146-495A-9B26-2A4D0B85F388` |
| iPad Pro 13-inch (M5) | `95B2A507-8FDF-4F69-992A-A66C780DDBEB` |

## Build UI tip (capture binary)

| Field | Value |
| ----- | ----- |
| Bundle | `com.hangndat.ticket` |
| Team | `BLUA62D52G` |
| Binary | Local **Release-iphonesimulator** `Vemoki.app` (embedded `main.jsbundle`) từ DerivedData |
| `CFBundleShortVersionString` | `0.1.0` |
| `CFBundleVersion` | `8` |
| Mobile source on `main` (gần tip) | `6002d09` — `fix(mobile): làm rõ yêu cầu xóa tài khoản và xác minh SDK (#353)` |
| Reuse checklist SHA (docs only) | PR #181 tip `4ba381d1035e8864a9fb1e0d6d4be1fcb3a06d2e` · merge `b672de852c163a24bcd9f3b5f680786aa14f7cb6` |

Không dùng binary này làm claim store archive (S4). Screenshots = UI signed-out / demo fixture.

## Gap D13 (quan sát sau upload)

| ID | Trước | Sau Task #323 |
| -- | ----- | ------------- |
| G3 Screenshots chưa upload ASC | Mở | **Đóng phần en-US media** (10 COMPLETE) — chưa submit |
| G4 iPad media chất lượng | Mở | **Retake iPad 5 màn distinct** (md5 khác nhau) và upload COMPLETE |

Locale **vi** chưa tạo screenshot set riêng (chỉ en-US). Preview video vẫn N/A.

## Claim boundary

- State vẫn **PREPARE_FOR_SUBMISSION**.
- Chưa chọn build version, chưa App Review submit, chưa release / Ready for Sale.
- UI signed-out + nhãn demo / API helper text trên một số màn — phù hợp prep listing; có thể cần polish marketing trước S6 nếu Review reject media.
- Implementer evidence; cần DoD reviewer độc lập trên **exact SHA** commit PR này.

## DoD checklist (implementer)

- [x] Slot iPhone + iPad theo checklist D10; không EAS
- [x] Evidence + receipt JSON (no secrets)
- [x] Ghi build UI tip + tip SHA (sau commit)
- [ ] DoD Cursor reviewer ≠ implementer (exact SHA)
- [x] Không submit/release
