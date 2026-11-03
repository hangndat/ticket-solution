# Routing và trách nhiệm agent

Mọi agent đọc policy này. [AGENTS.md](../../../AGENTS.md) quy định ownership, quyền và luồng đọc.

- Chọn role theo [catalog vai trò](../roles/README.md), nhân viên cố định theo [company](../../../company/README.md); không đổi employee khi phục hồi hoặc đổi model.
- [Cost catalog](../cost-catalog.md) là nguồn duy nhất cho tier, pin agent/model/effort và quota reserve. Coding primary dùng bảng OpenCode Go trong catalog; coordinator Codex và reviewer độc lập theo route được giao. Không inherit UI hoặc tự chọn model ngoài catalog.
- Lỗi/limit provider theo [fallback](provider-fallback.md); không chép lại chuỗi fallback vào task spec hoặc workflow khác.
- Chỉ coordinator gốc dispatch. Worker/planner/reviewer không spawn con, không tự tạo worktree hoặc sửa slice khác để vượt check.
- Worker đọc role, task spec, policy áp dụng và evidence cần thiết; không nạp tài liệu coordinator không liên quan. Theo preamble thật: thiếu đầu vào thì `ask` rồi nhường turn; hoàn tất gửi `worker_done` một lần mỗi assignment. Follow-up dùng IDs thật từ receipt.
- Nhánh A/B và quyền đóng Task theo [Project/DoD](project.md). Reviewer nhánh B khác implementer; review/fix theo [review](../workflows/review.md), không reset findings hoặc lượt fix khi đổi session/provider.
- Docs/rules thuần được miễn CRG; source exploration/implementation/review theo [context](context.md). Nạp đủ nội dung để xác minh; không đọc lại tài liệu chưa đổi nếu context còn.
- Coordinator thực thi [dispatch](../workflows/dispatch.md) và [lifecycle](../workflows/lifecycle.md). `worker_done`, CI xanh hoặc launch receipt không tự chứng minh acceptance/pilot ready.
