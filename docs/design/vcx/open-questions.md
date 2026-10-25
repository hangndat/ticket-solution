# Điểm còn mở — VCX-S0-T02

| ID | Chủ đề | Trạng thái | Owner / điều kiện đóng |
| --- | --- | --- | --- |
| OQ-1 | `GET imports` list scoped event — phục hồi job không session | Chờ **S0-T03** contract | Architect → backend S3-T01 |
| OQ-2 | `q` trên invitations | Chờ contract; UI có banner fallback | S0-T03 |
| OQ-3 | Endpoint read usage/limit phía tenant | Có thể **không** có — chỉ map error code | S0-T03 → S5-T02 |
| OQ-4 | Segmented «Danh sách / Vận hành» vs hai route | PD chốt **cùng route** + Segmented để giảm nav | Implementer S3-T02 — escalate nếu quá tải tab |
| OQ-5 | Timeline drawer API aggregate | Có thể ghép từ CS/ticket detail hiện có — cần spike BE | Gonic / coordinator |
| OQ-6 | Diff hai revision trên conflict | Optional S2-T04 — MVP chỉ reload | S2-T04 |

**Phiên bản mẫu:** `prototype/vcx-portal-handoff.html` v1 · xác nhận PD Liv trong Issue #923 · consumer implement trên SHA PR handoff.
