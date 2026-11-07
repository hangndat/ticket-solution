# #1233 Nhận vé mời — review gộp DoD + Security + UI

## James final evidence delta — exact `38f11b0bef63914c5b0428d428ab2ed1be754990`

[Matrix tích hợp 45 khung](D6-integrated390-revalidation.md) pin ảnh/AX 390×844 của keyboard thật ở ô tên/phone, drag dismiss rồi consent/CTA; `actions-38f11b0.jsonl` ghi tap submit/refresh và `d6-claim-pending-refreshed38-390.png` + AX giữ pending. Cùng evidence base d6f guest→verified giữ intent, required form/pending/issued detail và real signed ticket, **F02 đóng; DoD/UI nhóm PASS, Security PASS code scope và guard đã quan sát.** Hai ảnh pending cũ trùng bytes nên không dùng riêng chúng cho refresh; không gọi synthetic detail thiếu credential là real signed QR. Fix counter 1/2 giữ nguyên.

## James checkpoint trước delta cuối (lịch sử) — exact `38f11b0bef63914c5b0428d428ab2ed1be754990`

[Review gộp 45 khung](D6-integrated390-revalidation.md) tái dùng đúng phạm vi base d6f không bị diff38 chạm: real OIDC guest→verified giữ claim intent, real issued ticket/QR; synthetic form hai trường/terms, pending202→refresh và issued201→detail tại 390×844. `claim-issued-real.png` đã chuyển Staff nên không tính làm issued screen; hai ảnh pending/refresh trùng bytes, journey/log mới phân biệt thao tác. **F02 còn Mở vì software keyboard claim 390 chưa xuất hiện; DoD/UI FAIL, Security PASS code scope với guard đã quan sát.** F01 đã đóng và fix counter 1/2 giữ nguyên; không suy signed real QR từ detail synthetic thiếu credential.

## Revalidation USB build 54 — exact `d6f4e645f0349ffdf0f8fcb48bd173b440639961`

James (`dod+sec+ux`, độc lập Zico và coordinator UAT) kiểm lại `116db207` → HEAD trên `claim.tsx`, claim client/presentation/intent, owner-status, ticket detail và route guard. CRG ticket ready đúng worktree/HEAD, query `file_summary`/`imports_of`/`tests_for`; diff claim/client/intent không đổi, ticket detail chỉ đổi CTA lỗi/missing sang root `/wallet-access`, `git diff --check` PASS. Quyết định O02, O28–O30 và [D6 iOS wireframe](../design/mobile-approved-wireframes-2026-11-05/README.md) áp dụng; Architecture impact **Không**. Evidence runtime là [USB report](../../apps/mobile/.uat-artifacts/d6/usb-verified-staff-report.md) §build 54, app `com.hangndat.ticket.uat` ký local Team `BLUA62D52G`, synthetic API, iPhone **402×874 pt**, source/build SHA đúng HEAD; coordinator quan sát qua Mirroring, ảnh lượt này **không hash-pinned**. Không chạy lại suite/build; report ghi typecheck, mobile test, lint, diff check, prebuild/Pods/Xcode Release đều exit 0 trên SHA này.

| Gate | Verdict exact SHA | Căn cứ và giới hạn |
| --- | --- | --- |
| DoD / AC1–AC3 | **FAIL (acceptance còn thiếu)** | F01 đóng; verified form, POST→pending→owner refresh, issued→**vé mới** `…cdcd`, expired và wrong-email đã quan sát. Guest→verified return, claim keyboard/footer và hình học 390×844 vẫn chưa có runtime. CI trên integrated commit/merge thuộc coordinator. |
| Security | **PASS theo code scope; runtime guard còn GAP** | `claim.tsx:241–315` yêu cầu epoch/credential, giữ idempotency key khi unknown, clear intent sau final; `claim-intent.ts` fence owner/generation, token ở memory và không log. Runtime wrong-email `other` bị 403/denied; pending không tạo vé. Chưa chứng minh guest→verified, cross-account replay hoặc backend authz tổng quát từ fixture. |
| UI/UX | **FAIL (evidence thiếu)** | Copy VI pending/issued/expired/wrong-email và điều hướng issued→detail trên 402×874 được quan sát; không có ảnh pin/AX cho lượt này, claim keyboard/footer và 390×844 còn mở. O33 waive a11y UAT, không ghi a11y PASS. |

**F01 — Đã xác minh/đóng @ `d6f4e645` (iOS).** Source `claim-presentation.ts` ưu tiên pending/issued/denied dù token đã clear; build 54 cho pending sau POST và `Kiểm tra lại trạng thái` vẫn không hiển thị vé, rồi issued mở detail vé mới sau khi fixture thêm ticket vào `/v1/me/tickets`. Lượt đầu CTA chỉ về Wallet vì fixture 201 thiếu ticket trong wallet; đó là gap response-shape fixture đã sửa và thử lại, không quy lỗi sản phẩm.

**F02 — Mở, blocker acceptance @ `d6f4e645` (owner iOS + coordinator UAT).** Chụp/kiểm journey guest→verified giữ đúng lời mời, claim keyboard/footer safe area khi nhập form, và 390×844 VI cho các trạng thái bắt buộc; pin build/route/persona/state/ảnh hoặc AX đủ để reviewer xác minh. Mirroring 402×874 không thay bằng chứng strict 390×844. Hai correction fixture trong report (issued wallet và `ApiError` của invalid redeem) là giới hạn môi trường, không tăng lượt sửa code. Bộ đếm fix **1/2**, không tự mở lượt fix mới chỉ để lấy evidence; không kết luận pilot ready.

- Reviewer: James, Orca `e9ff5181-279f-4d25-b064-750ea9310f6e`, độc lập Zico/Dispatch `ctx_29700255b9e7`; revalidation fix **1/2**.
- Worktree/HEAD: `/Users/admin/SideProject/ticket-solution/ios-approved-ui-20261105` @ `116db2079a3dd6b78f2bd91445a2123d22d9f3f0`; revalidate diff từ `ab968dbb077976d233dd37a15670a83868de395d` (2 file mobile); base đầu `1528782715a89983c62263e584539d1a2b4b2a2d`. Không sửa source.
- CRG stats + `detect_changes_tool` trên worktree/HEAD này: ready, risk 0.38, 0 test gap theo graph; source/tests quyết định kết luận. Architecture impact **Không**: contract claim giữ nguyên. Decision: O28–O30 về Events/Ví/chi tiết vé; O33 waive a11y UAT, không ghi a11y PASS.

| Gate | Verdict | Căn cứ |
| --- | --- | --- |
| DoD / AC1–AC3 | **FAIL** | F01 sửa đúng transition trong code/test, chờ runtime xác minh; verified, pending/issued, keyboard/footer và guest→verified vẫn thiếu evidence F02. |
| Security | **PASS (static diff)** | Diff chỉ đổi presentation/test; token vẫn clear sau quyết định cuối, pending giữ request ID, không đổi claim API/idempotency/epoch guard. Runtime auth/session chưa được xác minh (F02). |
| UI/UX | **FAIL** | Guest/invalid guest CTA và ảnh 390×844 pt đã kiểm ở SHA trước; pending code đã sửa nhưng chưa có ảnh/AX verified, pending/issued, keyboard/footer trên HEAD này (F02). HTML pin `6fe321967104be69cd4a38b4472e59054f258e6d36a84f9e2eeb1ece59f99e32` và README CTA delta giữ nguyên. |

## Findings

- **F01 — blocker correctness/UI; đã sửa chờ runtime xác minh @ `116db207` (owner iOS).** `claim-presentation.ts:18–36` ưu tiên denied invalid code, rồi pending/issued/denied trước `!hasInvite`; `claim.tsx:300–308` vẫn xoá token ở final decision. Test `claim-presentation.test.ts:76–145` dùng intent thật, clear rồi kiểm pending/issued/denied và request ID cho refresh; test account switch ở dòng 148+. Source/test giải quyết transition báo ở `ab968dbb`; **đóng hoàn toàn** khi F02 có Orca pending/issued trên exact SHA, không hiện invalid sai và refresh hoạt động.
- **F02 — blocker thiếu evidence/môi trường, chặn nghiệm thu, Mở @ `116db207` (owner iOS/coordinator).** Report `.uat-artifacts/d6/claim-invitation-report.md` vẫn chỉ có guest/invalid guest; personal Development identity đã xác minh `OU=BLUA62D52G`, nhưng build simulator vẫn ad hoc/entitlement rỗng, ký tay app không launch được (`NSPOSIXErrorDomain 163`), ép Xcode signing fail 65 trên Pods. 572 tests, typecheck, lint, UI budget và local build PASS theo report không thay runtime AC1–AC3. **Đóng:** local signing/fixture auth an toàn, synthetic Orca ảnh/AX/hash guest→verified, verified form, pending/issued, invalid verified và keyboard/footer 390 pt. Không dùng identity team khác, không đổi production auth.

Revalidation checks: `git diff --check` PASS; worker report trên exact HEAD ghi mobile typecheck PASS, 572 tests PASS, lint PASS (8 cảnh báo cũ), UI budget PASS. Ảnh guest/invalid guest trước: SHA256 `b77dad4bd7d1eab41a5d0d13f062ed4d6337c49b5f495ee390585f37f4ce9224` / `b39698b060cd6d724c7a812ca0d838c259653ae5dd781ac93deafd3dc7ad8f5a`; không có UAT mới theo dispatch. Không merge/deploy/store.

**Coordinator USB build 51 / `70f7df23`, chưa review độc lập:** iPhone 16 Pro 402×874 pt, verified Attendee synthetic và token claim tạo tạm không in/log. Ảnh `usb-separate/build51-claim-verified.png` SHA-256 `d9c5199dfad940b9324e7e343fa5f1f826f447075dba922a426d3578e9096967` cho thấy form/CTA verified ban đầu. Không tap submit, không có pending/issued, keyboard/footer hoặc guest→verified; F01/F02 và DoD/UI tổng vẫn **GAP**. Provenance trong report USB ignored.
