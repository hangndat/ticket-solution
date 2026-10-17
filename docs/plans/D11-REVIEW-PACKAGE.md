# D11 — Gói review mở rộng MVP, trọng tâm UX/UI

> **Đã duyệt triển khai ngày 18/10/2026:** user trả lời “duyệt” cho gói D11. Phạm vi thực thi: web admin theo công việc/readiness; iOS Gate feedback/offline/conflict; attendee web/iOS nhận vé/QR/recovery; brand-test đa tenant và a11y trong các bề mặt đó. Thứ tự wave: web admin ∥ iOS Gate, rồi attendee theo slot ownership. Cho phép workflow feature branch → PR → review độc lập → CI → coordinator integration theo git-workflow. Validate-only/manual lookup, metrics mới, O06 số liệu, publish privacy, production deploy và store submit **không** được tự mở từ phê duyệt này. Các phần “chưa approved” bên dưới là snapshot proposal trước phê duyệt; Task Spec cụ thể và comment approval trên #222 là authority thực thi.


Epic [#222](https://github.com/hangndat/ticket-solution/issues/222) → Story #223 → BA #224 / PD #225 / planner #226. Ngày 18/10/2026. Đây là **đề xuất nghiên cứu/thiết kế**, chưa duyệt implementation.

## Khuyến nghị phạm vi

| Ưu tiên | Kết quả cho người dùng | Thay đổi đề xuất |
| --- | --- | --- |
| P0 | Admin làm đúng việc, đúng sự kiện | Workspace theo nhóm Chuẩn bị / Khách & mã / Cổng / Hỗ trợ; ngữ cảnh tổ chức/sự kiện rõ; ID nội bộ thu gọn; checklist trước xuất bản; trạng thái lưu/lỗi rõ |
| P0 | Nhân viên hiểu ngay kết quả quét | Bố cục scan và kết quả dễ nhìn; phân biệt đã vào/chờ đồng bộ/xung đột/chưa rõ; recovery và queue copy VI theo ADR-18; web offline khóa thao tác |
| P0/P1 | Khách nhận vé và tìm QR dễ hơn | Đường khách có copy dễ hiểu; dữ liệu demo giữ nhãn/đường riêng; flow đăng nhập/đổi mã/kết quả/khôi phục lỗi; thẻ vé có thông tin sự kiện rõ |
| Xuyên suốt | Dễ dùng và nhận đúng thương hiệu | Brand-test ≥2 tenant, không lẫn theme sau chuyển ngữ cảnh; state/copy đầy đủ; responsive, keyboard/focus, hit target, contrast, reduced motion theo checklist PD |
| Optional, chưa chọn vào đợt chính | Công cụ Gate bổ sung | Validate-only và tra cứu thủ công chỉ xem xét sau kiểm tra capability hiện có + review quyền/API; không tự coi là tính năng đã duyệt |

**Wave khuyến nghị sau review roadmap:** một worker **web admin** song song một worker **iOS Gate**; backend/contracts chỉ mở nếu có gap đã thống nhất; reviewer độc lập vào khi có PR. Tiếp theo worker web chuyển sang luồng khách sau khi giải phóng cùng ownership. Không tạo nhiều feature Dispatch cùng slice; không có dependency giả giữa web và iOS.

## Xem và đối chiếu

- [Prototype tương tác — mở hub](../design/d11-prototype/index.html)
- [Nghiên cứu BA: personas, benchmark, pain, stories, metrics](./D11-BA-RESEARCH.md)
- [Thiết kế PD: flows, states, a11y, UI AC, handoff](../design/D11-PRODUCTION-UX-UI.md)
- [Roadmap chi tiết và dependency/wave](./D11-UX-PRODUCTION-PLAN.md)
- [Task specs theo ownership](../tasks/d11/README.md)

## Bằng chứng và giới hạn

Source baseline: `3e61cde42d55654897048d6d627ab6834b54b808`. **Không có commit mới**; docs/prototype đang ở working tree, content hashes nằm trong artifacts review. Không gán baseline SHA cho nội dung mới hoặc deployment.

- [Baseline discovery](../reviews/D11-DISCOVERY-BASELINE.md): Project live D0–D10 Hoàn thành trước D11; public home 200, privacy 404 tại thời điểm kiểm tra.
- [Prototype headless QA](../reviews/D11-PROTOTYPE-HEADLESS-QA.md): **29/29 PASS** trên desktop1280/mobile390; đã sửa 4 lỗi interaction form. Prototype inline có 3 tab hoạt động, không pageerror.
- [Review độc lập BA](../reviews/D11-BA-DOCS-REVIEW.md): **PASS with known gap** cho chất lượng nghiên cứu; một số benchmark WAF/403 không reverify, không có user study/baseline sản phẩm đã đo.
- [Review độc lập PD](../reviews/D11-PD-REVIEW.md): **PASS with known gap** cho thiết kế/prototype; DUPLICATE có matrix nhưng chưa chip tương tác; native/full a11y/device/user research chưa chạy.
- [Review roadmap và revalidation](../reviews/D11-PLAN-REVIEW.md): **PASS** chất lượng kế hoạch/spec proposal sau fix, pin SHA256 cuối; không phải approval coding.
- Link-check cuối: **28 tài liệu**, không thiếu đích liên kết nội bộ; `git diff --check` PASS.

Đây không phải UAT ứng dụng web/iOS, CI code, local iOS build hay nghiệm thu production. Không sửa `apps/**`, contracts, lockfile; không deploy hoặc submit store. Không hồi sinh Android/payment/refund/transfer/seat/Wallet.

## Trước khi triển khai và trước production

1. Review phạm vi roadmap/thiết kế ở trên theo `AGENTS.md`; implementation mới chỉ sau review này. Định hướng mở rộng đã được giao, không hỏi lại quyền BA/PD.
2. O06 retention/region/SLA và nội dung privacy cần quyết định riêng trước dữ liệu người thật/publish policy; không tự điền số hoặc publish “TBD”.
3. Khi triển khai: PR theo ownership, review độc lập exact SHA, CI, headless UAT và local iOS build khi mobile trong scope. Device/venue/user study, capacity/restore/ops evidence vẫn là gate riêng trước claim pilot ready.
4. Production deploy và store submission vẫn cần task ủy quyền riêng. UI đẹp hoặc board Hoàn thành không thay các gate này.

## Cleanup điều phối

Đã release/đóng 7 terminal worker thuộc Run; 9 Dispatch đã settle (2 lần reuse session cho follow-up). Audit host không còn active/reclaimable worker của Run. Không dừng process/simulator/database của người dùng hoặc Run khác.
