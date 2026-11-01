# Handoff kiến trúc — GATE-03: QR credential ký + mã thủ công đủ entropy tại admission (PRD M08)

| Trường | Giá trị |
| --- | --- |
| Role | `architect` (Dexter) · [`docs/agents/roles/architect.md`](../agents/roles/architect.md) |
| **Exact SHA đối chiếu** | `8b6dacf889ac379e2df87c524554446599ab090c` (worktree `main-3`; dirty do Task khác trên `tests/e2e/**`/`company/**` — không liên quan, không chạm trong Task này) |
| Quyết định nguồn | [PRD §M08](../PRD.md) dòng 191–201 · [TECHNICAL-DESIGN §9](../TECHNICAL-DESIGN.md) dòng 283–337 · [ADR-18](../ops/ADR-18-OFFLINE-GATE-SYNC.md) · [DECISION-LOG O23](../DECISION-LOG.md) (Gate chỉ iOS Staff, không Web Gate) · O31/O32 (gate/session model, không đổi bởi Task này) · [TICKET-REISSUE-HANDOFF §2](./TICKET-REISSUE-HANDOFF.md) (phát hiện nền tảng mà Task này giải quyết) · PLAN `tests/e2e/PLAN.md` GATE-03/`backend/coverage.json` |
| Architecture impact | **Có** (trust boundary admission mới, transaction reserve/confirm, schema `ticket_credentials`/`checkin_reservations`, contract QR/API mới) |
| Security impact | **Có** (chống giả mạo bearer UUID thành "proof", key material mới, reject-audit) |
| **Kết luận** | **Đủ để triển khai trong scope** cho phương án được đề xuất (mục 3–8); **6 lựa chọn chính sách mục 9 đã chốt** (coordinator + User — xem §9) và **1 theo dõi chéo bắt buộc** với Task reissue đã handoff trước (mục 9.6, đã thành addendum). Security design vẫn **pending revalidation độc lập** (xem §11) |

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
8. `code-hmac.ts` (DB-19) đã có đúng pattern "mã đủ entropy, lưu HMAC-pepper, không lưu plaintext" cho redemption code — mẫu trực tiếp cho **manual entry code** (mục 6), dùng pepper/version riêng (mục 9.2).
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

**Vì sao bỏ AES-seal/`encrypted_token`/`token_hash` khỏi đường QR mới:** cơ chế cũ (`credential-crypto.ts`) tồn tại để giữ một **bearer secret bí mật** (token phải giữ kín, so hash để xác minh). Một khi toàn bộ claims được **ký** (chữ ký là thứ không thể giả mạo), token không cần bí mật nữa — tính không giả mạo nằm ở chữ ký, không ở việc giữ kín giá trị. Loại bỏ bước AES decrypt-on-read trên đường QR và bỏ hẳn mô hình bearer-secret: tính không giả mạo đến từ **chữ ký bất đối xứng ES256** (mục 9.1), không phải từ việc giữ kín một token đối xứng. Cột `ticket_credentials.token_hash`/`encrypted_token` giữ nguyên **chỉ** để tương thích kênh email hiện có (outbox vẫn render PNG `kind:'ticket.credential'` như cũ cho tới khi được dọn ở Task riêng — xem mục 8); đường QR mới trong app/web **không** đọc hai cột này.

**Chọn alg — đã chốt ES256 (mục 9.1):** TD §9.1 dùng từ vựng chuẩn của chữ ký **bất đối xứng** — *"Giữ public verification keys tới khi các vé đã phát hết vòng đời; private keys và token lưu mã hóa, không log"* — phân biệt rõ khóa công khai (verifier giữ/retain) với khóa riêng (signer giữ, mã hóa khi lưu). `HS256` (HMAC) **không có khái niệm "public key"** (khóa xác minh = khóa ký = bí mật tuyệt đối), nên không khớp nghĩa đen câu này. Vì vậy chọn **ES256** làm mặc định duy nhất: signer giữ private key (mã hóa khi lưu), verifier giữ public verification keys (retain tới khi vé hết vòng đời) — đúng nghĩa đen TD, đồng nhất tiền lệ `apns.ts` (đã dùng ES256 `SignJWT`/`importPKCS8` với `jose`), không thêm dependency. (Quyết định theo F01 — xem §11.)

**Allowlist alg tường minh khi verify** (tái dùng đúng pattern `oidc.ts` dòng 28: `ALLOWED_ALGORITHMS` truyền vào `jwtVerify`, ở đây cố định `['ES256']`), **không** đọc alg từ header JWS để tự quyết keyring — luôn tra `kid` trong keyring trước (fail-closed: `kid` lạ → `CREDENTIAL_SIGNATURE_INVALID`), rồi xác nhận `alg` trong header phải bằng `ES256` và khớp đúng alg đã đăng ký cho `kid` đó. Chặn tấn công alg-confusion/key-confusion.

**Keyring — khóa bất đối xứng (ES256), tái dùng khung `tombstone-keyring.ts`:** module mới `gate-credential-keyring.ts` giữ **hai tầng** đúng nghĩa đen TD §9.1:

- **Public verification keys (retain):** env `GATE_CREDENTIAL_VERIFY_KEYS_JSON` = array `[{kid, alg:'ES256', publicKeyJwk|publicKeyPem}]` — chỉ chứa khóa công khai, không bí mật, giữ lại tới khi vé đã phát hết vòng đời (đúng *"Giữ public verification keys tới khi các vé đã phát hết vòng đời"*). `jwtVerify` tra `kid` trong mảng này, fail-closed khi thiếu/sai JSON (giống D13, log `alert` sanitized, throw, không coerce rỗng).
- **Private signing key (encrypted-at-rest):** khóa riêng ký **không** nằm plaintext — lưu dạng sealed (AES-GCM, tái dùng sealing primitives `credential-crypto.ts` với context key riêng; khóa mở = `credentialKey` material mà process API **đã có sẵn** — không thêm secret mới) trong env `GATE_CREDENTIAL_SIGNING_KEY_SEALED` + `GATE_CREDENTIAL_CURRENT_KEY_ID` chọn cặp key hiện hành để ký. Không log private key dưới bất kỳ dạng nào (đúng *"private keys ... lưu mã hóa, không log"*).

Rotate: sinh cặp key mới → append public key mới vào `GATE_CREDENTIAL_VERIFY_KEYS_JSON`, đổi `GATE_CREDENTIAL_CURRENT_KEY_ID` + sealed private key để ký; giữ public key cũ trong mảng để còn verify JWS đã phát hành dưới kid đó cho tới khi vé hết vòng đời — chỉ xoá public key cũ khỏi mảng sau khi coordinator xác nhận không còn vé/event nào tham chiếu kid đó. (Đã sửa theo F01: bỏ `secretBase64` đối xứng, không invent lưu plaintext secret.)

### 4.2 Manual entry — mã riêng, đủ entropy, không phải JWS

Mới hoàn toàn (không có implementation nào hôm nay để sửa):

- **Mint tại thời điểm phát vé** (cùng call site version=1 của `ticket_credentials`: `issue.ts:644`, `approval.ts:831`) — một mã hiển thị (`manual_entry_code`), ví dụ 10 ký tự base32 (Crockford, không nhầm 0/O, 1/I) nhóm `XXXX-XXXX-XX`, entropy ≥50 bit. Lưu **chỉ HMAC-pepper** (không plaintext) trong cột mới `tickets.manual_entry_code_hash`, theo đúng pattern `code-hmac.ts` (`hashRedemptionCode`-style, pepper/version riêng — mục 9.2). Giá trị plaintext trả về **một lần** tại response phát vé/duyệt (giống cách redemption code gốc được cấp) và lưu AES-sealed riêng (tái dùng `credential-crypto.ts` sealing primitives với context key khác) để hiển thị lại ổn định trong app/web/email — **khác** QR: mã này cần hiển thị lại y nguyên nhiều lần, nên vẫn cần round-trip giải mã (không thể ký-lại-mỗi-lần như JWS vì giá trị phải cố định để con người đọc/so sánh).
- **Endpoint mới** `POST /v1/gate/events/{eventId}/manual-lookup`, quyền `gate.confirm` (không permission mới — cùng nhóm actor có quyền reserve/confirm, SCANNER_EVENT đã có):

  ```
  Body: { tenantId, staffSessionId, code }
  200: { ticketId, proofToken, expiresAt }   // proofToken TTL ngắn (ví dụ 60s)
  404 MANUAL_CODE_INVALID (không lộ ticket tồn tại hay không — timing-safe compare qua codesEqualHmac)
  ```

  `proofToken` = JWS ngắn hạn do chính backend ký (cùng keyring ES256, mục 4.1), claims `{tid, eid, tkt, sid: staffSessionId, ver: tickets.credential_version, exp}` — `ver` được mint từ `tickets.credential_version` hiện hành **tại thời điểm lookup thành công** (chống race reissue giữa lookup và reserve/confirm — mục 5, F02). **Ràng** vào đúng `staffSessionId` đã gọi lookup, để `reserveCheckin` xác nhận đúng người đã tra mã mới được dùng kết quả, không chuyển proofToken sang session khác.
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
   - kind='manual': verify proofToken (cùng keyring ES256, TTL check)
     → sai/hết hạn/sai staffSessionId → denyGate(MANUAL_PROOF_INVALID)
     ticketId := proofToken.tkt ; presentedVersion := proofToken.ver ; presentedVia := 'manual'
5. lockTicket(tx, tenantId, eventId, ticketId) — HÀM CÓ SẴN, không đổi; đã trả sẵn
   credential_version trong cùng row đã lock — không cần query thêm.
6. Nếu ticket.credential_version !== presentedVersion
     → denyGate(CREDENTIAL_VERSION_STALE)   // credential cũ (QR hoặc manual proof) sau reissue — đúng nghiệm thu "QR bị thu hồi... bị từ chối"
7. ticket.state !== 'ACTIVE' → denyGate(TICKET_NOT_ACTIVE) — NHƯ HIỆN CÓ, không đổi
8. ... toàn bộ phần còn lại (currentCheckinId, expireHeld, currentHold, insert/update
   checkin_reservations) GIỮ NGUYÊN, chỉ thêm hai cột khi insert/update:
   presented_credential_version = presentedVersion (bắt buộc cho cả hai path — không NULL)
   presented_via = presentedVia ('qr' | 'manual')
```

Không có lock mới, không đổi thứ tự lock hiện có — bước 4 thuần CPU trước `lockTicket`, bước 6 dùng dữ liệu `lockTicket` đã trả sẵn.

### 5.2 Confirm — không cần client gửi lại QR, chỉ re-check version đã ghi ở reserve

TD §9.3: "recheck ticket ACTIVE + credential version". `confirmCheckin` đã gọi `lockTicket` (có `credential_version` hiện hành) ở dòng 721. Thêm một điều kiện ngay sau dòng kiểm `ticket.state !== 'ACTIVE'` (805–815), dùng dữ liệu đã có từ `reservations`/`lockTicket`, không query thêm:

```
Nếu reservation.presented_credential_version !== ticket.credential_version
     → denyGate(CREDENTIAL_VERSION_STALE)
```

Chặn đúng race TOCTOU cho **cả hai path**: reissue xảy ra giữa lúc `reserve` (giữ hold 30s) và `confirm` — credential đã trình ở bước reserve (QR hoặc manual proof) nay stale, confirm từ chối dù ticket vẫn `ACTIVE`. Path `manual` giờ cũng có `ver` (proofToken mint từ `credential_version` lúc lookup, mục 4.2), nên bị chặn đối xứng với QR — **không tạo hold/checkin mutation nào khi version đã lệch** (F02). Tương tác với reissue xem mục 9.6.

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

-- F05: uniqueness có scope, partial (không chặn vé cũ NULL trước backfill)
CREATE UNIQUE INDEX tickets_manual_code_hmac_unique
  ON tickets (tenant_id, event_id, manual_entry_code_hash)
  WHERE manual_entry_code_hash IS NOT NULL;
```

Nullable — vé cũ (phát trước migration) không có mã thủ công cho tới khi được backfill (mục 9.3) hoặc reissue (mục 9.6). Uniqueness scope theo `(tenant_id, event_id, manual_entry_code_hash)` (giống tiền lệ `redemption_codes_hmac_unique` ở `code-hmac.ts`/DB-19) — mint phải **retry-on-conflict với số lần hữu hạn** (collision bounded) khi sinh mã, tránh admission nhầm vé khi va chạm (F05).

**Tên migration đề xuất** (coordinator xác nhận slot thật trước khi tạo file — tiếp theo `202610280003...`, kiểm tra lại nhánh khác chưa chiếm): `202610290002_gate_credential_jws_manual_code`.

## 6. GATE error codes mới (tất cả qua `denyGate` có sẵn → tự động có reject-audit, không cần sửa `recordGateReject`)

| Code | Khi nào | Lớp test |
| --- | --- | --- |
| `CREDENTIAL_REQUIRED` | Body thiếu `presented` hoàn toàn (422 ở HTTP layer, không tới `denyGate`) | H |
| `CREDENTIAL_SIGNATURE_INVALID` | JWS malformed, kid không có trong keyring, alg không khớp keyring, chữ ký sai | H |
| `CREDENTIAL_CONTEXT_MISMATCH` | `claims.tid`/`claims.eid` khác path/body (sai tenant/event) | H |
| `CREDENTIAL_VERSION_STALE` | `claims.ver` (QR) hoặc `proofToken.ver` (manual) / `reservation.presented_credential_version` khác `tickets.credential_version` hiện hành — áp dụng cả hai path tại reserve và confirm | D (liên kết reissue, mục 9.6) |
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

## 9. Lựa chọn chính sách — đã chốt (coordinator + User)

Sáu điểm dưới đây đã được chốt sau security-design review (`.orca-metrics/f04-gate03-security-design.md` F01–F05) và freeze-plan (`.orca-metrics/f04-gate03-freeze-plan.md`). Nội dung gốc giữ lại để truy vết, kết quả chốt ghi ngay sau mỗi điểm:

1. **Alg JWS**: ~~`HS256` (đơn giản, không relying party ngoài cần verify độc lập) vs `ES256` (đồng nhất tiền lệ `apns.ts`, dự phòng verify ngoài tương lai, phức tạp hơn quản lý key pair)~~ → **Chốt: `ES256`** theo nghĩa đen TD §9.1 (*"Giữ public verification keys...; private keys ... lưu mã hóa"*) — `HS256`/HMAC không có khái niệm "public key". Allowlist `ES256` + `kid` fail-closed; giữ public verification keys, private signing key mã hóa khi lưu (mục 4.1, F01).
2. **Pepper mã thủ công**: dùng chung `CODE_HMAC_PEPPER` (ít secret phải quản lý) vs pepper riêng `GATE_MANUAL_CODE_PEPPER` → **Chốt: pepper riêng `GATE_MANUAL_CODE_PEPPER`** (bán kính rotate độc lập; redemption code và manual-entry code khác vòng đời/mức lộ — đúng khuyến nghị gốc).
3. **Backfill mã thủ công cho vé đã phát trước migration** → **Chốt (User, trả lời trực tiếp): tạo mã nhập tay cho toàn bộ vé `ACTIVE` cũ.** Quyết định canonical tại [issue #1031](https://github.com/hangndat/ticket-solution/issues/1031#issuecomment-6562266950). Chi tiết plan bounded/idempotent/restart-safe xem §9.3.
4. **`reserve` body breaking change**: Task này đề xuất bỏ hẳn `ticketId` trần khỏi body `reserve` (bắt buộc `presented`) — thay đổi API contract phá vỡ client `gate-scan.ts`, cần phối hợp release backend+iOS cùng lúc. → **Chốt: cutover cứng, không dual-accept** (PRD dòng 201 đã khóa — giữ `ticketId` optional/dual-accept là vi phạm nghiệm thu). Coordinator khóa cửa sổ release backend+iOS đồng thời trước implement.
5. **Follow-up ADR-18 (mục 7)**: mở Task riêng ngay (ưu tiên theo dõi gap offline đã nêu) hay chấp nhận known-gap tạm thời cho MVP/pilot. → **Chốt: ngoài scope, không waiver** — không tự sửa ADR-18 trong Task này; offline gap giữ nguyên là known-gap đã nêu ở mục 7, đưa vào roadmap review đúng chu kỳ (cần ADR-18 amendment riêng).
6. **Tương tác với `reissueTicketCredential`** (mục 9.6) → **Chốt: reissue rotate mã thủ công cùng transaction** — addendum đã bổ sung vào TICKET-REISSUE-HANDOFF mục 4 (bước 10.5). Không áp ngược cho dữ liệu đã reissue trước khi cột manual-entry tồn tại.

### 9.3 — Backfill mã thủ công cho vé ACTIVE cũ (chi tiết — đã chốt, User)

**Quyết định (User trả lời trực tiếp, canonical tại [issue #1031 comment](https://github.com/hangndat/ticket-solution/issues/1031#issuecomment-6562266950)):** tạo mã nhập tay cho **toàn bộ** vé `ACTIVE` đã phát trước migration (không để trống `manual_entry_code_hash` rồi chặn `MANUAL_CODE_INVALID`).

**Plan (Task data-job riêng, không phải DDL — chỉ ghi kế hoạch ở đây, KHÔNG chạy job trong Task docs này):**

- **Phạm vi:** mọi row `tickets` có `state='ACTIVE'` và `manual_entry_code_hash IS NULL`.
- **Bounded / idempotent / restart-safe:** xử lý theo batch có khóa `FOR UPDATE SKIP LOCKED` (cursor theo `ticket_id`), mỗi batch mint + ghi rồi `COMMIT`; chạy lại chỉ skip vé đã có `manual_entry_code_hash IS NOT NULL` — không mint trùng, không lệch count khi restart.
- **Không đổi version, không reissue:** backfill chỉ điền mã thủ công, **không** đụng `ticket_credentials.version`, `tickets.credential_version`, `state`, không gọi `reissueTicketCredential`, không rotate QR — "reissue rotate mã" chỉ áp cho hành động reissue thật (§9.6), không phải backfill.
- **Không overwrite:** điều kiện `WHERE ... AND manual_entry_code_hash IS NULL` bảo đảm không ghi đè mã đã có (vé mint tại call site issue/approval sau migration).
- **Lưu trữ:** `manual_entry_code_hash` (HMAC-pepper `GATE_MANUAL_CODE_PEPPER`, scoped `(tenant_id, event_id, ...)`) + `manual_entry_code_sealed` (AES-sealed plaintext để hiển thị lại, tái dùng sealing primitives `credential-crypto.ts` với context key riêng) — không lưu plaintext ngoài cột sealed, không log.
- **Atomic chống race reissue:** mint + UPDATE nằm cùng transaction với khóa hiện hành của ticket (cùng `lockTicket` FOR UPDATE / current-version lock) để nếu `reissueTicketCredential` chạy song song thì chỉ một bên thắng trên ticket lock; reissue rotate luôn thắng, backfill sau lock thấy `manual_entry_code_hash IS NOT NULL` hoặc `state/version` đã đổi thì **skip** vé đó — không ghi đè mã vừa rotate.
- **UNIQUE + retry collision bounded:** dựa index `tickets_manual_code_hmac_unique` (§5.3, F05); mint va chạm hash thì retry sinh mã mới với số lần hữu hạn rồi mới fail.

> Ghi chú nghiệm thu: việc User chốt chính sách backfill **không** được tính là SecurityPASS — bản thân kế hoạch này vẫn cần revalidation độc lập + test migration thật khi backend implement (xem mapping F01–F05 ở §11).

### 9.6 — Theo dõi chéo bắt buộc với TICKET-REISSUE-HANDOFF

TICKET-REISSUE-HANDOFF (đã handoff trước Task này) thiết kế `reissueTicketCredential` mint `ticket_credentials` version mới + vô hiệu version cũ, nhưng **không** đề cập mã thủ công (vì endpoint manual entry chưa tồn tại lúc đó). Sau Task này, `reissueTicketCredential` nên **đồng thời rotate `manual_entry_code_hash`/`manual_entry_code_sealed`** — lý do: mục đích của reissue là "credential bị lộ/mất, phát lại" (PRD dòng 198); nếu chỉ xoay QR mà giữ nguyên mã thủ công cũ, kẻ có mã thủ công cũ (ví dụ đọc được từ email/chụp màn hình cùng lúc QR bị lộ) vẫn qua được `manual-lookup` sau reissue — làm rỗng một phần mục đích bảo mật của reissue. **Đã chốt (mục 9 điểm 6) và addendum đã bổ sung vào TICKET-REISSUE-HANDOFF mục 4** (bước 10.5 — mint cặp mã thủ công mới cùng transaction sau khi tăng `credential_version`, cùng ticket lock đã giữ); không áp ngược cho dữ liệu đã reissue trước khi cột manual-entry tồn tại (tuần tự ship, không phải lỗi).

## 10. Test matrix (theo lớp PLAN §3, ánh xạ đúng GATE-03/GATE-04 catalog)

| Lớp | Ca cần chứng minh |
| --- | --- |
| D | `reserve` với JWS hợp lệ version hiện hành → hold bình thường (không đổi hành vi). `reserve` với JWS version cũ (sau giả lập reissue) trên ticket vẫn `ACTIVE` → `CREDENTIAL_VERSION_STALE`, không tạo hold. `confirm` khi reissue xảy ra giữa lúc hold (TOCTOU) → `CREDENTIAL_VERSION_STALE`, không check-in. `manual-lookup` đúng mã → `proofToken` có `ver` = `credential_version` hiện hành; `reserve` dùng `proofToken` đúng `staffSessionId` → hold; dùng từ `staffSessionId` khác → `MANUAL_PROOF_INVALID`. `proofToken` mint **trước** reissue, dùng trong TTL **sau** reissue → `CREDENTIAL_VERSION_STALE` ở reserve, không tạo hold; `reserve` (manual) thành công trước reissue rồi `confirm` sau reissue → `CREDENTIAL_VERSION_STALE`, không check-in (F02, đối xứng manual↔QR). Mint JWS cho hai kid khác nhau (rotate keyring giữa chừng) — cả hai vẫn verify được; kid lạ → `CREDENTIAL_SIGNATURE_INVALID`. |
| H | JWS chữ ký sai/kid lạ/alg không phải `ES256` (allowlist) → `CREDENTIAL_SIGNATURE_INVALID`, 403/422 ổn định, projection tối thiểu (không lộ ticket tồn tại hay không với kid lạ). `claims.eid`/`claims.tid` sai → `CREDENTIAL_CONTEXT_MISMATCH`. Body `reserve` gửi `ticketId` trần (không `presented`) → 422 `CREDENTIAL_REQUIRED`, không tới `lockTicket`. `manual-lookup` mã sai → `MANUAL_CODE_INVALID`, timing không lộ tồn tại/không tồn tại (so sánh thời gian response). `proofToken` hết hạn (giả lập `exp` quá khứ) → `MANUAL_PROOF_INVALID`. `proofToken` thiếu/sai `ver` (giả lập claim `ver` khác `credential_version`) → `CREDENTIAL_VERSION_STALE`, không tạo hold. Rate limit `gateManualLookupPerUser` chặn brute-force sau N lần. Mọi deny trên đều có row `recordGateReject` tương ứng (reject-audit). |
| R | `/me/tickets` thật trả JWS ký bằng private signing key thật (ES256), Gate app thật (hoặc fixture gần runtime) parse + gửi `reserve` thành công end-to-end qua Mailpit/PG thật — không mock crypto. Rotate `GATE_CREDENTIAL_CURRENT_KEY_ID` giữa lúc chạy, JWS ký trước đó (kid cũ) vẫn verify được bằng public verification key cũ (xác nhận retain public keys đúng thiết kế, mục 4.1). |

## 11. Xác minh / giới hạn

- Đã đọc toàn bộ: `gate.ts` (bao gồm `reserveCheckin`/`confirmCheckin`/`revokeTicket`/`denyGate`/`lockTicket`/error codes), `qr-ticket.ts`, `credential-crypto.ts`, `role-map.ts`, `membership.ts` (`requireTenantPermission`), `gate-error.ts`, `tombstone-keyring.ts`, `code-hmac.ts`, `oidc.ts`/`apns.ts` (phần dùng `jose`), `gate-scan.ts` (toàn bộ, mobile), `display-payload.ts` (cả web và mobile), `offline-sync.ts` contract, TD §9, ADR-18, PRD M08, TICKET-REISSUE-HANDOFF, DECISION-LOG O23/O25/O27–O33 (xác nhận không mâu thuẫn), migration folder để chọn tên kế tiếp, `outbox.ts` đoạn render QR email (395–435).
- Chưa đọc/không cần cho quyết định D/API này: `apps/api/src/gate.ts` phần controller DTO chi tiết từng field validation (chỉ xác nhận route `reservations` tồn tại ở dòng 596); UI chi tiết hiển thị mã thủ công trên web/iOS (chưa tồn tại — Task này chỉ thiết kế backend contract + điểm client phải đổi).
- Không chạy test, không build, không sửa source — đúng giới hạn "no source edits" của Task.

### 11.1 Patch history (phân biệt source history vs decisions mới)

- **Source history:** các phát hiện nền tảng (mục 2) được xác minh trên source tại SHA `8b6dacf889ac379e2df87c524554446599ab090c` (handoff gốc) — không đổi khi patch quyết định.
- **Review SHA:** security-design review đối chiếu tại `08376150f6e634fba007d1ffae000d5a0e8c04af` (HEAD `f04-gate-contract-plan`) — xem `.orca-metrics/f04-gate03-security-design.md` + `.orca-metrics/f04-gate03-freeze-plan.md`.
- **Patch này** chỉ cập nhật **decisions mới** (mục 4/5/9) theo F01–F05, không viết lại source history.

### 11.2 Mapping findings F01–F05 (đã sửa / chờ reviewer)

| ID | Trạng thái | Nơi sửa | Ghi chú |
| --- | --- | --- | --- |
| F01 (alg ES256) | **Đã sửa** | §4.1, §9.1, §10 | Keyring bất đối xứng: retain public verification keys + private signing key mã hóa khi lưu; allowlist `ES256` + `kid` fail-closed. Chờ reviewer-security revalidate. |
| F02 (proofToken bind `ver`) | **Đã sửa** | §4.2, §5.1, §5.2, §6, §10 | `ver` = `credential_version` lúc lookup; check `CREDENTIAL_VERSION_STALE` đối xứng QR/manual tại reserve và confirm; không hold/checkin khi stale. Chờ reviewer-security revalidate. |
| F03 (backfill ACTIVE) | **Đã ghi quyết định** | §9.3 | User chốt "tạo mã cho toàn bộ ACTIVE cũ" (canonical [issue #1031](https://github.com/hangndat/ticket-solution/issues/1031#issuecomment-6562266950)); plan bounded/idempotent/restart-safe. Không chạy job; không SecurityPASS. |
| F04 (rationale sai) | **Đã sửa** | §4.1 | Bỏ câu "API chưa có `credentialKeyMaterial`" (sai sự thật — API đã có `credentialKey`). |
| F05 (UNIQUE + retry) | **Đã sửa** | §5.3 | Thêm `tickets_manual_code_hmac_unique (tenant_id, event_id, manual_entry_code_hash) WHERE ... NOT NULL` + retry collision bounded. |

> Security design (F01/F02) **vẫn pending independent revalidation** — Task này chỉ patch handoff theo quyết định đã freeze, không tự đóng SecurityPASS.

---

**Người quyết định tiếp theo (cập nhật sau review F01–F05):** 6 điểm mục 9 đã chốt (alg ES256, pepper riêng `GATE_MANUAL_CODE_PEPPER`, backfill toàn bộ ACTIVE, cutover cứng không dual-accept, ADR-18 ngoài scope không waiver, reissue rotate mã cùng tx). Việc còn lại là logistics, không phải policy: (a) coordinator khóa cửa sổ release backend+iOS đồng thời (#4) và xác nhận số/tên migration thật (§5.3); (b) giao backend implement mục 4–7 + addendum TICKET-REISSUE-HANDOFF mục 4 (bước 10.5, §9.6); (c) iOS đổi `gate-scan.ts`/`parseScan`/`runScan` theo contract mục 5.1 (bỏ nhánh UUID trần, thêm `presented`); (d) web/mobile wallet đổi `display-payload.ts` sang tiêu thụ `kind:'ticket.gate_credential'` từ `/me/tickets`; (e) reviewer-security revalidate độc lập trên SHA mới (xem §11.2) trước khi nghiệm thu. ADR-18 follow-up (mục 7) không phải blocker của Task online — chỉ là theo dõi bắt buộc.
