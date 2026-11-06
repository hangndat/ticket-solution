# #1233 Nhận vé mời — review gộp DoD + Security + UI

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
