# GitNexus cho project

GitNexus bổ sung khám phá luồng nghiệp vụ và vùng ảnh hưởng theo [context policy](../policies/context.md#gitnexus-trong-workflow). CRG vẫn là readiness gate; LeanCTX dùng để đọc/search source và docs. Không cần GitNexus cho mọi Task.

## Cài và cập nhật index

Yêu cầu Node.js theo `npm view gitnexus engines`. Bản cài ban đầu: `1.6.12`.

```sh
npm install -g gitnexus@1.6.12
gitnexus analyze --index-only --workers 4
gitnexus status
gitnexus query "authentication"
```

Chạy từ root worktree cần index. `--index-only` giữ nguyên AGENTS.md, CLAUDE.md, skills và hooks đang có. Index `.gitnexus/` là dữ liệu local, không commit. Embeddings không được bật trong lần cài này.

Khi Task thực sự cần GitNexus, chạy `gitnexus status` tại đúng worktree, kiểm đường dẫn repo, indexed/current commit và thay đổi working tree. Chưa có index hoặc stale thì chạy `gitnexus analyze --index-only --workers 4`, rồi kiểm lại status. Không suy index còn mới chỉ vì HEAD chưa đổi. Không tự build ở sessionStart, mỗi prompt hay mỗi lần sửa file; không bật watcher mặc định.

MCP có thể liệt kê nhiều repo. Dùng `gitnexus list` để đối chiếu đường dẫn index với worktree đang làm và chọn đúng repo trong truy vấn. Nếu registry trùng tên hoặc không xác minh được checkout, giải quyết định danh trước khi dùng kết quả; không lấy index worktree khác thay thế.

## Dùng trong Task

1. Source task hoàn tất readiness + query CRG theo context policy trước.
2. Nếu chưa rõ luồng hoặc ảnh hưởng xuyên module, dùng GitNexus `query` với mô tả nghiệp vụ; tiếp tục `context` cho symbol hoặc `impact` cho vùng ảnh hưởng khi cần.
3. Dùng LeanCTX đọc source liên quan, implement và chạy checks theo AC/rủi ro. Trước khi dùng lại graph sau sửa source, kiểm freshness.
4. Reviewer dùng graph trong cùng lượt review trên exact SHA/diff để chọn vùng kiểm thêm; tái dùng evidence hợp lệ theo workflow review. Không thêm một lượt review GitNexus riêng.

Ví dụ: Task sửa check-in bị nhận hai lần có thể dùng `query` tìm luồng scan → API → cập nhật vé. Đọc source để xác minh transaction/idempotency và chạy test phù hợp; đường nối trên graph không chứng minh logic đúng. Graph rỗng hoặc thiếu flow cũng không chứng minh code không được gọi.

Ghi worktree/SHA, kết quả hữu ích và giới hạn ảnh hưởng kết luận trong checkpoint/handoff sẵn có. Task hẹp đã đủ context không cần query trùng với CRG. GitNexus lỗi thì tiếp tục CRG/LeanCTX, giữ nguyên gate và checks bắt buộc.

## MCP local

Máy cài hiện tại dùng `/opt/homebrew/bin/gitnexus mcp` trong `.codex/config.toml` và `.cursor/mcp.json` của worktree. Hai file được gitignore vì chứa đường dẫn theo máy. Máy khác dùng kết quả `command -v gitnexus` để cấu hình `command`, `args = ["mcp"]`. Mở phiên editor/agent mới để nạp server.

Claude Code đã được thêm bằng lệnh sau từ worktree:

```sh
claude mcp add --scope local --transport stdio gitnexus -- /opt/homebrew/bin/gitnexus mcp
claude mcp get gitnexus
```

Claude lưu cấu hình local trong `~/.claude.json`; lần cài trên máy này CLI báo project `/Users/admin/SideProject/ticket-solution`. Cấu hình MCP không chứng minh index thuộc worktree hiện tại: vẫn kiểm đường dẫn index trước truy vấn. Chỉ chạy lệnh `add` khi chưa có server; dùng `get` để kiểm tra cấu hình/kết nối hiện hữu.

Không chạy `gitnexus setup` mặc định cho mọi editor: lệnh đó chỉnh cấu hình global và có thể thêm hooks/skills. Cài hiện tại chỉ thêm MCP, giữ nguyên hooks hiện hữu.

Nguồn: [GitNexus](https://github.com/abhigyanpatwari/GitNexus), [editor setup](https://github.com/abhigyanpatwari/GitNexus/blob/main/docs/editor-setup.md), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp). Khi README nhánh main khác bản npm đã cài, kiểm tra `gitnexus <command> --help` trước khi dùng option.
