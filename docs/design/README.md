# Nguồn thiết kế theo surface

Đối chiếu tài liệu 03/11/2026. Đây là index chọn nguồn, không phải bằng chứng UI đã triển khai hoặc go/no-go.

## Thứ tự đọc

1. Decision Log và AC/Task đã duyệt: O23 Gate chỉ iOS Staff; O25–O28 scope/navigation; O33 waiver a11y UAT theo phạm vi.
2. Concept được duyệt: [Vemoki unified v1](vemoki-unified-v1/README.md) và [design acceptance](vemoki-unified-v1/DESIGN-ACCEPTANCE.md).
3. Delta triển khai: [VD-03](vemoki-unified-v1/VD-03-UI-IMPLEMENTATION-HANDOFF.md); scope sau đó theo [roadmap #914](../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md) và handoff chuyên biệt.
4. Token theo `brand/vemoki/tokens.json` và quyết định Electric Violet ngày 04/11 trong Decision Log cho bề mặt Vemoki. Màu Live Pulse trong VD-03 là lịch sử; không lấy màu từ HTML/CDN prototype để tự đổi dependency/theme production. Portal giữ Ant Design mặc định.

**Visual iOS mới nhất được owner duyệt ngày 05/11/2026:** [board 45 khung và HTML gốc](mobile-approved-wireframes-2026-11-05/README.md), [ADR](../architecture/ADR-MOBILE-WIREFRAMES-2026-11-05.md) và [handoff cho leader](mobile-approved-wireframes-2026-11-05/IMPLEMENTATION-HANDOFF.md). Nguồn này cập nhật phần trình bày iOS trong phạm vi đã duyệt; hành vi/route/quyền vẫn theo Decision Log mới nhất. Bốn delta CTA được ghi riêng, không suy đã triển khai từ ảnh.

## Nguồn theo surface

| Surface                     | Nguồn ưu tiên                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Marketing / attendee web    | Unified concept + VD-03; [FB08 banner/loading delta](UI869-FEEDBACK/README.md) áp dụng đúng phần feedback được giao |
| Attendee / Staff iOS        | O23/O27–O33 + [wireframe 05/11](mobile-approved-wireframes-2026-11-05/README.md) cho visual; Unified/VD-03 là nền và lịch sử. Gate admission chỉ Staff iOS |
| Organizer / Platform Portal | [Ràng buộc Portal](portal-contract.md) + bổ sung O26/ADR-20; [VCX handoff](vcx/README.md) cho khách/vé/import/wizard/conflict/limit theo #914                |
| Acceptance runtime          | Exact source/tested SHA và evidence Task/PR; prototype/review bar/fixture metrics không phải runtime                |

Handoff Portal P0+P1 và bản FB08 Liv đã chuyển vào [archive](../archive/README.md). Guest flow đọc thẳng [gói refactor mobile](../plans/mobile-production-refactor/README.md); không còn pointer trung gian trong design.

## Kho tham khảo theo phiên bản

[current-mockups-2026-10-23](current-mockups-2026-10-23/README.md), [UI uplift](ui-uplift-2026-10/README.md), [Live Pulse freeze](visual-identity-v2/README.md), [UX revamp](ux-ui-revamp/README.md) giữ provenance và các flow/state còn được nguồn mới dẫn chiếu. Chúng không còn là điểm vào chung để chọn visual direction hoặc Gate scope.

Không xóa/move prototype, ảnh hay manifest theo tuổi file: handoff/evidence khác có thể pin path/hash. Khi hai handoff scoped mâu thuẫn, ghi phần xung đột và hỏi owner; không suy toàn bộ package cũ vô hiệu hoặc đã được implement chỉ từ ngày.
