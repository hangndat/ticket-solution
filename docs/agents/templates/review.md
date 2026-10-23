# Review theo exact SHA

**Tài liệu dành cho coordinator khi soạn dispatch, không phải đầu vào reviewer phải đọc.** Coordinator đọc một lần trong session, điền spec ngắn bên dưới rồi gửi riêng spec đó. Không đính kèm nguyên file, không yêu cầu reviewer đọc template này, task-spec hoặc worker-report. Reviewer vẫn đọc role/rules và source/evidence áp dụng.

## Spec gửi reviewer

Chỉ gửi khối đã điền, xóa placeholder/mục không áp dụng; mục tiêu 150–250 từ, không cắt AC/gate để đạt số chữ. Evidence chứa danh sách dài thì dẫn path/section, không paste log hoặc lịch sử findings đã đóng.

```text
Review only: <Issue/PR + paths>; <initial|revalidate>.
Base → head: <full SHAs>; SHA đã review: <nếu revalidate>.
Role/file + Persona: <...>; reviewer khác implementer <session/dispatch>.
Agent/model/effort + Cost tier: <...>; Architecture impact: <Có|Không + ADR>.
AC/Decision/skills/UI mẫu: <IDs + links/sections áp dụng>.
Evidence: <packet/report path + SHA/time>; gate/checks còn thiếu: <...>.
Revalidate: <findings mở + report trước>; fix <n/2>.
Đầu ra <path/comment đã authorize>: ≤3 câu tóm tắt, SHA + verdict từng gate,
checks (đã chạy/reuse/chưa chạy), findings mới/mở (ID, loại/mức độ, chặn+lý do,
AC/path:dòng, bằng chứng, điều kiện đóng), limitations + owner/bước tiếp.
Giữ IDs; findings đóng cite ID/report trước. Không bỏ gate vì tiết kiệm chữ.
Dùng preamble thật để check thư và worker_done; không sửa source.
```

Coordinator giữ hướng dẫn chi tiết dưới đây để soạn đủ đầu vào và kiểm bàn giao; không gửi lại toàn bộ checklist này cho reviewer.

## Đầu vào coordinator điền

- Issue/PR, paths: <scope và ranh giới>
- Mode: initial | revalidate; base → head: <full SHA>; SHA trước: <nếu revalidate>
- Reviewer/session: <khác implementer>; Role/file: <dod hoặc reviewer-merged>; Persona: <tên>
- Agent/model/effort, Cost tier: <theo catalog>; Architecture impact: Có | Không
- AC/Decision/ADR: <link + section/IDs>; skills/mẫu UI: <khi áp dụng>
- Evidence packet: <path + thời điểm>; findings trước/lượt fix: <link, 0|1|2 / 2>
- Gate/checks bắt buộc và evidence còn thiếu: <chỉ rõ; không chỉ ghi “CI xanh”>
- Ownership: review only; output: <một artifact hoặc comment được authorize>; worker_done theo preamble thật.

## Phạm vi đọc và kiểm

- Initial: xác minh head SHA, đọc toàn bộ diff trong scope; theo đường gọi liên quan qua các lớp để kiểm contract end-to-end (auth/tenant/idempotency/transaction). Không audit toàn repo mặc định.
- Revalidate: đọc báo cáo trước, xác minh findings mở và diff SHA cũ → mới cùng vùng regression. Mở rộng khi auth/tenant/contract/migration/dependency thay đổi; ghi lý do. Không kế thừa PASS tự động.
- Đọc packet/check summary trước; mở source/evidence/raw log cần để kết luận. Findings không được suy chỉ từ summary. Check chưa đổi có thể cite lại với SHA/điều kiện; không gọi là vừa chạy.
- Một reviewer gộp DoD ± security ± UI khi cùng PR/SHA; checklist chuyên sâu đọc section áp dụng. Không đọc role khác hoặc chạy lại cùng suite theo từng vai trò. Device/UAT/CI bắt buộc vẫn giữ.

## Báo cáo reviewer điền

<Tóm tắt tối đa ba câu: kết quả, blockers, bước tiếp theo.>

- SHA/mode/scope đã kiểm; DoD: <verdict>; Security/UI: <verdict riêng hoặc N/A + lý do>
- Checks: <lệnh/CI, SHA, kết quả, evidence link; phân biệt đã chạy, tái sử dụng, skipped, pending, blocked>

| ID / loại | Mức độ / chặn merge + lý do | AC/Decision, path:dòng và bằng chứng | Điều kiện đóng / trạng thái / SHA |
| --- | --- | --- | --- |
| F01 | <blocker/should-fix/nit; Có/Không> | <kỳ vọng, thực tế, tái hiện hoặc đường đi code> | <check cụ thể; mới/mở/đã xác minh> |

- Findings giữ ID qua các lượt; finding mới ghi regression/bỏ sót/evidence mới. Đã xác minh không chép lại toàn bộ: cite báo cáo trước + ID.
- Limitations/gate còn thiếu, owner và lượt fix còn lại: <không dùng known gap bỏ gate bắt buộc>. Không có finding thì ghi rõ, không tạo finding để điền bảng.
- Code complete / acceptance complete / pilot ready: <kết luận đúng phạm vi; chưa đánh giá thì ghi rõ>.

Không chấm điểm cảm tính. Thiếu exact SHA/evidence hoặc independence thì không PASS. Local dirty review chỉ là kiểm tra local, không phải DoD của commit chưa tồn tại.
