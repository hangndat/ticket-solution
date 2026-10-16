# Technical Design — Event Ticketing Platform

Phiên bản: 0.1 — Proposed, để review và làm spike trước triển khai  
Ngày: 2026-10-16  
Đặc tả sản phẩm: [PRD v0.2](./PRD.md)  
Phạm vi: web + app iOS; backend NestJS; Android giai đoạn sau.

## 1. Kết luận thiết kế

Dùng modular monolith NestJS, PostgreSQL làm nguồn dữ liệu chuẩn, Redis/BullMQ cho tác vụ nền. API và worker có deployment riêng; cùng repository và domain modules. Web Next.js và iOS React Native/Expo dùng cùng REST API có OpenAPI contract.

Không tách microservices trong bản đầu. Cấp vé, quota, idempotency, audit và outbox phải commit cùng một transaction PostgreSQL. Check-in có giao thức reserve/confirm với kết quả bền vững để khôi phục sau timeout. Không dùng distributed lock Redis để bảo đảm tính đúng của vé.

Thiết kế nhắm đến event có khoảng 50.000 người dùng/người tham dự, nhưng đây chưa phải xác nhận 50.000 concurrent users. Capacity chỉ được công bố sau benchmark trên hạ tầng xác định. Mục tiêu tải trong PRD là baseline pilot, không phải cam kết cho mọi event 50k.

Các quyết định trong tài liệu là đề xuất kỹ thuật, không tự biến các giả định sản phẩm thành yêu cầu đã được duyệt.

## 2. Các quyết định chính

| ID | Quyết định | Lý do / đánh đổi |
|---|---|---|
| ADR-01 | NestJS + TypeScript, Fastify adapter | Đồng bộ ngôn ngữ; kiểm tra tương thích plugin trước pin phiên bản |
| ADR-02 | PostgreSQL shared schema + RLS + backend authorization | Cách ly nhiều lớp; bắt buộc test connection pooling, role và worker |
| ADR-03 | Prisma cho CRUD; SQL tham số hóa cho hot transaction và policy | Không ép ORM biểu diễn toàn bộ locking/RLS |
| ADR-04 | PostgreSQL outbox → BullMQ → worker idempotent | Chấp nhận giao việc ít nhất một lần; không hứa gửi email exactly-once |
| ADR-05 | Quota dùng counter transaction, lock nhất quán | Ưu tiên tính đúng; event counter có thể thành điểm tranh khóa |
| ADR-06 | Check-in online reserve/confirm | Không cam kết chống trùng toàn hệ thống khi các cổng mất kết nối |
| ADR-07 | App chung có hai chế độ là baseline tạm | Không khóa phương án white-label khi sản phẩm chưa chốt |
| ADR-08 | Cấu hình có schema/version, template giới hạn | Bảo trì được qua nhiều event và nhiều phiên bản app |
| ADR-09 | Managed OIDC, Authorization Code + PKCE cho iOS | Không tự xây giao thức identity; provider là dependency cần chốt qua spike |
| ADR-10 | Admission control trước khi cần sharding quota | Hạn chế contention và bảo vệ DB; không cam kết FIFO tuyệt đối |

Chưa khóa version framework, SDK, database hoặc cloud provider. Khi scaffold phải chọn bộ phiên bản được hỗ trợ, pin lockfile và đối chiếu tài liệu đúng phiên bản.

## 3. Topology và ranh giới tin cậy

### 3.1 Thành phần triển khai

| Thành phần | Vai trò | Scale / lưu trạng thái |
|---|---|---|
| CDN/WAF | Public event pages, assets, bot/rate controls | Không cache API cá nhân |
| Next.js public web | Portal và web ticket view | Cache theo tenant/event/config version |
| Next.js admin/Gate | Tenant admin, platform console, Gate dự phòng | Authenticated, no-store |
| NestJS API | Authz, tenant context, domain commands/queries | Stateless, nhiều instance |
| Gate API pool | Cùng code API, ưu tiên tài nguyên cho check-in | Deployment và DB connection budget riêng |
| Outbox relay | Claim outbox rồi enqueue | Lease ngắn, retry và reconciliation |
| Workers | Email, push, import/export, aggregate | Queue/concurrency riêng từng nhóm |
| PostgreSQL primary + standby | Vé, quota, check-in, audit | Read/write critical qua primary |
| Redis | BullMQ, rate limit, cache không quan trọng | Không quyết định vé đã cấp/đã vào |
| Object storage | Asset, import, export, bản render nếu cần | Private, URL ký ngắn hạn |
| Managed OIDC | Identity, verification, MFA | Backend kiểm tra token và session |

Gate API pool giảm cạnh tranh CPU/connection nhưng vẫn dùng cùng PostgreSQL; không coi đây là cách ly hoàn toàn. Import/export và dashboard phải có statement timeout, concurrency cap và cơ chế giảm tải khi cổng bận.

Public directory chỉ chứa tenant/event đã publish và metadata công khai. Không mở anonymous RLS read trên bảng chứa draft hoặc PII. Asset công khai có bước publish riêng; file import/export luôn private.

### 3.2 Hướng truy cập

- Browser admin dùng session cookie HttpOnly, Secure, host-only qua BFF/proxy cùng origin; mutation kiểm tra CSRF/Origin. Token OIDC không nằm trong localStorage.
- iOS dùng bearer token ngắn hạn; refresh token trong Keychain/SecureStore. Public web đăng nhập dùng session riêng.
- BFF không được tự cấp tenant context hoặc permission; NestJS xác minh session và quyền.
- Mọi tenant API đều resolve tenant/event từ đường dẫn và tài nguyên thực tế, sau đó kiểm tra actor. Subdomain không phải bằng chứng quyền.
- App/browser không kết nối trực tiếp PostgreSQL, Redis hoặc email provider.
- Queue message chỉ có resource ID và envelope metadata; worker không tin tenant_id/message payload mà bỏ qua kiểm tra DB.

## 4. Repository và domain boundaries

```text
apps/
  web/                 Next.js: portal, admin, platform console, web Gate
  mobile/              Expo iOS: attendee và staff mode
  api/                 NestJS HTTP bootstrap
  worker/              NestJS background bootstrap
packages/
  backend/             NestJS domain modules và repositories
  api-client/          TypeScript client sinh từ OpenAPI
  contracts/           DTO/schema public, error codes, config schema
  brand-tokens/        Token format; không chia sẻ web/native components
  tooling/             Lint, TypeScript, test config
infra/                 IaC, manifests, migrations deployment
```

Các module backend: Identity, Tenancy, Authorization, Events, Branding, Inventory, Redemptions, Tickets, Gate, Notifications, ImportsExports, Reporting, Audit, PlatformOps.

Mỗi module sở hữu bảng/repository của mình. Redemption service điều phối transaction cấp vé qua repositories cùng transaction handle; không gọi HTTP giữa các module. Không emit in-memory event rồi trông chờ worker nhận được.

Web/app chia sẻ API contract và validation tiện ích, không import Prisma model, policy quyền hoặc secret của backend. Validation server là nguồn quyết định cuối.

## 5. Identity, membership và ownership

### 5.1 Identity

- `users` ánh xạ `(issuer, subject)` từ OIDC; không dùng email làm khóa identity duy nhất.
- Provider phải hỗ trợ verified email, mobile PKCE, refresh token rotation, MFA staff và xuất/xóa identity theo policy.
- Chỉ liên kết account sau bằng chứng xác thực cả hai phía hoặc quy trình provider được kiểm chứng; không auto-link chỉ vì email giống nhau.
- Email matching dùng canonicalization nhất quán với identity provider; không tự bỏ dấu chấm hoặc dấu cộng. Identity nội bộ dùng user ID.
- Người nhận khách mời phải chứng minh sở hữu email mời trước claim; user có email khác không tự nhận được vé đó.
- Chưa xác minh email: được xem form và lưu nháp, không giữ mã/quota, không tạo pending request khóa mã.

### 5.2 Authorization

User có thể là attendee mà không có membership quản trị tenant. Membership và event assignment dành cho staff/organizer; quyền sở hữu vé là một cơ chế khác.

- Tenant routes: membership active + permission cụ thể + event assignment nếu cần.
- Attendee routes: `owner_user_id = actor_id`; chỉ trả vé/yêu cầu của actor.
- Platform routes: role riêng và support grant có tenant, scope, reason, expiry; không dùng quyền platform để mặc định đọc mọi PII.
- Permission là enum code ổn định, ví dụ `ticket.read`, `ticket.resend`, `gate.confirm`, `gate.undo`, `event.publish`.
- Không tin role claim cũ để thực hiện mutation. Membership/session phải được kiểm tra từ DB ở request quan trọng.

Để đáp ứng yêu cầu thu hồi quyền: gate/issue mutation lấy shared lock trên staff membership/session đang active; lệnh thu hồi lấy lock xung đột. Một thao tác đã commit trước thu hồi vẫn hợp lệ; sau khi thu hồi commit, request mới bị từ chối. Chốt thứ tự lock để không tạo vòng deadlock. Attendee issuance khóa session tương ứng khi kiểm tra revocation.

### 5.3 My Tickets nhiều tenant

Tách đường query read-only theo owner, không yêu cầu attendee giả làm tenant staff. RLS cho identity reader chỉ cho đọc vé của chính actor và projection event công khai/được phép cho vé đó. Không mở general tenant CRUD cho role này. Nếu cần trả nhiều tenant, API aggregate projection theo ownership, không bật BYPASSRLS.

## 6. Tenant isolation và PostgreSQL RLS

### 6.1 Quy tắc schema

- Tất cả entity tenant-scoped có `tenant_id NOT NULL`; entity event-scoped có `event_id NOT NULL`.
- Mỗi bảng cha có UNIQUE `(tenant_id, id)`; event có UNIQUE `(tenant_id, id)`.
- Foreign key composite bảo đảm quan hệ không trỏ event/loại vé/nguồn thuộc tenant khác. Với entity cùng event dùng `(tenant_id, event_id, id)` khi cần.
- Không cho client sửa tenant_id/event_id sau tạo.
- `users`, identity mapping và public directory là các bảng global có quyền riêng, không dùng chung generic tenant repository.

### 6.2 Transaction context

Mọi tenant repository chạy trong explicit transaction, dùng cùng transaction connection:

```sql
SELECT set_config('app.tenant_id', $1, true);
SELECT set_config('app.actor_id', $2, true);
```

`true` giới hạn setting trong transaction. Không đặt context ở pool connection rồi chạy Prisma query ngoài transaction. Mọi lệnh dưới đây chỉ được gọi bằng transaction client; repository không nhận global Prisma client.

Policy mẫu cho bảng chỉ phục vụ tenant staff/worker:

```sql
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ticket_types
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
```

Đây là lớp tenant boundary; không thay backend permission checks. Ticket owner read policy phải là policy role-specific riêng; không thêm policy permissive rộng làm vô hiệu boundary.

### 6.3 Database roles

| Role | Quyền |
|---|---|
| Migration owner | DDL; credentials chỉ cho deploy job |
| Tenant API writer | DML cần thiết, không owner/superuser/BYPASSRLS |
| Identity reader | Read projection theo actor ownership, không mutation tenant |
| Worker | DML theo tenant context và loại job |
| Relay dispatcher | Chỉ claim/ack outbox envelope qua function giới hạn |
| Reporting | Read tenant-scoped, không ghi bảng nghiệp vụ |

RLS context không tự chống SQL injection từ role có khả năng đặt context; SQL luôn tham số hóa và service là ranh giới tin cậy. Không quảng cáo RLS như biện pháp bảo vệ khi credentials backend đã bị chiếm.

Dispatcher cần thấy việc của nhiều tenant: chỉ được EXECUTE function SECURITY DEFINER nhỏ, có `search_path` cố định, không dynamic SQL, không trả PII. Function claim trả outbox ID/tenant ID/type/resource ID; worker vào transaction RLS riêng để xử lý. Tất cả use-case vượt tenant phải được review riêng.

## 7. Data model và invariants

UUID cho ID; timestamp dùng UTC `timestamptz`; event lưu IANA timezone để render. Database time quyết định deadline. JSONB chỉ dùng nội dung/cấu hình/schema form đã version; quota, quyền, mã và trạng thái phải là cột có constraint.

| Bảng | Trường/ràng buộc quan trọng |
|---|---|
| tenants | id, slug unique, status, brand_version |
| users / identities | id; UNIQUE issuer+subject; không chứa tenant role global |
| memberships | tenant_id, user_id, role, status; UNIQUE tenant+user |
| event_assignments | tenant, event, membership, permissions |
| sessions | user, provider_session, revoked_at, expires_at |
| support_grants | operator, tenant, scopes, reason, expires_at |
| events | tenant, id, slug, status, windows, timezone, published_config_id |
| event_config_versions | tenant, event, version, schema_version, payload, author; immutable khi publish |
| ticket_types | tenant, event, id, label, entitlement_snapshot_version |
| issuance_sources | tenant, event, id, approval_mode, deadline |
| source_ticket_types | tenant, event, source, type; allowlist |
| quota_buckets | tenant, event, scope, scope_id, capacity nullable, allocated; CHECK allocated>=0 và capacity null hoặc allocated<=capacity |
| redemption_codes | tenant, event, code_hmac, source, type, status, active_request_id; UNIQUE tenant+event+code_hmac |
| event_attendees | tenant, event, user, canonical_email, profile; UNIQUE event+user và event+canonical_email theo policy |
| attendee_counters | tenant, event, attendee, issued_count; dùng serialize giới hạn vé/người |
| redemption_requests | tenant, event, actor, code, status, expiry, form_version, terms_version |
| tickets | tenant, event, owner, type, source, request_id unique, redemption_code_id nullable, state, credential_version, entitlement_snapshot |
| ticket_credentials | tenant, ticket, version, kid, token_hash, encrypted_token, status |
| gates / staff_sessions | tenant, event, gate, actor, device; quyền và revocation |
| checkin_reservations | ticket, staff_session, token_hash, expires_at, status; tối đa một HELD/ticket |
| checkins | tenant, event, ticket, operation, confirmed_at, undone_at; tối đa một record chưa undo/ticket |
| operations | tenant, event, actor, scope, key, request_hash, response_json; UNIQUE scope+actor+key trong tenant/event |
| outbox | tenant, event, type, aggregate_id, payload_version, lease, status, attempts |
| notifications / attempts | business_key unique, provider_ref, state, attempts, next_attempt_at |
| imports / exports | tenant, event, owner, status, private_object_key, expiry |
| audit_logs | tenant, event, actor, action, resource, reason, sanitized diff, operation |

Indexes bắt đầu bằng tenant/event cho query scoped; thêm owner index cho My Tickets, code_hmac lookup, notification due, outbox due, audit time và check-in ticket. Validate query plans với dataset đại diện, không index mọi cột.

### Invariants bắt buộc

1. Một mã chỉ dẫn đến một ticket đã phát; hủy ticket không tự tái sử dụng mã.
2. Một request chỉ tạo tối đa một ticket.
3. Mọi ticket ACTIVE được tính vào quota theo policy allocation; counter không vượt capacity.
4. Một ticket chỉ có một check-in hiện hành; undo giữ lịch sử gốc.
5. Vé thuộc event A không được cấp/check-in bằng nguồn/cổng event B.
6. Có ticket commit thì có outbox event commit, kể cả Redis/provider đang hỏng.
7. Không xác nhận vào cổng nếu vé revoked/cancelled, reservation hết hạn hoặc quyền staff bị thu hồi.
8. Cập nhật brand/config không tự đổi entitlement của vé đã phát.

### Policy hủy vé đề xuất

Quota đo số allocation đã tiêu thụ; mặc định revoke/cancel không hoàn quota và không mở lại mã. Nếu cần giải phóng capacity, Supervisor/Manager có permission riêng thực hiện `release-allocation` một lần, có audit và transaction; không suy từ số vé ACTIVE rồi tự trừ. Chính sách này cần product xác nhận trước khi build lệnh release.

## 8. Transaction cấp vé

### 8.1 Idempotency

Client tạo UUID operation trước mutation và giữ đến khi biết kết quả. Client operation ID chính là UUID trong key; lookup phải kèm command scope và event để resolve unique operation của actor, không giả định có thể lấy database ID từ response đã mất. Header `Idempotency-Key` bắt buộc cho cấp vé, duyệt cấp vé, confirm và undo.

Scope gồm tenant, event, actor, command, key. Hash canonical request ngăn cùng key được dùng với payload khác. Sau authz, trong transaction:

1. INSERT operation bằng `ON CONFLICT DO NOTHING`; unique conflict sẽ chờ transaction đầu hoàn tất. Không catch unique violation rồi tiếp tục dùng transaction PostgreSQL đã bị abort.
2. Nếu đã có completed record, kiểm tra hash rồi trả response cũ.
3. Hash khác trả 409 IDEMPOTENCY_CONFLICT.
4. Ghi kết quả và business changes cùng commit.

Transaction rollback thì operation cũng rollback; lỗi infrastructure không tạo success giả. Business rejection có thể commit response terminal. Muốn thử lại sau khi sửa điều kiện dùng operation mới. Ghi nhận thất bại có mutation tạm thời phải rollback về savepoint trước khi persist terminal response; không commit counter/code đã thay đổi dở. Operation record tồn tại ít nhất suốt event và cửa sổ CS; ràng buộc mã/request/check-in vẫn bảo vệ khi key cũ hết retention. Không cache token/PII đầy đủ vào response_json. Với reserve response cần trả lại secret khi retry, lưu secret mã hóa trong reservation và chỉ giải mã cho đúng holder sau authz; operation response chỉ chứa reference.

### 8.2 Auto-issue

Thứ tự lock chung: identity/session hoặc membership → operation → event policy shared lock → code → attendee counter → quota buckets theo thứ tự cố định event/type/source → ticket → reservation. Lệnh admin và worker phải tuân cùng thứ tự với các resource chúng chạm.

Pseudocode trong một PostgreSQL transaction READ COMMITTED:

```text
set tenant/actor context
verify active identity/session, verified email, event access
claim idempotency operation
create savepoint before business mutations
read event policy FOR SHARE; check windows/config status
lock code FOR UPDATE; validate source/type/expiry/current owner
upsert event attendee + counter; lock counter FOR UPDATE
check configured per-attendee/email limit
lock applicable quota buckets FOR UPDATE in deterministic order
check all capacities
increment all allocated counters and attendee issued_count
mark code CONSUMED
create request ISSUED, ticket ACTIVE, credential version 1
insert audit + outbox TicketIssued
save operation result with ticket ID
COMMIT
```

Không giữ connection trong lúc gọi provider, upload hoặc render email. Payload ký được chuẩn bị bằng key cục bộ được quản lý; không đặt remote KMS call vào transaction. Nếu signing service bắt buộc remote, thiết kế bước credential provisioning riêng trước khi dùng thực tế.

Lock event dạng shared không serialize các lượt cấp vé, nhưng admin đóng event lấy lock xung đột. Các quota bucket mới là điểm serialize. Deadlock/serialization errors retry giới hạn với jitter; lock timeout trả lỗi retryable và giữ cùng operation key. Không retry vô hạn.

### 8.3 Duyệt thủ công

Verified actor submit → khóa code → tạo PENDING_REVIEW và giữ code, không giữ quota. Có expires_at; quá hạn được giải phóng khi lookup dưới lock hoặc job housekeeping. Người khác không thể gia hạn pending của actor đầu.

Duyệt thành công chạy cùng issue transaction; check lại window, limit và quota. Nếu hết quota, request vẫn pending hoặc được chuyển rejection bởi quyết định rõ ràng; không gắn status ISSUED thiếu ticket. Duyệt, từ chối và expiry cùng khóa code/request theo thứ tự thống nhất.

Lệnh approve/reject không sử dụng identity của khách như quyền staff; audit lưu cả staff ra quyết định và owner nhận vé. Expiry pending cần product chốt, đề xuất cấu hình nguồn và giới hạn tối đa hệ thống.

### 8.4 Contention và mở rộng

Ban đầu chấp nhận quota event row là điểm khóa chung, đo transaction hold time và lock wait. Giữ đoạn giữ khóa ngắn, không claim đạt vài nghìn issue/giây khi chưa test.

Nếu throughput không đủ: admission control giảm concurrency trước; sau đó mới cân nhắc phân bổ capacity vào các bucket con theo nguồn. Bucket con phải có tổng allocation được cấp từ capacity cha, không chỉ cộng counter trong Redis. Sharding quota là ADR mới sau benchmark, không implementation mặc định.

## 9. Giao thức check-in và timeout recovery

### 9.1 QR credential

QR dùng compact JWS, thuật toán allowlist, `kid`, audience riêng cho gate và claims tối thiểu: tenant/event/ticket, credential version, opaque nonce. Không chứa email/tên. Manual entry là endpoint staff riêng tra mã vé đủ entropy, sau đó chạy cùng reservation checks; không coi mã gõ tay là JWS hoặc bỏ qua trạng thái vé. Ticket ID không phải quyền xem hồ sơ.

Backend kiểm tra chữ ký, audience, event, version/token hash và trạng thái hiện tại. QR bị chụp vẫn dùng được cho tới lần check-in đầu; không hứa xác minh danh tính bằng chữ ký. Thu hồi/đổi vé lấy ticket lock và vô hiệu credential cũ. Giữ public verification keys tới khi các vé đã phát hết vòng đời; private keys và token lưu mã hóa, không log.

### 9.2 Reserve

`POST /gate/events/{eventId}/reservations` với QR, staff_session_id và operation key:

- Xác thực staff, cổng, event và device session.
- Khóa ticket; kiểm tra credential, ticket state, window và check-in hiện hành.
- Dưới ticket lock, expire reservation cũ nếu hết hạn; không phụ thuộc scheduler chạy đúng giờ.
- Nếu đang held bởi phiên khác: trả HELD_BY_OTHER_SESSION, không báo đã vào.
- Tạo hold mặc định 30 giây bằng giờ DB, token reservation ngẫu nhiên chỉ trả cho phiên được giữ.
- Callback camera lặp bị chặn trên client; server vẫn idempotent.

Unique partial index trên ticket với status HELD; expiry được xử lý bằng mutation dưới lock, không dùng `now()` trong partial index predicate.

### 9.3 Confirm

`POST /gate/events/{eventId}/reservations/{id}/confirm`:

```text
verify staff/session still active
claim confirm operation
lock event policy shared, ticket, reservation
recheck ticket ACTIVE + credential version + gate rights
require reservation holder/token match
require expires_at > clock_timestamp() at decision point
require no current check-in
insert check-in (unique current ticket)
set reservation CONFIRMED
insert audit/outbox + persist operation result
COMMIT
```

Dùng thời gian thực DB ở thời điểm kiểm tra sau khi chờ lock; không chỉ dùng timestamp bắt đầu transaction. Ticket revoke và confirm khóa cùng ticket nên có thứ tự rõ.

Chỉ sau response xác nhận thành công mới phát vòng/cho vào theo quy trình chuẩn. Nếu mất response, client chuyển RECOVERING và gọi `GET /operations/{clientOperationId}?eventId=...&command=gate.confirm`. Không tự cho qua. Kết quả NOT_FOUND chưa chứng minh giao dịch thất bại vì request cũ có thể đang chạy; retry cùng key để lấy kết quả bền vững.

Client lưu client operation ID, command/event scope và reservation ID trước gửi. Nếu app restart, khôi phục các operation chưa rõ; không cần lưu QR raw hoặc reservation secret lâu dài để đọc status của chính operation. Status lookup trả đủ context event/ticket mask để nhân viên tránh đối soát nhầm khách.

### 9.4 Undo

Supervisor có quyền và lý do; khóa ticket rồi check-in, đặt undone_at, ghi audit/outbox. Không DELETE lịch sử. Không xoay QR tự động; vé có thể được scan lại sau undo, phải hiển thị cảnh báo lịch sử. Nếu đã phát vòng tay, phần mềm không tự thu hồi được vật lý; quy trình Supervisor xử lý riêng.

### 9.5 Mạng yếu

Không queue confirm offline để tự đẩy sau. Khi hết TTL: scan lại; khi confirm chưa rõ kết quả: reconcile trước. Backoff có jitter, tách timeout kết nối và timeout response. Tại cổng có mạng chính/dự phòng và thiết bị dự phòng; web Gate cũng cần mạng backend, không phải phương án offline.

## 10. API contract sơ bộ

Base `/v1`; OpenAPI là contract sinh client. DTO public không lộ ORM. Pagination cursor, giới hạn page size, error codes ổn định. Ngày giờ ISO-8601 UTC; server trả event timezone riêng.

| Nhóm | Endpoint tiêu biểu | Quyền |
|---|---|---|
| Public | GET /public/tenants/{slug}/events/{slug} | Chỉ projection published |
| Self | GET /me/tickets; GET /me/tickets/{id} | Owner |
| Redeem | POST /tenants/{t}/events/{e}/redemptions | Verified attendee + admission token nếu bật |
| Status | GET /me/redemptions/{id} | Owner |
| Operation | GET /operations/{clientOperationId}?eventId=...&command=... | Actor sở hữu, tenant/event/command scoped |
| Tenant | GET/PATCH /tenants/{t}; POST /tenants/{t}/members | Tenant permission |
| Event | POST /tenants/{t}/events; PATCH .../{e} | Event Manager |
| Config | POST .../{e}/config-versions; POST .../{e}/publish | Publish permission + expected version |
| Inventory | POST .../{e}/imports; GET .../{e}/quota | Inventory permission |
| Review | POST .../{e}/redemptions/{id}/approve hoặc reject | Approval permission |
| CS | GET .../{e}/tickets; POST .../tickets/{id}/resend | CS scope |
| Gate | POST /gate/events/{e}/sessions; POST .../reservations | Assigned staff |
| Confirm | POST /gate/events/{e}/reservations/{id}/confirm | Holder + active permission |
| Undo | POST /gate/events/{e}/checkins/{id}/undo | Supervisor |
| Export | POST .../{e}/exports; GET .../exports/{id}/download | Export permission |
| Webhook | POST /integrations/email/{provider}/events | Provider signature, replay control |
| Platform | /platform/tenants; /platform/support-grants | Operator scope |

Tenant của Gate được resolve từ event và assignment, không nhận tenant tùy ý từ QR để cấp quyền. Resend, revoke, quota change, cancel, clone và publish phải có endpoint riêng có audit; không dùng generic PATCH cho mọi trạng thái.

Error envelope:

```json
{
  "code": "QUOTA_EXHAUSTED",
  "message": "Nhóm vé đã hết suất.",
  "requestId": "opaque-id",
  "operationId": "opaque-id",
  "retryable": false
}
```

401: thiếu/hết auth; 403: thiếu quyền; 404: không có hoặc không được phép biết tài nguyên; 409: state/idempotency conflict; 422: input sai; 429: admission/rate limit kèm Retry-After; 503: tạm ngưng để bảo vệ dịch vụ. Client dùng code thay vì parse message. Gate failures trả mã rõ trong phạm vi staff hợp lệ, không trả PII cho public request.

Critical responses `Cache-Control: no-store`. Mutation dùng expected_version/If-Match cho config/quota để tránh ghi đè thao tác admin khác.

## 11. Outbox, queue và notification delivery

### 11.1 Relay

Business transaction insert outbox. Relay claim batch bằng lease/`FOR UPDATE SKIP LOCKED` trong function hẹp, commit lease rồi enqueue BullMQ job với deterministic safe job ID. Sau enqueue ack. Crash trước ack có thể enqueue lại; worker và DB business key phải chịu được duplicate. Không giữ DB transaction trong lúc gọi Redis.

Redis mất dữ liệu không được làm mất job nghiệp vụ: outbox chỉ COMPLETE khi worker hoàn tất ở DB, không phải khi relay đã enqueue. Reconciler re-enqueue bản ghi chưa COMPLETE, lease/processing timeout hết hạn. Worker claim DB processing lease để hạn chế chạy song song.

Outbox cho notification quan trọng được ưu tiên hơn aggregate/reporting. Payload version được kiểm tra để deployment mới không làm job cũ không đọc được.

### 11.2 Email/push

- Dedupe bằng notification business key trong DB; provider idempotency key nếu provider hỗ trợ.
- Tình huống provider nhận email nhưng worker crash trước ghi trạng thái có thể gây gửi lặp khi retry. Không thể cam kết exactly-once với provider không hỗ trợ đối soát/idempotency.
- Không mark SENT trước khi provider nhận. Timeout không rõ kết quả → reconcile provider nếu có API rồi mới quyết định retry.
- Webhook kiểm tra signature/raw body, timestamp và event ID unique; trạng thái xử lý không theo thứ tự arrival đơn giản.
- Receipt push không đồng nghĩa người dùng đọc. Push không mang QR token/PII; mở màn hình phải re-authz.
- Retry backoff giới hạn, dead-letter state trong DB và console replay có quyền/audit.
- Rate cap theo provider và tenant, giới hạn concurrency để một tenant không chiếm mọi slot. Không mặc định có fairness chỉ vì dùng BullMQ.

## 12. Web, cấu hình và app iOS

### 12.1 Web

Public content cache key chứa canonical host mapping + tenant + event + published config version + locale. Không dùng request cookie để tạo public cache. Preview authenticated/no-store. Admin và ticket pages không public cache; service worker nếu có không cache response PII mặc định.

Tenant slug resolve từ directory có kiểm soát; wildcard host phải allowlist, tránh host-header poisoning. Subdomain không chia sẻ session cookie tenant-wide. Tên miền riêng ngoài release đầu.

### 12.2 Configuration lifecycle

Config JSON schema có schema_version; published version immutable. Publish update event pointer bằng optimistic concurrency, audit và outbox invalidate CDN. Cache TTL hữu hạn là fallback nếu invalidation lỗi. Rollback tạo hành động publish version cũ hợp lệ, không quay ngược ticket state/quota.

App gửi app_version, API version và supported_config_version. Backend chỉ trả cấu hình tương thích hoặc template fallback. Không gửi code thực thi trong config. Nội dung rich text dùng allowlist cấu trúc hỗ trợ trên cả web/native; không render HTML tùy ý.

Entitlement snapshot và terms version trên ticket/request tách với nội dung trang; đổi banner không đổi quyền vào cổng.

### 12.3 iOS

- Expo development build, Expo Router, expo-camera và expo-notifications là baseline; package versions theo SDK được chọn khi scaffold.
- Tách attendee và staff navigation trees, cùng identity nhưng permission được server cấp. Tenant/event context luôn thấy trên staff screens.
- Server-state cache có thể dùng TanStack Query; local persisted ticket data dùng SQLite, refresh token dùng SecureStore.
- Local cache theo user ID; logout xóa dữ liệu, detach push device và hủy request cũ. Account switch không hydrate cache user trước.
- SQLite mặc định không được giả định mã hóa. Chỉ lưu dữ liệu vé tối thiểu; mã hóa credential nhạy cảm bằng key lưu Keychain và cấu hình file protection. Spike kiểm chứng khả năng mở offline khi thiết bị đã unlock, không ghi token QR vào log/analytics/backups ngoài policy.
- Credential trong SecureStore có thể có lifecycle khác app cache; startup luôn đối soát identity, không tự coi cài lại app là logout đã hoàn tất.
- Offline QR là bản credential đã lưu; hiển thị last synced. Server Gate vẫn quyết định revoked/used.
- Universal Links về domain platform được cấu hình AASA; link ticket không tự cấp quyền chỉ vì có ID. Web fallback hoạt động nếu chưa cài app.
- Camera chỉ hoạt động trên màn scan; pause khi app background. Callback scan dedupe, không để hàng loạt request từ nhiều frame.
- Không ép cập nhật app giữa event; support API/config compatibility được kiểm tra bằng app release cũ trong CI/UAT.

## 13. Security và chống lạm dụng

- Mã đổi vé sinh đủ entropy; lưu HMAC với key có version thay vì plaintext hash của mã ngắn. Import mã bên ngoài cần đánh giá entropy; lookup qua key versions đang còn hỗ trợ khi rotation; rate limit lookup theo user/IP/event và tín hiệu abuse, không chỉ IP vì có mạng NAT đông người.
- Manual ticket lookup không dùng ID tăng dần hoặc trả hồ sơ chỉ từ email. Scanner chỉ nhận thông tin tối thiểu để đối chiếu.
- Upload size/type cap, virus scan nếu phù hợp; file nằm quarantine trước parse. CSV parsing chạy worker có giới hạn row/memory và bảo vệ formula injection khi export.
- PII, QR token, OTP và signed download URL không vào telemetry. Audit sanitize diff; giữ actor/resource/reason thay vì toàn bộ request body.
- Signed URL ngắn hạn sau authorization; ai giữ URL còn hạn có thể dùng, vì vậy không coi prefix tenant là bảo mật.
- Keys/credentials trong secret manager, rotation có kid/version; backup key management được test restore.
- Cookie web chống CSRF, CSP, output sanitization; CORS chỉ origin cho phép nhưng không coi CORS là authorization.
- Retention/xóa user phải xử lý DB, object store, local cache, search/aggregate và backup policy; thời hạn cụ thể còn chờ product.
- Bot có thể giữ mã pending: chỉ verified user được giữ, TTL có giới hạn, cap số pending/user và abuse monitoring.

## 14. Capacity model và admission control

### 14.1 Các scenario cần benchmark

Đây là test scenarios đề xuất, không phải yêu cầu tải đã được xác nhận hoặc khả năng đã chứng minh.

| Scenario | Mẫu tải | Điều cần đo |
|---|---|---|
| S1 — Volume | Một event 50k attendee/ticket, hai tenant hoạt động | Query plan, storage, export, dashboard |
| S2 — Public burst | 50k phiên mở trang trong 60 giây, chủ yếu CDN | Origin request rate, cache hit, tải metadata |
| S3 — Redeem pilot | 50 issue/s + 20 confirm/s, nhiều tenant | p95, lỗi, lock wait, connection saturation |
| S4 — Opening shock | 50k attempt trong 10 giây, admission bật | Edge rejection/queue, accepted throughput, fairness |
| S5 — Gate | 100 thiết bị, 20 confirm/s, scan/reserve riêng | Duplicate frames, hold contention, retry/recovery |
| S6 — Noisy neighbor | Tenant A import/export và mở vé, B check-in | Tail latency và tài nguyên Gate còn lại |
| S7 — Failure | Kill API/worker, Redis restart, network timeout | Invariants, outbox replay, outcome recovery |

S4 tương đương trung bình 5.000 attempts/s tại lớp tiếp nhận, không đòi PostgreSQL commit 5.000 vé/s. Nếu yêu cầu thực tế là 50k concurrent users duy trì lâu hoặc cần cấp vé ở tốc độ đó, phải benchmark và điều chỉnh ADR trước cam kết.

### 14.2 Admission

Default có per-user/event rate limit và global in-flight cap. Khi mở vé lớn, dùng edge waiting room/admission layer có token ký, event/user/session binding và TTL. Token admission không giữ vé và không thay authz/quota check. Chỉ backend từ ingress hợp lệ mới được chấp nhận, tránh bypass bằng URL origin.

Waiting room/edge provider cần chọn qua spike. Nếu layer này lỗi, đường cấp vé đông phải fail closed hoặc chuyển rate limit bảo thủ; Gate không đi qua waiting room. Không cam kết FIFO theo thời gian mở tab. Backoff và polling có jitter để tránh retry storm.

### 14.3 Ngân sách tài nguyên

Tổng connection phải tính: replicas × pool size cho API, Gate, worker, relay, dashboard, migration và phần dự phòng. Không tăng replicas tùy ý rồi làm PostgreSQL hết connection. Giới hạn queue concurrency, payload size, transaction timeout và statement timeout theo loại workload.

CPU-heavy parsing/rendering chạy worker. Event loop lag, DB lock wait, WAL/IO, pool wait và queue age là metric bắt buộc. Chưa khóa số vCPU/RAM trước benchmark, không suy capacity từ benchmark framework.

## 15. Deployment, backup và incident behavior

### 15.1 Môi trường

Development local, staging và production tách dữ liệu, secrets, OIDC client, Redis, buckets và push environment. Production ưu tiên managed PostgreSQL có standby/failover, PITR và monitoring; managed Redis với persistence phù hợp BullMQ. Chọn cloud/region theo địa điểm event và yêu cầu dữ liệu trước production.

API/worker containers, health/readiness endpoints riêng. Rolling deploy và graceful shutdown: dừng nhận request/job mới, chờ transaction kết thúc có deadline. Worker job dài phải resumable. Không cần Kubernetes trong bản đầu nếu managed container service đáp ứng.

Migration theo expand → backfill → switch → contract; chạy job đơn với migration role. App release cũ phải hoạt động trong cửa sổ hỗ trợ; không drop/rename API hoặc cột cùng lúc deployment đầu tiên cần chúng.

### 15.2 Failure matrix

| Sự cố | Hành vi |
|---|---|
| Email/push provider lỗi | Vé vẫn cấp; notification pending, retry có giới hạn |
| Redis lỗi | Không mất ticket/check-in; outbox giữ việc; admission phụ thuộc Redis fail closed hoặc chế độ bảo thủ được định nghĩa; Gate được tiếp tục nếu DB/auth còn khỏe |
| Database primary không truy cập được | Không issue/confirm; hiển thị unavailable, không nhận thành công giả |
| Client timeout sau commit | Retry cùng key / tra operation, không tạo transaction nghiệp vụ mới |
| Worker chết | Lease hết hạn, reconcile/requeue; effects idempotent |
| Dashboard quá tải | Giảm tần suất/tạm ngưng reporting trước Gate |
| Mạng venue đứt | Chuyển đường truyền dự phòng; không tự bật offline confirm |
| Auth provider gián đoạn | Token/phiên hiện tại có thể tiếp tục trong thời hạn hợp lệ với DB revocation; login/refresh mới có thể lỗi, không bỏ qua xác thực |

Gate critical path không được phụ thuộc Redis cache/rate limiter theo cách bắt buộc fail khi Redis lỗi; dùng per-process protective cap + ingress controls và DB authz. Nếu implementation chọn phụ thuộc Redis cho Gate thì phải cập nhật failure matrix, không mặc định claim Gate hoạt động.

### 15.3 Recovery trong giờ event

Backup RPO 15 phút ở PRD chỉ là baseline disaster recovery, không bảo đảm không mất check-in vừa xác nhận. Cần phân biệt:

- Normal failover: kiểm tra replication và durability configuration; không hứa zero-data-loss nếu deployment chưa bảo đảm điều đó.
- Restore từ backup/PITR có khả năng mất giao dịch: đóng mutations, đối soát phạm vi mất dữ liệu, giữ evidence từ operation IDs/client receipt và log đã sanitize; không tự mở cổng dựa trên DB cũ.
- Client receipt hỗ trợ điều tra, không tự chứng minh toàn bộ các vé đã dùng. Nếu không tái lập đầy đủ, Supervisor áp dụng quy trình hạn chế đã thống nhất trước event.

Trước pilot phải diễn tập restore DB + keys, failover, reconnect và reconciliation. RTO/RPO thực đo được ghi trong báo cáo; ưu tiên durability trong giờ event hơn tự mở lại khi chưa rõ dữ liệu.

## 16. Quan sát và vận hành

- Trace/request ID xuyên API → DB operation → outbox → notification/job.
- Metrics: endpoint p50/p95/p99, event loop lag, DB pool wait/lock wait/deadlock, issue rate/rejection reason, confirm latency, recovery count, hold expiry, queue oldest age, provider bounce/error và tenant throttling.
- Không đưa user/ticket ID vào metric labels; tenant/event labels cần kiểm soát cardinality. Chi tiết đi vào log/trace có quyền.
- Dashboard realtime dùng aggregate eventual consistency, mục tiêu trễ ≤10 giây trong pilot; timestamp dữ liệu luôn hiển thị. Không query COUNT toàn bảng ở mỗi poll.
- Alert theo symptom: Gate error tăng, queue age tăng, DB saturation, outbox pending lâu; mỗi alert có runbook.
- Freeze deploy/migration/config nghiệp vụ rủi ro quanh cửa sổ sự kiện; hotfix có người phụ trách, rollback và kiểm tra tương thích.

## 17. Kế hoạch kiểm chứng trước pilot

| Spike / test | Deliverable | Điều kiện đạt |
|---|---|---|
| P1 — RLS + Prisma pool | DB roles, sample policies, integration tests | Không lộ tenant qua request xen kẽ/pool reuse/worker/export; owner reader chỉ thấy vé mình |
| P2 — Issue transaction | Prototype + concurrency/fault tests | Không vượt quota/limit, không trùng code/request; retry sau timeout trả cùng ticket |
| P3 — Gate protocol | API prototype + hai iPhone qua TestFlight | Một confirm thắng; revoke/expiry/undo có thứ tự; app restart recover operation |
| P4 — Identity | Provider ADR và auth demo web/iOS | PKCE, verified email, MFA, account claim, revocation, logout và account switch đúng |
| P5 — Outbox/queue | Failure injection và replay report | Redis mất queue/worker kill không mất việc đã commit; duplicate effects được quản lý |
| P6 — Capacity | k6 scenario scripts + benchmark report | Đạt pilot SLO, không lỗi invariants; overload có kiểm soát và không làm Gate sập |
| P7 — iOS capability | Device matrix, camera/deep link/push/offline report | Hoạt động trên thiết bị hỗ trợ, ánh sáng yếu và mạng chập chờn; local data đúng tài khoản |
| P8 — Recovery | Runbook + failover/restore evidence | Biết RPO/RTO thực, không mở lại Gate trên dữ liệu thiếu mà không đối soát |

P1–P4 cần làm trước khi mở rộng các màn quản trị. Test không chỉ assertion HTTP 200: phải đối soát counter, code, ticket, outbox, check-in và audit sau tải/failure.

Những race bắt buộc: issue vs quota change; issue vs close event; approve vs expiry; same email nhiều mã; confirm vs revoke; confirm vs expiry; confirm vs staff revoke; undo vs scan; account switch vs response cũ; publish vs cache invalidation; outbox enqueue vs crash.

Release gate: architecture tests + isolation/security tests + concurrency tests + device UAT + restore drill + runbook hoàn tất. Store submitted/approved/available là ba trạng thái riêng, không dùng việc build thành công để coi app đã phát hành.

## 18. Quyết định còn mở và điều kiện chốt

| Quyết định | Baseline | Khi cần chốt |
|---|---|---|
| App chung hay white-label | App chung, staff/attendee modes | Trước bundle ID và store branding |
| Identity provider | Managed OIDC đạt P4 | Trước foundation implementation |
| 50k nghĩa là volume/burst/concurrent? | Test theo S1–S4, chưa claim concurrent | Trước capacity sizing và event SLA |
| Cloud/region/admission provider | Managed services + edge controls | Trước production benchmark |
| Pending TTL, cancel/release policy | Verified-only hold; không tự hoàn quota | Trước redemption schema/API freeze |
| Data retention và support access | Least privilege, thời hạn còn mở | Trước dữ liệu người dùng thật |
| Đối chiếu danh tính tại cổng | QR bearer, một lượt | Trước Gate UAT và train staff |
| Mức chấp nhận mất giao dịch khi disaster | Không tự mở lại trên DB restore thiếu | Trước pilot approval |

## 19. Ràng buộc SQL mẫu để triển khai

Các câu lệnh sau minh họa constraints/index, chưa phải migration chạy được độc lập. Tên cột phải đồng bộ với schema đầy đủ và composite FK ở mục 6–7.

```sql
-- Một mã và một request không cấp nhiều vé.
CREATE UNIQUE INDEX tickets_one_per_request
  ON tickets (tenant_id, event_id, request_id);
CREATE UNIQUE INDEX tickets_one_per_code
  ON tickets (tenant_id, event_id, redemption_code_id)
  WHERE redemption_code_id IS NOT NULL;

-- Hết hạn hold được chuyển trạng thái dưới ticket lock trước khi tạo hold mới.
CREATE UNIQUE INDEX reservations_one_held_per_ticket
  ON checkin_reservations (tenant_id, event_id, ticket_id)
  WHERE status = 'HELD';
CREATE UNIQUE INDEX checkins_one_current_per_ticket
  ON checkins (tenant_id, event_id, ticket_id)
  WHERE undone_at IS NULL;

-- NULL capacity = không giới hạn; không dùng NULL scope_id cho bucket event.
ALTER TABLE quota_buckets ADD CONSTRAINT quota_valid
  CHECK (allocated >= 0 AND (capacity IS NULL OR allocated <= capacity));
CREATE UNIQUE INDEX quota_bucket_scope
  ON quota_buckets (tenant_id, event_id, scope, scope_id);

-- Vẫn kiểm tra kết quả UPDATE, kể cả khi đã có lock.
UPDATE quota_buckets
SET allocated = allocated + 1
WHERE tenant_id = $1 AND event_id = $2 AND id = $3
  AND (capacity IS NULL OR allocated < capacity)
RETURNING id, allocated;
```

Phải có constraint/counter bổ sung cho attendee limit, source/type mapping và foreign keys. Các index phía trên không tự bảo vệ toàn bộ các invariant. Migration được test bằng raw SQL ngoài ORM để kiểm tra database từ chối dữ liệu bất hợp lệ.

### Lưu ý thiết kế còn phải kiểm chứng

- OpenAPI ở mục 10 là endpoint inventory, chưa phải file contract được sinh/validate. SQL ở mục 19 là sketch; chưa có migration hoặc prototype chạy thực tế.
- Chọn identity provider, pin SDK/framework versions và benchmark infrastructure là deliverable của các spike, không được bỏ qua khi bắt đầu code.
- Chưa có số đo latency/capacity hoặc kết quả security test. Các mục tiêu trong tài liệu là acceptance gates.

## 20. Tài liệu chính thức tham chiếu

Đọc lại theo version đã pin khi triển khai; các link current/latest có thể thay đổi.

- PostgreSQL isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL locking: https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL transaction-local configuration: https://www.postgresql.org/docs/current/functions-admin.html
- Prisma transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- NestJS authorization: https://docs.nestjs.com/security/authorization
- BullMQ idempotent jobs: https://docs.bullmq.io/patterns/idempotent-jobs
- BullMQ job IDs: https://docs.bullmq.io/guide/jobs/job-ids
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo camera: https://docs.expo.dev/versions/latest/sdk/camera/
- Expo notifications setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Apple review guidelines: https://developer.apple.com/app-store/review/guidelines/
