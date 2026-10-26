---
name: vemoki-design-system
description: "Đặc tả hoặc duy trì Vemoki Design System trong Task product-design: đối chiếu brand, token, component và UX giữa Web/iOS, lập handoff migration và governance. Không dùng cho sửa UI nhỏ, triển khai code hoặc review độc lập."
---

# Vemoki Design System — capability của Product Design

Dùng skill này **chỉ khi Task Spec giao Design System** cho `product-design` (Liv). Giữ Role ID, persona, ownership và review workflow hiện hành. `impeccable` hỗ trợ thiết kế/render khi Task cần; skill này xử lý nguồn chuẩn và handoff đặc thù Vemoki.

## Xác định nguồn trước khi đặc tả

1. Đọc `AGENTS.md`, Task/AC, các mục áp dụng trong `docs/DECISION-LOG.md`, `docs/agents/ui-workflow.md` và [bản đồ nguồn/migration](references/source-and-migration.md). Xác minh đường dẫn, version/SHA và trạng thái tracked của Brand Guidelines v1.0, Design System 0.1, `brand/vemoki/tokens.json` và handoff trước. Thiếu Brand Kit/draft được giao thì báo Coordinator bổ sung nguồn trước phần đặc tả phụ thuộc; không gọi một draft hoặc file untracked là SoT đã tích hợp.
2. Phân biệt **brand direction**, **design specification đã duyệt** và **token/component đang chạy**. Khi nguồn xung đột, lập bảng khác biệt và chuyển Coordinator quyết định trong thẩm quyền; không tự viết lại O22/O23/O26, Brand Kit hoặc Issue AC. **Loại Portal khỏi phạm vi Vemoki Design System**: theo bổ sung O26, Portal ưu tiên ProComponents chính thức, dùng `antd` khi phù hợp và giữ theme/token mặc định của Ant Design.
3. Không suy ra brand mới đã triển khai từ prototype. Không tạo token SoT thứ hai, shared component package hoặc token generator mới khi chưa có quyết định kiến trúc và evidence cần thiết.

## Handoff cần tạo trong path Task giao

- **Foundations và tokens:** nguồn, trạng thái `đã chốt | đề xuất | đã kiểm runtime`, primitive → semantic → component mapping, alias cũ–mới, ngữ cảnh màu/trạng thái, typography, spacing, radius và breakpoint. Nêu giá trị nào cần kiểm contrast hoặc asset/license.
- **Components và patterns:** inventory trước khi thêm spec; với mỗi component trong scope ghi mục đích, anatomy, variant/state, tương tác, copy/locale, keyboard/focus/screen reader, responsive và ví dụ dùng/sai. Chỉ đặc tả flow sản phẩm đã nằm trong AC.
- **Cross-app và motion:** xác định phần dùng chung về ý nghĩa và adapter Web/iOS; Portal chỉ là ranh giới loại trừ, không nhận token/component/motion system Vemoki. Ghi motion token, feedback nghiệp vụ và reduced motion cho bề mặt trong scope. Gate `queued/unknown` không được diễn tả như admission thành công.
- **Governance:** version, nguồn quyết định, owner, ngoại lệ, deprecation và thứ tự migration; ma trận `giữ | sửa | bỏ`, Task phụ thuộc, evidence thiết kế/runtime cần thu và giới hạn chưa kiểm.

PD sở hữu **đặc tả**, không sửa `apps/**`, shared token/code, Brand Kit hoặc production assets trong Task này. Web/iOS implement theo slice; Dexter chỉ khi có architecture impact thật; Mira review UI/UX độc lập; James làm DoD khi được giao. Coordinator quản lý scope, shared contract, Project và integration. Handoff/prototype không thay review exact SHA, CI hoặc UAT runtime.
