# Setup Orca V3 cho Vemoki

Đồng bộ ngày 02/11/2026 theo user yêu cầu. Architecture impact: Không — chỉ rules/hướng dẫn vận hành; không đổi business contract. Owner inline: Minh (`company/employees.json`), coordinator scope, không tạo Run/worker cho task docs.

## Baseline và nguồn

- Host hiện tại: `orca --version` → `1.4.246`.
- [Release v1.4.246](https://github.com/stablyai/orca/releases/tag/v1.4.246).
- Guide đọc từ binary: `orca skills get orchestration`, cùng `--reference references/coordinator-loop.md` và `--reference references/recovery-and-cleanup.md`. Khi host đổi version, nạp guide tương ứng trước khi điều phối; không sao chép bundled skill thành bản riêng.
- Task docs/rules được miễn CRG. `ctx_search` dùng path tuyệt đối và `include: "*.md"` (hoặc `*.mdc`) khi thư mục có cả source; `ctx_read` dùng file đã biết. Search/compose trên thư mục chỉ có tài liệu cũng được miễn. `docs/agents/tools` có JS/shell nên compose toàn `docs/agents` vẫn là scope trộn, cần graph hoặc thu hẹp vào policy/workflow. Không tắt guard để vượt scope.

## Lifecycle chuẩn

1. Coordinator kiểm routing/quota/ownership, tạo Task/deps và start mọi task ready độc lập trong caps/WIP qua `agent-workflow-run.mjs start --employee <id>`; xác minh state/requested/effective, xử lý `next`.
2. Lưu checkpoint ngắn Run/Task/Dispatch/SHA/findings/budget/bước tiếp, rồi kết thúc turn. Orca chịu trách nhiệm wake; coordinator vẫn giữ Run và trách nhiệm xử lý kết quả.
3. Khi wake, chạy đúng `check` trong wake, xử lý question/escalation/worker_done, evidence và ack theo receipt. Kiểm ready queue để fill slot. Nhiều Run phải scope `--run`; không `run-use` chỉ để xem vì thay đổi binding.
4. Worker xong tự đóng; `next` yêu cầu gì thì xử lý đúng tài nguyên owned. Thu telemetry sau settlement; nguồn thiếu ghi unknown. Không poll/long-poll hoặc tạo watch script đọc Orca mailbox.
5. Follow-up cùng context/model/employee dùng `send --to dispatch:<id> --subject "…" --body "…"`; đọc Task/Dispatch thật trong receipt để tracking và thu telemetry. Worker finished/closed được mở lại; paired-server theo placement guide. Keep-open chỉ khi user sẽ tiếp tục dùng worker chat.
6. Worker hỏi blocking dùng `ask` rồi kết thúc turn; Orca wake với câu trả lời. `worker_done` một lần mỗi assignment, không thay DoD hoặc cho phép merge/deploy.

Chi tiết và recovery: [mailbox rule](../workflows/lifecycle.md). Caps, model pin, quota reserve, persona, reviewer độc lập, exact SHA và giới hạn fix vẫn theo rules hiện hành.

## Settings đề xuất trên host

- Settings → Agents: coordinator dùng Chat để theo dõi worker cards; model/effort mặc định khớp cost-catalog. Worker coding giữ route OpenCode Go Flash/Pro; launch vẫn pin qua wrapper, UI default không thay receipt requested/effective.
- Settings → Chat → Behavior: bật Queue follow-ups; Enter xếp hàng, Cmd+Enter steer ngay khi cần đổi hướng đang chạy. Không để chỉ dẫn khẩn chỉ nằm trong queue.
- Giữ một workspace root, worktree theo ownership/conflict và trần ≤8 sống. Automation chỉ báo PR/DoD/worktree cần xử lý; không tự merge/deploy/store.

Các mục Settings trên là cấu hình đề xuất, chưa thay đổi user settings toàn máy trong lượt đồng bộ rules này. Không tạo automation hoặc cài plugin mới.

## Xác minh và giới hạn

- Đã đối chiếu lifecycle với guide của binary 1.4.246; rà các rules coordinator/worker và AGENTS, cập nhật chỗ yêu cầu giữ turn/long-poll.
- `git diff --check`: PASS; đã rà diff docs/rules và các câu chờ mailbox cũ trên đường dẫn file cụ thể. `task-list --run <id>` được xác nhận qua CLI help. Chưa phải evidence DoD exact-SHA sau commit.
- Chưa chạy smoke test wake/follow-up/auto-close bằng worker thật hoặc kiểm compatibility wrapper với receipt follow-up V3. Khi dùng Run sản phẩm tiếp theo, xác minh wake thật, IDs và telemetry; nếu lỗi giữ checkpoint/receipt để chẩn đoán, không retry hoặc khôi phục polling mù.
