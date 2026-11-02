# Nguồn thiết kế theo surface

Đối chiếu tài liệu 03/11/2026. Đây là index chọn nguồn, không phải bằng chứng UI đã triển khai hoặc go/no-go.

## Thứ tự đọc

1. Decision Log và AC/Task đã duyệt: O23 Gate chỉ iOS Staff; O25–O28 scope/navigation; O33 waiver a11y UAT theo phạm vi.
2. Concept được duyệt: [Vemoki unified v1](vemoki-unified-v1/README.md) và [design acceptance](vemoki-unified-v1/DESIGN-ACCEPTANCE.md).
3. Delta triển khai: [VD-03](vemoki-unified-v1/VD-03-UI-IMPLEMENTATION-HANDOFF.md); scope sau đó theo [roadmap #914](../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md) và handoff chuyên biệt.
4. Token theo brand source và theme của slice được VD-03 chỉ định. Không lấy tên palette cũ hoặc HTML/CDN prototype để tự đổi dependency/theme production.

## Nguồn theo surface

| Surface                     | Nguồn ưu tiên                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Marketing / attendee web    | Unified concept + VD-03; [FB08 banner/loading delta](UI869-FEEDBACK/README.md) áp dụng đúng phần feedback được giao |
| Attendee / Staff iOS        | Unified product + VD-03, rồi O25–O28/Task UX #914; Gate admission chỉ Staff iOS                                     |
| Organizer / Platform Portal | VD-03 + O18/ADR-20; [VCX handoff](vcx/README.md) cho khách/vé/import/wizard/conflict/limit theo #914                |
| Acceptance runtime          | Exact source/tested SHA và evidence Task/PR; prototype/review bar/fixture metrics không phải runtime                |

## Kho tham khảo theo phiên bản

[current-mockups-2026-10-23](current-mockups-2026-10-23/README.md), [UI uplift](ui-uplift-2026-10/README.md), [Live Pulse freeze](visual-identity-v2/README.md), [UX revamp](ux-ui-revamp/README.md) giữ provenance và các flow/state còn được nguồn mới dẫn chiếu. Chúng không còn là điểm vào chung để chọn visual direction hoặc Gate scope.

Không xóa/move prototype, ảnh hay manifest theo tuổi file: handoff/evidence khác có thể pin path/hash. Khi hai handoff scoped mâu thuẫn, ghi phần xung đột và hỏi owner; không suy toàn bộ package cũ vô hiệu hoặc đã được implement chỉ từ ngày.
