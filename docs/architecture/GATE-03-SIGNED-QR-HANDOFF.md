# Handoff kiến trúc — GATE-03: QR credential ký + mã thủ công đủ entropy tại admission (PRD M08)

| Trường | Giá trị |
| --- | --- |
| Role | `architect` (Dexter) · [`docs/agents/roles/architect.md`](../agents/roles/architect.md) |
| **Exact SHA đối chiếu** | `8b6dacf889ac379e2df87c524554446599ab090c` (worktree `main-3`; dirty do Task khác trên `tests/e2e/**`/`company/**` — không liên quan, không chạm trong Task này) |
| Quyết định nguồn | [PRD §M08](../PRD.md) dòng 191–201 · [TECHNICAL-DESIGN §9](../TECHNICAL-DESIGN.md) dòng 283–337 · [ADR-18](../ops/ADR-18-OFFLINE-GATE-SYNC.md) · [DECISION-LOG O23](../DECISION-LOG.md) (Gate chỉ iOS Staff, không Web Gate) · O31/O32 (gate/session model, không đổi bởi Task này) · [TICKET-REISSUE-HANDOFF §2](./TICKET-REISSUE-HANDOFF.md) (phát hiện nền tảng mà Task này giải quyết) · PLAN `tests/e2e/PLAN.md` GATE-03/`backend/coverage.json` |
| Architecture impact | **Có** (trust boundary admission mới, transaction reserve/confirm, schema `ticket_credentials`/`checkin_reservations`, contract QR/API mới) |
| Security impact | **Có** (chống giả mạo bearer UUID thành "proof", key material mới, reject-audit) |
| **Kết luận** | **Đủ để triển khai trong scope** cho phương án được đề xuất (mục 3–8), kèm **6 lựa chọn chính sách chưa thể suy ra** (mục 9) và **1 theo dõi chéo bắt buộc** với Task reissue đã handoff trước (mục 9.6) |

**Non-goals:** không đổi online reserve/confirm transaction skeleton ngoài phần bổ sung ở mục 5 (giữ nguyên ADR-06 lock order hiện có); **không đổi ADR-18** (offline sync contract #105/#106/#107 giữ nguyên — mục 7 chỉ đề xuất một bổ sung additive, cần ADR-18 amendment riêng do coordinator xác nhận, không tự sửa trong Task này); không implement `reissueTicketCredential` (đã có handoff riêng, chỉ tham chiếu chéo mục 9.6); không đổi O23 (Gate chỉ iOS Staff) hay O31/O32 (gate/session model); không thêm Web Gate.

---

## 1. Phạm vi và mục tiêu

PRD M08 (dòng 193–194, 201): *"Vé có ID nội bộ, mã hiển thị khó đoán... QR chứa token ký có phiên bản và ngữ cảnh event... Backend kiểm tra trạng thái hiện tại kể cả chữ ký hợp lệ... Nghiệm thu: QR bị thu hồi, sai event, giả chữ ký hoặc đã dùng bị từ chối."* TD §9.1–9.3 mô tả rõ: JWS compact có `kid`/audience/claims tối thiểu, backend kiểm tra chữ ký/audience/event/version/hash tại reserve, và một **endpoint manual entry riêng** cho mã đủ entropy (không phải JWS, không bỏ qua trạng thái vé).

TICKET-REISSUE-HANDOFF §2 đã xác nhận bằng cách đọc toàn bộ `gate.ts`/`qr-ticket.ts`/`credential-crypto.ts`/`gate-scan.ts`/`display-payload.ts` (web+mobile): **không có implementation nào của đoạn TD §9.1 này tồn tại**. Mục tiêu Task này là đóng đúng gap đó — thiết kế contract để `reserveCheckin`/`confirmCheckin` thực sự kiểm tra một credential không thể giả mạo, và để "manual entry" là một con đường riêng có entropy, không phải việc dán UUID trần.

## 2. Phát hiện nền tảng (xác minh lại, không suy đoán)

Đọc trực tiếp source tại SHA trên, xác nhận đúng như TICKET-REISSUE-HANDOFF §2 đã nêu, bổ sung chi tiết cho phần credential:

1. **`reserveCheckin`/`confirmCheckin` (`gate.ts:527–869`)** chỉ nhận `ticketId` làm input thuần — không có tham số credential nào. Lock ticket, kiểm `state==='ACTIVE'`, dùng reservation token ephemeral (server-sinh, không liên quan `ticket_credentials`). `confirmCheckin` tại dòng 794 so `token_hash` của **reservation** (ephemeral hold token) — không phải của credential vé.
2. **`apps/mobile/src/gate/gate-scan.ts` `parseScan`** (dòng 94–129) chấp nhận đúng hai dạng: JSON `kind==='ticket.display'` (không chữ ký — `v1`, chỉ `ticketId/tenantId/eventId/credentialVersion/state`) **hoặc một UUID trần dán tay**, xử lý **giống nhau tuyệt đối** — cả hai đi thẳng vào `reserveCheckin` qua `runScan` (dòng 423–432) không qua bước xác minh nào khác. Đây chính là "Gate must not treat this as proof" nhưng code hiện tại coi `ticket.display` UUID **là** đủ để mở `reserveCheckin`.
3. **`qr-ticket.ts`/`credential-crypto.ts`**: `kind:'ticket.credential'` KHÔNG phải JWS — là token đối xứng đơn giản (`randomBytes(32)`, AES-256-GCM sealed để lưu, nhúng **plaintext** vào JSON QR khi render email). Không `kid` trong payload (kid cố định `'local-v1'` chỉ ở tầng mã hóa lưu trữ, không phải JWS header). Không signature. Không audience. Chỉ dùng cho email (`outbox.ts:408–430`); **không có endpoint nào trả giá trị này cho client** — app/web wallet không bao giờ thấy nó.
4. **`OfflineSyncEvent` (`packages/contracts/src/offline-sync.ts` dòng 100–116)** chỉ có `ticketId` — không trường credential nào. `applyOfflineSyncBatch`/`replayOfflineSyncBatch` (ADR-18, "đã chốt") verify entirely qua `tickets.state` tại thời điểm apply, không có khái niệm "credential hợp lệ" ở path offline.
5. **Không có endpoint "manual entry/lookup" nào trong `apps/api/src/gate.ts`** (đã grep toàn bộ `manual|lookupByCode|redemption` trong `gate.ts` cả hai package — 0 kết quả). Điều TD §9.1 gọi "manual entry endpoint staff riêng" **chưa tồn tại**; hành vi "nhập tay" hôm nay = dán UUID vào cùng ô camera, xử lý ở mục 2.
6. `jose@5.10.0` đã là dependency có sẵn ở cả `packages/backend` và `apps/api` (dùng cho `apns.ts` — ES256 `SignJWT`/`importPKCS8`, và `oidc.ts` — `jwtVerify` với `algorithms` allowlist tường minh). Không cần thêm dependency mới.
7. `tombstone-keyring.ts` (D13) đã có đúng pattern keyring cần: JSON array `{keyId, secret}` + `currentKeyId` qua env, fail-closed khi thiếu/sai — tái dùng được cho keyring credential Gate, không viết lại logic đọc keyring.
8. `code-hmac.ts` (DB-19) đã có đúng pattern "mã đủ entropy, lưu HMAC-pepper, không lưu plaintext" cho redemption code — mẫu trực tiếp cho **manual entry code** (mục 6), dùng pepper/version riêng (mục 9.3).
9. `revokeTicket` (`gate.ts:938–977`) đã set `tickets.state='REVOKED'` **và** `ticket_credentials.status='REVOKED'` cho mọi row của ticket đó trong cùng transaction — `ticket.state` một mình đã chặn `reserve`/`confirm` sau revoke (check hiện có, không đổi). Hệ quả: credential/version check ở Task này **không** cần để chặn case revoke (đã chặn) — giá trị thật của nó là (a) chặn **giả mạo chữ ký/ticketId đoán được** độc lập với revoke, và (b) chặn **version cũ sau reissue** khi ticket vẫn `ACTIVE` (xem mục 9.6).

## 3. Ràng buộc bắt buộc

- O23: Gate chỉ chạy trên iOS Staff, luôn gọi server online cho `reserve`/`confirm`; không có relying party nào khác cần verify JWS độc lập (không Web Gate, client không tự admit offline — ADR-18 D7: "Client không được tự coi scan offline là USED cho đến khi server APPLIED/DUPLICATE"). → không có use case buộc chữ ký phải bất đối xứng.
- TD §9.1: không `exp` trong claims — "QR bị chụp vẫn dùng được cho tới lần check-in đầu"; tính hợp lệ do cột DB (`tickets.state`, `ticket_credentials.status`/version hiện hành) quyết định, không do thời gian.
- TD §9.1: "Ticket ID không phải quyền xem hồ sơ" — claims JWS không chứa PII (tenant/event/ticket/version/nonce chỉ).
- PRD dòng 201: nghiệm thu không có khoan "dual-accept tạm thời cho QR cũ chưa ký" — giả chữ ký/không chữ ký phải bị từ chối ngay khi tính năng chạy, không có grace window (xem mục 8 — hệ quả rollout).
- Không tự sửa ADR-18 (đã chốt, Issue #105–107) hay O31/O32 (gate/session) trong Task này.
- Tenant context transaction-local, RLS/deny-by-default không đổi; verify JWS không cần transaction (CPU-bound, thuần hàm) nhưng **phần đối chiếu version/state vẫn phải nằm sau `lockTicket` FOR UPDATE** như luồng hiện có.

## 4. Phương án — hai lớp credential tách biệt, không trộn

Giữ đúng phân biệt TD §9.1 đã vạch (JWS cho QR, endpoint riêng + mã entropy cho thủ công) — không gộp hai cơ chế:

### 4.1 QR — JWS compact ký bởi backend, thay thế `ticket.display` làm artifact duy nhất Gate chấp nhận

**Payload mới `kind:'ticket.gate_credential'` v1:**

```ts
// Envelope hiển thị trong QR JSON — giữ hình dạng tương tự kind cũ để parser
// client đổi tối thiểu (so sánh kind, không phải redesign QR scanner).
{ v: 1, kind: 'ticket.gate_credential', jws: string }
```

**JWS claims (payload bên trong, không mã hóa — chỉ ký, không phải JWE; không PII):**

```ts
{
  iss: 'vemoki-gate',       // cố định, phân biệt khỏi OIDC/APNs JWT khác trong cùng hệ thống
  aud: 'gate',              // audience riêng cho Gate — TD §9.1 yêu cầu tường minh
  tid: string,              // tenantId
  eid: string,              // eventId
  tkt: string,              // ticketId
  ver: number,              // credential_version tại thời điểm ký (không phải lúc phát vé)
  jti: string,              // nonce ngẫu nhiên — chỉ để log correlation, KHÔNG dùng để chống replay
  iat: number,
  // không có `exp` — đúng TD §9.1
}
```

**Ký ở đâu, khi nào:** **Ký lại mỗi lần đọc**, không lưu JWS đã ký. `GET /v1/me/tickets` và chi tiết vé (`apps/api/src/tickets.ts` — nơi hiện trả `credentialVersion` thô) ký fresh JWS bằng `tickets.credential_version` hiện hành ngay tại thời điểm response. Hệ quả quan trọng: **không cần backfill** — mọi vé đã phát trước khi tính năng này deploy đều có JWS hợp lệ ngay từ request kế tiếp, vì JWS chỉ là hàm thuần của `(tid,eid,tkt,ver)` + khoá ký hiện hành, không phụ thuộc lịch sử.

**Vì sao bỏ AES-seal/`encrypted_token`/`token_hash` khỏi đường QR mới:** cơ chế cũ (`credential-crypto.ts`) tồn tại để giữ một **bearer secret bí mật** (token phải giữ kín, so hash để xác minh). Một khi toàn bộ claims được **ký** (chữ ký là thứ không thể giả mạo), token không cần bí mật nữa — tính không giả mạo nằm ở chữ ký, không ở việc giữ kín giá trị. Loại bỏ bước AES decrypt-on-read, tránh phải cấp `credentialKeyMaterial` cho process API (hôm nay chỉ outbox worker có) — giảm attack surface, không mở thêm secret cho API. Cột `ticket_credentials.token_hash`/`encrypted_token` giữ nguyên **chỉ** để tương thích kênh email hiện có (outbox vẫn render PNG `kind:'ticket.credential'` như cũ cho tới khi được dọn ở Task riêng — xem mục 8); đường QR mới trong app/web **không** đọc hai cột này.

**Chọn alg — mục 9.1 (lựa chọn, có khuyến nghị):** `HS256` (HMAC) khuyến nghị làm mặc định — vì verifier duy nhất là chính backend (không client nào tự verify), bất đối xứng không có lợi ích thật ở closed-loop này, và HMAC cho chữ ký ngắn hơn (tốt cho mật độ QR). `ES256` là phương án thay thế nếu coordinator muốn đồng nhất với tiền lệ `apns.ts` hoặc dự phòng một relying party verify độc lập trong tương lai (web preview không cần network?). Cả hai `jose` đều hỗ trợ sẵn, không đổi dependency.

**Allowlist alg tường minh khi verify** (tái dùng đúng pattern `oidc.ts` dòng 28: `ALLOWED_ALGORITHMS` truyền vào `jwtVerify`), **không** đọc alg từ header JWS để tự quyết keyring — luôn tra `kid` trong keyring trước, rồi xác nhận `alg` trong header khớp đúng alg đã đăng ký cho `kid` đó. Chặn tấn công alg-confusion/key-confusion.

**Keyring — tái dùng khung `tombstone-keyring.ts`:** module mới `gate-credential-keyring.ts`, env `GATE_CREDENTIAL_KEYRING_JSON` (`[{keyId, secretBase64, alg}]`) + `GATE_CREDENTIAL_CURRENT_KEY_ID`, fail-closed khi thiếu/sai JSON (giống D13, log `alert` sanitized, throw, không coerce rỗng). Rotate: thêm key mới vào array, đổi `currentKeyId` để ký; giữ key cũ trong array để còn verify JWS đã phát hành dưới kid đó cho tới khi vé hết vòng đời (đúng câu TD §9.1) — chỉ xoá key cũ khỏi array sau khi coordinator xác nhận không còn vé/event nào còn tham chiếu kid đó.

### 4.2 Manual entry — mã riêng, đủ entropy, không phải JWS

Mới hoàn toàn (không có implementation nào hôm nay để sửa):

- **Mint tại thời điểm phát vé** (cùng call site version=1 của `ticket_credentials`: `issue.ts:644`, `approval.ts:831`) — một mã hiển thị (`manual_entry_code`), ví dụ 10 ký tự base32 (Crockford, không nhầm 0/O, 1/I) nhóm `XXXX-XXXX-XX`, entropy ≥50 bit. Lưu **chỉ HMAC-pepper** (không plaintext) trong cột mới `tickets.manual_entry_code_hash`, theo đúng pattern `code-hmac.ts` (`hashRedemptionCode`-style, pepper/version riêng — mục 9.3). Giá trị plaintext trả về **một lần** tại response phát vé/duyệt (giống cách redemption code gốc được cấp) và lưu AES-sealed riêng (tái dùng `credential-crypto.ts` sealing primitives với context key khác) để hiển thị lại ổn định trong app/web/email — **khác** QR: mã này cần hiển thị lại y nguyên nhiều lần, nên vẫn cần round-trip giải mã (không thể ký-lại-mỗi-lần như JWS vì giá trị phải cố định để con người đọc/so sánh).
- **Endpoint mới** `POST /v1/gate/events/{eventId}/manual-lookup`, quyền `gate.confirm` (không permission mới — cùng nhóm actor có quyền reserve/confirm, SCANNER_EVENT đã có):

  ```
  Body: { tenantId, staffSessionId, code }
  200: { ticketId, proofToken, expiresAt }   // proofToken TTL ngắn (ví dụ 60s)
  404 MANUAL_CODE_INVALID (không lộ ticket tồn tại hay không — timing-safe compare qua codesEqualHmac)
  ```

  `proofToken` = JWS/HMAC ngắn hạn do chính backend ký, claims `{tid, eid, tkt, sid: staffSessionId, exp}` — **ràng** vào đúng `staffSessionId` đã gọi lookup, để `reserveCheckin` xác nhận đúng người đã tra mã mới được dùng kết quả, không chuyển proofToken sang session khác.
- **`reserveCheckin` nhận `proofToken` này làm một trong hai hình thức "presented credential"** (mục 5) — ticketId cho path thủ công đến **từ proofToken đã verify**, không bao giờ từ `ticketId` client tự gửi trực tiếp. Đây là điểm chặn chính xác "không coi ticket.display UUID là proof": client **không còn** quyền gửi `ticketId` trần vào `reserve` dưới bất kỳ hình thức nào sau Task này.
- Rate limit mới `API_RATE_LIMITS.gateManualLookupPerUser` (cùng khối `API_RATE_BUCKETS`/`API_RATE_LIMITS` đang dùng cho `gateReservePerUser`) để chặn brute-force không gian mã — bắt buộc đi kèm entropy, không phải lựa chọn.

## 5. Endpoint, transaction, lock order (reserve/confirm — sửa tại chỗ, không viết lại bộ khung)

### 5.1 Reserve — `POST /v1/gate/events/{eventId}/reservations`

**Body mới** (thay `ticketId` trần bằng một trong hai hình thức presented credential — breaking change có chủ đích, xem mục 8):

```ts
{
  tenantId: string;
  staffSessionId: string;
  presented:
    | { kind: 'qr'; jws: string }
    | { kind: 'manual'; proofToken: string };
}
```

**Thứ tự xử lý trong `reserveCheckin` (chèn vào đúng vị trí hiện có, không đổi thứ tự lock đã có):**

```
1. requireTenantPermission(gate.confirm) — như hiện có, không đổi
2. assertOpenForGate — như hiện có
3. assertSessionActive — như hiện có
4. Giải mã/verify presented (CPU-bound, KHÔNG cần transaction/lock):
   - kind='qr': parse envelope → jwtVerify(jws, keyringFor(kid), {algorithms:[registered alg]})
     → claims. Sai kid/alg/signature/malformed → denyGate(CREDENTIAL_SIGNATURE_INVALID)
     (resourceType 'ticket', resourceId = claims.tkt nếu parse được, else omit).
     claims.tid !== input.tenantId hoặc claims.eid !== input.eventId
       → denyGate(CREDENTIAL_CONTEXT_MISMATCH)   // sai event/tenant — đúng nghiệm thu PRD "sai event"
     ticketId := claims.tkt ; presentedVersion := claims.ver ; presentedVia := 'qr'
   - kind='manual': verify proofToken (cùng keyring hoặc keyring riêng, TTL check)
     → sai/hết hạn/sai staffSessionId → denyGate(MANUAL_PROOF_INVALID)
     ticketId := proofToken.tkt ; presentedVersion := null ; presentedVia := 'manual'
5. lockTicket(tx, tenantId, eventId, ticketId) — HÀM CÓ SẴN, không đổi; đã trả sẵn
   credential_version trong cùng row đã lock — không cần query thêm.
6. Nếu presentedVia='qr' VÀ ticket.credential_version !== presentedVersion
     → denyGate(CREDENTIAL_VERSION_STALE)   // QR cũ sau reissue — đúng nghiệm thu "QR bị thu hồi... bị từ chối"
7. ticket.state !== 'ACTIVE' → denyGate(TICKET_NOT_ACTIVE) — NHƯ HIỆN CÓ, không đổi
8. ... toàn bộ phần còn lại (currentCheckinId, expireHeld, currentHold, insert/update
   checkin_reservations) GIỮ NGUYÊN, chỉ thêm hai cột khi insert/update:
   presented_credential_version = presentedVersion (NULL nếu manual)
   presented_via = presentedVia ('qr' | 'manual')
```

Không có lock mới, không đổi thứ tự lock hiện có — bước 4 thuần CPU trước `lockTicket`, bước 6 dùng dữ liệu `lockTicket` đã trả sẵn.

### 5.2 Confirm — không cần client gửi lại QR, chỉ re-check version đã ghi ở reserve

TD §9.3: "recheck ticket ACTIVE + credential version". `confirmCheckin` đã gọi `lockTicket` (có `credential_version` hiện hành) ở dòng 721. Thêm một điều kiện ngay sau dòng kiểm `ticket.state !== 'ACTIVE'` (805–815), dùng dữ liệu đã có từ `reservations`/`lockTicket`, không query thêm:

```
Nếu reservation.presented_via === 'qr'
   VÀ reservation.presented_credential_version !== ticket.credential_version
     → denyGate(CREDENTIAL_VERSION_STALE)
```

Chặn đúng race TOCTOU: reissue xảy ra giữa lúc `reserve` (giữ hold 30s) và `confirm` — QR đã trình ở bước reserve nay stale, confirm từ chối dù ticket vẫn `ACTIVE`. Path `manual` không có version để so (đúng theo thiết kế — xem mục 4.2, mục 9.6 cho tương tác với reissue).

### 5.3 Schema — `checkin_reservations` thêm hai cột (migration bắt buộc)

```sql
ALTER TABLE checkin_reservations
  ADD COLUMN presented_via text NOT NULL DEFAULT 'qr'
    CHECK (presented_via IN ('qr', 'manual')),
  ADD COLUMN presented_credential_version integer NULL;
```

Default `'qr'` an toàn cho các dòng cũ (không còn `HELD` sống qua migration — reservation có TTL 30s, không có dữ liệu lịch sử nào còn "live" bị ảnh hưởng).

`tickets` thêm cột cho manual entry code (mục 4.2):

```sql
ALTER TABLE tickets
  ADD COLUMN manual_entry_code_hash text NULL,
  ADD COLUMN manual_entry_code_sealed text NULL; -- AES-sealed, để hiển thị lại
```

Nullable — vé cũ (phát trước migration) không có mã thủ công cho tới khi được backfill (mục 8) hoặc reissue (mục 9.6).

**Tên migration đề xuất** (coordinator xác nhận slot thật trước khi tạo file — tiếp theo `202610280003...`, kiểm tra lại nhánh khác chưa chiếm): `202610290002_gate_credential_jws_manual_code`.

## 6. GATE error codes mới (tất cả qua `denyGate` có sẵn → tự động có reject-audit, không cần sửa `recordGateReject`)

| Code | Khi nào | Lớp test |
| --- | --- | --- |
| `CREDENTIAL_REQUIRED` | Body thiếu `presented` hoàn toàn (422 ở HTTP layer, không tới `denyGate`) | H |
| `CREDENTIAL_SIGNATURE_INVALID` | JWS malformed, kid không có trong keyring, alg không khớp keyring, chữ ký sai | H |
| `CREDENTIAL_CONTEXT_MISMATCH` | `claims.tid`/`claims.eid` khác path/body (sai tenant/event) | H |
| `CREDENTIAL_VERSION_STALE` | `claims.ver`/`reservation.presented_credential_version` khác `tickets.credential_version` hiện hành | D (liên kết reissue, mục 9.6) |
| `MANUAL_CODE_INVALID` | `manual-lookup` không tìm thấy mã khớp hash (timing-safe) | H |
| `MANUAL_PROOF_INVALID` | `proofToken` sai chữ ký/hết hạn/sai `staffSessionId` | H |

Không tái dùng `TICKET_NOT_FOUND` cho các case trên — giữ phân biệt rõ "không tìm thấy vé" khỏi "credential không hợp lệ", đúng yêu cầu catalog GATE-03 ("QR giả/sai audience/kid/version/hash/event... từ chối, projection tối thiểu, có reject-audit đúng contract").

## 7. Online/offline — theo dõi, không tự sửa ADR-18

**Online (path chính của Task này):** đầy đủ theo mục 5. Không đổi.

**Offline (ADR-18, đã chốt — không sửa trong Task này):** `OfflineSyncEvent` (`packages/contracts/src/offline-sync.ts`) hôm nay chỉ có `ticketId` — **không có chỗ cho credential**. Hệ quả sau khi Task này ship: đường **online** (`reserve`) được bảo vệ bằng chữ ký, nhưng đường **offline** (`CHECKIN_OFFLINE` → apply tại `replayOfflineSyncBatch`) **vẫn hoàn toàn không xác minh credential** — chỉ dựa `tickets.state` như trước giờ. Đây là một khoảng hở còn lại, **không phải lỗi của Task này** (đúng ranh giới ADR-18 "đã chốt", giống cách TICKET-REISSUE-HANDOFF §2 nêu gap GATE-03 mà không tự sửa).

**Đề xuất follow-up (cần Task riêng + ADR-18 amendment do coordinator xác nhận, không làm ở đây):** thêm trường **additive, optional** vào `OfflineSyncEvent`:

```ts
presentedCredentialJws?: string;  // optional — client cũ (chưa update) vẫn hợp lệ, apply fallback như hôm nay
```

`replayOfflineSyncBatch` khi có trường này thì chạy lại đúng bước 4+6 của mục 5.1 (verify JWS + so version) tại thời điểm **apply** (lúc có mạng để sync), không phải lúc scan. Đây tương thích ngược hoàn toàn (trường optional, item cũ không có trường vẫn `APPLIED` như hôm nay) nên có thể triển khai **sau** và **độc lập** với Task này — ghi rõ ở đây để không bị quên, không phải blocker của GATE-03 online.

## 8. Rollout / compatibility — cutover cứng, không dual-accept

PRD dòng 201 không có khoan cho QR chưa ký: *"giả chữ ký hoặc đã dùng bị từ chối"* — không có điều kiện "trừ QR phát trước ngày X". Vì vậy:

- **Không** thiết kế giai đoạn Gate chấp nhận đồng thời `ticket.display` (không ký) và `ticket.gate_credential` (có ký) — làm vậy vi phạm đúng câu nghiệm thu trên trong lúc dual-accept.
- **Cutover nguyên khối:** thời điểm backend deploy xác minh chữ ký, **mọi** `reserve` phải có `presented` hợp lệ. Vì JWS được ký-lại-mỗi-lần-đọc (mục 4.1), **không cần backfill DB** — vé cũ vẫn ký được JWS hợp lệ ngay khi app/web gọi lại `/me/tickets` lần kế tiếp.
- **Rủi ro rollout thật, cần nêu rõ cho coordinator/CS:** thiết bị đã **cache QR cũ offline** trước cutover (O10/ADR-18 "lưu vé đã lấy về để mở khi không có mạng") sẽ scan ra `kind:'ticket.display'` không ký — Gate từ chối đúng theo thiết kế (không phải bug), nhưng với trải nghiệm xấu nếu attendee không mở app online lại trước khi đến cổng. Giảm nhẹ: client fetch lại ticket detail mỗi khi app foreground có mạng (không chỉ lúc mở từ cold start) để tối đa hoá khả năng QR đã là bản ký trước ngày sự kiện; không có cách nào loại hoàn toàn rủi ro này với một client đã cài từ trước mà chưa từng mở lại máy có mạng — chấp nhận được vì MVP/pilot chưa có người dùng thật đang cầm QR cũ (O06).
- Email QR (`kind:'ticket.credential'`, `outbox.ts`) **giữ nguyên không đổi** trong Task này — đường email không phải đường Gate chấp nhận hôm nay và cũng sẽ không phải sau Task này (Gate chỉ chấp nhận `ticket.gate_credential` quét từ app/web wallet). Dọn dẹp/hợp nhất hai kind QR email+wallet là việc của Task riêng, không bắt buộc để GATE-03 pass.

## 9. Lựa chọn chính sách — owner/coordinator phải chốt, không tự quyết

1. **Alg JWS**: `HS256` (khuyến nghị — đơn giản, không relying party ngoài cần verify độc lập) vs `ES256` (đồng nhất tiền lệ `apns.ts`, dự phòng verify ngoài tương lai, phức tạp hơn quản lý key pair).
2. **Pepper mã thủ công**: dùng chung `CODE_HMAC_PEPPER` (ít secret phải quản lý) vs pepper riêng `GATE_MANUAL_CODE_PEPPER` (khuyến nghị — bán kính rotate độc lập, redemption code và manual-entry code có vòng đời/mức lộ khác nhau).
3. **Backfill mã thủ công cho vé đã phát trước migration**: để trống (`manual_entry_code_hash IS NULL`) và chặn `manual-lookup` trả `MANUAL_CODE_INVALID` cho vé cũ (đơn giản, nhưng vé cũ mất hẳn đường thủ công cho tới khi reissue) vs chạy job backfill mint mã cho toàn bộ vé `ACTIVE` hiện có (cần Task migration dữ liệu riêng, không phải DDL). Không tự quyết vì ảnh hưởng vận hành ngay (không phải chỉ kiến trúc).
4. **`reserve` body breaking change**: Task này đề xuất bỏ hẳn `ticketId` trần khỏi body `reserve` (bắt buộc `presented`) — đây là thay đổi API contract phá vỡ client `gate-scan.ts` hiện tại, cần phối hợp release backend+iOS cùng lúc (không thể rolling partial). Phương án giữ `ticketId` optional kèm cảnh báo deprecate dần **không được khuyến nghị** vì chính nó là lỗ hổng "coi UUID là proof" mà Task này phải đóng — nhưng nêu ra vì ảnh hưởng lịch release, cần coordinator xác nhận cửa sổ deploy đồng thời.
5. **Follow-up ADR-18 (mục 7)**: mở Task riêng ngay (ưu tiên theo dõi gap offline đã nêu) hay chấp nhận known-gap tạm thời cho MVP/pilot (offline check-in không xác minh credential, chỉ dựa `ticket.state`) — owner quyết định mức ưu tiên, không phải quyết định kỹ thuật của Task này.
6. **Tương tác với `reissueTicketCredential`** (xem mục 9.6 bên dưới) — TICKET-REISSUE-HANDOFF chưa tồn tại khi Task đó được viết nên chưa xét; cần addendum.

### 9.6 — Theo dõi chéo bắt buộc với TICKET-REISSUE-HANDOFF

TICKET-REISSUE-HANDOFF (đã handoff trước Task này) thiết kế `reissueTicketCredential` mint `ticket_credentials` version mới + vô hiệu version cũ, nhưng **không** đề cập mã thủ công (vì endpoint manual entry chưa tồn tại lúc đó). Sau Task này, `reissueTicketCredential` nên **đồng thời rotate `manual_entry_code_hash`/`manual_entry_code_sealed`** — lý do: mục đích của reissue là "credential bị lộ/mất, phát lại" (PRD dòng 198); nếu chỉ xoay QR mà giữ nguyên mã thủ công cũ, kẻ có mã thủ công cũ (ví dụ đọc được từ email/chụp màn hình cùng lúc QR bị lộ) vẫn qua được `manual-lookup` sau reissue — làm rỗng một phần mục đích bảo mật của reissue. Đây là **addendum cần bổ sung vào TICKET-REISSUE-HANDOFF mục 4** (bước 7–9 của quy trình reissue nên mint cặp mã thủ công mới cùng lúc mint version mới), không phải thiết kế lại trong Task này — nêu ở đây để coordinator không bỏ sót khi giao backend implement cả hai Task cùng lúc.

## 10. Test matrix (theo lớp PLAN §3, ánh xạ đúng GATE-03/GATE-04 catalog)

| Lớp | Ca cần chứng minh |
| --- | --- |
| D | `reserve` với JWS hợp lệ version hiện hành → hold bình thường (không đổi hành vi). `reserve` với JWS version cũ (sau giả lập reissue) trên ticket vẫn `ACTIVE` → `CREDENTIAL_VERSION_STALE`, không tạo hold. `confirm` khi reissue xảy ra giữa lúc hold (TOCTOU) → `CREDENTIAL_VERSION_STALE`, không check-in. `manual-lookup` đúng mã → `proofToken`; `reserve` dùng `proofToken` đúng `staffSessionId` → hold; dùng từ `staffSessionId` khác → `MANUAL_PROOF_INVALID`. Mint JWS cho hai kid khác nhau (rotate keyring giữa chừng) — cả hai vẫn verify được. |
| H | JWS chữ ký sai/kid lạ/alg không allowlist → `CREDENTIAL_SIGNATURE_INVALID`, 403/422 ổn định, projection tối thiểu (không lộ ticket tồn tại hay không với kid lạ). `claims.eid`/`claims.tid` sai → `CREDENTIAL_CONTEXT_MISMATCH`. Body `reserve` gửi `ticketId` trần (không `presented`) → 422 `CREDENTIAL_REQUIRED`, không tới `lockTicket`. `manual-lookup` mã sai → `MANUAL_CODE_INVALID`, timing không lộ tồn tại/không tồn tại (so sánh thời gian response). `proofToken` hết hạn (giả lập `exp` quá khứ) → `MANUAL_PROOF_INVALID`. Rate limit `gateManualLookupPerUser` chặn brute-force sau N lần. Mọi deny trên đều có row `recordGateReject` tương ứng (reject-audit). |
| R | `/me/tickets` thật trả JWS ký bằng keyring thật, Gate app thật (hoặc fixture gần runtime) parse + gửi `reserve` thành công end-to-end qua Mailpit/PG thật — không mock crypto. Rotate `GATE_CREDENTIAL_CURRENT_KEY_ID` giữa lúc chạy, JWS ký trước đó (kid cũ) vẫn verify được (xác nhận keyring giữ key cũ đúng như thiết kế). |

## 11. Xác minh / giới hạn

- Đã đọc toàn bộ: `gate.ts` (bao gồm `reserveCheckin`/`confirmCheckin`/`revokeTicket`/`denyGate`/`lockTicket`/error codes), `qr-ticket.ts`, `credential-crypto.ts`, `role-map.ts`, `membership.ts` (`requireTenantPermission`), `gate-error.ts`, `tombstone-keyring.ts`, `code-hmac.ts`, `oidc.ts`/`apns.ts` (phần dùng `jose`), `gate-scan.ts` (toàn bộ, mobile), `display-payload.ts` (cả web và mobile), `offline-sync.ts` contract, TD §9, ADR-18, PRD M08, TICKET-REISSUE-HANDOFF, DECISION-LOG O23/O25/O27–O33 (xác nhận không mâu thuẫn), migration folder để chọn tên kế tiếp, `outbox.ts` đoạn render QR email (395–435).
- Chưa đọc/không cần cho quyết định D/API này: `apps/api/src/gate.ts` phần controller DTO chi tiết từng field validation (chỉ xác nhận route `reservations` tồn tại ở dòng 596); UI chi tiết hiển thị mã thủ công trên web/iOS (chưa tồn tại — Task này chỉ thiết kế backend contract + điểm client phải đổi).
- Không chạy test, không build, không sửa source — đúng giới hạn "no source edits" của Task.

---

**Người quyết định tiếp theo:** coordinator chốt 6 điểm mục 9 (đặc biệt #4 — cửa sổ deploy backend+iOS đồng thời do breaking `reserve` body, và #6 — bổ sung addendum vào TICKET-REISSUE-HANDOFF), rồi giao backend implement mục 4–7, 9.6-addendum; iOS implement đổi `gate-scan.ts`/`parseScan`/`runScan` theo contract mục 5.1 (bỏ nhánh UUID trần, thêm `presented`); web/mobile wallet đổi `display-payload.ts` sang tiêu thụ `kind:'ticket.gate_credential'` từ `/me/tickets`. Không coi `ADR-18` follow-up (mục 7) là blocker của Task online — chỉ là theo dõi bắt buộc.
