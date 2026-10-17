# D10 — App Store screenshots & preview checklist

Issues: [#154](https://github.com/hangndat/ticket-solution/issues/154) (story), [#155](https://github.com/hangndat/ticket-solution/issues/155) (T1 capture), [#156](https://github.com/hangndat/ticket-solution/issues/156) (T2 preview).  
Epic: [#150](https://github.com/hangndat/ticket-solution/issues/150).  
Branch: `hangndat/d10-screenshots`. Bundle: `com.hangndat.ticket` (Vemoki). Team: `BLUA62D52G`.

**Cấm EAS Cloud Build.** Capture chỉ Simulator local (`xcrun simctl` + AXe HID / `scripts/sim-uat.sh`). Không cliclick / Computer Use.

## ASC display sizes (required)

| Slot ASC | Pixel (portrait) | Simulator dùng | Trạng thái |
| --- | --- | --- | --- |
| iPhone 6.9" | **1320 × 2868** | iPhone 17 Pro Max | ✅ captured |
| iPad 13" | **2064 × 2752** | iPad Pro 13-inch (M5) | ✅ size OK (events + retries) |

Không bắt buộc upload ASC trong task này — chỉ chuẩn bị file + path evidence.

## Artifact paths (gitignored)

Root: `apps/mobile/.uat-artifacts/d10-asc/`  
Manifest local: `apps/mobile/.uat-artifacts/d10-asc/manifest.json`

### iPhone 6.9" (`iphone-6.9/`)

| Screen | Path | Pixels |
| --- | --- | --- |
| Events | `apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/01-events.png` | 1320×2868 |
| My tickets (signed-out) | `apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/02-my-tickets.png` | 1320×2868 |
| Redeem | `apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/03-redeem.png` | 1320×2868 |
| Event detail (demo) | `apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/04-event-detail.png` | 1320×2868 |
| Staff / gate | `apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/05-staff.png` | 1320×2868 |

### iPad 13" (`ipad-13/`)

| Screen | Path | Pixels |
| --- | --- | --- |
| Events | `apps/mobile/.uat-artifacts/d10-asc/ipad-13/01-events.png` | 2064×2752 |
| My tickets / Staff / Redeem | `…/ipad-13/02-*.png` … `05-*.png` | 2064×2752 — **một số file có thể trùng Events** nếu tap a11y trùng label (split-view); retake bằng tọa độ trước upload ASC |

## Capture commands (local)

```bash
# Boot (không open Simulator.app)
xcrun simctl boot "iPhone 17 Pro Max"
# hoặc: scripts/sim-uat.sh boot "iPhone 17 Pro Max"

# App đã cài com.hangndat.ticket — launch + screenshot
UDID=<promax-udid>
xcrun simctl launch "$UDID" com.hangndat.ticket
# Điều hướng in-app qua axe (tránh openurl khi app đang chạy — tránh sheet "Open in Vemoki?")
axe tap --udid "$UDID" --label "Vé của tôi"
xcrun simctl io "$UDID" screenshot apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/02-my-tickets.png

# iPad 13"
xcrun simctl boot "iPad Pro 13-inch (M5)"
xcrun simctl install <ipad-udid> "$(xcrun simctl get_app_container <promax-udid> com.hangndat.ticket app)"
xcrun simctl launch <ipad-udid> com.hangndat.ticket
xcrun simctl io <ipad-udid> screenshot apps/mobile/.uat-artifacts/d10-asc/ipad-13/01-events.png
```

Kiểm tra kích thước:

```bash
sips -g pixelWidth -g pixelHeight apps/mobile/.uat-artifacts/d10-asc/iphone-6.9/*.png
sips -g pixelWidth -g pixelHeight apps/mobile/.uat-artifacts/d10-asc/ipad-13/*.png
```

## T2 — Preview video / storyboard

**N/A (có lý do)** cho đợt prep D10 hiện tại:

1. ASC **không bắt buộc** App Preview video để submit metadata/screenshot set.
2. Storyboard tối thiểu = dãy 5 screenshot iPhone 6.9" ở trên (events → tickets → redeem → event → staff); đủ kể chuyện sản phẩm cho review nội bộ.
3. Quay preview video (`.mov` 15–30s) để lại bước upload ASC / marketing — ngoài phạm vi S2 khi chưa có session signed-in + nội dung vé thật trên sim.

Khi cần video sau này: quay bằng Simulator → File → Record (hoặc `xcrun simctl io <udid> recordVideo`) — vẫn **local**, không EAS Cloud.

## Hạn chế (ghi rõ)

- Sim UAT / signed-out: My Tickets & Staff hiện trạng `Phiên: signed-out`; Events có nhãn demo — **không** tuyên bố listing production-ready.
- Không physical device / TestFlight media trong task này.
- PNG gitignored — chỉ checklist + path + lệnh trong repo; reviewer xác nhận file tồn tại local trên máy capture.

## Acceptance checklist

- [x] Screenshot iPhone 6.9" đúng 1320×2868 (5 màn)
- [x] Screenshot iPad 13" đúng 2064×2752 (≥1 màn Events; thêm màn khi retake)
- [x] Artifact paths ghi trong checklist (gitignored)
- [x] Preview video: N/A có lý do (storyboard = dãy screenshot)
- [x] Không EAS Cloud
- [ ] DoD Cursor reviewer ≠ implementer (exact SHA checklist commit)
- [ ] Upload ASC — ngoài scope S2 (Epic #150 / story khác)

## Evidence pointer

Xem thêm ghi chú capture: [`docs/reviews/d10-screenshots-notes.md`](../reviews/d10-screenshots-notes.md).
