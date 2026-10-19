# D13 — S4-T3 Physical-device smoke (Internal TF 1.0.0)

Task #327 · Epic #301 · Story #307. Role `ios` · Architecture impact: **Không** — device UAT evidence.

**Verdict: BLOCKED (không PASS)** — ASC train `1.0.0` builds **10–13** VALID + Internal TF; **DatHN iPhone** đã cài **`1.0.0 (13)`** (`com.hangndat.ticket`). Checklist attendee/staff **camera** chưa chạy: `devicectl` launch bị **device locked**; coordinator chọn `blocked` (không retry interactive trong dispatch này). Không Submit for Review / không publish.

## Target binary (đã upload — S4-T2 + follow-up TF)

| Trường | Giá trị |
| ------ | ------- |
| Source archive SHA (S4-T1/S4-T2) | `6002d09afa9382a72ee9840c8ba1dd41c7b09065` (PR #353) |
| Upload evidence (build 10) | [D13-S4-T2-UPLOAD.md](./D13-S4-T2-UPLOAD.md) · merge tip PR #359 `4fa9071e4d47cba755eb2ff76611e72f8c9ff67f` |
| Bundle | `com.hangndat.ticket` |
| Team | `BLUA62D52G` |
| S4-T2 marketing / build | **`1.0.0` / `10`** · ASC id `45c730c3-7caa-4b28-92fb-315cf07bce5d` |
| Tip TF on device (session này) | **`1.0.0` / `13`** · ASC id `fa4f322d-6a18-4a62-b5a9-e2133a055f8f` · uploaded `2026-10-18T21:32:47-07:00` |
| IPA SHA256 (build 10 local reuse) | `37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7` |
| ASC API Key ID (không secret) | `KHT3SAL2FS` |

## ASC re-verify (read-only, session này)

Thời điểm UTC: [D13-S4-T3-DEVICE-SMOKE.json](./D13-S4-T3-DEVICE-SMOKE.json).

| Gate | Kết quả |
| ---- | ------- |
| Builds `1.0.0` **10–13** | `processingState=VALID` · Internal `IN_BETA_TESTING` |
| `preReleaseVersion` | **1.0.0** |
| App Store Version `1.0.0` | `PREPARE_FOR_SUBMISSION` / `releaseType=MANUAL` — **chưa** Submit |
| Internal beta group | `James` (`isInternalGroup=true`, `hasAccessToAllBuilds=true`) |
| Tester | `hangndat@gmail.com` · `inviteType=EMAIL` |

Không EAS Cloud Build. Không commit `.p8` / IPA / signing.

## Physical device inventory (USB)

| Device | CoreDevice id | UDID | OS | `com.hangndat.ticket` installed |
| ------ | ------------- | ---- | -- | ------------------------------- |
| Dexter’s iPhone 16 Pro | `06CAC741-EB05-55B0-AAE6-14D7B49F50BB` | `00008140-000605803C01801C` | 26.6.1 | **0.1.0 (7)** + WDA runner (dev, không phải TF 1.0.0) |
| DatHN iPhone | `CB22153A-C24F-547E-87FC-34EC62527838` | `00008130-000618E402D1001C` | 26.6.1 | **`1.0.0 (13)`** — khớp ASC TF tip |

- `devicectl device info apps` không liệt kê bundle TestFlight (`com.apple.TestFlight`); TF build cài trực tiếp dưới `com.hangndat.ticket` (bình thường sau cài từ TestFlight).
- USB install IPA Distribution → **FAIL** `0xe800801f` (kỳ vọng; không sideload store IPA).
- `devicectl device process launch` **DatHN** → **FAIL** locked (`FBSOpenApplicationErrorDomain` 7) — 2026-10-19 session.
- `devicectl` launch **Dexter** → OK nhưng binary **sai** (0.1.0 dev) — không dùng cho AC TF smoke.

## Smoke checklist (chưa PASS trên TF 1.0.0)

| # | Scenario | Yêu cầu AC | Status |
| - | -------- | ---------- | ------ |
| 1 | Launch TF build; Settings/About = `1.0.0` + build đã upload | Device thật + binary TF | **PARTIAL** — build **13** trên DatHN; chưa xác minh UI About (locked) |
| 2 | Attendee: mở vé / QR display (prod endpoints) | Device thật | **BLOCKED** |
| 3 | Staff/Gate: `GateCamera` — camera + preview quét QR | Camera hardware | **BLOCKED** |
| 4 | Optional push smoke (production APNs) | Device thật | **BLOCKED** / ngoài tối thiểu |

Headless `scripts/sim-uat.sh`: **không chạy** (optional; sim ≠ TF binary; không thay camera AC).

## Blocker (operator)

1. **Unlock** DatHN iPhone (`00008130-000618E402D1001C`); giữ USB + màn hình sáng.
2. Mở Vemoki **1.0.0 (13)**; đăng nhập prod (fixture `attendee@example.com` / staff theo [D13-S5-T2-DEMO-REVIEWER.md](./D13-S5-T2-DEMO-REVIEWER.md)).
3. Chạy checklist #2–#3; screenshot dưới `apps/mobile/.uat-artifacts/` (gitignored).
4. Re-dispatch S4-T3 → cập nhật verdict **PASS** khi đủ.

## Giới hạn / không làm

- Không EAS / Expo Cloud Build; không upload source/signing lên Expo.
- Không computer-use / App Store mirror desktop user.
- Không Development rebuild thay TF để claim PASS.
- Không Submit for Review (#332) — xem [d13-s6-t1-332-readiness.md](./d13-s6-t1-332-readiness.md).
- Không commit secrets, IPA, provisioning, API key material.

## Tip SHA

Exact tip evidence (docs): `e6198af2ba793a1f3ee6d5562d48f9cc246ecddc` (`git rev-parse HEAD` trên branch PR). ASC/device facts không phụ thuộc tip docs.
