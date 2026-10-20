# D13 — S4-T3 Physical-device smoke (Dexter · prod bake 1.0.0/14)

Task #327 · Epic #301 · Story #307. Role `ios` · Architecture impact: **Không**.

**Verdict: FAIL (không PASS)** — Build **14** trên Dexter USB; catalog prod MFest **PASS**. OIDC prod **chưa hoàn tất** (sheet `auth.vemoki.com` mở được; không gõ credential — `core-device` HID/pasteboard cần `sudo tunneld`, WDA `type`/`status` treo passcode XCTest). Attendee QR + staff `GateCamera` **FAIL** (chưa đăng nhập; tab/deeplink không đổi route qua a11y). Không Submit for Review.

## Target binary

| Trường | Giá trị |
| ------ | ------- |
| Device (primary) | Dexter’s iPhone 16 Pro · `06CAC741-EB05-55B0-AAE6-14D7B49F50BB` · `00008140-000605803C01801C` |
| Installed (USB dev sign) | **`1.0.0` / `14`** (`devicectl device info apps`) |
| ASC Delivery UUID (TF) | `fc3a28b8-c0d3-4358-a481-de3a2ab835c8` · `processingState=VALID` |
| IPA SHA256 | `84de550b34c09b07e847ab38eea6880a684b85fd30e27b8ee1bb005c03ab4279` |
| Prod bake | `main.jsbundle` chứa `api.vemoki.com` + OIDC issuer + `ticket-mobile`; `aps-environment=production` trên IPA export |
| Team | `BLUA62D52G` · bundle `com.hangndat.ticket` |

## Smoke checklist (Dexter · prod · operator re-dispatch)

| # | Scenario | Status |
| - | -------- | ------ |
| 1 | Launch **1.0.0 (14)**; prod catalog (không «Chưa cấu hình API») | **PASS** — `20-catalog.png` («Đã xuất bản · v2», MFest) |
| 2 | OIDC prod sign-in → attendee QR | **FAIL** — `10-launch.png` / `12-current.png` tới `auth.vemoki.com`; coordinator `ask` (msg_01808529dc1a) timeout 22m; không submit credential |
| 3 | Staff `GateCamera` preview | **FAIL** — `vemoki://staff` + a11y tab không đổi route; không tab Nhân viên khi chưa staff session |
| 4 | Push | **SKIP** |

Demo accounts (operator thủ công): `attendee@example.com` / `attendee-demo`, `staff@example.com` / `staff-demo` (`docs/asc/app-review-notes.md` §A).

## Lệnh (rút gọn)

```sh
xcrun devicectl device process launch --device 06CAC741-EB05-55B0-AAE6-14D7B49F50BB com.hangndat.ticket
python3 -m pymobiledevice3 developer dvt screenshot apps/mobile/.uat-artifacts/s4-t3-dexter-operator/20-catalog.png \
  --udid 00008140-000605803C01801C
python3 -m pymobiledevice3 developer accessibility list-items --udid 00008140-000605803C01801C
# HID typing (blocked here without sudo tunneld):
# PYMOBILEDEVICE3_UDID=… python3 -m pymobiledevice3 developer core-device universal-hid-service type '…'
```

## Artifacts

`apps/mobile/.uat-artifacts/s4-t3-dexter-operator/` — `10-launch.png` … `40-deeplink-*.png` (gitignored).

## Blocker / next

1. Operator hoàn tất OIDC trên Dexter (hoặc coordinator trả lời `ask` đang pending).
2. Bật UI automation passcode + `sudo python3 -m pymobiledevice3 remote tunneld` để HID/WDA typing.
3. Re-dispatch sau attendee QR + staff camera evidence.

## Tip SHA

`6ba435ebfaf810e2a15149761e16abd193368280` (`hangndat/d13-s4-t3-operator-327`).
