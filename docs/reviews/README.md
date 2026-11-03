# Evidence và báo cáo review

Đây là kho evidence theo Task/PR/SHA; không phải nguồn Status live hoặc chỉ dẫn deploy/UAT. Bắt đầu từ [docs index](../README.md), thực thi theo workflow hiện hành.

## Chọn evidence

- F04 regression: [acceptance matrix](../../tests/e2e/ACCEPTANCE.md), [E2E plan](../../tests/e2e/PLAN.md).
- Pilot: [PROD-LAUNCH-UAT](../plans/PROD-LAUNCH-UAT.md), đúng scope/authorization #1008.
- Kiến trúc: [baseline có bằng chứng](../architecture/ar891-current-architecture.md) dẫn evidence theo vấn đề/SHA.
- [GAP audit 18/10](GAP-AUDIT-2026-10-18-INDEX.md) và [D6 evidence](d6-foundation-evidence-index.md) là checkpoint lịch sử, không phải audit mới.

Khi tìm theo Issue/PR/SHA, kiểm source/tested SHA, environment/build, command/run ID, provenance, verdict/findings và limitations. Evidence cũ có thể tái sử dụng theo diff với lý do; không đổi nhãn SHA và không gọi đó là test mới.

## Retention

- Giữ ADR, approval, verdict độc lập, finding IDs/lượt fix và evidence cần để audit/reproduce/rollback.
- Các file prior/revalidation không tự là bản sao thừa: chúng có thể chứng minh diễn tiến findings. Không xóa dựa tên hoặc ngày.
- Raw logs, capture lặp và artifact sinh mới ưu tiên gitignored artifact/CI storage theo policy; không thêm PNG hoặc dữ liệu thật vào Git.
- Dọn artifact đã theo dõi chỉ bằng Task riêng: inventory consumer + path/hash, bản thay thế đã verify, retention/backup và approval đúng scope. Không chạy git clean hoặc xóa cả assets trong đợt dọn docs.
- Research và run log không dùng làm chỉ dẫn vận hành; đưa archive có index, cập nhật link. Report lịch sử vẫn giữ exact SHA/verdict; không rewrite kết quả.

Lượt tổ chức docs 03/11/2026 giữ nguyên reports/assets khác; README cũ dành riêng D6 được lưu tại link trên để evidence không mất.
