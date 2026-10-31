# Handoff kiến trúc — Ticket reissue / QR credential rotation (M08, DB-09/DB-19)

| Trường | Giá trị |
| --- | --- |
| Role | `architect` (Dexter) · [`docs/agents/roles/architect.md`](../agents/roles/architect.md) |
| **Exact SHA đối chiếu** | `eb2ebc6f08521c72f09518a078ce012cdbfa73d9` (worktree `main-3`, dirty — không commit gì trong Task này) |
| Quyết định nguồn | [PRD §M08](../PRD.md) dòng 191–201 · [TECHNICAL-DESIGN §8–9](../TECHNICAL-DESIGN.md) · [ADR-18](../ops/ADR-18-OFFLINE-GATE-SYNC.md) · [PLAN DB-09/DB-19/GATE-03](../../tests/e2e/PLAN.md) · evidence [.artifacts/db09-local.md](../../.artifacts/db09-local.md) |
| Architecture impact | **Có** (schema ticket_credentials, permission catalog, transaction/lock order, idempotency) |
| Security impact | **Có** (credential invalidation semantics, actor/authz, audit) |
| **Kết luận** | **Đủ để triển khai trong scope** cho phần D/API (mint version mới + vô hiệu version cũ, idempotent, audited) — **5 lựa chọn policy đã chốt** (§0, 2026-10-29; mục 7 giữ lại để truy vết). Vẫn còn **1 vấn đề ngoài phạm vi Task này** chặn nghiệm thu PRD đầy đủ (mục 2, GATE-03) — không do quyết định này giải quyết, cần Task riêng |

## 0. Quyết định bổ sung — User, 2026-10-29

User đã chốt sau restart, trả lời trực tiếp 5 điểm "Lựa chọn policy" ở §7 (đánh dấu **Đã chốt** tại §7 bên dưới, giữ nguyên nội dung gốc để truy vết):

1. **Actor**: chỉ **Supervisor/Owner** — không mở cho CS. Permission `ticket.reissue` thêm vào `SUPERVISOR_EVENT` như đề xuất gốc §3, không mở rộng thêm.
2. **Giá trị status cho credential bị thay**: tái dùng **`REVOKED`** (Phương án A §5) — **không** thêm `SUPERSEDED`, không cần migration ALTER CHECK.
3. **Event đã `CANCELLED`**: **cho phép reissue** (giữ tiền lệ `revokeTicket` — không thêm event-open check), đúng hành vi đã mô tả ở §6 dòng "Event đã `business_status='CANCELLED'`".
4. **`reason`**: **bắt buộc** (giống `revoke`/`undo`, validate ở HTTP layer) — không phải optional như `resend`.
5. **Giới hạn tần suất**: **không thêm rate limit mới** — nhất quán với quyết định 1 (actor chỉ Supervisor/Owner, hành động hiếm và có audit, không cần cooldown như `resend`).

Vì actor chỉ Supervisor/Owner (điểm 1) và status tái dùng `REVOKED` (điểm 2), **migration #2 ở §9 gốc (thêm `SUPERSEDED`) không còn cần** — bảng migration §9 đã cập nhật bên dưới.

**Non-goals:** không đổi online reserve/confirm (ADR-06), không đổi offline sync (ADR-18 — D7 giữ "undo/revoke offline không hỗ trợ", reissue cũng không hỗ trợ offline), không thiết kế policy sửa email owner (PRD dòng 199 — khác phạm vi), không tự thêm `release-allocation` (TD §7, cần product chốt riêng), không implement GATE-03 (mục 2).

---

## 1. Phạm vi và mục tiêu

PRD M08 (dòng 198): *"Thu hồi/hủy vé được audit. Phát hành lại xoay token và vô hiệu QR cũ."* PLAN DB-09 (P0, D/H): *"revoke/cancel không tái sử dụng mã; credential rotate làm QR cũ vô hiệu; không transfer/đổi owner qua generic PATCH."* `.artifacts/db09-local.md` đã chứng minh D-layer cho revoke/owner-invariant/allocation-policy, nhưng xác nhận rõ: **không có hàm reissue/rotate nào trong source** — hai call site duy nhất `INSERT INTO ticket_credentials` (`issue.ts:644`, `approval.ts:831`) chỉ tạo `version=1` lúc phát vé; `resendTicketEmail` (`cs.ts:401`) explicit **không** rotate.

Mục tiêu Task này: thiết kế contract cho một hành động **reissue** mới — mint `ticket_credentials` version kế tiếp, vô hiệu version hiện tại, giữ bất biến owner/ticket, idempotent, có audit — đủ để một worker triển khai và DB-09 chuyển từ `blocked` sang `implemented` ở phần D/API mà PLAN yêu cầu.

## 2. Phát hiện nền tảng — vì sao "rotation" hôm nay không có điểm chốt an ninh thật

Đây là ràng buộc quan trọng nhất, phải đọc trước khi thiết kế API, vì nó định hình đúng kỳ vọng của mọi actor downstream (coordinator, reviewer-security, CS).

Hệ thống có **hai QR khác nhau**, không phải một:

1. **`kind:'ticket.credential'`** (`packages/backend/src/qr-ticket.ts`) — payload có `token` (opaque, AES-256-GCM sealed bởi `credential-crypto.ts`) + `credentialVersion`. Đây đúng là thứ PRD dòng 194 mô tả ("QR chứa token ký có phiên bản"). **Chỉ một nơi** gọi `openCurrentCredentialForQr`/`renderCredentialQrPng`: `outbox.ts:408-430`, để đính PNG vào **email** phát vé/resend. Không có endpoint nào trả credential này cho client theo yêu cầu (không có `GET .../qr`).
2. **`kind:'ticket.display'`** (`apps/web/src/owner-ticket/display-payload.ts`, `apps/mobile/src/tickets/display-payload.ts`) — payload chỉ có `ticketId/tenantId/eventId/credentialVersion/state`, **không chữ ký, không token**. Đây là QR **thực tế hiển thị trong ví** (web/app, từ `/me/tickets`) và **duy nhất** mà Gate scanner chấp nhận: `apps/mobile/src/gate/gate-scan.ts` hàm `parseScan` chỉ nhận `kind==='ticket.display'` hoặc UUID trần. Comment ngay trong code: *"Gate must not treat this as proof"*, *"Contracts ... do not yet return a signed Gate credential/JWS"*.

Và ở phía server, `gate.ts` hàm `reserveCheckin`/`confirmCheckin` (đã đọc toàn bộ, dòng 527–869) **không hề** đọc `ticket_credentials` — input chỉ có `ticketId`, kiểm tra duy nhất là `ticket.state === 'ACTIVE'` + reservation token (ephemeral, server-sinh, không liên quan credential). TD §9.1/§9.2 (dòng 285–302) mô tả backend phải "kiểm tra chữ ký, audience, event, version/token hash" tại reserve — **chưa được implement**; đây chính là gap đã track riêng trong `tests/e2e/backend/coverage.json` **GATE-03**: *"Thiếu H QR audience/kid/version/hash/manual rejection"*.

**Hệ quả cho reissue:** mint version mới trong `ticket_credentials` thỏa đúng ngữ nghĩa DB-09 ở lớp D (có hàm, có version/hash, có invalidate, có audit) — nhưng **không** tự làm true nghiệm thu PRD M08 dòng 201 (*"QR bị thu hồi ... bị từ chối"*) cho QR thực sự bị quét tại cổng, vì cổng không đọc `ticket_credentials`. QR cũ bị "vô hiệu" ở DB chỉ ảnh hưởng email tiếp theo (outbox đọc `ticket.credential_version` hiện hành); nó không ảnh hưởng gì tới `ticket.display` đang hiển thị/cached trên máy khách, vì giá trị đó không được server verify khi quét. Việc có bị quét lọt hay không hoàn toàn do `ticket.state` (ACTIVE/USED/REVOKED) quyết định — giống *trước* và *sau* reissue.

→ **Khuyến nghị:** triển khai reissue đúng theo thiết kế mục 3–6 (đúng scope Task, đúng DB-09), đồng thời coordinator mở/ưu tiên GATE-03 như một Task riêng — không gộp vào đây vì GATE-03 đổi cả transaction reserve/confirm (rủi ro lớn hơn, cần Architect review riêng) và đổi cả client scan (web+mobile). Không coi reissue xong là PRD M08 nghiệm thu đầy đủ.

## 3. Permission và actor

Permission catalog hiện có (`role-map.ts:6-32`): `SUPERVISOR_EVENT = ['gate.confirm','gate.undo','ticket.revoke']`, `CS_EVENT = ['cs.lookup','cs.resend']`. Không có permission reissue. **Đã chốt (User, 2026-10-29 — §0 điểm 1): permission mới `ticket.reissue` thêm vào `SUPERVISOR_EVENT`** (cùng nhóm với `ticket.revoke` — cùng là hành động bảo mật/lifecycle trên credential, cần `requireTenantPermission(..., eventId)` scoped theo event giống `revokeTicket`). Owner-tenant thừa hưởng qua `eventPermissionsForRole('Owner')` (đã gồm `SUPERVISOR_EVENT`). **CS không có `ticket.reissue`** — không thêm vào `CS_EVENT`.

## 4. Endpoint, transaction, lock order

Đề xuất đặt cạnh `revokeTicket` trong `gate.ts` (cùng actor/permission group, cùng ticket-lock pattern), route đối xứng với revoke:

```
POST /v1/gate/events/{eventId}/tickets/{ticketId}/reissue
Header: Idempotency-Key (bắt buộc, UUID)
Body: { tenantId, reason }  -- reason bắt buộc (đã chốt, §0 điểm 4) — validate ở HTTP layer, 422 nếu thiếu/rỗng, giống revoke/undo
```

Hàm nghiệp vụ `reissueTicketCredential(tx, input)` trả `ReissueOutcome` (pattern giống `ReserveOutcome`/`ConfirmOutcome` — `{ok:true,...} | GateDenyOutcome`, unwrap ở HTTP layer giống `unwrapReserveOutcome`).

**Idempotency — khác revoke:** revoke là hành động *absorbing* (REVOKED là trạng thái tận cùng, gọi lại vô hại — `gate.ts:960` `if (ticket.state === 'REVOKED') return;`). Reissue **không** absorbing — gọi hai lần sẽ mint hai version, vô hiệu QR vừa gửi, gửi hai email. Vì vậy reissue **phải** dùng đúng cơ chế idempotency TD §8.1 ("Header Idempotency-Key bắt buộc cho cấp vé, duyệt cấp vé, confirm và undo" — reissue thuộc cùng lớp rủi ro, cần bổ sung vào danh sách này), tái dùng nguyên khối `claimOperation`/`completeOperation`/`canonicalHash`/`requireIdempotencyKey` đã có ở `event-operations.ts:15-104` (cùng khối `cancelEvent` dùng) — không viết lại logic claim/replay mới.

Thứ tự lock (nhất quán TD §8.2 và các hàm hiện có trong `gate.ts`):

```
1. requireTenantPermission(tx, {tenantId, userId:actorUserId, permission:'ticket.reissue', eventId})
   → lock membership FOR SHARE + event_assignment FOR SHARE (membership.ts:228-261)
2. requireIdempotencyKey(header) → clientKey
3. canonicalHash({command:'ticket.reissue', tenantId, eventId, ticketId, reason})
4. claimOperation(...)  → lock operations row FOR UPDATE (chỉ serialize cùng key)
   - claimed=false + COMPLETED cùng hash → trả lại response đã lưu, replayed:true, DỪNG (không chạy bước 5+)
   - hash khác → 409 IDEMPOTENCY_CONFLICT
5. lockTicket(tx, tenantId, eventId, ticketId)  → SELECT ... FOR UPDATE tickets (gate.ts:109-128, tái dùng helper có sẵn)
   — đây là điểm serialize DUY NHẤT cần cho ticket_credentials; revoke/confirm/undo cũng
     lấy lock này trước khi đụng ticket/ticket_credentials, nên không cần lock riêng trên
     ticket_credentials (giống cách revokeTicket đang làm, gate.ts:966-977).
6. ticket.state !== 'ACTIVE' → denyGate(TICKET_NOT_ACTIVE) [commit audit gate.reject, KHÔNG throw]
7. newVersion = ticket.credential_version + 1
   rawToken = randomBytes(32); sealed = sealCredentialToken(rawToken, credentialKeyMaterial)
8. UPDATE ticket_credentials SET status=<invalidate> WHERE tenant_id=.. AND ticket_id=.. AND status='ACTIVE'
9. INSERT INTO ticket_credentials (..., version=newVersion, status='ACTIVE', ...)
10. UPDATE tickets SET credential_version=newVersion, updated_at=now() WHERE ...
    (bắt buộc — outbox.ts:341 và /me/tickets đều đọc tickets.credential_version làm nguồn
    "version hiện hành"; quên bước này thì email/QR mới không bao giờ được outbox nhặt)
11. writeAudit(action='ticket.credential_reissue', resource_type='ticket', resource_id=ticketId,
    reason, sanitized_diff={fromVersion, toVersion})  — không ghi token/hash vào audit
12. Enqueue outbox 'TicketIssued' + notifications row mới (copy nguyên pattern cs.ts:531-566,
    businessKey khác: `ticket:<id>:reissue:email:<operationId>`) — KHÔNG cần outbox type/
    notification kind mới; outbox worker đã tự đọc credential_version hiện hành (outbox.ts:408).
13. completeOperation(tx, tenantId, op.id, {ticketId, credentialVersion:newVersion, replayed:false})
14. COMMIT
```

Không chạm `checkin_reservations` (khác revoke — xem mục 6).

## 5. Credential version / hash / trạng thái vô hiệu

Schema hiện tại (`202610160004_d2_issue_ticket/migration.sql:204-217`):

```sql
CREATE TABLE ticket_credentials (
  tenant_id, ticket_id, version, kid, token_hash, encrypted_token,
  status text NOT NULL DEFAULT 'ACTIVE',  -- CHECK (status IN ('ACTIVE','REVOKED'))
  created_at,
  PRIMARY KEY (tenant_id, ticket_id, version)
);
```

Không có unique/partial-index đảm bảo *chỉ một* version `ACTIVE` tại một thời điểm — bất biến này hiện chỉ đúng vì chưa ai từng rotate. **Đã chốt (User, 2026-10-29 — §0 điểm 2): Phương án A — tái dùng `REVOKED`** cho credential bị thay khi reissue. Không cần migration ALTER CHECK. Phân biệt "revoke ticket" vs "reissue" chỉ qua `audit_logs.action` (`ticket.revoke` vs `ticket.credential_reissue`) — hệ quả đã biết và chấp nhận: CS tra `ticket_credentials.status='REVOKED'` không tự biết lý do nếu không join audit; không cần xử lý thêm trong Task này.

~~B — thêm `SUPERSEDED` (migration `ALTER ... ticket_credentials_status_chk` thêm giá trị): không chọn.~~

**Độc lập với lựa chọn trên, đề xuất luôn thêm** (migration cần, không phải lựa chọn — đây là invariant DB-09 đòi hỏi "QR cũ vô hiệu" phải đúng ở mọi lúc, không chỉ đúng tại thời điểm code chạy):

```sql
CREATE UNIQUE INDEX ticket_credentials_one_active_idx
  ON ticket_credentials (tenant_id, ticket_id)
  WHERE status = 'ACTIVE';
```

(cùng pattern với `tickets_code_issued_unique` đã có, migration.sql:200-202 — partial unique index, không phải tính năng mới lạ trong codebase.)

`kid` hiện luôn `'local-v1'` (`credential-crypto.ts:30`) — **không phải keyring nhiều khoá** (khác `tombstone-keyring.ts`, có `KEYRING_JSON` nhiều key + `currentKeyId`). Nếu `CREDENTIAL_KEY` env bị xoay ở tầng hạ tầng, **mọi** `encrypted_token` cũ (mọi version, mọi ticket) hết giải mã được — không riêng gì ticket vừa reissue. Đây là rủi ro vận hành có thật nhưng **khác** phạm vi "ticket reissue" (là rotate *khoá hạ tầng*, không phải rotate *credential per-ticket*) — nêu ở đây để coordinator biết, không thiết kế giải pháp trong Task này. Liên quan PLAN DB-19 (*rotation key/pepper... không làm QR đã revoke hợp lệ trở lại*) — nhưng DB-19 nói về **pepper HMAC của redemption code** (`code-hmac.ts`/`readSupportedPepperConfigs`, test `issue-unit.test.cjs#CODE_HMAC_PEPPER`), không phải `ticket_credentials`. Nguyên tắc chung cả hai nơi đều đã đúng: tính hợp lệ do **cột `status`/`state` trong DB** quyết định, không do việc giải mã/verify hash còn chạy được hay không — nên rotate hạ tầng (key hoặc pepper) không tự làm sống lại thứ đã bị revoke.

## 6. Hành vi theo trạng thái

| Trạng thái lúc gọi reissue | Hành vi |
| --- | --- |
| `tickets.state = 'ACTIVE'`, không có `checkin_reservations` HELD | Rotate bình thường (mục 4). |
| Có reservation `HELD` (nhân viên đang giữ 30s để confirm) | **Không chặn, không hủy hold.** Reissue không đọc/sửa `checkin_reservations`; confirm đang chạy chỉ kiểm `ticket.state` + reservation token ephemeral (gate.ts:748-826), không kiểm `ticket_credentials` — nên hold tiếp tục bình thường. Đây là hệ quả trực tiếp của mục 2: hôm nay credential không phải cổng chặn, nên rotate giữa lúc đang scan không tạo race với confirm. |
| `tickets.state = 'USED'` | Deny `TICKET_NOT_ACTIVE` (dùng chung code với reserve/confirm). Vé đã tiêu thụ, rotate không có mục đích — Gate sẽ luôn trả `ALREADY_CHECKED_IN` bất kể version. |
| `tickets.state = 'REVOKED'` | Deny `TICKET_NOT_ACTIVE`. Vé đã chết, không có gì để bảo vệ bằng rotate. |
| `tickets.state = 'CANCELLED'` | Deny `TICKET_NOT_ACTIVE`. (Giá trị này nằm trong CHECK constraint từ D2 nhưng **chưa có code path nào set** — `cancelEvent`, event-lifecycle.ts:852-941, chỉ đổi `events.business_status`, không đổi từng `tickets.state`. Xử lý thủ tục như trên để an toàn nếu tương lai có path gán state này.) |
| Event đã `business_status='CANCELLED'`, ticket vẫn `ACTIVE` | **Không chặn ở layer event-policy** (đã chốt, §0 điểm 3 / §7.3) — khác `reserveCheckin`/issue, `revokeTicket` hiện tại cũng không gọi `assertOpenForGate`/`assertOpenForIssuance` (gate.ts:938-987, đã đọc toàn bộ, không có check event). Reissue theo đúng tiền lệ revoke: không thêm event-open check (CS/Supervisor vẫn cần sửa lỗi vé dù event đã bị hủy). |
| QR `ticket.credential` (PNG) hoặc `ticket.display` đã cache offline trên máy khách, dùng sau khi server đã reissue | Server-side: version cũ không còn `ACTIVE`, không ảnh hưởng gì tới việc Gate chấp nhận quét hay không — xem mục 2. App vẫn hiển thị `ticket.display` cũ (có `credentialVersion` cũ, cosmetic) cho tới lần sync `/me/tickets` kế tiếp; đây không phải lỗi của reissue, là giới hạn hiện hành của "không có credential check tại Gate". |

## 7. Lựa chọn policy — đã chốt (User, 2026-10-29 — §0)

Danh sách gốc giữ lại để truy vết, kết quả chốt ghi ngay sau mỗi điểm:

1. **Actor được gọi reissue**: chỉ Supervisor+Owner (giống `ticket.revoke`) hay thêm cả CS (giống `cs.resend`) hay cho owner tự phục vụ qua app. → **Chốt: chỉ Supervisor/Owner.** Không CS, không owner tự phục vụ (không có endpoint owner-mutation nào hôm nay, giữ nguyên — không mở mặt bằng quyền mới).
2. **Giá trị status cho credential bị thay** (mục 5): tái dùng `REVOKED` (không migration) hay thêm `SUPERSEDED` (migration, rõ nghĩa hơn). → **Chốt: tái dùng `REVOKED`** (Phương án A). Không migration ALTER CHECK.
3. **Event đã cancelled có chặn reissue không**: giữ tiền lệ revoke (không chặn) hay siết hơn (chặn). → **Chốt: không chặn** — giữ tiền lệ revoke, cho phép reissue khi event đã cancelled.
4. **`reason` bắt buộc hay optional**: giống `revoke`/`undo` (bắt buộc) hay giống `resend` (không bắt buộc). → **Chốt: bắt buộc.**
5. **Giới hạn tần suất**: `resend` có cooldown 60s + 10 lần/giờ/actor (`cs.ts:21-22`). → **Chốt: không thêm rate limit mới** cho reissue — nhất quán với điểm 1 (chỉ Supervisor/Owner, hành động hiếm, có audit, khác rủi ro spam của CS `resend`).

Không còn lựa chọn policy nào mở ở mục này.

## 8. Response / privacy

Response HTTP chỉ trả `{ticketId, credentialVersion, replayed}` — **không** trả `token`/QR thô trong response đồng bộ. Khớp đúng tiền lệ `resendTicketEmail` (chỉ trả `operationId/notificationId/providerStatus`, không trả nội dung) và TD §8.1 ("Không cache token/PII đầy đủ vào response_json"). QR mới tới chủ vé qua email (outbox/worker có sẵn), không qua API trả trực tiếp — nhất quán với việc hệ thống hôm nay **không có** endpoint "lấy QR hiện hành" nào khác ngoài email.

## 9. Migration cần (tổng hợp)

| # | Nội dung | Trạng thái sau §0 |
| --- | --- | --- |
| 1 | `ticket_credentials_one_active_idx` — partial unique `(tenant_id, ticket_id) WHERE status='ACTIVE'` | Bắt buộc (mục 5) |
| 2 | ~~`ALTER ... ticket_credentials_status_chk` thêm `'SUPERSEDED'`~~ | **Không cần** — đã chốt dùng `REVOKED` (§0 điểm 2) |
| 3 | Thêm `'ticket.reissue'` vào `SUPERVISOR_EVENT` (`role-map.ts`) — code, không SQL | Bắt buộc, coordinator/backend sở hữu file này |
| 4 | Route + controller DTO mới trong `apps/api/src/gate.ts`; validate `reason` bắt buộc ở DTO (backend sở hữu route; web sở hữu client gọi) | Bắt buộc |

Tên migration đề xuất (chưa tạo file — theo rule, coordinator xác nhận ID trước khi worker tạo thật): `202610290001_ticket_credentials_reissue` (tiếp theo `202610280003...`, ngày đối chiếu 29/10/2026 — xác nhận lại thứ tự thật tại thời điểm implement vì nhánh khác có thể đã chiếm slot). **Lưu ý sequencing:** [O06-RETENTION-HANDOFF.md](./O06-RETENTION-HANDOFF.md) cũng đề xuất migration mới cùng mốc ngày (POL-02/POL-03) — coordinator xác nhận thứ tự số thật giữa 2 bộ migration trước khi tạo file, tránh trùng slot.

### Thứ tự triển khai đề xuất

1. **Migration**: chỉ mục #1 ở bảng trên (`ticket_credentials_one_active_idx`) — xác nhận tên/số file thật với coordinator trước khi tạo (xem lưu ý sequencing).
2. **Code — permission**: thêm `'ticket.reissue'` vào `SUPERVISOR_EVENT` (`role-map.ts`).
3. **Code — hàm nghiệp vụ**: `reissueTicketCredential(tx, input)` trong `gate.ts` theo đúng thứ tự lock/transaction §4 (bước 1–14); tái dùng `claimOperation`/`completeOperation`/`canonicalHash`/`requireIdempotencyKey` từ `event-operations.ts` — không viết lại logic claim/replay.
4. **Code — route**: `POST /v1/gate/events/{eventId}/tickets/{ticketId}/reissue` + DTO validate `reason` bắt buộc (422 nếu thiếu/rỗng), `Idempotency-Key` bắt buộc.
5. **Test**: viết test matrix §10 trước hoặc cùng bước 3–4 (dùng làm acceptance) — thứ tự D (idempotency, unique index, deny theo state) → H (permission 403/validation 422) → R (outbox thật qua Mailpit).
6. **Theo dõi riêng, không block**: coordinator mở Task GATE-03 (§2) — cần để PRD M08 nghiệm thu đầy đủ ở cổng thật, nhưng không gộp vào Task reissue này.

## 10. Test matrix (D/H/R — theo lớp PLAN §3)

| Lớp | Ca cần chứng minh |
| --- | --- |
| D | reissue trên `ACTIVE` ticket: version+1, row cũ hết `ACTIVE`, row mới `ACTIVE`, `tickets.credential_version` khớp; retry cùng Idempotency-Key → cùng response, không version thứ 3; Idempotency-Key cũ với payload khác → 409; gọi trên `USED`/`REVOKED`/`CANCELLED` → deny, không mutation; đồng thời `revokeTicket` và `reissueTicketCredential` trên cùng ticket (ticket lock serialize đúng thứ tự, không deadlock); unique partial index chặn insert hai row `ACTIVE` nếu code có bug bỏ qua bước 8. |
| H | Thiếu permission `ticket.reissue` → 403; actor có `CS_EVENT` nhưng không có `SUPERVISOR_EVENT` → 403 (xác nhận CS bị loại, §0 điểm 1); thiếu `Idempotency-Key` → 422; thiếu/rỗng `reason` → 422 (§0 điểm 4); actor ngoài event assignment → 403; response không chứa token/QR thô. |
| R | Outbox worker thật nhặt event mới, render PNG đúng version mới (không phải version cũ), gửi qua SMTP Mailpit thật; ticket bị revoke sau khi reissue nhưng trước khi outbox chạy → notification `DEAD` đúng theo nhánh `outbox.ts:350-392` hiện có (không cần sửa, đã generic theo `tickets.state`). |

## 11. Xác minh / giới hạn

- Đã đọc toàn bộ `gate.ts`, `qr-ticket.ts`, `credential-crypto.ts`, `issue.ts` (đoạn issue + version=1), `approval.ts` (đoạn tương tự), `cs.ts` (resend), `event-operations.ts`, `membership.ts` (requireTenantPermission), `role-map.ts`/`role-presets.ts`, migration D2 DDL, `outbox.ts` (đoạn đọc credential), client `gate-scan.ts` + `display-payload.ts` (web/mobile) — đủ để khẳng định phát hiện mục 2 không phải suy đoán.
- Chưa đọc: `apps/web`/`apps/mobile` phần hiển thị email/UI CS gọi reissue (chưa tồn tại — Task này chỉ thiết kế backend contract); native iOS wallet cache chi tiết (không cần cho quyết định D/API này).
- Không chạy test, không build — đúng theo giới hạn "no code edits" của Task.

---

**Người quyết định tiếp theo (cập nhật 2026-10-29):** 5 điểm mục 7 đã chốt (§0) — coordinator giao backend implement theo mục 3–6, 8–9 và thứ tự triển khai ở §9, không cần chờ thêm quyết định policy. Việc còn lại không phải chính sách: (a) xác nhận số thứ tự migration thật với O06-RETENTION-HANDOFF trước khi tạo file (§9 lưu ý sequencing); (b) coordinator mở Task GATE-03 riêng (mục 2) — không phụ thuộc cứng vào reissue nhưng vẫn cần để PRD M08 nghiệm thu đầy đủ ở cổng thật, chưa có quyết định/thiết kế nào giải quyết vấn đề này trong phạm vi hai handoff hiện có.
