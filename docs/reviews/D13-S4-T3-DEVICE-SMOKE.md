# D13 — S4-T3 Physical-device smoke (DatHN · prod target 1.0.0/26)

Task `task_c515b184a886` · Epic #301 · Story #307. Role `launch-uat` · Architecture impact: **Không**.

**Verdict: FAIL (không PASS)** — DatHN iPhone (Wi‑Fi CoreDevice) chạy được launch + catalog + deeplink Account; **không cài** bản Release dev-signed **1.0.0 (26)** (provisioning profile team `BLUA62D52G` không gồm UDID `00008130-000618E402D1001C` dù thiết bị đã đăng ký portal). Thiết bị vẫn có **1.0.0 (14)** USB dev cũ. OIDC prod **chưa mở sheet** (`perform_press` trên «Đăng nhập» không kích hoạt; WDA/HID cần `sudo tunneld` hoặc HID service không có trên iOS 26). Attendee QR · staff camera · account-deletion **chưa chạy**. Không Submit for Review.

## Target binary

| Trường | Giá trị |
| ------ | ------- |
| Device (this run) | **DatHN iPhone** · iPhone 15 Pro · CoreDevice `CB22153A-C24F-547E-87FC-34EC62527838` · UDID `00008130-000618E402D1001C` |
| Installed (observed) | **`1.0.0` / `14`** (`devicectl device info apps`) — **không** TF 26 trên máy |
| Intended (task) | **`1.0.0` / `26`** · prod bake `api.vemoki.com` + `auth.vemoki.com` + `ticket-mobile` · `aps-environment=production` |
| Build 26 install | **FAIL** — `xcodebuild` / `expo run:ios --configuration Release`: *Provisioning profile "iOS Team Provisioning Profile: com.hangndat.ticket" doesn't include … DatHN iPhone*; `-allowProvisioningUpdates` / `-allowProvisioningDeviceRegistration`: *device already exists on team* nhưng profile chưa refresh |
| Team | `BLUA62D52G` · bundle `com.hangndat.ticket` |
| Metro bundle (tip `main`, Release attempt) | `main.jsbundle` chứa `api.vemoki.com`, `auth.vemoki.com` (strings `demo-mfest`/`fixture`/`uat` vẫn trong bundle — không đồng nghĩa route lộ) |

## Smoke checklist (DatHN · prod · 2026-10-21)

| # | Scenario | Status | Evidence |
| - | -------- | ------ | -------- |
| 1 | Launch; prod catalog (không «Chưa cấu hình API») | **PASS** (trên build **14**) | `apps/mobile/.uat-artifacts/s4-t3-dathn/11-vemoki-launch.png`, `20-catalog.png` — MFest · Demo, Studio Night · Demo |
| 2 | OIDC prod sign-in → attendee QR | **FAIL** | Account deeplink OK (`30-account-deeplink.png`); `accessibility perform_press` «Đăng nhập, Button» không mở `auth.vemoki.com` (`40-auth-sheet.png` vẫn Account); chưa gõ credential |
| 3 | Staff `GateCamera` preview + QR scan | **FAIL** | Chưa staff session |
| 4 | Account → «Yêu cầu xóa tài khoản» (không xác nhận) | **FAIL** | Chưa đăng nhập |
| 5 | Không route dev/fixture/UAT lộ; không crash | **PARTIAL** | Không crash; catalog vẫn hiện sự kiện **Demo** (MFest · Demo) trên build 14 — cần xác nhận lại trên binary **26** prod bake |

Demo accounts (operator): `review-attendee@vemoki.com`, `review-staff@vemoki.com` — mật khẩu trong `/opt/vemoki/secrets/app-review/asc-sign-in-required.txt` trên VPS `conanphong` (không ghi trong repo).

## Automation (đã thử)

| Cách | Kết quả |
| ---- | ------- |
| `devicectl` launch + `--payload-url vemoki://account` | **PASS** — mở tab Tài khoản |
| `pymobiledevice3 remote start-tunnel --native` + `dvt screenshot --rsd` | **PASS** qua Wi‑Fi (không cần USB) |
| `accessibility list-items` + `perform_press` (Đăng nhập) | **FAIL** — không mở OIDC sheet |
| `core-device universal-hid-service tap` | **FAIL** — service không có trên iOS 26 |
| `developer wda` | **FAIL** — cần `sudo python3 -m pymobiledevice3 remote tunneld` |
| Release install build 26 | **FAIL** — provisioning |

## Operator handoff (gõ tay ~5 phút)

Thiết bị **đã mở khóa**, app có thể mở lại:

```sh
DEVICE=CB22153A-C24F-547E-87FC-34EC62527838
xcrun devicectl device process launch --device "$DEVICE" \
  --payload-url "vemoki://account" com.hangndat.ticket
```

1. Chạm **Đăng nhập** → hoàn tất OIDC `auth.vemoki.com` với `review-attendee@vemoki.com` (mật khẩu từ VPS; không chụp màn hình khi gõ).
2. **Vé của tôi** → mở vé → xác nhận QR (`~/Desktop/vemoki-review-ticket-qr.png`).
3. Đăng xuất → đăng nhập `review-staff@vemoki.com` → cho phép Camera → scanner preview; hiển thị ảnh QR trên Mac trước camera nếu quét.
4. **Tài khoản** → **Yêu cầu xóa tài khoản** — chỉ xem màn xác nhận, **không** bấm xác nhận cuối.

Tùy chọn coordinator: refresh provisioning (Xcode account `hangndat@gmail.com` / team `BLUA62D52G`) hoặc cài TF **26** trên DatHN; cắm USB giúp `pymobiledevice3` HID nếu cần automation lại.

## Artifacts

`apps/mobile/.uat-artifacts/s4-t3-dathn/` — `11-vemoki-launch.png`, `20-catalog.png`, `30-account-deeplink.png`, `40-auth-sheet.png` (gitignored).

## Prior run (Dexter · build 14)

Xem lịch sử Dexter USB trong git history của file này (`6ba435eb…`).

## Tip SHA (repo evidence)

`f3b4af071745a94654e37e24449ac60c057c655a` (`hangndat/uat-device-smoke-26`).
