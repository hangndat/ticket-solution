# Portal — ràng buộc UI và contract

Đối chiếu tài liệu ngày 03/11/2026. Trang này tập hợp các ràng buộc còn dùng từ handoff P0+P1; không phải inventory route/API hoặc bằng chứng nghiệm thu trên HEAD. [Bản handoff 18/10](../archive/design/PORTAL-IMPLEMENTATION-HANDOFF.md) giữ route map, parity P01–P19 và visual V01–V20 để truy vết; các quyết định sau đó có ưu tiên cao hơn.

## 1. Nguồn và phạm vi

| Việc                                       | Nguồn áp dụng                                                                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope và quyền thực thi                    | [Roadmap Portal](../plans/PORTAL-ROADMAP.md), Task/Issue đã duyệt; trạng thái động ở Project #3                                                                             |
| Auth/BFF/Platform                          | [ADR-20](../ops/ADR-20-PORTAL-ADMIN.md); cookie host-only, session/client/audience tenant và Operator tách biệt                                                             |
| Import/invitations, privacy projections    | [Portal contract](../architecture/PORTAL-CONTRACT-HANDOFF.md) và shared contracts đã review; không suy tình trạng API từ bảng READY/GAP ngày 18/10                          |
| Component/theme                            | [Decision Log](../DECISION-LOG.md) **bổ sung O26**: ProComponents cho pattern phù hợp, antd nền tảng, theme/token mặc định Ant Design; không tạo design system Portal riêng |
| Flow khách/vé/import/wizard/conflict/limit | [VCX](vcx/README.md), [scope #914](../plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md) và AC được giao                                                                           |
| Visual web/iOS và các delta                | [Design index](README.md); không áp token/theme Vemoki consumer lên Portal trái bổ sung O26                                                                                 |

Portal là app riêng `apps/portal`, host `portal.vemoki.com`; web và Portal là hai ownership slice theo O25. Tenant Owner không tự có quyền Platform. Admission (quét/nhập tay/confirm) chỉ **iOS Staff** theo O23; không dùng `GATE-STAY-APP`, link web scan hoặc yêu cầu giữ camera web trong bản lưu.

## 2. Điều hướng và quyền

Route context dùng `tenantId` / `eventId`; nhãn hiển thị dùng tên, không bắt người dùng paste UUID khi đã có context. Không tự thêm slug resolver hoặc API mới từ route sketch lịch sử.

| Nhóm / chức năng                   | Ràng buộc                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tổ chức, sự kiện, thiết lập        | Menu và action theo capability server; [O02 contract](o02-permission-nav/contract.md), deny-by-default            |
| Gate reporting                     | Chỉ đọc; `report.read` và assignment phù hợp; không suy từ `gate.confirm`                                         |
| Audit                              | `report.read` + assignment theo ADR-20/Portal contract; không tạo permission `audit.read`                         |
| Inventory browse                   | `inventory.import` + assignment; projection masked; không raw code/`code_hmac`, không permission `inventory.read` |
| CS, export, members, notifications | Quyền và lifecycle theo contract tương ứng; quyền lookup không tự cấp resend/mutation                             |
| Platform                           | Zone `/platform` với Operator audience/session riêng; tenant role không cấp quyền Platform                        |

Client không tự suy quyền từ tên role. Deep-link thiếu quyền phải fail-closed/soft-land theo O02. Giữ allowlist redirect/query, không đưa token/PII lên URL. Menu, breadcrumb và screen group được Task UI điều chỉnh theo flow đã duyệt; bảng route ngày 18/10 không khóa layout mới.

## 3. State và tương tác

| State                         | Hành vi                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| loading / empty               | Giữ context và footprint; thông báo tiến trình hoặc CTA phù hợp quyền                                  |
| ready                         | Hiển thị dữ liệu từ API; không bịa metric/total hoặc trạng thái thành công                             |
| error / unknown               | Lỗi rõ có retry phù hợp; timeout/kết quả chưa rõ là “Chưa rõ kết quả”, cần kiểm tra lại trước mutation |
| permission-denied / suspended | Fail-closed, không hiển thị mutation vượt quyền                                                        |
| stale / offline               | Báo dữ liệu cũ hoặc mất kết nối; chỉ tiếp tục khi contract hỗ trợ                                      |
| async-running / async-failed  | Tiến trình thật từ lifecycle job; ngăn double-submit; retry theo idempotency contract                  |

Pagination dùng cursor server, không bịa page/total. Notification `ACCEPTED` không đồng nghĩa `DELIVERED`; publish config không đồng nghĩa mở redeem/admission. Form có label/lỗi tiếng Việt, focus lỗi hợp lý; destructive action nêu impact/reason, bảo vệ dữ liệu chưa lưu. Modal/Drawer dùng component thư viện, keyboard/focus/return-focus theo component và AC; bulk chỉ khi có API bulk.

## 4. Nghiệm thu

Kiểm UI → BFF → API → authz → dữ liệu → feedback trên exact SHA. Bao gồm tenant/Platform isolation, discovery/session/CSRF, assignment, masked output, idempotency, denied/unknown/stale và các nhánh được AC yêu cầu. Giữ tiếng Việt, responsive và accessibility theo scope/waiver hiện hành; không hồi sinh gate đã được Decision Log thay thế.

[F04 acceptance](../../tests/e2e/ACCEPTANCE.md) và [catalog launch UAT](../plans/PROD-LAUNCH-UAT.md) có scope riêng. Bản lưu P01–P19/V01–V20 là checklist lịch sử, không tự xác nhận PASS hoặc thêm Gate scan web vào UAT. Production deploy/DNS/cutover/store chỉ theo Task đã authorize.
