# Setup host và adapter

- [Skills dùng chung](skills.md): checkout/symlink và nguồn chỉnh sửa.
- [Orca V3](orca-v3.md): baseline, settings đề xuất và giới hạn runtime chưa smoke test.
- [Provider recovery](provider-recovery.md): kiểm khả dụng tài khoản/provider.
- [MCP setup](../MCP-SETUP.md): CRG/LeanCTX và root worktree.
- [LeanCTX trên Cursor](leanctx-cursor.md): troubleshooting theo host.

Cursor nạp metadata trong .cursor/rules; mỗi adapter trỏ đến policy/workflow chung. Claude đọc CLAUDE.md → AGENTS.md; agent khác bắt đầu từ AGENTS.md. Không giả định các host tự hiểu alwaysApply/globs của Cursor.

Giữ hooks đang có. Hook lỗi hoặc chặn sai scope: ghi lỗi/công cụ/path, dùng đường truy cập được policy cho phép; không tắt toàn bộ hook để mở một capability. Chỉ thay cấu hình hook khi có task rõ và kiểm tác động.

## Adapter Cursor tối thiểu

- `.cursor/rules/project.mdc`: entrypoint duy nhất luôn nạp; đọc AGENTS, routing và bản đồ đọc. Context/CRG, Git/GitHub API, Project/DoD và workflow được nạp theo hành động, như các host khác.
- `.cursor/rules/orca-dispatch.mdc`: trigger coordinator cho dispatch/DAG/ready queue, thay bảy adapter cũ cùng nguồn.
- Chín adapter theo ngữ cảnh còn lại: Git chi tiết, GitHub API chi tiết, Project coordinator, lifecycle, review, worktree, UAT, provider fallback và LeanCTX troubleshooting.
- Metadata UAT globs giữ nguyên. Không cần giữ một file rule cho mỗi tên workflow cũ; các tài liệu vận hành dẫn thẳng nguồn chuẩn.

## Wiring hooks đã rà — 02/11/2026

`hooks.json` gọi sessionStart → crg-session-start, beforeSubmitPrompt → crg-before-prompt + agent-metrics-auto-join, afterFileEdit → crg-update, stop/afterAgentResponse → agent-metrics-cursor-turn. Hai entrypoint CRG gọi crg-ensure-ready. Cả sáu script đều có consumer, nên giữ nguyên hooks/config. Hai event telemetry có chủ đích dùng chung handler và dedupe generation, không phải hai file dư.

Rà source dưới CRG repo_root main-2, HEAD `023f01cbb8e556c2fc714541211de3363bbf37f3`; stats khớp HEAD và graph query file_summary cho helper CRG. Đây là kiểm wiring tĩnh; chưa mô phỏng runtime Cursor. Evidence lịch sử trong docs/reviews và archive giữ nguyên đường dẫn của thời điểm review; khi cần thực thi dùng bản đồ nguồn chuẩn hiện tại.
