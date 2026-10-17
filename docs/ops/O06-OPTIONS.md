# O06 — Lựa chọn chưa chốt (retention / vùng dữ liệu / SLA)

**Trạng thái:** mở (DECISION-LOG + ROADMAP).  
**Ràng buộc:** chuẩn bị lựa chọn để product/ops chốt; **không** tự bịa số ngày, region hay SLA.  
**Chặn:** trước khi ingest dữ liệu user thật / production PII.

## 1. Retention & xóa

Cần chốt (mỗi mục một giá trị hoặc “không áp dụng MVP”):

| Hạng mục | Câu hỏi | Gợi ý chiều lựa chọn (không phải quyết định) |
| --- | --- | --- |
| Tài khoản | Giữ / anonymize / xóa cứng sau bao lâu khi user yêu cầu? | Pháp lý địa phương + hỗ trợ khiếu nại vé |
| Vé / check-in | Giữ bao lâu sau event? | Đối soát Gate vs quyền riêng tư |
| Audit log | TTL riêng? | Thường dài hơn transactional |
| Object store (MinIO) | TTL QR/export? | Signed URL hết hạn ≠ xóa object |
| Backup | Backup có bị “undelete” dữ liệu đã xóa? | Policy backup vs erasure |
| Cache client | iOS/Web purge khi logout/switch | Đã có hướng isolate theo user |

Bắt buộc có **policy** trước dữ liệu user thật; giá trị ngày cụ thể vẫn trống cho tới khi product ký.

## 2. Vùng dữ liệu (data residency)

| Lựa chọn khung | Ý nghĩa | Hệ quả kỹ thuật |
| --- | --- | --- |
| A. Single-region VPS | Một quốc gia/region cho Postgres + object + Keycloak | Đơn giản ops; ghi rõ trong DPA |
| B. Split (DB region X, object Y) | Tách lưu trữ | Phức tạp backup/restore; cần ADR |
| C. EU-only / VN-only / … | Ràng buộc pháp lý | Chọn region VPS + backup cùng vùng |

Chưa chọn A/B/C trong repo này. Production self-host (không managed SaaS DB) vẫn phải ghi **vùng vật lý** khi chốt.

## 3. SLA hỗ trợ

| Trục | Cần chốt | Lưu ý |
| --- | --- | --- |
| Giờ hỗ trợ | business-hours vs 24/7 trong cửa sổ event | Gate on-call ≠ email marketing |
| Thời gian phản hồi P1/P2/P3 | phút/giờ | Không copy số RPO/RTO PRD làm SLA support |
| Kênh | email / chat / hotline | Không log PII/OTP/QR vào ticket support |
| RPO/RTO (kỹ thuật) | PRD baseline RPO ≤15 phút, RTO ≤2 giờ là **mục tiêu** — chỉ công bố sau drill trên hạ tầng đích | Drill local #25 đo wall-clock dump/restore, không phải SLO prod |

## 4. Quy trình chốt

1. Product + legal chọn retention + region.
2. Ops chọn SLA support và on-call Gate.
3. Ghi vào DECISION-LOG (đóng O06) + cập nhật runbook.
4. Chỉ sau đó mới ingest user thật ngoài demo realm.

## 5. Liên kết

- DECISION-LOG O06  
- TECHNICAL-DESIGN §13 retention, §15 deployment  
- PRD mục khôi phục / bảo mật  
- Evidence #25: `docs/reviews/D5-ISSUE-25-EVIDENCE.md`
