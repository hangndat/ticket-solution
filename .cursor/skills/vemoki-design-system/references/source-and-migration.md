# Nguồn chuẩn và migration — kiểm kê 26/10/2026

Đây là bản đồ để **đặc tả** Design System, không phải quyết định tự động thay brand hoặc lệnh triển khai. Đối chiếu lại khi Task bắt đầu vì trạng thái repo/Issue có thể đổi.

| Nguồn | Trạng thái tại base `0fcda837765a049f01ae28d362eaa9f33a091980` | Cách dùng |
| --- | --- | --- |
| `docs/DECISION-LOG.md` O22, O23, O26 và `docs/ops/ADR-22-WEB-DS-ACETERNITY.md` | Tracked, đã chốt | O22: Web Tailwind v4 + `@ticket/ui`, token SoT hiện hành `brand/vemoki/tokens.json`; O23: Gate admission chỉ iOS Staff; O26: Portal UI mới dùng `antd` mặc định, ProComponents/custom hiện có chờ migration theo Task. |
| `brand/vemoki/tokens.json` | Tracked, Live Pulse v2 | SoT **implementation hiện hành** cho các bề mặt Vemoki ngoài Portal. Generator đã có tại `packages/ui/scripts/generate-tokens.mjs`, xuất CSS và TS mobile; không tạo pipeline song song. |
| `docs/design/vemoki-unified-v1/` và handoff Liv #789/#875/#923 | Tracked, evidence/handoff lịch sử | Baseline để kiểm kê, không chứng minh UI runtime hoặc brand mới đã được áp dụng. Giữ nguyên nghiệp vụ O23 và các findings/acceptance gate. |
| `docs/design/design-system/Vemoki-Brand-Guidelines-v1.pdf` | **Untracked trong working tree nguồn** khi lập PR capability; SHA-256 `2e10e90488bf6b56f120ba9a11fa74be84431e7f2c512b29faf01369eeb055eb` | User đã chọn hướng brand mới. Đối chiếu bản PDF/asset được cung cấp trước khi dùng làm nguồn versioned; không sửa Brand Kit. PDF nêu Connect V, Indigo `#5635E8`, Lime `#C5F52A`, Ink `#19152E`, White `#FFFFFF`, DejaVu Sans 400/700 và motion 180–240 ms. |
| `docs/design/design-system/vemoki-design-system-v0.1/` | **Untracked trong working tree nguồn**; `tokens/tokens.json` SHA-256 `ce55394439c8483a16c4fd43a8d94b08f40abb0623b5a1d30d7c72bb4951dad6` | Draft/prototype, không phải component library hoặc spec v1.0 đã nghiệm thu. Neutral/status colors, spacing, radius, breakpoint, component API và accessibility runtime còn cần xác minh. |
| [Epic #766](https://github.com/hangndat/ticket-solution/issues/766) | OPEN, nội dung vẫn pin Live Pulse v2; không gắn Project #3 tại lần kiểm kê | Có Web DS implementation scope. Điều chỉnh scope/decision trước khi giao migration theo brand mới; không tạo Epic Web DS trùng. |

## Compatibility cần giải trước implementation

1. **Quyết định brand:** yêu cầu user chuyển sang hướng Brand Guidelines v1.0 đã có trong cuộc trao đổi, nhưng O27 chỉ là thay đổi local chưa tích hợp tại thời điểm lập PR này. Coordinator phải reconcile quyết định, roadmap và Issue áp dụng trước khi PD đóng băng spec hoặc Web/iOS sửa token. Không sửa im lặng lịch sử O22/O23/O26.
2. **Token:** lập mapping tên/giá trị Live Pulse → foundation mới và tác động CSS `@theme`, legacy variables, TS mobile. Dùng pipeline SoT hiện hành sau khi thay đổi được duyệt; xác định fallback, visual regression và thứ tự rollout. Không gán token semantic nghiệp vụ `admit/unknown` theo màu brand nếu làm sai trạng thái Gate.
3. **Component:** kiểm kê `packages/ui`, Web và iOS trước. Chỉ mở rộng component hiện có trong Task implementation theo owner; không tạo shared package/generator mới vì DS draft có danh sách component.
4. **Portal:** O26 là quyết định UI mới nhất: `antd` mặc định; ProComponents đang tồn tại cần migration riêng. Nếu yêu cầu giữ ProComponents cho **UI mới** được chốt sau O26, Coordinator phải ghi quyết định thay thế rõ ràng trước khi áp dụng.
5. **Evidence/gates:** Brand Kit và prototype không chứng minh contrast theo ngữ cảnh, screen reader, Dynamic Type, viewport hoặc thiết bị thật. Thiết kế, code complete, acceptance và pilot ready là các trạng thái khác nhau. #874 đang Bị chặn ở acceptance; không reset hoặc gộp blocker đó vào capability.

## Trình tự đề xuất

PD xác minh nguồn và inventory → Coordinator chốt xung đột/phiên bản nguồn → PD hoàn thiện spec và Mira review độc lập khi Task giao → Coordinator chia migration theo slice Web/iOS trên Issue hiện có hoặc Task không trùng → owner triển khai, reviewer/DoD kiểm exact SHA và runtime evidence. PR capability này chỉ thêm hướng dẫn; không mở Task hoặc thay trạng thái Project.
