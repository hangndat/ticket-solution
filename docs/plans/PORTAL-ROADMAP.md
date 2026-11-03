# Roadmap Portal — phạm vi hiện hành và nguồn triển khai

Ngày đối chiếu tài liệu: 03/11/2026. Phạm vi P0+P1 đã có approval ngày 18/10/2026 cho Epic #406; O23 ngày 24/10 thay quyết định GATE-STAY-APP. Approval không phải bằng chứng đã nghiệm thu/deploy. Status động lấy [Project #3](https://github.com/users/hangndat/projects/3).

Bản proposal, bảng Status và hồ sơ approval trước khi chuẩn hóa được giữ trong [snapshot](../archive/plans/PORTAL-ROADMAP-before-cleanup-2026-11-03.md). Không dùng đoạn chưa duyệt/chưa code trong snapshot làm trạng thái hiện tại.

## 1. Ranh giới đã chốt

- Portal tại portal.vemoki.com, app Next riêng `apps/portal`; không gom vào attendee `apps/web`.
- Tenant admin và Platform zone có client/audience/session/permission phù hợp; tenant Owner không tự có quyền Platform.
- Gate scan/nhập tay/admission chỉ iOS Staff (O23). Portal Gate reporting là read-only theo quyền; GATE-STAY-APP là quyết định cũ đã superseded.
- Stack UI và components theo [ADR-20](../ops/ADR-20-PORTAL-ADMIN.md), bổ sung O26 và [ràng buộc UI Portal](../design/portal-contract.md); không dùng option nghiên cứu cũ để tự đổi dependency.
- Scope/contract/DoD theo Task/Issue đã authorize. Research không cấp thêm quyền production DNS/deploy/cutover/cloud/store.

## 2. Nguồn thực thi theo công việc

- Hoàn thiện sản phẩm/UX sau #406: [roadmap #914](VEMOKI-CORE-UX-ROADMAP-2026-10-26.md), [portal handoff VCX](../design/vcx/README.md), [Decision Log](../DECISION-LOG.md) O25–O28 và bổ sung O26.
- API/BFF/auth boundary: [Portal contract handoff](../architecture/PORTAL-CONTRACT-HANDOFF.md), ADR-20 và contract đã review.
- Mẫu UI/visual budget: [design index](../design/README.md); không coi prototype là runtime.
- F04 Portal regression: [acceptance matrix](../../tests/e2e/ACCEPTANCE.md). Pilot/UAT là [#1008/catalog riêng](PROD-LAUNCH-UAT.md), không tự mở từ roadmap này.
- [Discovery run](../archive/runs/PORTAL-RESEARCH-RUN.md) và [epic tasks ban đầu](PORTAL-EPIC-TASKS.md) là provenance, không phải queue live.

## 3. Nghiệm thu và migration

Mỗi chức năng cần evidence UI → BFF → API → authz → dữ liệu → feedback; không nghiệm thu từ số trang hoặc đổi component. Kiểm tenant/Platform isolation, session/CSRF, audit, idempotency và các nhánh từ chối theo AC. Reviewer nhánh B khác implementer, exact SHA và CI theo DoD.

Mọi migration host/session/route/contract cần Task/ADR và compatibility/recovery plan; không redirect admission về web. Cutover/deploy theo [runbook Portal](../ops/PORTAL-PROD-CUTOVER.md) chỉ khi có authorization. Không rollback database destructive hoặc coi local pass là production/pilot ready.
