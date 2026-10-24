# #859 — Contract đối soát receipt offline (bản chốt của coordinator)

**Trạng thái:** Đã chấp nhận trong phạm vi user phê duyệt24/10/2026. **Chưa có verdict implementation.**
Base b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37 + dirty worktree. Dexter đề xuất, James review độc lập, root chốt sửa C01–C08 theo [preflight](../reviews/F02-RECEIPT-CONTRACT-2026-10-24.md). Preflight FAIL áp dụng draft cũ; bản này thay toàn bộ semantics admissionEligible của draft. Implementation phải review lại, không kế thừa PASS.

## Phạm vi và quyết định

PRD M10 yêu cầu restart/timeout vẫn đối soát được cùng operation; không thành công giả offline và thu hồi quyền chặn xác nhận tiếp. ADR18 replay POST chỉ đủ khi còn immutable payload. GateOp thiếu clientOccurredAt/clientSeq/payloadVersion/deviceId; không dựng payload để replay. Ledger offline_sync_events chỉ lưu apply thành công, không có durable rejected/conflict. GET operations hiện dùng ledger khác.

Chọn bổ sung GET đọc ledger có scope, thay vì miễn recovery bằng permanent unknown. Không đổi POST replay/idempotency/skew, không migration, không đổi privacy purge khi logout. Receipt chỉ đối soát lịch sử, không tạo quyền cho vào; không mở search/manual lookup rộng.

## HTTP và DTO đã chốt

GET /v1/gate/events/{eventId}/offline-sync/receipts/{clientEventId}?tenantId={uuid}
Bearer thật; UUID validate theo patterns hiện có. Không staffSessionId/deviceId client input cho authz.

    export type OfflineSyncReceiptCheckinState =
      | 'CURRENT' | 'UNDONE' | 'TICKET_REVOKED' | 'NO_LONGER_CURRENT';

    export interface OfflineSyncReceiptResponse {
      tenantId: string;
      eventId: string;
      clientEventId: string;
      status: 'APPLIED';
      historical: true;
      ticketId: string;
      checkinId: string;
      staffSessionId: string;
      appliedAt: string; // ISO UTC ledger.applied_at
      checkinState: OfflineSyncReceiptCheckinState;
    }

Không admissionEligible/admissionBlockReason/actorUserId hoặc quyền admission trong DTO. Luôn historical:true; APPLIED chỉ mô tả apply trước đây. Precedence khi đọc: ticket REVOKED→TICKET_REVOKED; checkin undone_at set→UNDONE; checkin ledger còn current và ticket USED→CURRENT; còn lại NO_LONGER_CURRENT. CURRENT vẫn là thông tin lịch sử, không cho khách qua lại.

## Authz, transaction và lỗi

Trong withTenant transaction-local + RLS, mọi query parameterized:

1. JWT actor; requireTenantPermission với PERMISSION_CONFIRM và tenant/event path.
2. Actor phải có ít nhất một staff_session hiện tại thuộc tenant/event, ACTIVE và revoked_at null. Không đọc session từ client.
3. Ledger chỉ đọc khi tenant/event/clientEventId khớp, actor_user_id=caller và session gốc join theo staff_session_id cũng cùng tenant/event/user caller. Original session có thể inactive/revoked nếu caller hiện có assignment/session active hợp lệ; đây chỉ đọc lịch sử, không xin xác nhận mới.
4. Join checkins và tickets phải khớp tenant/event/ticket/checkin ledger. Thiếu/corrupt join fail-closed. Không rawQR, reservation secret hay payloadHash.
5. Không assertOpenForGate: đọc receipt sau khi cửa sổ check-in đóng vẫn được nếu permission/assignment pass. Không business INSERT/UPDATE; read locks phù hợp nếu cần, không reuse readLedger FOR UPDATE của POST.

401 identity; 403 permission hoặc SESSION_NOT_ACTIVE hiện tại, độc lập target receipt.
Sau authz hiện tại, tất cả no row/wrong event/wrong actor/original-session mismatch/missing join cùng **404 OFFLINE_SYNC_RECEIPT_NOT_FOUND**, ApiError retryable:true (chưa thấy receipt không đồng nghĩa thất bại).
422 SCOPE_REQUIRED (retryable:false) cho UUID/query thiếu hoặc sai, giữ pattern requireUuid/scopeError hiện có của GateController; không tạo chuẩn400 riêng. Timeout/network/404 không admit.
GET dùng rate-limit đọc Gate sẵn có phù hợp hoặc bucket riêng hằng số có test; backend ghi rõ lựa chọn, không đổi limits POST.
Additive route/types/OpenAPI; client cũ không đổi.

## iOS consume

Online sau verified identity và cùng user/scope/lifecycle generation. Lookup theo clientEventId của GateOp queued/unknown khi thiếu receipt local; không replay POST nếu thiếu payload gốc. Queue còn nguyên vẫn dùng POST đúng contract.

Response validate đầy đủ và khớp tenant/event/clientEventId/ticketId/staffSessionId của operation; kiểm lại user/scope/session/generation sau await. Không đổi op khác hay ghi data A cho B. Session gốc của receipt phải khớp op, không tự thay bằng session mới của view.

200 historical → phase mới **recorded** hoặc trạng thái terminal trung tính tương đương, copy “Đã ghi nhận trước đó”; state undo/revoke có copy rõ riêng. **Không phase admitted**, không tone/haptic/audio fresh-admit, kể cả CURRENT. Pending chờ đối soát hết khi đã có receipt, History giữ đúng operation/receipt. Không fake QueuedOfflineScan. 404/auth/malformed/mismatch→unknown/nonadmit; không đánh dấu server rejected khi chưa có outcome durable.

## Test và bàn giao bắt buộc

Backend/API: current, undo, revoke, no-longer-current, closed window; cross-actor/tenant/event/original-session ownership404; thiếu active session/permission403; missing/corrupt join404; original inactive nhưng new active owned session cho phép read; body/query session không cấp quyền; GET không sửa ledger/checkins. Integration dùng PG RLS runtime role, token thật cho runtime proof; unit mock không thay auth/RLS.

iOS: receipt CURRENT vẫn neutral/nonadmit; undo/revoke;404/401/403/malformed/ID mismatch; stale user/scope/generation; History đúng receipt/pending0. Native M10 queue→restart OFFLINE→online verify/reauth→reconcile cùng clientEventId/partition, không inject giữa flow/rescan/reset. Legacy6c812d24 phải GET và hiển thị recorded thực, không admission mới. New flow proof có thể dùng fixture mới, không gọi UUID khác là recovery cùng operation.

Ownership: coordinator ủy quyền backend sửa packages/contracts/src/offline-sync.ts và export cần thiết trong cùng batch, cùng apps/api + packages/backend + generated OpenAPI theo pipeline. Không sửa slice iOS hay lockfile/CI. iOS chỉ consume bản chốt này sau BE handoff. Reviewer độc lập trên exact source freeze, tách code complete / acceptance complete / pilot ready.

Đối chiếu root18:03Z: lỗi validation422 là chuẩn route Gate hiện có (gate.ts scopeError), thay mô tả400 của draft; không đổi DTO, authz hoặc read-only semantics. GET receipt dùng bucket riêng240/h/user, POST offline-sync giữ60/h/user.


## Bổ sung root — recovery khi operation không còn trong History local

Root đã mở History thực trên bundle mới; legacy6c812d24 không còn trong5rows local, trong khi GET xác thực trả receipt gốc. Cho phép UI History đối soát **mã operation UUID đã biết** trong tenant/event hiện tại qua cùng GET đã chốt. Đây là đường recovery theo operation gốc trong phê duyệt #859, không search hay validate vé.

Nếu chưa có GateOp, response200 phải validate schema/historical/APPLIED và match clientEventId nhập cùng tenant/event đang hoạt động; ticketId/staffSessionId lấy từ response đã được server ràng buộc ownership/actor. Tạo **GateOp recorded từ receipt thật**, không queued/unknown giả, không QueuedOfflineScan hoặc POST payload. Có thể dùng clientEventId làm ID local, dedupe cùng operation; giữ checkinId/appliedAt/checkinState. Không admit/rung/âm. Captured verified user/session epoch + workspace scope/generation phải còn đúng sauawait mới được persist. 404/401/403/malformed/mismatch/stale không import receipt.

Mã lượt/biên nhận đầy đủ phải đọc/copy hoặc accessible trong History để phục vụ recovery; label rút gọn vẫn được trên row chính. Test import không có op, duplicate import, stale logout/scope, wrongID/malformed và neutral UX. Legacyproof là import receipt thật quaUI, không gọi đó là khôi phục payload local đã mất.
