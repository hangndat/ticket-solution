# Setup host và adapter

- [Skills dùng chung](skills.md): checkout/symlink và nguồn chỉnh sửa.
- [Orca V3](orca-v3.md): baseline, settings đề xuất và giới hạn runtime chưa smoke test.
- [Provider recovery](provider-recovery.md): kiểm khả dụng tài khoản/provider.
- [MCP setup](../MCP-SETUP.md): CRG/LeanCTX và root worktree.
- [LeanCTX trên Cursor](leanctx-cursor.md): troubleshooting theo host.

Cursor nạp một adapter `.cursor/rules/project.mdc` trỏ tới AGENTS.md và bản đồ đọc chung. Claude đọc CLAUDE.md → AGENTS.md; agent khác bắt đầu từ AGENTS.md. Không dựa vào trigger/globs riêng của Cursor để áp dụng policy chung.

Giữ hooks đang có. Hook lỗi hoặc chặn sai scope: ghi lỗi/công cụ/path, dùng đường truy cập được policy cho phép; không tắt toàn bộ hook để mở một capability. Chỉ thay cấu hình hook khi có task rõ và kiểm tác động.

## Adapter Cursor tối thiểu

- `.cursor/rules/project.mdc`: entrypoint duy nhất luôn nạp; đọc AGENTS, routing và bản đồ đọc. Context/CRG, Git/GitHub API, Project/DoD và workflow được nạp theo hành động, như các host khác.
- Git, dispatch/lifecycle, review, worktree, UAT, fallback và troubleshooting được chọn theo hành động trong [bản đồ đọc](../README.md). Không giữ rule chỉ lặp lại những pointer này.

## Wiring hooks sau dọn legacy — 03/11/2026

`hooks.json` chỉ đăng ký beforeSubmitPrompt → agent-metrics-auto-join và stop/afterAgentResponse → agent-metrics-cursor-turn. Hai event cuối dùng chung handler, dedupe generation; giữ cả hai để nhận telemetry từ Cursor.

Đã bỏ bốn script CRG và các đăng ký sessionStart/afterFileEdit tương ứng. Chúng tự build/update trước khi biết scope task, lặp policy và pin namespace `code-review-graph-ticket` đã cũ. Readiness vẫn bắt buộc theo [context/CRG](../policies/context.md); guard global thuộc cấu hình host, không nằm trong repo. Máy mới cần setup guard theo policy cài đặt, không được suy rằng repo hooks tự cung cấp enforcement.

Evidence lịch sử trong docs/reviews và archive giữ đường dẫn tại thời điểm review; khi thực thi dùng bản đồ nguồn chuẩn hiện tại. Không xóa `.cursor/skills`: đó là symlink đến `.agents/skills`, không phải bản sao legacy.
