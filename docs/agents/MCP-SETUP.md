# MCP cho agent Vemoki (Cursor / Claude Code)

Cấu hình **local** — không commit secrets. File `.cursor/mcp.json` **gitignored**; mỗi máy tự tạo.

## Server cần (ticket-solution)

| Server                | Namespace Cursor           | Mục đích                                                                   |
| --------------------- | -------------------------- | -------------------------------------------------------------------------- |
| **code-review-graph** | `code-review-graph-ticket` | Symbol/impact/review — graph Tree-sitter                                   |
| **lean-ctx**          | `lean-ctx`                 | `ctx_compose` / `ctx_read` / `ctx_search` khi shadow hoặc unknown location |

### code-review-graph-ticket

- Cài CLI `code-review-graph` trên PATH.
- Trong `mcp.json`, server thường truyền `--repo` trỏ checkout **`main`** (integration) của repo — graph MCP đọc DB tại repo đó.
- Hook `crg-ensure-ready.sh` vẫn build/update graph trong **worktree đang mở**; kết quả MCP có thể lệch branch worktree → **source wins**, xem `.cursor/rules/code-review-graph-ready.mdc`.

### lean-ctx

- Cấu hình theo skill `lean-ctx` / user rule; gọi qua `CallDynamicTool` namespace `lean-ctx` (không top-level `ctx_call`).
- Khi `Tool ctx_call was not found` hoặc Grep/Glob denied → Read `.cursor/rules/lean-ctx-mcp-cursor.mdc`.

## Tham chiếu

- [README.md](./README.md) — catalog role + context budget
- [context-budget.md](./context-budget.md) — đo rules alwaysApply
