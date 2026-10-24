# Công ty agent — hồ sơ nhân sự và nhật ký

Theo yêu cầu user ngày 2026-10-24: chỉ tracking data trong repo, **chưa build dashboard**. Tên làm việc: Vemoki Agent Team; đây là các persona AI, không phải nhân sự con người.

- `employees.json`: ID cố định, tên, chức danh, role, tính cách, văn phong, phạm vi và model mặc định của từng nhân viên.
- `work-events.jsonl`: nhật ký append-only, một JSON object mỗi dòng; schema v1 bên dưới. Chỉ ghi dữ kiện có bằng chứng, không ghi suy nghĩ nội bộ, token auth, cookie, secret hoặc dữ liệu người dùng.
- `work-event.schema.json`: contract JSON Schema cho công cụ và dashboard sau này.
- Runtime session/dispatch là một lần làm việc của nhân viên. Phục hồi phiên hoặc đổi model không tạo nhân viên mới. Không sửa lịch sử cũ để biến failed thành succeeded; thêm event mới có `previousDispatchId`.
- Nhật ký live ghi trực tiếp vào working tree khi điều phối; commit snapshot theo mốc bàn giao, không auto commit/push cho mỗi event. Kết quả `settled` là trạng thái dispatch, không tự đồng nghĩa nghiệm thu PASS; verdict review được ghi riêng.

## Giao việc

1. Chọn nhân viên theo role; đọc `node scripts/company-worklog.mjs profile <id>` và đưa ID/path hồ sơ vào Task Spec. Giữ tên đúng cả `--display-name` và `--task-title`, kèm văn phong của người nhận. Vai trò và nội dung quyết định model/tier; hồ sơ không được vượt cost-catalog/quota gates.
2. Start bằng `scripts/agent-workflow-run.mjs start ... --employee <id>`. Wrapper kiểm tên/role trước launch, ghi requested/effective vào nhật ký sau khi có receipt. Model khác mặc định phải có lý do trong Task Spec. Không rename worker đang live.
3. Cùng nhân viên có thể làm nhiều task theo thời gian; không giao hai ownership dispatch chồng nhau. Reviewer khác implementer, kể cả khi cùng tên role.
4. Settle bằng wrapper với `--employee <id>`; nhật ký ghi kết quả dispatch và release thực tế. Checkpoint/review/giao lại thêm bằng `company-worklog record <event.json>`. Bàn giao phải có SHA/checks/evidence và phần chưa xong.
5. Đóng browser pages do agent mở sau UAT; giữ server local và tab user. Không mở worker chỉ để làm đẹp nhật ký.

## Dữ liệu

Mỗi event có `schemaVersion`, `id` (duy nhất), `occurredAt` (thời điểm sự kiện), `recordedAt`, `employeeId`, `type`, `runId`, `taskId`, `dispatchId`, `previousDispatchId`, `roleId`, `issue`, `pr`, `summary`, `outcome`, `model`, `sha`, `evidence`, `source`.

`type`: `assigned`, `checkpoint`, `interrupted`, `recovered`, `handoff`, `reviewed`, `settled`, `released`. `model` giữ `requested`/`effective` và nguồn receipt; null nghĩa chưa biết, không coi là default đã được xác minh. `evidence` là các path/URL đã kiểm; `source` ghi công cụ/receipt. Historical backfill phải giữ thời điểm nguồn và chỉ đánh dấu phần đã xác minh.

Checkpoint/handoff/review mới nhận ID riêng; khi retry cùng một event, truyền lại `id` đã nhận (hoặc tự cấp ID ổn định trước khi record). Các receipt lifecycle chỉ xuất hiện một lần mỗi loại/dispatch. Append và `validate` đều kiểm một dispatch giữ đúng employee/run/task qua các loại event; recovery chain đã có dữ liệu cũng phải giữ cùng danh tính.

Lệnh đọc: `node scripts/company-worklog.mjs roster`, `profile linh`, `status`, `validate`. File JSONL có thể đọc trực tiếp để dựng dashboard sau; không phụ thuộc UI hoặc database mới.

Các persona có sẵn trong `docs/agents/README.md` được giữ nguyên; bổ sung Minh (coordinator), Linh (web, theo user yêu cầu phục hồi) và Noah (tooling local được giao trong #869). Registry này mở rộng nhân sự, không thay ownership/routing/role contract và model catalog hiện hành.
