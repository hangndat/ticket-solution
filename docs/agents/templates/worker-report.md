# Báo cáo worker ngắn

Mục tiêu khoảng 150–300 từ cho phần tóm tắt; findings cần đủ bằng chứng thì tách artifact chi tiết, không cắt mất blocker. Không paste terminal transcript.

## Tóm tắt ba câu

<Đã làm gì trong scope. Kết quả checks/findings quan trọng nhất. Phần còn thiếu và owner/bước tiếp theo.>

- Task / Dispatch: <ID thật từ preamble>
- Base → head: <full SHA>; working tree: sạch | có thay đổi chưa commit
- Paths thay đổi: <paths chính; packet có danh sách đầy đủ hoặc omitted count>
- Trạng thái: code complete <Có/Không>; acceptance complete <Có/Không>; pilot ready <Chưa đánh giá hoặc evidence gate cụ thể>
- Review only: <DoD / Security / UI verdict riêng nếu áp dụng; không thay status bằng worker_done>

| Check | SHA / input đã kiểm | Kết quả | Evidence |
| --- | --- | --- | --- |
| <lệnh, cwd> | <exact SHA; nếu dirty ghi rõ không phải committed SHA> | PASS / FAIL / chưa chạy / bị chặn | <path/link> |

- Findings: <ID ổn định, loại, mức độ, chặn Có/Không, path:dòng, bằng chứng và điều kiện đóng; hoặc link bảng chi tiết>
- Rủi ro / thiếu evidence: <ghi rõ; không suy PASS từ không thấy lỗi>
- Checkpoint: <lượt fix đã dùng, quyết định đã chốt, owner tiếp theo>
- Evidence packet / raw artifact: <path; thời điểm, SHA; không chứa secrets/PII>
- Allowance/thời gian nếu đo: <source + cửa sổ đo; unknown nếu không có; account delta không phải chi phí riêng task>
- Hiệu quả delta: <AC vừa đóng / finding mới đã chứng minh / không có evidence mới + nguyên nhân; lượt rework và điều kiện thử tiếp>. Usage nếu provider cung cấp: <source/boundary/coverage, input/cache/output; thiếu = unknown, không tự ước lượng>; coordinator join receipt, không yêu cầu worker đọc transcript hay billing để điền.

Coordinator đọc phần tóm tắt trước, mở artifact khi cần kiểm AC, blocker hoặc quyết định rủi ro. Reviewer vẫn phải đọc code/evidence cần thiết; báo cáo worker không thay review độc lập.
