# O06 — Retention / vùng dữ liệu / SLA hỗ trợ

**Trạng thái:** **Đã chốt (MVP)** — user duyệt 2026-10-18.  
**Authority:** [DECISION-LOG.md](../DECISION-LOG.md) mục O06.  
**Ràng buộc:** Không đổi số im lặng — mọi thay đổi ghi dòng lịch sử mới trên DECISION-LOG.

## 1. Retention & xóa

| Hạng mục | Quyết định MVP |
| --- | --- |
| Tài khoản khi user yêu cầu xóa | **Anonymize ≤ 30 ngày** (không xóa cứng ngay — giữ đối soát khiếu nại) |
| Vé / check-in sau event | **Giữ 365 ngày** rồi anonymize PII; giữ aggregate/KPI |
| Audit log | **TTL 730 ngày** |
| Object store (QR/export) | Signed URL ngắn hạn + **job xóa object ≤ 90 ngày** sau hết hạn nghiệp vụ |
| Backup vs erasure | Backup **tôn trọng xóa trong RPO** (sau restore không “sống lại” PII đã xóa quá cửa sổ) |
| Cache client | Purge khi logout / đổi user |

## 2. Vùng dữ liệu (data residency)

| Lựa chọn | Quyết định |
| --- | --- |
| **A. Single-region VPS** | **Đã chọn** — Postgres + MinIO + Keycloak + SMTP cùng quốc gia với VPS hiện tại; ghi quốc gia host trong DPA khi có tenant thật |
| B. Split DB / object | Không dùng MVP |
| C. EU-only / VN-only cứng | Không khóa thêm trong MVP ngoài single-region thực tế của VPS |

## 3. SLA hỗ trợ

| Trục | Quyết định MVP |
| --- | --- |
| Ngoài cửa sổ event | **Business hours** T2–T6 (giờ VN) |
| Trong cửa sổ Gate / opening | **On-call P1 24/7 theo lịch event** |
| P1 (cổng chết / không check-in) | Phản hồi **≤ 30 phút** trong cửa sổ |
| P2 (email/redeem lỗi, không chặn cổng) | **≤ 4 giờ** business / **≤ 1 giờ** trong cửa sổ |
| P3 (cải tiến, copy) | **≤ 2 ngày làm việc** |
| Kênh | Email + chat nội bộ; **cấm** log OTP/QR/PII thô vào ticket |
| RPO/RTO (kỹ thuật) | Mục tiêu PRD **RPO ≤ 15 phút, RTO ≤ 2 giờ** — chỉ công bố sau drill trên hạ tầng đích; **không** copy sang SLA support |

## 4. Hệ quả vận hành

1. Privacy copy / Nutrition Labels phải **khớp số** mục 1–2 (không bịa retention khác).
2. Ingest PII ngoài demo **được phép về mặt policy** sau khi privacy + RELEASE-CHECKLIST gates đủ.
3. Deploy `/privacy` hoặc production vẫn cần **ủy quyền task riêng**.
4. On-call Gate ghi rõ người/kênh trong [`RUNBOOK.md`](./RUNBOOK.md) trước claim pilot cửa sổ event.

## 5. Liên kết

- [DECISION-LOG.md](../DECISION-LOG.md) O06  
- [TECHNICAL-DESIGN.md](../TECHNICAL-DESIGN.md) §13 retention, §15 deployment  
- [PRD.md](../PRD.md) khôi phục / bảo mật  
- Evidence #25: `docs/reviews/D5-ISSUE-25-EVIDENCE.md`  
- [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)
