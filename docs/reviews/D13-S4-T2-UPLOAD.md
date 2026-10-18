# D13 — Upload IPA → ASC (TestFlight processing)

Task #326 · Epic #301 · Story #307. Architecture impact: **Không** — release ops upload; không đổi app source; ≠ Submit for Review (#332); ≠ publish/release.

Source archive exact `6002d09afa9382a72ee9840c8ba1dd41c7b09065` (PR #353 merge tip dùng cho S4-T1). IPA reuse artifact S4-T1 ([D13-S4-T1-LOCAL-ARCHIVE.md](./D13-S4-T1-LOCAL-ARCHIVE.md) / [JSON](./D13-S4-T1-LOCAL-ARCHIVE.json)); merge evidence archive `0899f879e7fe714ba98af7764116e5792ddf8c98` (PR #358).

## Kết quả

`xcrun altool --upload-app` local (không EAS Cloud) lên App Store Connect thành công. Delivery UUID `45c730c3-7caa-4b28-92fb-315cf07bce5d`. ASC API (read) sau upload: train **`1.0.0`**, build **`10`**, `processingState=VALID`, `internalBuildState=IN_BETA_TESTING`, `externalBuildState=READY_FOR_BETA_SUBMISSION`. App Store Version `1.0.0` vẫn `PREPARE_FOR_SUBMISSION` / `releaseType=MANUAL` — **chưa** Submit for Review, **chưa** release.

| Trường | Giá trị |
| ------ | ------- |
| Bundle | `com.hangndat.ticket` |
| Team | `BLUA62D52G` |
| Marketing version | `1.0.0` |
| Build (`CFBundleVersion`) | `10` |
| IPA path (local) | `apps/mobile/.expo/d13-release/export/Vemoki.ipa` |
| IPA SHA256 | `37c96607b99be7136ef91c9f57aa561c2461e5458122175c364553bd5b78f8c7` |
| IPA bytes | `11722935` |
| ASC build id / Delivery UUID | `45c730c3-7caa-4b28-92fb-315cf07bce5d` |
| Uploaded (ASC) | `2026-10-18T02:04:04-07:00` |
| ASC API Key ID (không secret) | `KHT3SAL2FS` |
| Tool | `xcrun altool` ContentDelivery `26.40.1` / Xcode 26.5 |

## Prior TestFlight vs acceptance

Trước upload, ASC chỉ có train `0.1.0` với build tối đa **11** (build id `feb92136-c86e-431e-a1f8-94b3996ab114`, `VALID`). Sau upload: train **`1.0.0`** xuất hiện với build **10** — binary mới trên marketing version 1.0, không reuse build trên train cũ.

Đối chiếu AC «version 1.0 / build > prior TF»: marketing version đã lên **1.0.0**; số build `10` **không** lớn hơn số `11` của train `0.1.0`, nhưng cặp `(CFBundleShortVersionString, CFBundleVersion)` là duy nhất theo quy tắc Apple đã ghi ở S4-T1 — không bắt buộc build của train mới vượt số build train cũ. Apple đã chấp nhận upload và xử lý **VALID** + Internal TestFlight **IN_BETA_TESTING**.

## Lệnh (không chứa secret)

```sh
export APP_STORE_CONNECT_API_KEY_ID=KHT3SAL2FS
export APP_STORE_CONNECT_API_ISSUER_ID=<issuer-uuid>   # local env; không commit
export APP_STORE_CONNECT_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_KHT3SAL2FS.p8"

xcrun altool --upload-app \
  --type ios \
  --file apps/mobile/.expo/d13-release/export/Vemoki.ipa \
  --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
  --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID" \
  --output-format xml
```

Log local (gitignored host path): `/tmp/d13-s4-t2-upload/altool-upload.log` — `UPLOAD SUCCEEDED`, Delivery UUID như trên. Không commit `.p8`, issuer secret blob, hay IPA.

Xác minh ASC (JWT từ API Key local; chỉ đọc):

```text
GET /v1/builds/{45c730c3-…}?include=preReleaseVersion,buildBetaDetail
→ version=10, processingState=VALID, preReleaseVersion=1.0.0,
  internalBuildState=IN_BETA_TESTING
GET /v1/apps/6823694490/appStoreVersions → 1.0.0 PREPARE_FOR_SUBMISSION (chưa submit)
```

## Giới hạn / không làm

- Không EAS / Expo Cloud Build; không upload source/signing lên Expo.
- Không Submit for Review (#332), không chọn build cho App Review, không release / Ready for Sale.
- Không gắn External TestFlight group (external = `READY_FOR_BETA_SUBMISSION` thôi).
- Không commit IPA/binary/signing material.
- Chưa physical-device smoke trên binary TF này; runtime UAT / privacy / territory vẫn gate riêng.
- Artifact này là implementer evidence — cần DoD reviewer độc lập exact-SHA trước khi Project **Hoàn thành**.

JSON biên nhận: [D13-S4-T2-UPLOAD.json](./D13-S4-T2-UPLOAD.json).
