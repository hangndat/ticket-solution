# Review config agent global — 2026-11-03

Phạm vi: Codex global, Codex home của tài khoản Orca được cho phép, cấu hình hook Cursor/Claude, OpenCode và LeanCTX. Review ban đầu chỉ đọc; sau đó user yêu cầu “Fix hết đi” và các sửa đổi bên dưới đã được áp dụng. Không đọc auth, lịch sử chat hoặc dữ liệu tài khoản. Đây là công việc config ngoài repository, được miễn CRG; thay đổi trong repo chỉ gồm hướng dẫn/thông báo hook và báo cáo.

## Findings đã xác nhận

### G01 — CRG global trỏ tới repo không tồn tại

Cả `~/.codex/config.toml` và config trong Orca home khai báo server `code-review-graph` với `--repo /Users/admin/Work/portal-be`. Kiểm tra `git -C ... rev-parse --show-toplevel` trả exit 128: thư mục không tồn tại. Cần cập nhật hoặc bỏ đăng ký đã lỗi thời. Chưa đo hậu quả startup của server.

### G02 — Năm đăng ký CRG cố định trong mỗi config Codex

Hai config cùng khai báo CRG cho portal-be, portal-fe, pos-backend, s10-kbgroup và ticket-solution. Server ticket dùng thư mục cha `/Users/admin/SideProject/ticket-solution`, không phải worktree hiện tại `main-2`. Điều này làm tăng số namespace/tool và tạo nhiều default root không phù hợp với session. Các query có `repo_root` rõ ràng vẫn chọn đúng worktree; không kết luận mọi query hiện tại sai. Nên thu gọn cấu hình theo project hoặc dùng server hỗ trợ root của từng query, sau khi xác minh khả năng runtime.

### G03 — Hook cập nhật CRG không phân biệt Bash chỉ đọc

Trong cả hai Codex home, PostToolUse có matcher `Write|Edit|Bash`; command chỉ kiểm tra đang ở Git repo rồi chạy `code-review-graph update --skip-flows`. Không kiểm tra lệnh Bash có sửa source hay không. Với event khớp `Bash`, lệnh chỉ đọc cũng đi qua update. Ngược lại matcher này không liệt kê `apply_patch`, dù hook observe bên cạnh có. Cần chuẩn hóa theo tên tool thực tế của host và chỉ update khi source thay đổi. Chưa kết luận mọi shell call Codex hiện tại đều khớp tên `Bash`.

### G04 — Cursor đăng ký redirect Read hai lần

`~/.cursor/hooks.json` có hai entry cùng command `lean-ctx hook redirect`: matcher `Read|Grep|Glob` và matcher `Read`. Cấu hình chồng lặp cho Read; nên giữ một entry. Chưa đo số lần thực thi thực tế nếu host dừng sau kết quả hook đầu tiên.

### G05 — Trạng thái trust khác nhau giữa Codex trực tiếp và Orca

Kiểm tra bằng local `codex app-server --stdio`, gọi `initialize` và `hooks/list` với cwd `main-2`: cả hai trả `errors: []`. Orca trả tất cả hook được liệt kê là `enabled: true`, `trust: trusted`. Codex global trả một hook LeanCTX SessionStart và một hook PreToolUse khác ở trạng thái `untrusted`, dù `enabled: true`. Vì vậy không thể suy từ file cấu hình giống nhau rằng hành vi chạy trực tiếp và chạy qua Orca giống nhau. Cần đối chiếu source/command cụ thể trước khi cập nhật trust; không trust hàng loạt.

### G06 — Hướng dẫn shell và scope discovery gây đường vòng khi review global

Preamble shell khuyến nghị native `ls -1` và các reader, trong khi policy routing mới hạn chế native đọc tài liệu. Khi review global, discovery còn bị ràng buộc vào worktree dù tác vụ ngoài repo được miễn CRG. Trong phiên review đã gặp chặn listing và đọc đường dẫn ngoài scope, phải chuyển sang exact-path reads được cấp quyền. Nên làm rõ native-reader exceptions và thiết kế scope discovery cho root ngoài repo đã được người dùng cho phép; không mở rộng root mặc định toàn máy.

## Điểm cần xác minh, chưa kết luận là lỗi

- Orca `node_repl.env.CODEX_HOME` vẫn là `/Users/admin/.codex`, cùng các đường dẫn browser/computer-use global. Có thể là runtime dùng chung có chủ đích; chưa có bằng chứng trộn dữ liệu tài khoản.
- Cursor có `lean-ctx hook deny` cho native editor. Payload Write giả lập tới docs trả `{}` và exit 0, không sửa file. Không đủ bằng chứng để nói hook này đang chặn sửa docs; cần đúng payload/host context khi kiểm tra sâu hơn.
- Cursor khai báo CRG hook ở global và repo; chưa đọc được các script global trong `~/.cursor/hooks` do path protection, nên chưa kết luận chạy update hai lần.
- LeanCTX có cấu hình archive/giới hạn output và loop detection; đã gặp output cần expand, nhưng chưa đo hiệu quả tổng token hoặc xác minh enforcement của từng knob. Không coi giá trị config đơn lẻ là bằng chứng quota đang chặn.
- Trust project ở `/Users/admin` rộng; chưa xác minh semantics kế thừa bằng runtime, không kết luận lỗ hổng.

## Đối chiếu và kiểm tra

- Block policy đồng bộ trong Codex global, Orca và OpenCode khớp nguồn `agent-context-policy/RULES.md` tại thời điểm kiểm tra.
- OpenCode plugin trỏ về adapter dùng chung, không phát hiện bản sao policy riêng bị lệch trong phạm vi đã đọc.
- Script kiểm tra hooks chỉ chạy hai Codex home đã được cho phép, không tạo thread/model request, không chỉnh trust. App-server được terminate sau kiểm tra.
- Kiểm tra hook deny là dry-run payload; không gọi tool Write thực tế.
- Các quyền allow-path đã thêm theo chấp thuận trước đó chỉ phục vụ truy cập config. Allow-path không phải cơ chế cấp quyền filesystem read-only; reviewer tự giới hạn thao tác đọc.
- Chưa thay đổi config vận hành và chưa commit/push báo cáo. Không tuyên bố đã review nội dung script Cursor đang bị chặn hoặc toàn bộ cơ chế của các ứng dụng.

## Kết quả sửa sau khi được cho phép

- **G01/G02:** Cả hai Codex home còn một server `code-review-graph`, args `["serve"]`, tự nhận cwd; không còn các repo root hardcode. MCP handshake và tools/list PASS tại `main-2` và `/Users/admin`; schema của stats/query/build hỗ trợ `repo_root` rõ ràng. MCP trong phiên đang chạy có thể vẫn giữ catalog cũ cho tới khi host reload/restart session.
- **G03:** Bỏ hook global update sau `Write|Edit|Bash` và status khi session start. Graph được kiểm tra/build/query khi cần source theo shared guard, không còn eager update vì shell chỉ đọc. Policy yêu cầu kiểm tra lại freshness sau sửa source; guard trước source vẫn được giữ. Không bật auto-watch hay cloud embeddings.
- **G04:** Chỉ giữ một redirect `Read|Grep|Glob` ở Cursor. Sau khi đọc ba script CRG global, xác nhận beforeSubmitPrompt gọi tiếp project hook và sessionStart tự build/update. Bỏ ba đăng ký eager CRG global; project hooks vẫn do repo quản lý, global shared guard vẫn hoạt động. Đường dẫn `~/.cursor/hooks` đã được allow để thực hiện sửa toàn bộ theo yêu cầu user.
- **G05:** Dùng schema và `hooks/list` của Codex cài trên máy để cập nhật hash cho đúng các registration đã review, xóa state cũ của nguồn tương ứng. Kết quả fresh app-server: Codex global **8/8 trusted**, Orca **17/17 trusted**, không lỗi parse. Giữ enabled/disabled hiện có, không mở rộng trust project.
- **G06:** Guard cho phép discovery theo các config root đã được user cho phép, khai báo chính xác trong `external-roots.json`; vẫn từ chối scope thiếu, parent/symlink escape, mixed repo source chưa có CRG và native read. Preamble shell của các host thống nhất dùng LeanCTX. Làm rõ chỉ OpenCode dùng cú pháp `execute/tools.crg`. Không chèn thêm bản sao policy global vào AGENTS của repo.
- **G07 phát hiện khi sửa:** Skill global `~/.agents/skills/update-cli-config/SKILL.md` mang tên Codex nhưng dẫn sang `.cursor/cli-config.json`. Đã thay bằng hướng dẫn xác định active `CODEX_HOME`, đọc `config.toml`/`hooks.json`, kiểm runtime và tránh nhầm host.
- **G08 phát hiện bằng runtime:** Codex đang nạp hook từ `/Users/admin/SideProject/ticket-solution/.codex/hooks.json`, vẫn chỉ `.cursor/rules` và ép Cursor/composer. Đã sửa cả hook repo cha và worktree `main-2` theo thông báo host-neutral đang dùng ở Claude, giữ nguyên quyết định deny spawn trái workflow.

### Kiểm chứng cuối

- `npm test` trong global policy: **36/36 PASS** (31 regression cũ + 5 case external scope mới), adapter OpenCode **PASS**.
- Smoke test config: parse TOML/JSON, một CRG server, không còn eager update/redirect trùng, shared guard còn đăng ký; MCP startup ở hai cwd PASS.
- Dry-run hook dispatch của repo cha và worktree: JSON hợp lệ, vẫn deny spawn trái workflow, không còn pointer `.cursor/rules` hay pin composer; **PASS**.
- Không gọi model/worker thực, không đọc auth/history, không đổi model, không đổi node_repl runtime dùng chung hoặc project trust khi chưa có bằng chứng chúng sai.
- Hook `deny` của Cursor và các knob archive/loop chưa có bằng chứng gây lỗi; không đổi chúng chỉ dựa trên tên setting. Các nghi ngờ này không được ghi là đã tái hiện hoặc đã fix.
- Backup config ban đầu: `/Users/admin/.config/agent-context-policy/backups/global-fix-20261103-022120/`; các lần sửa rules/trust tiếp theo có backup riêng cùng prefix `global-fix-`. Sync policy backup: `backups/20261103-022235-123713/`.
- Chưa commit/push. `.codex` hooks là cấu hình local, không xuất hiện trong diff tracked của repo.

## Dọn legacy Cursor trong repo — follow-up 03/11/2026

- Theo yêu cầu user, giảm `.cursor/rules` từ 11 xuống 1 adapter `project.mdc`; routing theo hành động nằm trong `docs/agents/README.md`, gồm cả provider fallback và LeanCTX troubleshooting. Không còn phụ thuộc UAT globs riêng của Cursor.
- Giảm `.cursor/hooks` từ 6 xuống 2 script telemetry. Bỏ bốn script CRG eager build/update, marker readiness và namespace pin cũ; gỡ registration tương ứng. Giữ auto-join và stop/afterAgentResponse với dedupe generation. Giữ symlink skills.
- CRG scope `/Users/admin/SideProject/ticket-solution/main-2`, base HEAD `08f3578c062e7885595ca4a8f1255245b243650c`: incremental minimal build, stats khớp HEAD, query `file_summary` cho `crg-ensure-ready.sh`; đã đọc bốn script và tìm consumer trước khi xóa.
- Cập nhật setup/context docs và pointer UAT còn dùng; evidence lịch sử không viết lại. Máy chưa cài guard global vẫn phải làm readiness theo policy, không được coi telemetry hooks là enforcement.
- Validation: `pnpm agent:workflow:test` **85/85 PASS**, gồm hook log privacy và dedupe; cấu hình JSON, 3 event registrations, 2 script targets, symlink skills và **33 documentation links PASS**; `git diff --check` PASS. Chưa smoke-test phiên Cursor UI mới.
- Phần follow-up đang ở nhánh `hangndat/tooling-cursor-legacy-cleanup`, chưa commit/push.
