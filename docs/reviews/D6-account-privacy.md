# #1233 — Tài khoản, xóa tài khoản, quyền riêng tư

- Reviewer: James (`dod+sec+ux`), session `0c255ab4-8585-4b48-9822-e7dfb15aed72`, độc lập với Zico/Dispatch `ctx_43a8cc1273e3`. Fix counter **0/2**.
- Scope gốc: diff `apps/mobile/**` từ `116db2079a3dd6b78f2bd91445a2123d22d9f3f0` tới exact SHA **`fc17fdd24cce3104108a4a25f50ce7cd131211ce`** (4 file). Revalidation mới nhất trên source/build **`39b0170c13c6103b4e33e1e3cd7c61ff889a4d32`**; từ `70f7df23` chỉ đổi `app.config.ts` build 51→52. Architecture impact **Không**: không đổi route/API/session contract. CRG worktree hiện tại đã refresh và query; source/tests là căn cứ cuối.
- Chuẩn: spec `.orca-metrics/d6-account-privacy-spec.md`, PRD M02, O27–O30, handoff/README; 3 HTML gốc có SHA-256 khớp spec (`4a1f9407…`, `a5ccf73e…`, `af8d9d0a…`). Review UI native một context theo `impeccable` critique; không áp detector DOM.

| Gate | Verdict | Căn cứ |
| --- | --- | --- |
| DoD | **FAIL** | F01 mở một phần: Build52 đã chứng minh happy path xóa và guest guard sau logout, còn Back, error/retry và geometry verified 390×844 chưa đủ. |
| Security | **PASS (code scope)** | Guard verified, xác nhận riêng, idempotency/epoch và ACK đúng nghĩa; Build52 quan sát guest guard sau logout/cold restart. Không suy đã xóa mọi khóa local hoặc xóa tài khoản production. |
| UI/UX | **FAIL (acceptance)** | Privacy native 390×844 phù hợp mẫu; Build52 verified 402×874 cho initial/confirm/status và account/logout, chưa đủ mục tiêu 390×844 hay error/retry (F01). |

## Finding

- **F01 · thiếu evidence · blocker, còn mở, chặn đóng #1233:** Review gốc `fc17fdd2` chỉ có guest entry với banner khôi phục phiên, không chứng minh AC1/AC2 verified. Revalidation Build52 hiện **đã chứng minh** trên iPhone 402×874 pt: initial → confirm (trước POST) → một POST attendee → ACK `REQUESTED/UNRESOLVED` → mở lại đọc cùng status; logout → guest account → link vé cũ bị guest guard cả sau cold restart. **Còn thiếu** Back từ Account về tab nguồn, error/retry deletion trên phiên verified, kiểm scroll/CTA ở 390×844 pt và chứng cứ cleanup toàn bộ dữ liệu cục bộ theo contract. **Đóng khi** kiểm các nhánh còn thiếu trên build/SHA được pin, có ảnh/AX/journey đúng viewport; không suy production erasure hoặc storage purge từ ảnh guest.

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

Ảnh account trước logout `build52-account-logout-ready-settled.png` (`bcdc0baa…`) cho thấy email `.invalid`, Back, privacy, xóa và logout trong viewport 402×874. Chuỗi tap được người dùng thực hiện rồi coordinator chụp; reviewer xác minh cặp ảnh và fixture report, không tự thao tác USB. F01 vẫn mở như bảng verdict: không có bằng chứng Back đã bấm, nhánh lỗi/thử lại verified, hay geometry 390×844; guest guard không chứng minh kiểm kê/xóa SecureStore và không có xóa tài khoản thật.
