# Nạp context theo task

- Đọc [bản đồ](README.md), chỉ nạp policy/workflow/role áp dụng. Dùng lại nội dung chưa đổi trong session; context mất hoặc cần xác minh thì đọc lại.
- Docs/rules thuần không nạp toàn bộ PRD/technical design; business task đọc phần contract/invariant liên quan.
- Spec giữ paths/SHA/evidence packet; raw logs ở artifact. Summary không thay source/evidence hoặc review độc lập.
- Gộp việc nhỏ cùng owner/input/mục tiêu; không tách session vì nhãn tier hoặc giữ worker rảnh.
- Chờ worker theo [lifecycle V3](workflows/lifecycle.md), không polling mailbox. Handoff leader theo [dispatch](workflows/dispatch.md) ở boundary an toàn.
- Checks theo tác động/AC; revalidation theo findings/diff. CI trên integrated SHA vẫn bắt buộc.
- Token/cache thiếu ghi unknown. Bytes/3.5 chỉ ước lượng kích thước, không phải billing/quota; không gán số đo tổng host vào riêng task.
- Checkpoint giữ Run/Task/Dispatch/owner, PR/SHA, CI, AC thiếu, findings/lượt fix, evidence và bước tiếp; không ghi theo heartbeat.
- [Phép đo cũ](archive/context-budget-2026-11-02.md) là lịch sử; [telemetry hiện hành](workflow-evidence-telemetry.md) quy định cách thu/diễn giải evidence.
