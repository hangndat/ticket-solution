# Task Spec ngắn

Điền trước dispatch; thay placeholder, xóa mục không áp dụng. Dùng link/đường dẫn thay vì chép lại tài liệu. Mục tiêu khoảng 300–600 từ; không bỏ AC hoặc gate để đạt giới hạn chữ.

Task review: coordinator dùng [review.md](review.md) để soạn spec ngắn đã điền; reviewer chỉ nhận spec, không đọc các mẫu trống này.

## Kết quả cần bàn giao

- Task / Issue / PR: <ID hoặc local-only>
- Kết quả: <hành vi/đầu ra cụ thể, 1–2 câu>
- Owner / paths được sửa: <một ownership slice>
- Ngoài phạm vi: <paths, deploy/store, contract không được đổi>
- Base SHA: <full SHA>; review/revalidate: <exact head SHA>
- Architecture impact: Có | Không — <lý do / ADR>

## Routing và đầu vào

- Agent / model / effort: <theo cost-catalog; Codex worker cần lý do reasoning>
- Cost tier: cheap | standard | focused | advanced | high
- Lý do dùng quota dự phòng (nếu có): --essential-reason; không tự coi high là khẩn cấp.
- Lý do tier: <quyết định, giải pháp và rủi ro cụ thể — 1 câu>; high bắt buộc truyền --tier-reason, việc khó có giới hạn mặc định advanced.
- Role ID / file: <role đúng scope; tooling không có role chuyên môn thì ghi coordinator scope>
- Persona / task-title: <theo roster; title tiếng Việt>
- Skills cần nạp: <chỉ skill liên quan, mục đích; UI ghi mẫu chuẩn và evidence>
- Tài liệu: AGENTS.md, rules áp dụng và các mục PRD/TECHNICAL-DESIGN/DECISION-LOG liên quan scope. Docs/tooling thuần không nạp toàn bộ tài liệu sản phẩm; session hiện tại dùng phần đã đọc nếu chưa thay đổi.
- Context bổ sung: <tối đa các path/section/contract cần cho task; không dump log>
- Evidence packet: <đường dẫn JSON, thời điểm, SHA, giới hạn/truncation>
- Evidence-only/UI: <checkpoint scope; expect/manifest + probe journey trước batch; runtime leak dừng/escalate>
- Dependencies: <artifact/contract thật còn thiếu; không đặt deps chỉ vì thứ tự Story>

## Acceptance và checks

| AC | Hành vi quan sát được | Check / evidence bắt buộc |
| --- | --- | --- |
| AC1 | <kỳ vọng cụ thể> | <command hoặc journey + artifact> |
| AC2 | <lỗi/edge case quan trọng> | <command hoặc bằng chứng> |

- Lệnh chạy ở đâu / điều kiện môi trường: <cwd, fixture, dependency>
- Không chạy lại checks đã đạt nếu source/input/môi trường không đổi; checks CI/gate bắt buộc vẫn phải khớp SHA yêu cầu.
- Review lại: <findings ID còn mở, SHA cũ → mới, diff và vùng regression>; mở rộng khi auth/tenant/contract/migration đổi.

## Điểm dừng và bàn giao

- Thiếu contract/quyền/môi trường hoặc lỗi lặp cùng nguyên nhân: checkpoint + hỏi coordinator qua lifecycle; không sửa slice khác.
- Số lượt fix đã dùng: <0|1|2 / 2>; theo orca-review-convergence, không reset khi đổi worker/session.
- Báo cáo: [worker-report.md](worker-report.md), kèm SHA, checks và limitations; raw logs nằm trong artifact local, không có secrets/user data thật.
- Telemetry do coordinator thu trước release; Codex cần baseline provider trước boundary, Cursor join conversation đúng dispatch. Thiếu token/cache phải ghi unknown, không suy quota từ token.
- Gửi `worker_done` theo preamble thật, outcome đúng, ba câu tóm tắt và report path. `worker_done` không tự chứng minh acceptance/merge/pilot ready.
