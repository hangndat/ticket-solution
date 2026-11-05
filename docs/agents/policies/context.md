# Context và graph (ticket-solution)

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

## GitNexus trong workflow

GitNexus bổ sung khám phá luồng nghiệp vụ và tác động xuyên module khi CRG chưa giải đáp đủ câu hỏi của Task. Gate CRG ở trên vẫn áp dụng; không thêm gate GitNexus, hook tự build hoặc lượt review riêng. Task docs/rules thuần bỏ qua cả hai graph.

| Công cụ | Trách nhiệm |
| --- | --- |
| CRG | Readiness bắt buộc; quan hệ symbol, tests và diff theo scope |
| GitNexus | Tìm từ mô tả nghiệp vụ, khám phá execution flow và vùng ảnh hưởng xuyên module |
| LeanCTX | Chọn và đọc source/docs, search phần graph chưa giải đáp, lấy context để sửa |
| Tests/UAT | Xác minh hành vi và acceptance theo Task |

Sau readiness + query CRG, chỉ dùng GitNexus nếu còn câu hỏi cụ thể: chưa biết luồng bắt đầu ở đâu, thay đổi chạm nhiều module, hoặc cần lần caller/dependency ngoài scope đã biết. Dùng `query` tìm luồng từ mô tả nghiệp vụ, `context` kiểm symbol và quan hệ, `impact` xác định vùng cần đọc/kiểm thêm. Không query cùng câu hỏi trên cả hai graph mặc định; Task hẹp đã đủ context có thể bỏ qua GitNexus.

Trước khi dựa vào kết quả, xác minh index trỏ đúng đường dẫn tuyệt đối của worktree và còn mới so với HEAD lẫn working tree. MCP có thể thấy nhiều repo: chỉ định repo đúng và kiểm đường dẫn index; tên repo một mình không chứng minh đúng checkout. Chưa có hoặc stale thì cập nhật khi cần dùng theo [hướng dẫn GitNexus](../setup/gitnexus.md). Không dùng index checkout khác cho worker hiện tại, không build ở mỗi prompt/lần sửa file. Source đổi sau truy vấn thì kiểm freshness trước lần dùng tiếp theo.

Implementer dùng kết quả để chọn file qua LeanCTX và checks theo rủi ro. Reviewer dùng kết quả trong cùng lượt review trên exact SHA/diff đã giao để xác định vùng cần kiểm thêm; không tự mở rộng AC, thêm reviewer hoặc lặp suite đã có evidence còn hiệu lực. Theo [review/revalidation](../workflows/review.md), ghi ngắn worktree/SHA, câu hỏi đã giải đáp và giới hạn có ảnh hưởng kết luận trong checkpoint/handoff hiện có; không tạo báo cáo riêng chỉ để chứng minh đã gọi tool.

Graph có thể bỏ sót quan hệ/flow do parser, giới hạn truy vết hoặc index cũ. Kết quả rỗng không chứng minh code không được gọi hay không tồn tại luồng. Source và tests quyết định khi khác graph. GitNexus lỗi/không khả dụng thì ghi limitation khi có ảnh hưởng và tiếp tục qua CRG/LeanCTX; lỗi này không miễn gate CRG hoặc acceptance bắt buộc.
