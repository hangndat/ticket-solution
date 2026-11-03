# Review Portal guest list — 03/11/2026

- Reviewer: James (`reviewer-dod`, DoD + Security + UI/UX), session `d0b7a775-a2bc-4c42-b911-1e923cab41ca`; độc lập với implementer Higo `ctx_59430ee9dbd4`.
- Product SHA: `c501e5f91b8995ea78643243b676f33a46ad8443`; base `c0a61100cdf32f007857641567f38b00d7ab5703`; phạm vi đúng bốn file `apps/portal/src/guests/{guest-list-page.ts,guest-workspace.tsx,use-guest-list-page.ts}` và `apps/portal/tests/guest-workspace-query.test.ts`.
- CRG: graph worktree/HEAD trên SHA trên, 1.620 file; `file_summary` GuestWorkspace. Đối chiếu PRD M01/M02/M06, Technical Design §5.2/§6, Decision O25/O26; ranh giới list data nội bộ Portal không đổi contract/BFF.

## Kết luận

- **DoD: PASS.** Diff giữ props, query path, gating tab, cursor, thông điệp, detail và các trạng thái UI; logic parse/fetch chuyển nguyên sang module/hook. Receipt và logs mới xác nhận checks trên exact SHA.
- **Security: PASS.** Gating vẫn dựa permission truyền từ route; parse redemption vẫn từ chối `email`, `actorEmail`, `phone`, `token`, và ticket/invitation dùng interpreter cũ. Không thấy thay đổi tenant route hoặc backend authz trong diff.
- **UI/UX: PASS.** JSX chỉ đổi format, trạng thái loading/error/empty/pagination giữ nguyên theo diff. Scope là refactor state nội bộ, AC không đổi visual/journey; runtime viewport/persona probe không là gate bắt buộc cho thay đổi này.

## Checks và findings

- `git rev-parse HEAD`: khớp product SHA; `git diff --stat` xác nhận bốn file; `git diff --check base product`: PASS.
- CRG readiness/query và đọc toàn diff bốn file, caller route, test liên quan: PASS về phạm vi review. Tái dùng `.orca-metrics/review-evidence/receipt.md` và logs: Portal test 315/315 (38 suites; focused guest 12/12), typecheck, ESLint, Prettier bốn file, diff check đều exit 0 trên exact SHA; log test và output từng check đã đối chiếu.
- **F01 · evidence · should-fix · đã đóng:** coordinator bổ sung receipt/logs exact SHA; path: `apps/portal/tests/guest-workspace-query.test.ts` và màn GuestWorkspace. Lần chạy test tại review worktree trước đó thất bại do thiếu `node_modules`, không phải lỗi product; evidence từ product worktree sạch đã thay thế.

Giới hạn: review tĩnh, không truy cập dữ liệu thật hay môi trường runtime; không suy rộng thành UAT sản phẩm. Owner evidence F01: coordinator; product verdict chỉ áp dụng SHA `c501e5f91b8995ea78643243b676f33a46ad8443`.
