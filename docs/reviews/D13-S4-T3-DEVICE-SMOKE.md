# D13 — S4-T3 Physical-device smoke (Dexter · prod bake 1.0.0/14)

Task #327 · Epic #301 · Story #307. Role `ios` · Architecture impact: **Không**.

**Verdict: FAIL (không PASS)** — Dexter **1.0.0 (14)** cài USB (prod bake xác minh UI + IPA). ASC upload build **14** `VALID`. Launch + prod MFest catalog **PASS**. OIDC prod sign-in + attendee QR + staff `GateCamera` **FAIL** — accessibility tap không mở AuthSession/đổi tab; WDA blocked bởi XCTest passcode prompt. Không Submit for Review / không publish.

## Target binary

| Trường | Giá trị |
| ------ | ------- |
| Device (primary) | Dexter’s iPhone 16 Pro · `06CAC741-EB05-55B0-AAE6-14D7B49F50BB` · `00008140-000605803C01801C` |
| Installed (USB dev sign) | **`1.0.0` / `14`** (`devicectl device info apps`) |
| ASC Delivery UUID (TF) | `fc3a28b8-c0d3-4358-a481-de3a2ab835c8` · `processingState=VALID` |
| IPA SHA256 | `84de550b34c09b07e847ab38eea6880a684b85fd30e27b8ee1bb005c03ab4279` |
| Prod bake | `main.jsbundle` chứa `api.vemoki.com` + OIDC issuer + `ticket-mobile`; `aps-environment=production` trên IPA export |
| Install path | Coordinator redirect: `xcodebuild … build install` + `devicectl device install app` `.app` (không chờ TestFlight) |
| Team | `BLUA62D52G` · bundle `com.hangndat.ticket` |

Build **13** TF: FAIL prod bake (session trước). Build **14** khắc phục bake.

## Smoke checklist (Dexter · prod)

| # | Scenario | Status |
| - | -------- | ------ |
| 1 | Launch **1.0.0 (14)**; prod catalog (không demo footer / không «Chưa cấu hình API») | **PASS** — `10-launch.png` |
| 2 | OIDC prod sign-in → attendee QR | **FAIL** — `perform_press` «Đăng nhập» không mở sheet; chưa vào ví/QR |
| 3 | Staff `GateCamera` preview | **FAIL** — deep link `vemoki://staff` không đổi route; chưa camera |
| 4 | Push | **SKIP** |

Demo accounts (khi operator sign-in thủ công): `attendee@example.com` / `attendee-demo`, `staff@example.com` / `staff-demo` (`docs/asc/app-review-notes.md` §A).

## Lệnh (rút gọn)

Prod env + archive/upload: xem `apps/mobile/.expo/tf-upload-14/` và `/tmp/tf14-*.log`.

```sh
# USB install Dexter (sau xcodebuild install)
xcrun devicectl device install app --device 06CAC741-EB05-55B0-AAE6-14D7B49F50BB \
  ~/Library/Developer/Xcode/DerivedData/.../Vemoki.app
xcrun devicectl device process launch --device 06CAC741-EB05-55B0-AAE6-14D7B49F50BB com.hangndat.ticket
python3 -m pymobiledevice3 developer dvt screenshot apps/mobile/.uat-artifacts/s4-t3-dexter/10-launch.png \
  --udid 00008140-000605803C01801C
```

## Artifacts

`apps/mobile/.uat-artifacts/s4-t3-dexter/` — `00-*` App Store attempts; `10-launch.png` … `15-staff-deeplink.png` (gitignored).

## Blocker / next

Operator: hoàn tất OIDC + QR + GateCamera trên Dexter (sign-in thủ công hoặc bật UI automation passcode); hoặc re-dispatch với WDA passcode đã enable.

## Tip SHA

`git rev-parse HEAD` trên branch PR #575.
