# #1233 — Tài khoản, xóa tài khoản, quyền riêng tư

## James final evidence delta — exact `38f11b0bef63914c5b0428d428ab2ed1be754990`

[Matrix tích hợp 45 khung](D6-integrated390-revalidation.md) đối soát strict390 Account/Back/scroll, deletion initial→confirm→POST503 retry202 ACK, GET503 retry200 và fixture Idempotency-Key equality. Audit Keychain sửa đúng service mapping default `app:no-auth`: Staff identity1/workspace1 → 0/0 sau Logout và cold; group5→3, unclassified0, ba row còn lại là deviceId global, ownership journal control và aggregate của persona `empty` khác. Ảnh `d6-staff-logout-cold38-390.png` hash trong `manifest-keyboard.json` cho guest settled. Kết hợp Attendee aggregate/tenant cleanup trước đó và source/test, **F01 đóng trong contract current-owner cleanup; DoD/UI nhóm PASS, Security PASS code scope + runtime owner đã kiểm.** Push/queue không tồn tại trước audit nên không suy runtime purge chúng; không yêu cầu xóa mọi storage/production account ngoài AC. Fix counter 0/2 giữ nguyên vì đây là evidence review, không thêm lượt code fix.

## James checkpoint trước delta cuối (lịch sử) — exact `38f11b0bef63914c5b0428d428ab2ed1be754990`

[Review gộp 45 khung](D6-integrated390-revalidation.md) pin source/build A/B và ảnh 390×844 cho Attendee/Staff Account initial, gesture, deletion initial→confirm→POST503 retry202 ACK và GET503 retry200. Fixture xác nhận POST retry dùng cùng Idempotency-Key mà không ghi key. Diff38 thêm cleanup owner aggregate và known tenant slices khi Account thiếu walletScope; Keychain metadata trước Logout là identity/binding/tenant/aggregate 1 mỗi loại, sau Logout và cold đều 0, deviceId giữ 1. **F01 còn Mở ở phần kiểm kê cleanup ngoài known scopes; DoD/UI FAIL, Security PASS trong code scope + runtime đã kiểm.** ACK không chứng minh xóa production hoặc full storage purge; ảnh `d6-fix-logout-guest-390.png` còn OIDC prompt nên chỉ dùng cold guest/Keychain audit cho kết luận sau Logout. Fix counter 0/2 không đổi vì đây là revalidation tích hợp, không phải lượt fix F01 do reviewer giao.

## James revalidation — unchanged source/build `d6f4e645f0349ffdf0f8fcb48bd173b440639961`

Đối chiếu [USB report](../../apps/mobile/.uat-artifacts/d6/usb-verified-staff-report.md) §Build 54 additional journeys và mở `build54-deletion-idempotent-retry-ack.png`: SHA-256 **`c52f58fd23219e730a3b011f71724b327b167a38992531ab6d78c8d528b20127`** khớp, ảnh 414×912 px gồm Mirroring chrome quanh phone 402×874 pt, hiện `Đang xử lý yêu cầu` và nói tài khoản chưa bị xóa ngay. Persona verified tổng hợp `empty` đi initial→confirm→POST 503→cuộn tới retry→POST 202/REQUESTED; fixture so khóa **trong bộ nhớ** ghi `previous=False same=False` rồi `previous=True same=True`, không log giá trị khóa. Vì vậy hành trình tương đương trên build54 **chứng minh reuse Idempotency-Key trong fixture tổng hợp**; không gán phép so này ngược cho hai POST Build52. Ảnh ACK riêng không chứng minh header hoặc phép so khóa, provenance ở log/report. Cũng đã quan sát cuộn tới retry ở 402×874, không suy bố cục 390×844.

**F01 vẫn Mở; DoD/UI FAIL, Security PASS trong code scope với giới hạn runtime.** Còn strict 390×844 verified geometry/scroll/CTA và kiểm kê cleanup local đầy đủ; ACK không chứng minh production erasure. Fix counter **0/2**; evidence-only không phải code fix. Bảng/verdict Build52 dưới đây là lịch sử tại SHA đó, đặc biệt nhận xét thiếu key equality đã được bằng chứng mới giải quyết cho fixture tổng hợp.

- Reviewer: James (`dod+sec+ux`), session `0c255ab4-8585-4b48-9822-e7dfb15aed72`, độc lập với Zico/Dispatch `ctx_43a8cc1273e3`. Fix counter **0/2**.
- Scope gốc: diff `apps/mobile/**` từ `116db2079a3dd6b78f2bd91445a2123d22d9f3f0` tới exact SHA **`fc17fdd24cce3104108a4a25f50ce7cd131211ce`** (4 file). Revalidation mới nhất trên source/build **`39b0170c13c6103b4e33e1e3cd7c61ff889a4d32`**; từ `70f7df23` chỉ đổi `app.config.ts` build 51→52. Architecture impact **Không**: không đổi route/API/session contract. CRG worktree hiện tại đã refresh và query; source/tests là căn cứ cuối.
- Chuẩn: spec `.orca-metrics/d6-account-privacy-spec.md`, PRD M02, O27–O30, handoff/README; 3 HTML gốc có SHA-256 khớp spec (`4a1f9407…`, `a5ccf73e…`, `af8d9d0a…`). Review UI native một context theo `impeccable` critique; không áp detector DOM.

| Gate | Verdict | Căn cứ |
| --- | --- | --- |
| DoD | **FAIL** | F01 mở một phần: Build52 đã chứng minh Back Account→Wallet và POST 503→retry→ACK thêm vào các journey trước; còn geometry verified 390×844, kiểm scroll/CTA tại khổ đó, cleanup đầy đủ và bằng chứng reuse Idempotency-Key. |
| Security | **PASS (code scope, giới hạn runtime)** | Guard verified, xác nhận riêng, idempotency/epoch và ACK đúng nghĩa; Build52 quan sát guest guard sau logout và hai POST 503→202. Fixture log không chứng minh hai POST dùng cùng Idempotency-Key; không suy đã xóa mọi khóa local hoặc xóa tài khoản production. |
| UI/UX | **FAIL (acceptance)** | Privacy native 390×844 phù hợp mẫu; Build52 verified 402×874 cho initial/confirm/status, Back cả hai tầng, GET và POST retry; chưa đủ geometry/scroll 390×844 (F01). |

## Finding

- **F01 · thiếu evidence · blocker, còn mở, chặn đóng #1233:** Review gốc `fc17fdd2` chỉ có guest entry với banner khôi phục phiên, không chứng minh AC1/AC2 verified. Revalidation Build52 trên iPhone 402×874 pt **đã chứng minh** initial → confirm → POST → ACK `REQUESTED/UNRESOLVED` → mở lại status; Back deletion→Account và Account→Wallet nguồn; GET current 503→retry GET 200/null→idle không POST; POST 503→retry POST 202→ACK; logout→guest guard cho link vé cũ cả sau cold restart. **Còn thiếu** chứng cứ hai POST dùng cùng Idempotency-Key, scroll/CTA verified ở 390×844 pt và cleanup toàn bộ dữ liệu cục bộ theo contract. **Đóng khi** kiểm các phần còn thiếu trên build/SHA được pin, có ảnh/AX/journey đúng viewport; không suy production erasure hoặc storage purge từ ảnh guest.

## Evidence và giới hạn

- Handoff ghi `typecheck` PASS, `test` **572/572**, `lint` 0 error (8 warning ngoài diff), UI budget **5/5**, local Xcode Release Simulator PASS với `EXPO_PUBLIC_BUILD_GIT_SHA` đúng SHA. Review này không lặp suite; `git diff --check` diff mobile PASS. Unit tests chỉ chứng minh logic được test, không thay F01.
- `privacy-top.png` SHA `4d4c1268…` cho thấy ngày cập nhật, intro, mục lục, mục đầu và nút **Xong** trong màn native; `privacy-retention.png` SHA `f41ebc03…` cho thấy mục **Lưu giữ** đầy đủ sau jump. Report ghi Orca AX/tap Xong về Sự kiện. Ảnh 1170×2532 px = 390×844 pt; `ui-evidence-check.sh` ở review gốc: **OK, 73 file không trùng**. Khi đó chưa kiểm Back từ Account, Dynamic Type hoặc tương tác verified do F01.
- Diff giữ `privacy-policy-copy.ts`, route push/back/Xong và API deletion; `staff-account/delete` dùng chung `AccountDeleteScreen` nên thay đổi presentation cũng xuất hiện ở staff, chưa có evidence staff để kết luận regression. Deep link deletion báo `Unmatched Route` trong handoff nhưng không thuộc AC và không có quyết định công bố route đó, nên không mở finding.

**Coordinator evidence mới, chờ reviewer — build 50 / `b5a9f0ee`:** USB iPhone 16 Pro, fixture verified tổng hợp, ảnh `usb-other50-account.png` và `usb-staff50-account.png` cho thấy tài khoản Attendee/Staff, hàng privacy/xóa và logout. Hash/provenance trong `apps/mobile/.uat-artifacts/d6/usb-verified-staff-report.md`. Chưa có tap Back/logout hoặc ba trạng thái xác nhận xóa; F01 và verdict DoD/UI vẫn mở.

**Coordinator USB build 51 / `70f7df23`, chưa review độc lập:** verified Attendee mở route xóa trên iPhone 402×874 pt. Fixture GET trạng thái trả `null` đúng contract; ảnh `usb-separate/build51-delete-idle-settled.png` SHA-256 `8aa6aaa05dd2bc18fed8ac6877306617538ed46275ffa36fa7a26ac917096c16` hiện trạng thái ban đầu và CTA yêu cầu xóa. Ảnh 404 trước khi bổ sung fixture chỉ chứng minh lỗi tải. Không có tap xác nhận, POST, ACK, logout hay kiểm cleanup; **F01/DoD/UI vẫn GAP**. Provenance trong report USB ignored.

**Coordinator USB build 52 / `39b0170c`, checkpoint trước tương tác:** sau khi IP LAN đổi, bản UAT riêng được ký/cài lại với API fixture hiện tại; ảnh `usb-separate/build52-delete-ready.png` SHA-256 `8aedd763ea048b3e515a4b9bff4bbb2db4c7c95705e72d7aadf06afccdffb172` hiện verified Attendee và CTA ở trạng thái ban đầu. Fixture tổng hợp trả 202 `REQUESTED` cho POST xác nhận có Idempotency-Key (probe trên persona Staff); lúc đó chưa có POST của Attendee. Người dùng được đề nghị chạm CTA đầu tiên để chụp bước xác nhận. **Checkpoint này chưa chứng minh ACK hay cleanup; xem revalidation bên dưới.**

## James revalidation — Build52 / exact `39b0170c13c6103b4e33e1e3cd7c61ff889a4d32`

- `git diff 70f7df23..39b0170c -- apps/mobile` chỉ đổi `app.config.ts` build number 51→52; `git diff --check` PASS. Report USB ghi signed Release Team `BLUA62D52G`, bundle riêng `com.hangndat.ticket.uat`, bake API `192.168.86.5:43194`, Build52 trên Dexter iPhone 16 Pro. Fixture ignored `usb-fixture.py:96-127` yêu cầu `confirmation:true` + `Idempotency-Key`, trả 202 `REQUESTED/UNRESOLVED`, GET current trả status theo persona; log report ghi một POST attendee rồi GET 200. Không lặp mobile suite trên Build52; typecheck PASS theo handoff, 593 tests trước đó trên Build51 có source hành vi tương đồng.
- Bảy ảnh `usb-separate/build52-*.png` bên dưới đều 1206×2622 px = **402×874 pt**, hash SHA-256 khớp handoff và đã mở xem. `ui-evidence-check.sh usb-separate` báo duplicate ở **hai ảnh Build51** (`build51-delete-ready*.png`), không phải bảy ảnh Build52.

| State Build52 | SHA-256 | Reviewer thấy |
| --- | --- | --- |
| `build52-delete-ready.png` | `8aedd763…` | Giải thích hệ quả, 3 bước, CTA đỏ. |
| `build52-delete-confirm.png` | `0aa626d3…` | Xác nhận riêng, CTA “Gửi yêu cầu (không xóa ngay)”; handoff ghi chưa có POST tại đây. |
| `build52-delete-ack.png` | `0e3dde8a…` | “Đang xử lý yêu cầu”, nêu rõ tài khoản không bị xóa ngay. |
| `build52-delete-reopen.png` | `666659bc…` | Status vẫn hiện sau mở lại; có Back trong header. |
| `build52-logout-after-tap.png` | `8a46759d…` | Account guest với Đăng nhập, không còn email verified. |
| `build52-logout-ticket-guard-settled.png` | `01472468…` | Link vé cũ mở guest guard, không hiện vé/QR/mã tay. |
| `build52-logout-cold-ticket.png` | `3740e80a…` | Guest guard còn sau terminate/cold relaunch. |

Ảnh account trước logout `build52-account-logout-ready-settled.png` (`bcdc0baa…`) cho thấy email `.invalid`, Back, privacy, xóa và logout trong viewport 402×874. Chuỗi tap được người dùng thực hiện rồi coordinator chụp; reviewer xác minh cặp ảnh và fixture report, không tự thao tác USB. Guest guard không chứng minh kiểm kê/xóa SecureStore và không có xóa tài khoản thật.

### James evidence revalidation — Back và GET retry, cùng Build52

- Bốn ảnh 1206×2622 px, SHA-256 khớp `usb-verified-staff-report.md` và đã mở xem: `build52-delete-back-ready.png` `546f99a7…` (status, Back native) → user tap → `build52-back-to-account.png` `d2e418d0…` (Account verified, privacy/xóa/logout). Điều này chứng minh Back của **màn deletion** về Account; chưa chứng minh Back của Account về tab nguồn.
- Fixture khởi động lại nên trạng thái `REQUESTED` trong bộ nhớ được reset. One-shot GET current trả 503 rồi tự hết marker; `build52-delete-error.png` `d98e0fda…` hiện “Không tải được trạng thái” và CTA “Thử tải lại trạng thái”. Sau user tap, report log ghi **GET mới, không POST**; `build52-delete-retry-recovered.png` `12c061bd…` hiện idle/CTA đỏ sau GET 200/null. Đây là recovery của **GET status**, không phải failed POST/resubmit hoặc trạng thái ACK được giữ qua restart.
- Verdict F01/DoD/UI vẫn FAIL cho các nhánh còn thiếu ở trên; Security giữ PASS trong code scope. Fix counter **0/2**; không đổi source, không tạo finding mới.

### James evidence revalidation — Account Back và POST retry, Build52

- Exact installed source/build `39b0170c13c6103b4e33e1e3cd7c61ff889a4d32`; HEAD docs merge `547fe23b` có diff `apps/mobile/**` rỗng so với build. Năm ảnh dưới đây đều 1206×2622 px = **402×874 pt**, hash SHA-256 khớp `usb-verified-staff-report.md` và đã mở xem.
- `build52-account-back-wallet-settled.png` `ee0c9106…` (Wallet và vé synthetic `44444444`) → user tap icon tài khoản → `build52-account-from-wallet.png` `dc67c074…` (Account verified, Back) → user tap Back → `build52-account-back-to-wallet.png` `7caa515d…` (cùng Wallet/vé, tab nguồn). Back từ Account đã có evidence cho đường vào Wallet thực tế.
- Fixture one-shot trả 503 cho POST đầu; `build52-post503-retry-check.png` `7f3088ae…` cho thấy “Không gửi được yêu cầu”, “Thử lại gửi yêu cầu” và “Đóng” cùng trong viewport. Sau user tap retry, report log ghi POST attendee thứ hai và 202 `REQUESTED`; `build52-post503-retry-ack.png` `8b4326a7…` cho thấy “Đang xử lý yêu cầu”, không nói tài khoản đã xóa. Đây là recovery synthetic POST 503→202; log không ghi header/key nên **chưa chứng minh reuse Idempotency-Key** hoặc chống trùng trên backend thật.
- F01 vẫn mở cho geometry/scroll 390×844 và kiểm cleanup cục bộ theo contract; DoD/UI chưa PASS toàn #1233. Security chỉ PASS code scope với giới hạn trên, không có production erasure. Fix counter **0/2**; không sửa source hay fixture.
