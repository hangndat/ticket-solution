# Áp dụng Electric Violet — theo dõi local

## Trạng thái hiện hành sau review fix 2/2

Logo/token đã áp vào nguồn dùng chung, Web và iOS. James xác minh F01 đã đóng trên dirty local: màu sự kiện hợp lệ và fallback dùng đúng production presentation path; platform chrome giữ màu Vemoki. F02 vẫn chặn nghiệm thu tổng thể vì iOS chưa có signed-in ticket/QR, auth failure stage chưa biết. F03 là giới hạn capture compositor, không chặn riêng; DOM/geometry hỗ trợ các claim màu và overflow đã kiểm. Không có commit/deploy/CI exact-commit hoặc pilot PASS. Đề xuất diagnostic local cần quyết định mở rộng scope tại `F02-DIAGNOSTIC-HANDOFF.md`.

Coordinator đã chạy `pnpm --filter @ticket/web build` sau fix2: exit 0 trên source local đã review. Cảnh báo tracing filesystem ở marketing lead/idempotency vẫn có như lần build trước; không sửa ngoài scope. Đây production-mode build local, không phải deploy hoặc CI exact-commit. Tất cả worker hiện đã bàn giao và thu settlement; không còn worker chạy. F01 implementation dùng 2/2 lượt sửa; giữ F02 để chờ quyết định diagnostic, không lặp đăng nhập khi chưa có marker mới.

User chốt “tôi thấy ổn rồi, apply đi” ngày 04/11/2026. Mẫu chuẩn là master sạch trong `logo/`, không dùng `archive/trace-svg/`. Scope: nguồn token/asset dùng chung → consumer/marketing Web và iOS. Portal giữ Ant Design theo O26. Không triển khai production/store/publish Git trong đợt local này.

## Quyết định triển khai

Theo bổ sung Electric Violet trong `docs/DECISION-LOG.md`: ink `#141020`, paper `#FFFFFF`, signal/primary `#6C35FF`, focus `#5B22F0`, line `#D7D6E0`, muted `#5C5774`. Giữ màu và nghĩa destructive/admit/unknown, font Sora/Be Vietnam Pro, spacing/radius. Giữ token SoT và generator hiện có; tenant/event branding theo published data và các luồng O27/O28 không đổi.

## Task trong Run `run_97d2d791c150`

| Task | Owner / scope | Trạng thái ban đầu | Dependency / đầu ra |
| --- | --- | --- | --- |
| `task_8c9c7d36d77e` | Minh · nền tảng, `brand/vemoki` và generated token outputs | Worker failed; coordinator đã thực hiện trực tiếp, checks PASS | `apply-foundation-report.md`, asset canonical và tokens mới |
| `task_9617a3479423` | Linh · Web, `apps/web` | Worker succeeded `ctx_612a90733d44`; checks và ảnh runtime đã bàn giao, chờ review độc lập | Report tại `apps/web/.uat-artifacts/electric-violet/REPORT.md` |
| `task_ec3b15a3ab37` | Zico · iOS, `apps/mobile` | Worker succeeded `ctx_530617e8019c`; simulator build/UAT guest bàn giao, chờ review độc lập | Report tại `apps/mobile/.uat-artifacts/electric-violet/REPORT.md` |
| `task_cb0ead952f48` | James · dod+ux, review độc lập các thay đổi local | Review hoàn tất; acceptance FAIL vì F01–F02 thiếu evidence, F03 capture không chặn riêng | `APPLY-REVIEW.md`; không thay exact-commit DoD |
| `task_667b8f449c0f` | Linh · Web, bổ sung evidence F01/F03 | Evidence batch 1/2 xong: event, real local login và owner QR đã kiểm; F01 branding tenant còn mở | Web REPORT; F03 dùng DOM evidence vì compositor strip |
| `task_b588730c0e5b` | Zico · iOS, bổ sung evidence F02 | Failed: event branding đã thấy, sign-in quay guest; ticket/QR vẫn chưa kiểm | Mobile REPORT; không đổi source/auth |
| `task_907bdb330dfe` | Zico · iOS, chẩn đoán F02 | Diagnosis xong: static callback hợp lệ, actual failure stage unknown; F02 vẫn mở | Mobile REPORT; không sửa auth, không UAT lặp khi chưa có căn cứ mới |
| `task_342857c51c61` | James · dod+ux, revalidate evidence F01–F03 | Đã reopen `ctx_73453cc749e8`; phân loại contract/baseline màu tenant và bằng chứng bổ sung | `APPLY-REVIEW.md`, source snapshot không đổi |
| `task_dca8fd97c0dc` | Linh · Web, fix F01 theo M04 | Implementation fix 1/2 xong: runtime hai event đúng màu, platform giữ violet; chờ review | Web REPORT; không đổi platform chrome/hero/auth |
| `task_faf46571a8c1` | James · dod+ux, verify F01 | Review xong: valid colors/scoping đạt, invalid published color ghi đè fallback nên F01 còn mở | `APPLY-REVIEW.md`; F02 vẫn mở |
| `task_c633a909a0de` | Linh · Web, F01 invalid-color fallback | Fix 2/2 xong; production presentation path dùng parsed fallback, checks PASS | Web REPORT; invalid case mới kiểm unit, chưa live browser |
| `task_13c8a9ca30e3` | James · dod+ux, verify F01 fix2 | Review hoàn tất: F01 đã xác minh đóng local, F02 vẫn chặn nghiệm thu tổng thể | `APPLY-REVIEW.md`; F03 không chặn riêng |

F02 vẫn chặn acceptance signed-in iOS; đề xuất mở rộng diagnostic auth local tại `F02-DIAGNOSTIC-HANDOFF.md`, chưa triển khai. Không lặp UAT khi chưa có marker/giả thuyết mới.

Task consumers phụ thuộc file/token thật, không phụ thuộc nhau về nghiệp vụ. OpenCode Go đã báo giới hạn tuần, nên áp fallback Codex Luna theo policy, không bật Extra Usage hoặc free model. Codex có cap một worker nên khi dùng fallback, Web/iOS sẽ được triển khai lần lượt sau nguồn nền tảng; không tự tăng cap. Trước khi nhận hoàn tất phải có checks và evidence runtime theo workflow của từng slice. Reviewer khi cần làm độc lập với implementer, kiểm scope/diff cụ thể. Không gọi handoff design hay launch receipt là code/acceptance complete.

## Trạng thái kiểm

Foundation đã được coordinator áp trực tiếp và xác minh: nguồn SVG sạch khớp byte bộ duyệt, PNG alpha/dimensions/padding, icon RGB opaque, generator idempotent và UI typecheck PASS. Xem `apply-foundation-report.md`. Attempt OpenCode dừng do quota; Luna failed trước source edits; Terra cũng failed sau graph query, không thực hiện source. Giữ failed outcome của các dispatch, không gọi chúng thành công. Web đã báo implementation xong: test/lint/typecheck/build/diff-check PASS và có Orca captures desktop/mobile. API local không có event data và auth chưa cấu hình nên runtime mới kiểm empty/error/sign-in-required; tenant branding chưa có runtime fixture. iOS đã bàn giao lint/typecheck/tests/export và Xcode simulator Debug/Release builds PASS, cùng Orca UAT guest catalog/redeem; ticket/QR đăng nhập chưa kiểm. James đang review độc lập bản local; chưa nghiệm thu toàn bộ hoặc kiểm authenticated flow. Base SHA hiện tại `51bd5a5b77ba6fdeeac011a0982dd6770f7bdac5`; source local chưa commit. Các dirty docs agent của phiên khác được giữ nguyên. Checkpoint/receipt chi tiết trong `.orca-metrics/electric-violet/`, không có credentials trong báo cáo.
