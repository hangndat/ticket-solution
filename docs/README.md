# Bản đồ tài liệu Vemoki

Đọc theo mục đích; ngày của một snapshot không phải ngày kiểm chứng production. Status động lấy [Project #3](https://github.com/users/hangndat/projects/3).

- **Sản phẩm:** [PRD](PRD.md), [scope/gates](ROADMAP.md), [Decision Log](DECISION-LOG.md).
- **Kiến trúc:** [baseline có bằng chứng](architecture/ar891-current-architecture.md), ADR trong ops; [technical proposal](TECHNICAL-DESIGN.md) giữ mục tiêu dài hạn. Baseline có SHA riêng, không tự đại diện HEAD/deployed hiện tại.
- **Thiết kế:** [nguồn theo surface](design/README.md), [ràng buộc UI/contract Portal](design/portal-contract.md).
- **Thực thi agent:** [AGENTS](../AGENTS.md), [bản đồ role/policy/workflow](agents/README.md).
- **Vận hành:** [runbook](ops/RUNBOOK.md), [release contract](ops/IMMUTABLE-RELEASE.md), [pipeline](ops/DEPLOY-PIPELINE.md); production chỉ theo Task authorize.
- **Kiểm chứng:** [evidence index và retention](reviews/README.md); F04 theo [acceptance matrix](../tests/e2e/ACCEPTANCE.md), Pilot theo [catalog](plans/PROD-LAUNCH-UAT.md).
- **Lịch sử:** [archive](archive/README.md), research/handoff theo scope Issue. Run/dispatch snapshot không phải ready queue live.

## Quy tắc duy trì

Tài liệu hiện hành giữ scope/contract/gates; không tích lũy số Status/PR/checkpoint cũ trong đầu file. Snapshot, proposal superseded và run log có provenance đi archive. Giữ nguyên ID, SHA, verdict, approval và số lượt fix; không đổi FAIL/GAP thành PASS khi dọn docs.

Evidence/ADR/Decision Log không xóa hàng loạt. Khi chuyển đường dẫn, cập nhật link và kiểm nguồn đến; không đổi source/tested SHA hoặc hash của artifact. Các ví dụ CLI cũ trong archive không cấp quyền thực thi.
