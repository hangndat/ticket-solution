# Coordinator handoff — <Run/Epic> — <YYYY-MM-DD>

Dùng khi xoay vòng coordinator theo [dispatch → Quản lý context coordinator](../workflows/dispatch.md#quản-lý-context-coordinator). Chỉ ghi dữ liệu đã xác minh từ receipt, `worker-list`, GitHub, Git và CI; ô chưa xác minh ghi `unverified`. Không ghi secrets hay suy nghĩ nội bộ.

## Lý do xoay vòng

- Dấu hiệu + evidence:
- Authorize của user (link/trích dẫn):

## Phạm vi và quyền

- Run ID / Epic / Issue:
- Base SHA, HEAD hiện tại:
- Coordinator cũ (employee/model effective):
- Dispatch đã dừng lúc:

## Worker và mailbox

| Task ID | Dispatch ID | Employee | Trạng thái (liveness/`next`) | Branch/PR | Ghi chú |
| ------- | ----------- | -------- | ---------------------------- | --------- | ------- |

- Mail/question/delivery đang chờ:
- Cleanup có `next` chưa xử lý:

## Đối soát trạng thái

| Task/Issue | Project #3 | Git/PR | CI (SHA) | Lệch/hành động |
| ---------- | ---------- | ------ | -------- | -------------- |

## Quyết định, blocker, dependency

- Quyết định kiến trúc (ADR/DECISION-LOG):
- Blocker:
- Dependency chưa giải:
- Findings review còn mở:

## Bước tiếp theo

1.

## Chuyển quyền

- [ ] Coordinator mới đã đọc handoff
- [ ] Bind Run và xác minh mailbox/routing
- [ ] Xác minh model effective
- [ ] Gửi xác nhận nhận trách nhiệm (link/receipt)
- [ ] Coordinator cũ kết thúc lượt điều phối (không xóa chat/worktree)
