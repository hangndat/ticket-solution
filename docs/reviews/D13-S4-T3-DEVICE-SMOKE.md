# D13 — S4-T3 Physical-device smoke (Internal TF 1.0.0/10)

Task #327 · Epic #301 · Story #307. Role `ios` · Architecture impact: **Không** — device UAT evidence.

**Verdict: BLOCKED (không PASS)** — ASC binary sẵn sàng; chưa cài được `1.0.0 (10)` lên device thật qua TestFlight trong session này. Không claim physical TF smoke PASS. Không Submit for Review / không publish.

## Target binary (đã upload — S4-T2)

| Trường | Giá trị |
| ------ | ------- |
| Source archive SHA | `6002d09afa9382a72ee9840c8ba1dd41c7b09065` (PR #353) |
| Upload evidence | [D13-S4-T2-UPLOAD.md](./D13-S4-T2-UPLOAD.md) · merge tip PR #359 `4fa9071e4d47cba755eb2ff76611e72f8c9ff67f` |
| Bundle | `com.hangndat.ticket` |
| Team | `BLUA62D52G` |
| Marketing / build | **`1.0.0` / `10`** |
| IPA SHA256 (local reuse) | `37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7` |
| ASC build / Delivery UUID | `45c730c3-7caa-4b28-92fb-315cf07bce5d` |
| ASC API Key ID (không secret) | `KHT3SAL2FS` |

## ASC re-verify (read-only, session này)

Thời điểm UTC: xem [D13-S4-T3-DEVICE-SMOKE.json](./D13-S4-T3-DEVICE-SMOKE.json).

| Gate | Kết quả |
| ---- | ------- |
| `processingState` | **VALID** |
| `preReleaseVersion` | **1.0.0** |
| `internalBuildState` | **IN_BETA_TESTING** |
| `externalBuildState` | `READY_FOR_BETA_SUBMISSION` (chưa External group) |
| App Store Version `1.0.0` | `PREPARE_FOR_SUBMISSION` / `releaseType=MANUAL` — **chưa** Submit |
| Internal beta group | `James` (`isInternalGroup=true`, `hasAccessToAllBuilds=true`) |
| Tester | `hangndat@gmail.com` · `inviteType=EMAIL` · ASC `state=INSTALLED` |

Không EAS Cloud Build. Không commit `.p8` / IPA / signing.

## Physical device inventory (USB)

| Device | CoreDevice id | UDID | OS | `com.hangndat.ticket` installed |
| ------ | ------------- | ---- | -- | ------------------------------- |
| Dexter’s iPhone 16 Pro | `06CAC741-EB05-55B0-AAE6-14D7B49F50BB` | `00008140-000605803C01801C` | 26.6.1 | **0.1.0 (7)** + WDA runner |
| DatHN iPhone | `CB22153A-C24F-547E-87FC-34EC62527838` | `00008130-000618E402D1001C` | 26.6.1 | **0.1.0 (10)** |

- Không thấy app **TestFlight** trên danh sách `devicectl device info apps` của cả hai máy.
- USB install IPA Distribution (`xcrun devicectl device install app …/Vemoki.ipa`) → **FAIL** `0xe800801f` — *Attempted to install a Beta profile without the proper entitlement* (đúng kỳ vọng: binary App Store/TF chỉ cài qua TestFlight, không sideload Development).

## Smoke checklist (chưa chạy trên TF 1.0.0/10)

| # | Scenario | Yêu cầu AC | Status |
| - | -------- | ---------- | ------ |
| 1 | Launch TF build; Settings/About = `1.0.0 (10)` | Device thật + binary đã upload | **BLOCKED** — binary chưa trên device |
| 2 | Attendee: mở vé / QR display (prod endpoints) | Device thật | **BLOCKED** |
| 3 | Staff/Gate: `GateCamera` — cho phép camera + preview quét QR | Camera hardware (sim không thay) | **BLOCKED** |
| 4 | Optional push smoke trên TF (production APNs entitlement) | Device thật | **BLOCKED** / ngoài tối thiểu nếu chưa có fixture |

Headless `scripts/sim-uat.sh`: **không chạy** trong session này (coordinator: optional; sim ≠ TF binary và không thay camera AC).

## Blocker (operator)

Coordinator chỉ định **A — operator install TestFlight**:

1. Trên device có Apple ID `hangndat@gmail.com` (ASC Internal tester đã `INSTALLED`): cài **TestFlight** nếu thiếu.
2. Cài / cập nhật **Vemoki `1.0.0 (10)`** từ Internal TestFlight (group James / all builds).
3. Báo lại **UDID** + xác nhận version/build trên device.
4. Re-dispatch S4-T3 để chạy checklist camera attendee/staff + ghi screenshot dưới `apps/mobile/.uat-artifacts/` (gitignored) và cập nhật artifact này → PASS khi đủ.

## Giới hạn / không làm

- Không EAS / Expo Cloud Build; không upload source/signing lên Expo.
- Không computer-use / App Store mirror chiếm desktop user (uat-headless).
- Không Development rebuild thay thế để claim PASS AC title (cần binary TF đã upload).
- Không Submit for Review (#332), không External TF bắt buộc, không release / Ready for Sale.
- Không commit secrets, IPA, provisioning, API key material.
- Artifact này **không** đủ đóng S4-T3 / mở S6; Project giữ **Bị chặn** đến khi operator TF install + smoke re-run.

## Tip SHA

Exact tip của PR chứa artifact này — điền sau commit (`git rev-parse HEAD`). Evidence ASC/device ở trên không phụ thuộc tip docs.
