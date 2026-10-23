# Chốt audit #832 — 23/10/2026

- Baseline: `b34187919ade8ab5e07efcab59ac0284097c663d`.
- Báo cáo authority: `docs/reviews/PORTAL-AUDIT-2026-10-23.md`; hai assessment gốc và annotations được giữ để truy vết.
- A `ctx_14b111498042`: succeeded, terminal được reuse ngay cho A2; bản ghi lịch sử cuối có resource `absent/not_materialized`, `nextAction=none`. Không có worker đang chạy từ bản ghi này; không suy liveness từ nhãn retained lịch sử.
- B `ctx_b3f8f9dce776`: succeeded; `worker-release` xác nhận `closed_agent_terminal`.
- A2 `ctx_1867a7b94b16`: succeeded; `worker-release` xác nhận `closed_agent_terminal` trên cùng handle từng dùng cho A.
- Cuối Run: không active dispatch, không reclaimable; mailbox không delivery/question tồn đọng. Runtime vẫn đếm một hàng retained lịch sử của A đã được reuse, không phải giữ thêm một terminal sống.
- Ba tab audit do A/A2/coordinator tạo đã đóng theo exact page ID. Không đóng tab/session ngoài scope.
- Portal/API local: chỉ dừng PID đã xác định `90046` (pnpm next start3413), descendant `90047` và `45596` (API3410); ghi tại `cleanup-processes.json`.
- Docker: `docker compose -f /tmp/portal-audit-832-runtime/compose.yaml down` exit 0; không còn container label project `portal-audit-832`.
- Xác minh sau cleanup: port `3410`, `3413`, `8480`, `58432` đều đóng. Không prune image hoặc dọn tài nguyên task khác.
- `ui-evidence-check.sh` trên bộ UX canonical: **OK, 60 file, không trùng nội dung**. Coordinator đã mở lại Guests 390/1440 và CS1440, đối chiếu source/probe; source-only và phần chưa kiểm được ghi riêng trong report.
- Scan credential-like token trên artifact text/JSON/log: không thấy JWT/access-token/refresh-token/id-token-hint được lưu trong bộ report. Env runtime private nằm ngoài Git, được xóa sau cleanup.
- Generated `apps/portal/next-env.d.ts` thay đổi bởi Next typegen được khôi phục đúng nội dung HEAD sau khi đối chiếu diff; không còn tracked source/lockfile diff. Chỉ còn báo cáo/assets mới, chưa commit.
- Không commit/push/PR/merge/deploy/store. Worktree/branch và evidence được bảo toàn.
- Trạng thái bàn giao: **Chờ duyệt báo cáo audit**; không đóng Issue và không claim acceptance complete/pilot ready của portal.

## Chi phí / provenance

`cost-wave | run=run_f882e146c144 | n=2 fresh | cheap=0 standard=2 | pinned=2 inherit=0 | inherit%=0 | models=composer-2.5 | source=receipt`

A2 reuse cùng terminal standard của Mira, không fresh launch. Receipt reuse có `effective.model=null`; không mô tả đây là model được xác nhận lại, và không tính như fresh inherited launch. Không spawn thêm model sau đó.

## Giới hạn bổ sung khi kiểm chứng coordinator

Coordinator đăng nhập fixture staff qua OIDC form thật và lưu `menu-before.json`, `menu-dom.json`. Snapshot sider chỉ có nhóm; lượt thử mở nhóm bằng DOM click + chờ animation frame gặp Orca runtime timeout. Đây là **giới hạn xác minh**, không được biến thành kết luận portal không có menu con hoặc lỗi product chắc chắn.

Questions skipped: scope audit rõ; các kiến nghị sửa trong báo cáo tổng hợp cần review trước khi mở implementation.
