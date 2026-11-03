# Mailbox và lifecycle — Orchestrator V3

Chỉ đọc khi supervise Orca Run; dùng guide phiên bản host và preamble thật. Baseline 1.4.246; setup/checkpoint: [orca-v3.md](../setup/orca-v3.md).

1. Start mọi task ready độc lập trong scope, caps/WIP và quota qua workflow wrapper; kiểm `result.state`, `failedStage`, requested/effective và `next` trong receipt. Xử lý `next` nếu có, lưu checkpoint rồi **kết thúc turn** để Orca đánh thức khi worker báo. Nhường turn không phải kết thúc Run hay bỏ supervision.
2. Khi Orca wake: chạy đúng lệnh `check` trong wake; scope đúng Run/Task/Dispatch. Nhiều Run dùng `--run <id>` rõ ràng; không `run-use` chỉ để xem Run khác vì có thể mất binding các Run trước.
3. Process toàn bộ delivery: reply `question` khi đủ chỉ dẫn; thiếu quyết định của user thì hỏi user và giữ checkpoint. Xác minh task/dispatch/outcome của `worker_done`; không đổi reported failure thành completed. `escalation` có `stopReason` là worker dừng thiếu `worker_done`, xử lý theo recovery guide. Ack theo receipt/preamble sau batch.
4. Lưu evidence/checkpoint, kiểm ready queue và fill slot theo [idle-fill](dispatch.md). Xử lý delivery, câu hỏi có thể trả lời và cleanup có `next` trước khi nhường turn. Không còn hành động làm được thì kết thúc turn; Orca tiếp tục wake cả khi còn worker live. Chỉ báo scope hoàn tất khi mọi Task có outcome và evidence/gates tương ứng.
5. Worker xong tự đóng trừ khi receipt/`worker-list` có `next` yêu cầu hành động hoặc đã keep-open. Thu telemetry qua wrapper sau settlement hợp lệ, trước cleanup chủ động; chỉ release tài nguyên owned khi host yêu cầu, kiểm receipt. `worker_done` không thay DoD. Không xóa branch/worktree hoặc kill process không thuộc task.
6. Follow-up cùng scope/context và đúng model/employee: `send --to dispatch:<id> --subject "…" --body "…"`. Worker đang làm nhận mail; worker finished/closed nhận Task follow-up và gửi `worker_done` mới. Đọc receipt lấy Task/Dispatch thật, cập nhật tracking; không gán receipt assignment cũ cho follow-up. Paired-server finished worker không hỗ trợ cách này: đọc placement guide, start Task qua wrapper trên đúng host.
7. Chỉ dùng `--keep-open` hoặc `worker-keep-open --dispatch <id>` khi user sẽ tiếp tục xem/nói chuyện trong worker chat; không giữ worker rảnh để có thể dùng sau. User-taken-over và tài nguyên chưa xác minh không được tự đóng.
8. Timeout, silence, heartbeat hoặc inbox rỗng không chứng minh exit. Chỉ kiểm `worker-list` scoped Run khi có lỗi/escalation, user yêu cầu hoặc quá hạn task; đọc liveness và `next`. `unverifiable` không cho phép tự stop/retry/release. Start failed/interrupted: đọc `failedStage` và `references/recovery-and-cleanup.md`; không retry mù hoặc dùng Run/Task mới né circuit breaker.

## Tránh vòng model không có thông tin mới

- Heartbeat bình thường chỉ cập nhật liveness và ack; không kéo theo worker-read, GitHub query, review hoặc báo cáo tiến độ mới. Khi user yêu cầu check, trả trạng thái ngắn nếu không có delta.
- **Không `check --wait`, polling hoặc watch script đọc mailbox trong V3.** Script gọi plain `check` có thể lấy mail trước coordinator, khiến host không còn mail để wake. Không tạo cron/job gọi model chỉ để hỏi trạng thái. Host không có V3 hoặc wake lỗi: giữ checkpoint, báo giới hạn và theo recovery guide phiên bản host; không giả định listener hoạt động hoặc âm thầm phục hồi long-poll.
- CI dùng một watcher CLI cho exact run/SHA, ví dụ `./scripts/gh-dod-evidence.sh <PR> --watch <FULL_SHA>`; progress lưu ngoài context, chỉ đọc kết quả cuối hoặc lỗi cần quyết định. Không song song watcher và gh poll cùng CI; không gọi model theo mỗi tick. Không auto-merge bằng watcher.
- Trước trả output tool: lọc JSON bằng jq hoặc công cụ đọc có giới hạn. Không dump toàn bộ worker-list, PR checks hay transcript rồi mới tóm tắt; vẫn giữ count/omitted và mở phần thiếu khi cần quyết định.
- Khi mất dấu mail đã xử lý, dùng `inbox --terminal run:<run_id> --limit 50` theo guide để khôi phục rồi xử lý receipt; không tự chạy vòng inbox/check theo timer. Watcher CI ở trên không được đọc Orca mailbox.
- Không worker-read transcript sau mỗi timeout. Chỉ đọc khi có escalation, sai receipt, bằng chứng stall hoặc cần xác minh một kết quả cụ thể; đọc phần mới bằng cursor, giới hạn output.
- Không tự động đọc raw log để viết progress. Cập nhật user ngắn theo thông tin mới; không gọi thêm tools chỉ để có nội dung báo cáo.
- Có user steer/message thì xử lý sớm; giữ lifecycle và giới hạn review/fix trong [review-convergence](review.md).
