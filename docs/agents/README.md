# Hướng dẫn agent Vemoki

Bắt đầu từ [AGENTS.md](../../AGENTS.md). Đây là bản đồ đọc chung cho Cursor, Codex, Claude và OpenCode.

## Đọc theo công việc

- Mọi task: [routing/trách nhiệm](policies/routing.md), [role](roles/README.md), task spec được giao.
- Source exploration/code/review: [context và CRG](policies/context.md); docs/rules thuần được miễn CRG.
- Git/PR/merge: [Git](policies/git.md), [chi tiết](policies/git-details.md), [GitHub API](policies/github-api.md).
- Tracking/DoD: [Project](policies/project.md); coordinator thêm [WIP/milestone](policies/project-coordinator.md).
- Giao việc: [dispatch](workflows/dispatch.md), [lifecycle/recovery](workflows/lifecycle.md), [cost catalog](cost-catalog.md), [company](../../company/README.md).
- Review/fix: [findings và revalidation](workflows/review.md). Worktree: [metadata và cleanup](workflows/worktree.md).
- UI: [UI workflow](ui-workflow.md); UAT: [browser/emulator](workflows/uat.md).
- Host mới/nâng cấp: [setup](setup/README.md). Telemetry: [evidence](workflow-evidence-telemetry.md).

## Nguồn sở hữu

- `policies/`: quyền, routing, DoD, context, fallback; `workflows/`: các bước thực thi.
- `setup/`: host, MCP, skills; `archive/`: lịch sử, không dùng để chọn route.
- `roles/`, `templates/`: chuyên môn và mẫu giao việc; `upstream/`: tham khảo có provenance.
- `cost-catalog.md`: pin/tier/quota. `company/employees.json`: danh tính/văn phong; default route hồ sơ không vượt catalog.
- `.agents/skills/`: skills dự án được version control; `.cursor/skills` là symlink, xem [skills](setup/skills.md).

Adapter host trỏ đến nguồn chuẩn; các pointer orca-* cũ đã được loại bỏ. Chỉnh nội dung ở nguồn đích. [Catalog trước khi tổ chức lại](archive/agent-catalog-2026-11-02.md) chỉ là lịch sử.
