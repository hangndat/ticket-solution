# #1233 — Tài khoản, xóa tài khoản, quyền riêng tư

- Reviewer: James (`dod+sec+ux`), session `0c255ab4-8585-4b48-9822-e7dfb15aed72`, độc lập với Zico/Dispatch `ctx_43a8cc1273e3`. Fix counter **0/2**.
- Scope: diff `apps/mobile/**` từ `116db2079a3dd6b78f2bd91445a2123d22d9f3f0` tới exact SHA **`fc17fdd24cce3104108a4a25f50ce7cd131211ce`** (4 file). Architecture impact **Không**: không đổi route/API/session contract. CRG worktree này cập nhật và query review context đúng HEAD; source/tests là căn cứ cuối.
- Chuẩn: spec `.orca-metrics/d6-account-privacy-spec.md`, PRD M02, O27–O30, handoff/README; 3 HTML gốc có SHA-256 khớp spec (`4a1f9407…`, `a5ccf73e…`, `af8d9d0a…`). Review UI native một context theo `impeccable` critique; không áp detector DOM.

| Gate | Verdict | Căn cứ |
| --- | --- | --- |
| DoD | **FAIL** | F01: AC1/AC2 thiếu journey verified; chưa đủ acceptance để đóng #1233. |
| Security | **PASS (code scope)** | Guard verified trước panel; POST xác nhận riêng, khóa idempotency/epoch và retry semantics dùng flow hiện hữu; ACK không nói đã xóa. Logout vẫn gọi `logoutAndClearWalletArtifacts` trước end-session/navigation. Chưa kiểm được cleanup qua runtime verified (F01). |
| UI/UX | **FAIL (acceptance)** | Privacy native 390×844 phù hợp mẫu, nhưng không có ảnh/journey Tài khoản và 3 trạng thái Xóa ở verified (F01). |

## Finding

- **F01 · thiếu evidence · blocker, chặn đóng/merge #1233:** AC1/AC2 yêu cầu account verified, Back/scroll/logout dọn dữ liệu cục bộ và ba trạng thái xóa/CTA trên simulator. `apps/mobile/.uat-artifacts/d6/account-privacy-report.md` xác nhận SecureStore/khôi phục phiên chặn từ guest entry; chỉ có `guest-entry.png`, không có journey/ảnh verified, logout hoặc deletion. Ảnh guest SHA `9cce8eda…` hiện banner khôi phục phiên nên viewport bị chiếm phần trên; không dùng ảnh đó để suy bố cục account. **Đóng khi** fixture phiên verified hợp lệ hoạt động và Orca trên build đúng SHA ghi route/persona/390×844, ảnh + AX/journey account Back/scroll/logout và deletion initial/confirm/ACK/error-retry; xác minh cleanup/không báo xóa ngay. Không mock auth production.

## Evidence và giới hạn

- Handoff ghi `typecheck` PASS, `test` **572/572**, `lint` 0 error (8 warning ngoài diff), UI budget **5/5**, local Xcode Release Simulator PASS với `EXPO_PUBLIC_BUILD_GIT_SHA` đúng SHA. Review này không lặp suite; `git diff --check` diff mobile PASS. Unit tests chỉ chứng minh logic được test, không thay F01.
- `privacy-top.png` SHA `4d4c1268…` cho thấy ngày cập nhật, intro, mục lục, mục đầu và nút **Xong** trong màn native; `privacy-retention.png` SHA `f41ebc03…` cho thấy mục **Lưu giữ** đầy đủ sau jump. Report ghi Orca AX/tap Xong về Sự kiện. Ảnh 1170×2532 px = 390×844 pt; `ui-evidence-check.sh` trên thư mục d6: **OK, 73 file không trùng**. Chưa kiểm Back từ Account, Dynamic Type hoặc tương tác verified do F01.
- Diff giữ `privacy-policy-copy.ts`, route push/back/Xong và API deletion; `staff-account/delete` dùng chung `AccountDeleteScreen` nên thay đổi presentation cũng xuất hiện ở staff, chưa có evidence staff để kết luận regression. Deep link deletion báo `Unmatched Route` trong handoff nhưng không thuộc AC và không có quyết định công bố route đó, nên không mở finding.
