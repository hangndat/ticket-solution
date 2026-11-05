# Electric Violet — nguồn nhận diện runtime

Bộ logo và palette đã được user duyệt; nguồn canonical và cách tái xuất tại [brand/vemoki](../../../brand/vemoki/README.md). SVG dùng outlined Bézier paths, không nhúng raster hoặc dựng wordmark bằng font UI. `brand/vemoki/tokens.json` là SoT duy nhất.

- [Foundations](specs/foundations.md) và [components](specs/components.md) lưu handoff thiết kế; giá trị runtime theo token JSON và Decision Log Electric Violet.
- Web dùng default Electric Violet và giữ published event primary qua scoped alias trong event main. Màu publish không hợp lệ qua parser/fallback; platform header/footer giữ thương hiệu Vemoki.
- Token semantic destructive/admit/unknown, font, spacing/radius, tenant routing và auth/Gate behavior được giữ.

Scope phát hành Web này gồm shared brand/token outputs và `apps/web`; native iOS là consumer riêng. Không nhận thiếu evidence signed-in iOS là đã PASS, không bao gồm Portal/backend/auth changes. UI/runtime evidence local và báo cáo reviewer được dẫn trong PR exact SHA; ảnh UAT không đưa vào Git. Logo kit/proof thiết kế local không phải runtime dependency.

Bản lưu [logo kit, proof và báo cáo thiết kế đã duyệt](archive/approved-kit-2026-11-04/README.md) giữ lại quá trình bàn giao; nguồn runtime hiện hành vẫn ở `brand/vemoki`.
