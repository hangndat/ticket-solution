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

## Chọn công cụ, tránh đọc trùng

- CRG ưu tiên symbol, callers/callees, impact, architecture và phạm vi review theo readiness gate. Không gọi thêm `ctx_callgraph`/`ctx_impact`/`ctx_architecture` nếu CRG đã trả lời đủ.
- `ctx_read` đọc source sau khi biết file; chọn một mode theo mục đích, không chạy chuỗi map → signatures → lines. `map`: cấu trúc; `signatures`: API; `lines:N-M`: đoạn đã biết; `anchored`: sửa; `full`: cần toàn bộ nội dung. Dùng `diff` khi cần đọc lại sau thay đổi.
- `ctx_search` tìm docs/config/literals ngoài graph. `ctx_compose` dùng khi chưa biết vị trí và CRG chưa trả lời đủ; không bắt buộc gọi trước mọi lần đọc.
- `ctx_shell` phù hợp log build/test dài; giữ exit code và mở phần lỗi từ archive qua `ctx_expand`, không chạy lại chỉ để lấy log.
- Tool ít dùng hoặc thống kê token bằng 0 không tự chứng minh lỗi hay thiếu hiệu quả. Đo nội dung trả về, số lượt gọi và evidence theo task; không ép dùng mọi tool.

## Root và độ mới của source

Lấy root từ checkout thực tế, không ghép hậu tố `/main`:

```bash
git -C <task-checkout> rev-parse --show-toplevel
git -C <task-checkout> rev-parse HEAD
```

Truyền root tuyệt đối cho `ctx_compose`, scope `ctx_search` vào đúng checkout và dùng đường dẫn tuyệt đối cho `ctx_read`. CRG MCP trỏ checkout khác chỉ là gợi ý: xác minh source ở worktree/SHA của task trước khi kết luận impact hoặc review. Không dùng graph main để khẳng định branch không có symbol.

## Scope và output trong monorepo

- Task spec ghi checkout tuyệt đối, base/head SHA, slice được tìm/đọc và path/section tài liệu liên quan. Không tìm từ home hoặc worktree khác.
- Ưu tiên thư mục slice (`apps/api`, `apps/worker`, `packages/backend`, `apps/web`, `apps/portal`, `apps/mobile`, `docs/agents`) trước khi mở rộng để xác minh contract/impact. Khi `ctx_compose` ở root báo `source file budget exceeded`, thu hẹp câu hỏi/phạm vi qua `ctx_search` trong slice; không gọi lặp cùng yêu cầu toàn repo.
- Listing native dùng `ls -1 <dir>` / `ls -la <dir>`; bare `ls` có thể bị rewrite thành cây thư mục lớn. Đọc file dùng `ctx_read`; không đọc lại chỉ để đổi mode.
- Output read-only dài từ `orca`, `node`, build/test/log dùng `ctx_shell`. Lệnh ghi/commit/push/install/deploy dùng native shell; giữ output gọn. JSON `gh` lọc bằng `--jq` / `--template`, không pipe interpreter chỉ để lọc.
- Archive/reference đã trả về: `ctx_expand` theo phần cần; không chạy lại để lấy cùng output. Ghi lỗi bounce/authority theo task và nguyên nhân; không tắt policy hay bật deny/shadow chỉ để tăng Gain Score.

## Chẩn đoán output thiếu nội dung

1. Smoke-test `ctx_read` trên tài liệu public đã biết và `ctx_call(name="ctx_discover_tools", arguments={query:"metrics"})`. Thành công phải có nội dung/danh sách tool, không chỉ footer `tok sent`.
2. Nếu chỉ có header, kiểm tra `response_verbosity` trong config toàn máy mà `lean-ctx doctor` báo. Với 3.11.4, `headers_only` loại nội dung; `full` trả nội dung. Sao lưu trước khi sửa đúng trường; không commit config cá nhân. Bản 3.11.4 đã quan sát có mismatch validator: `config set ... full` đòi normal/compact/minimal, nhưng normal bị parser từ chối. Trong trường hợp đó sửa TOML trực tiếp thành `response_verbosity = "full"`, rồi smoke-test lại.
3. Header-only khác với lỗi policy/authority. Khi `POLICY BLOCKED`, `source path is outside the request authority` hoặc source authority không xác minh được: kiểm tra root/checkout và ghi nguyên lỗi; chỉ retry một lần với root đã xác minh. Nếu còn lỗi, dừng đường gọi đó và báo limitation; không tắt policy, mở rộng allowlist hoặc dùng tool khác để né quyết định từ chối.
4. Nếu MCP đã trả nội dung nhưng CLI vẫn bị policy chặn, ghi riêng hai kết quả; không suy ra CLI đã được sửa. Với lỗi availability không có policy deny, dùng công cụ native trong phạm vi được phép và ghi rõ fallback.

Cấu hình invocation phụ thuộc host: `CallDynamicTool` chỉ dành cho Cursor; host khác dùng tên/schema MCP thực sự được cung cấp. Không bật shadow/deny hoặc toàn bộ tool chỉ để tăng số lượt lean-ctx.
