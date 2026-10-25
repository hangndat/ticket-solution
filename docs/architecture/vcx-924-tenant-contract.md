# VCX #924 — Contract truy hồi import, invitations và hạn mức tenant

**Trạng thái: Đề xuất — đủ để coordinator phân việc triển khai trong scope sau review; chưa phải contract đã được chấp nhận.** Task [#924](https://github.com/hangndat/ticket-solution/issues/924), Epic #914, O25. Source khảo sát tại `a04e71afbc53af4490d0683c1ff680b37a96315a` (base `ac579482b4f8766ff24928112bbba852f3b53b05`); roadmap canonical `docs/plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md` §2–4. Tài liệu này chỉ đề xuất transport contract; không thay API, database, `packages/contracts`, policy cap/đình chỉ, transaction quota, RLS hoặc retention O06.

## Bằng chứng hiện trạng và ranh giới

| Nhu cầu | Quan sát source | Hệ quả |
| --- | --- | --- |
| G-09 | `apps/api/src/inventory.ts:586-622` chỉ có POST `/imports` và GET `/imports/:importId`; `apps/portal/app/api/bff/tenants/[tenantId]/events/[eventId]/imports/route.ts` chỉ có POST. `packages/contracts/src/import-invite.ts:60-75` có `ImportJob` nhưng không có list/page. | Reload không tìm được job nếu mất UUID. |
| G-08 | `apps/api/src/inventory.ts:688-703` và BFF `.../invitations/route.ts:16-28` nhận `cursor`, `limit`, `state`; `packages/backend/src/guest-invitations.ts:114-191` trả `InvitationListPage` với email đã mask. `apps/api/src/cs.ts:233-253` có `q` cho tickets, `apps/api/src/approval.ts:221-253` có `q` UUID request. | Chỉ thêm filter chính xác khi workspace cần tìm một invitation; giữ response hiện có. |
| G-10 | `packages/contracts/src/index.ts:557-562` có `TenantLimitsDto`; `packages/backend/src/platform-tenant.ts:365-420` tính usage, nhưng `apps/api/src/platform/platform-operator.controller.ts:87-126` là route Platform Operator. BFF `/platform/tenants/[tenantId]/limits` chỉ PUT. | Tenant không có đường đọc limits/usage. Không tái sử dụng quyền Operator ở Portal. |
| G-04 | `docs/TECHNICAL-DESIGN.md:227-238` đã chốt scope/hash/retention của operation; BFF import chuyển key vào `Idempotency-Key`, BFF export hiện có fallback tạo UUID (`.../exports/route.ts:44`). | Client phải giữ cả key và payload; BFF không được tạo key thay khi retry. |

Các list/get import và invitations hiện dùng `inventory.import` với event assignment qua `requireTenantPermission` trong transaction `withTenant` (`packages/backend/src/import-jobs.ts:817-840`, `guest-invitations.ts:114-132`). Permission là danh mục đóng (`packages/backend/src/role-map.ts:7-43`); không đề xuất quyền mới. `CursorPage<T>` là `{items,nextCursor}` với limit mặc định 20, tối đa 100 (`packages/contracts/src/common.ts:4-13`).

## Quyết định và phương án

| Gap | Chọn | Phương án khác và đánh đổi |
| --- | --- | --- |
| G-09 | Thêm GET cùng collection `/imports`, projection tóm tắt không PII, keyset cursor. | Bắt client nhớ UUID/local storage ít code hơn nhưng không phục hồi được sau đổi máy, xóa cache hoặc session. |
| G-08 | Thêm `q` **chỉ là UUID invitationId chính xác**, tùy chọn. UI có thể lọc `state`/paging không cần `q`; khi hiển thị ô tìm, nhãn phải là “ID lời mời”. | Tìm email gần đúng dễ dùng hơn nhưng mở bề mặt dò PII và yêu cầu chỉ mục/chuẩn hóa mới. Xem xét lại bằng yêu cầu sản phẩm và security review riêng. |
| G-10 | **Thêm endpoint tenant read-only `/tenants/:tenantId/limits`** cho Owner có `tenant.profile`; giữ error mapping hiện có cho mọi actor. | Chỉ map `TENANT_LIMIT_REACHED`/`RATE_LIMITED`/`RESEND_LIMIT`/`PENDING_LIMIT` ít backend hơn, nhưng S5 không thể có màn xem hạn mức/usage như G-10. Endpoint cần task backend riêng `dod+sec` trước S5-T02; tài liệu này không cấp quyền đọc cho Manager/CS. |

### G-09 — GET danh sách import jobs

`GET /v1/tenants/:tenantId/events/:eventId/imports?cursor=&limit=&status=&kind=`; BFF GET cùng path trong `/api/bff`. Query `cursor` opaque (client không phân tích), `limit` số nguyên 1–100, mặc định 20; `status` thuộc `ImportJobStatus`, `kind` thuộc `ImportKind`. Bỏ query giữ hành vi POST hiện có; query lạ hoặc sai kiểu trả 422 `INVALID_FILTER`/`INVALID_CURSOR` (bổ sung hai code transport trong `ImportErrorCode`), không âm thầm bỏ qua. Cursor gắn tenant, event và bộ filter; dùng thứ tự `(created_at DESC, id DESC)`, keyset query `limit+1`, trả `CursorPage<ImportJobSummary>`. Cursor không phải capability: mỗi trang kiểm lại authz, scope, RLS và filter; cursor chéo scope/filter trả 422 `INVALID_CURSOR` đồng nhất. Không hứa snapshot: job status có thể đổi giữa các trang, thứ tự dựa trên `created_at` bất biến; client refresh trang đầu để thấy job mới.

`ImportJobSummary = Pick<ImportJob, 'importId'|'kind'|'status'|'sourceId'|'ticketTypeId'|'mappingRevision'|'previewRevision'|'validRowCount'|'errorRowCount'|'invitationCount'|'estimatedQuota'> & {createdAt: string}`. `createdAt` UTC ISO 8601. Không trả `fileHash`, file ID/key, raw CSV, sample error, email, token, report URL hoặc `replayed`. Sau khi chọn item, client gọi GET `/imports/:importId` hiện có để lấy chi tiết; detail không đổi. Import thuộc event khác, kể cả cùng tenant, không xuất hiện trong list và GET detail vẫn kiểm scope. Có thể bỏ `status`/`kind` khỏi bản đầu nếu UI không cần, nhưng khi triển khai đã công bố thì phải test filter-bound cursor.

Auth: bearer + membership còn hiệu lực + `inventory.import` trên event, deny-by-default; không mở cho `report.read` hay tenant Owner thiếu assignment. Không có job → 200 `{items:[],nextCursor:null}`. Thiếu auth 401; thiếu quyền 403; event không tồn tại/không được phép biết 404 theo policy ẩn tài nguyên; tham số sai 422; bảo vệ tải 429 `RATE_LIMITED` + `Retry-After` nếu limiter áp dụng; lỗi tạm thời 503, không đổi meaning của `IMPORT_NOT_FOUND` ở detail. Response `Cache-Control: private, no-store`. Audit: log metadata actor/tenant/event/filter/count/requestId, không log cursor thô hay dữ liệu CSV; không tạo business audit row cho GET trừ khi policy audit đọc hiện hành yêu cầu.

### G-08 — `q` invitations có điều kiện

`GET /v1/tenants/:tenantId/events/:eventId/invitations?cursor=&limit=&state=&q=`; thêm `q?: string` vào query type, BFF allowlist và backend. `q` vắng mặt giữ nguyên byte shape `{items,nextCursor}` và `InvitationSummary` (email chỉ masked). Nếu có, `q` phải là UUID invitationId đầy đủ, không hỗ trợ prefix/email/phone; giá trị sai trả 422 `INVALID_FILTER` trước query. Kết hợp `q` với `state` theo AND; cursor vẫn theo thứ tự `created_at DESC,id DESC` và gắn bộ filter để tránh trộn trang. Quyền `inventory.import` + event assignment như route hiện tại; kết quả không có/mismatch trả list rỗng, không có lỗi phân biệt ID thật/không thật. Cùng bộ HTTP 401/403/404/422/429/503 và `no-store` như G-09. Không log `q` dạng raw; audit chỉ event, actor và cờ có filter.

### G-10 — GET limits/usage phía tenant

`GET /v1/tenants/:tenantId/limits` (BFF `/api/bff/tenants/:tenantId/limits` qua **staff** bearer, không đi qua `/platform` hoặc `forwardPlatformBearer`). Không có paging/query. Response đề xuất:

```ts
interface TenantLimitsUsageReadDto {
  tenantId: string;
  limits: TenantLimitsDto; // null = không đặt cap; không suy ra "unlimited" thương mại
  usage: {
    events: number;
    staffActive: number;
    staffPendingInvites: number;
    emailToday: number; // ngày UTC, theo usage counter hiện hành
  };
  asOf: string; // UTC ISO 8601, thời điểm đọc DB
  emailUsageDate: string; // YYYY-MM-DD UTC
}
```

Auth: membership ACTIVE với `tenant.profile` (Owner hiện có), deny-by-default; Manager/CS/Supervisor/Scanner không đọc tổng tenant. Với actor khác, Portal vẫn map error code trả về từ action cụ thể và hướng họ tới Owner, không giả lập usage. Truy vấn tenant-scoped dùng runtime tenant transaction-local + RLS, parameterized SQL; **không gọi** `platform_tenant_usage_counts` bằng quyền Platform (`migration 202610170012_d4_platform_m01` chỉ GRANT cho `ticket_platform_runtime`). Backend cần đối chiếu các table/GRANT/RLS khi triển khai; không tạo SECURITY DEFINER hay bypass role để đạt kết quả. Nếu quyền đọc cần mở rộng, báo coordinator để quyết định riêng, không ngầm thay role map. Usage là snapshot để giải thích cap, không phải căn cứ cấp quota/điều chỉnh cap; count email theo UTC hiện hành, không hứa realtime hoặc nhất quán xuyên request. `importRowsPerJob` là trần mỗi job, không có usage tổng tương ứng. Không hiện trạng thái đình chỉ, lý do nội bộ, contact hay version quản trị Platform.

401 thiếu auth, 403 thiếu `tenant.profile`, 404 tenant không tồn tại hoặc không được phép biết theo policy ẩn tài nguyên, 429 `RATE_LIMITED` + `Retry-After`, 503 dependency tạm lỗi; `ApiError` hiện có. Không phân biệt tenant ID tồn tại trong response cho người không có quyền; `Cache-Control: private, no-store`. Audit access ở request log với actor/tenant/requestId, không log member/email cá nhân; không business audit mutation. BFF không cache/snapshot cross tenant. Mapping UI theo code hiện hữu: `TENANT_LIMIT_REACHED` dẫn tới màn limits nếu Owner, người khác nhận hướng liên hệ Owner; `RATE_LIMITED` theo `Retry-After`; `RESEND_LIMIT` chỉ resend; `PENDING_LIMIT` chỉ pending redemption. Không gộp các mã này thành một cap và không đổi policy O06.

## G-04 — Idempotency theo một ý định ở client

Một `Intent` gồm `{tenantId,eventId?,actorId,command,key,payload,createdAt,state,resourceHint?}`. Trước request đầu, tạo UUID key một lần **sau khi** chốt payload gửi thực tế (gồm revision, IDs, filter/file reference); giữ cả key và bản payload bất biến, chỉ trong phạm vi actor/tenant hiện tại. BFF chỉ forward key client cho mutation đã hỗ trợ `Idempotency-Key`; không tự sinh fallback (đặc biệt export). Không đổi route/header/backend hash hiện có. Double-click dùng cùng in-flight promise; timeout/network mất response → `unknown`, retry có giới hạn với **đúng key, đúng payload, đúng command/context** và backoff/`Retry-After`; không claim thất bại hay tạo key mới chỉ vì HTTP timeout. Đổi tenant/event/actor thì hủy view/in-flight local và cô lập intent cũ, không replay vào context mới.

Để khôi phục sau reload, lưu intent tối thiểu có thời hạn trong storage theo actor + tenant + command, **không lưu token, raw CSV, email, PII, URL ký, secret**; payload nhạy cảm chỉ giữ trong memory, và nếu không dựng lại được chính xác thì đi thẳng đối soát. Với create import/export, đối soát bằng GET list (import sau G-09, export đã có) + detail và dấu hiệu nguồn thời gian/status; với operation khác dùng GET trạng thái tài nguyên/đối soát nghiệp vụ sẵn có. List không phải lookup idempotency theo key và không tự chứng minh operation đã commit; trường hợp không xác định giữ trạng thái `unknown`, hướng người dùng kiểm tra/hỗ trợ, không tự phát lại bằng key mới. Khi có terminal success/rejection được xác nhận, dọn intent. Sửa form khi `unknown` phải đối soát hoặc người dùng xác nhận ý định mới **sau khi** hiểu nguy cơ thao tác cũ đã thành công.

`409 IDEMPOTENCY_CONFLICT`/payload mismatch: dừng retry, giữ intent để điều tra và đối soát; không đổi key ngầm. Key quá retention: thời hạn backend không được suy từ TTL client và O06 chưa chốt; khi client không còn tin key được giữ, **không replay tự động**, đối soát trước. Nếu backend trả terminal rejection đã lưu và điều kiện kinh doanh được sửa, đó là ý định mới có key mới sau xác nhận. Chỉ áp pattern cho mutation có idempotency contract hiện hữu; những mutation thiếu contract cần task backend/contract riêng, không gắn header rồi giả định an toàn. Tests S1-T04: server commit mất response, double-click, reload, đổi context, key cũ, mismatch, không có đường đối soát.

## Security, triển khai và evidence cần có

| Checklist | Bắt buộc xác minh ở implementation |
| --- | --- |
| Tenant scope/RLS | Mỗi list/read dùng `withTenant`, tenant transaction-local, query parameterized với tenant + event rõ; test tenant A/B, event A/B, cursor chéo scope. Runtime role không owner/bypass RLS. |
| Permission deny-by-default | `inventory.import` + assignment cho hai list; `tenant.profile` cho limits; revoke giữa hai trang/reload phải trả denied. Không tin menu/BFF làm authz authority. |
| PII response | Import summary không raw CSV/hash/error report; invitation giữ masked email; limits chỉ aggregate. Snapshot/console/log không chứa PII, no-store. |
| IDOR/enumeration | ID/cursor khác tenant/event và `q` ID lạ không tiết lộ bản ghi; không search email/prefix; 404/empty theo route policy, latency/limit kiểm thử theo khả năng. |
| Rate limit | Bounded 1–100, index `(tenant_id,event_id,created_at,id)` và filter khi cần; bảo vệ q/scan, 429 + Retry-After; không tạo queue/service mới. Đo query plan/p95 trước claim capacity. |
| Audit | Authz/denied/read request metadata và requestId theo logging hiện hành, không đưa payload/PII/cursor vào log; mutation audit/idempotency hiện có không đổi. |

Coordinator áp additive types/endpoints vào `packages/contracts` trong PR riêng ref #924, rồi giao backend S3-T01 cho imports và optional `q`; **tạo task backend limits riêng, reviewer James hoặc reviewer độc lập `dod+sec`, trước S5-T02**. Backend triển khai/xác minh HTTP, RLS, permissions, privacy, rate limit và index; Portal/BFF thêm GET allowlist + state UX sau khi contract/API có thật. Rollout theo thứ tự types → backend → BFF/UI; client cũ không gọi route mới, POST/detail/InvitationListPage cũ không đổi. Rollback UI/BFF về không gọi route mới; giữ endpoint read-only không đổi state. Mọi thay đổi policy/permission rộng hơn quay lại coordinator.

**Giới hạn:** Chỉ static source review, chưa chạy DB/runtime/CI hoặc security test trên implementation chưa có. #901/#903/#904/AR891-INT-F01 vẫn hoãn; nếu lỗi đó tái hiện chặn test local, coordinator áp B-02 của roadmap. Đủ để triển khai trong scope **sau review contract**; acceptance complete và pilot ready cần exact-SHA reviewer/CI/runtime evidence riêng.
