# Code-review-graph (ticket-solution)

Khám phá namespace CRG được cấu hình trên host; không suy tên server từ agent vendor. Mọi stats/build/query phải truyền repo_root tuyệt đối của Git worktree hiện tại.

Repo không tự build/update graph ở sessionStart, beforeSubmitPrompt hoặc afterFileEdit. Agent kiểm stats, cập nhật khi stale và thực hiện graph query liên quan trong session/worktree/HEAD hiện tại; sau sửa source phải kiểm freshness trước khi dựa vào graph. Guard global trên host đã cài kiểm quy trình này, không được dùng CRG_READY từ hook cũ làm bằng chứng. Source và tests là authoritative; không thay graph của checkout khác.

## Readiness gate (bắt buộc)

Trước **coding / explore / impact / review**:

1. `list_graph_stats_tool(repo_root=<absolute-current-worktree>)`
2. Trống/stale → `build_or_update_graph_tool` với cùng repo_root, rồi xác minh stats. Tool lỗi thật: ghi lỗi và dùng fallback có giới hạn theo policy host, không chế lỗi hoặc tắt guard.
3. Sau ready → `semantic_search_nodes_tool` / `query_graph_tool` / `get_impact_radius_tool` / `detect_changes_tool`
4. **Không** Grep/broad-scan thay graph khi MCP available

**Exempt:** docs/rules Q&A thuần; gói chỉ sửa `.cursor/rules`, `AGENTS.md`, `docs/agents`, `docs/plans` (không đụng `apps/`/`packages/`); MCP thật sự unavailable (ghi limitation → fallback `rg`/source/Read). Exempt thì **không** gọi `list_graph_stats_tool` hay rebuild.

## Tool flow

1. **Symbols first** — PascalCase (`TicketService`, `CheckInController`), không URL slug
2. `semantic_search_nodes_tool(query=Symbol)` → ambiguous thì `qualified_name`
3. `query_graph_tool` (`callees_of` / `callers_of` / `imports_of` / `tests_for`) hoặc `get_impact_radius_tool` / `get_affected_flows_tool`
4. **lean-ctx** cho routes/docs/literals CRG không index; chọn **một** mode `ctx_read` theo mục đích: `map` (cấu trúc), `signatures` (API), `lines:N-M` (đoạn đã biết), `anchored` (sửa), `full` (cần toàn bộ). Không đọc tuần tự mọi mode
5. Source wins nếu graph ≠ source; không đổi code chỉ từ graph

## Khi ưu tiên graph

| Nhu cầu      | Tool                                                      |
| ------------ | --------------------------------------------------------- |
| Explore      | `semantic_search_nodes_tool`, `query_graph_tool`          |
| Impact       | `get_impact_radius_tool`, `get_affected_flows_tool`       |
| Review       | `detect_changes_tool`, `get_review_context_tool`          |
| Architecture | `get_architecture_overview_tool`, `list_communities_tool` |

Review: `query_graph_tool` pattern `tests_for` cho coverage.
