# F02 — Security / contract preflight (GET offline receipt)

| Mục | Giá trị |
| --- | --- |
| **Issue** | #859 |
| **Task** | `task_4abcc7f6530a` · dispatch `ctx_ed4dcb191f65` |
| **Reviewer** | James · `reviewer-security` (≠ architect Dexter · `ctx_4968d90e0af7`) |
| **SHA đối chiếu** | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` (worktree dirty; source thắng graph) |
| **BE implementation** | **Chưa có** — chỉ đánh giá draft `docs/architecture/F02-OFFLINE-RECEIPT-2026-10-24.md` + source hiện hành |
| **Input** | `DECISION-F02-FULL-2026-10-24.md`, `ORPHAN-COORDINATOR-DECISION.md`, `F02-OFFLINE-RECEIPT-2026-10-24.md` |

---

## Executive verdict

| Gate | Kết quả |
| --- | --- |
| **Contract security (mandatory)** | **FAIL** |
| **Implementation readiness (BE + iOS consume)** | **FAIL** — không coding cho đến khi sửa contract theo amendments §4 |

Không dùng `PASS with known gap` cho mandatory security/contract trong scope user 24/10. Không waive thiếu payload historical / mapping client.

---

## Findings (ID ổn định)

### C01 — `admissionEligible` + map `phase: 'admitted'` vi phạm non-admit historical (FAIL)

**Nguồn:** `F02-OFFLINE-RECEIPT-2026-10-24.md` §4.2 (`admissionEligible`), §7 (hydrate: `admissionEligible === true` → `phase: 'admitted'` + `admissionKind: 'already'`).

**Vấn đề:** Receipt lookup là **đối soát** cùng `clientEventId` (M10 restart, orphan), không phải xác nhận cho vào mới. `phase: 'admitted'` kích hoạt UX admission (copy “Được vào”, rung/âm theo PRD M10 §222–223) kể cả khi `admissionKind: 'already'`. Điều này trái `ORPHAN-COORDINATOR-DECISION.md` §5 và `ROADMAP.md` (#859): historical receipt **không** fresh-admit và **không** tái cấp admission từ ledger.

**Đối chiếu iOS hiện tại:** `reconcileOfflineScanOps` (`offline-scan-reconciliation.ts` ~49–63) cũng map local `applied`/`duplicate` → `admitted` — đúng cho **queue replay đã có immutable row**, nhưng **không** được nhân bản cho GET receipt; GET phải lane riêng (xem C08).

**Root adjudication:** **Chấp nhận** — bỏ `admissionEligible` / `admissionBlockReason` khỏi contract; không client path từ GET → `admitted`.

---

### C02 — DTO cần `historical` + `checkinState` thay boolean admission (FAIL → amend)

**Đề xuất contract (chốt review):**

```typescript
export type OfflineSyncReceiptStatus = 'APPLIED';

/** Trạng thái check-in/ticket tại thời điểm đọc — chỉ thông tin, không cấp quyền cho qua cổng. */
export type OfflineSyncReceiptCheckinState =
  | 'CURRENT'           // ledger checkin_id, undone_at null, ticket USED
  | 'UNDONE'            // checkins.undone_at set
  | 'TICKET_REVOKED'    // tickets.state === 'REVOKED'
  | 'NO_LONGER_CURRENT'; // ticket/check-in không còn khớp “winner” hiện tại (nếu BE phân biệt)

export interface OfflineSyncReceiptResponse {
  tenantId: string;
  eventId: string;
  clientEventId: string;
  status: OfflineSyncReceiptStatus; // luôn APPLIED khi 200
  historical: true;                   // luôn true trên route này — semantic bắt buộc
  ticketId: string;
  checkinId: string;
  staffSessionId: string;             // session tại apply (ledger), không phải input client
  appliedAt: string;                  // ISO UTC offline_sync_events.applied_at
  checkinState: OfflineSyncReceiptCheckinState;
}
```

**Loại bỏ:** `actorUserId` (caller đã bắt buộc = ledger actor sau authz), `admissionEligible`, `admissionBlockReason`, `checkinUndone`, `ticketRevoked` (gộp vào `checkinState`).

**Root adjudication:** **Chấp nhận** — khớp M10 đối soát kết quả không đồng nghĩa “cho vào lại”.

---

### C03 — Authz stack: không reuse `assertOpenForGate` trên GET (FAIL)

**Source:** `applyOfflineSyncBatch` gọi `assertOpenForGate` (`offline-sync.ts` ~625); `assertOpenForGate` từ chối khi check-in window đóng (`event-policy.ts` ~137–158).

**Vấn đề:** GET receipt là **read history** sau apply durable; staff có thể cần đối soát sau timeout/restart (PRD M10: “app restart sau timeout vẫn đối soát được kết quả”) trong khi cửa sổ check-in đã đóng. Gắn `assertOpenForGate` vào GET sẽ **403/closed** thay vì 200 + `historical`, làm hỏng M10/orphan recovery.

**Root adjudication:** **Chấp nhận** — GET **không** gọi `assertOpenForGate`. Vẫn cần event tồn tại trong tenant (implicit qua permission + join), không yêu cầu window mở.

---

### C04 — “Current event context” theo source (PASS khi implement đúng)

**Bắt buộc trên GET (song song, fail-closed):**

| Bước | Mechanism source | Ghi chú |
| --- | --- | --- |
| 1 | JWT → `actorUserId` | Giống `applyOfflineSyncBatch` ~619–624 |
| 2 | `requireTenantPermission` + `PERMISSION_CONFIRM` + `eventId` path | `offline-sync.ts` ~619–624 |
| 3 | **Không** `assertOpenForGate` | C01/C03 |
| 4 | **Ít nhất một** `staff_sessions` `ACTIVE`, `revoked_at IS NULL`, `user_id = actor`, `tenant_id` + `event_id` path | Draft §5.4 — **chưa có helper** trong repo; `assertSessionActive` (~238–261) yêu cầu **session id cụ thể** (POST body). BE phải thêm query mới (vd. `assertActorHasActiveSessionOnEvent`) |
| 5 | Sau đọc ledger: `ledger.actor_user_id = actorUserId`, `ledger.event_id = pathEventId`, join `staff_sessions` on `ledger.staff_session_id` với `user_id = actorUserId` (**không** yêu cầu session gốc còn ACTIVE) | Draft §5.5 — khớp M10 session mới sau restart |

**Không tin:** `staffSessionId` / `deviceId` từ query/body client.

**Membership / assignment / token:** 401/403 độc lập (identity, `SESSION_NOT_ACTIVE`, deny permission) — **trước** tra ledger.

---

### C05 — Oracle: 404 thống nhất sau permission check (FAIL → amend)

**Draft hiện tại:** 403 cho cross-actor (T4/T5); 404 cho no row / wrong event.

**Root + review:** Sau bước permission + active assignment hiện tại, các trường hợp sau **cùng** `404` + `OFFLINE_SYNC_RECEIPT_NOT_FOUND` (không phân biệt):

- Không row `(tenant_id, client_event_id)`
- `ledger.event_id` ≠ path `eventId`
- `ledger.actor_user_id` ≠ caller
- Join session gốc: `staff_sessions.user_id` ≠ caller
- Join `checkins` / `tickets` thiếu hoặc corrupt (fail-closed, không 500 leak)

**Lý do:** Tránh oracle `clientEventId` cross-actor/event sau khi caller đã được xác thực staff.

**Root adjudication:** **Chấp nhận** — sửa §4.3 và matrix T4/T5 → kỳ vọng 404.

---

### C06 — RLS / query read-only (PASS với điều kiện)

**Ledger:** `offline_sync_events` RLS tenant (`migration 202610170013_d7` ~48–53). Mọi query trong `withTenant(tenantId)`.

**Implementation:** GET dùng `FOR SHARE` (không `FOR UPDATE` như `readLedger` ~297–310 dùng cho apply path). Parameterized `$queryRaw` như hiện hành.

**Join bắt buộc:** `checkins` ( `undone_at` ), `tickets` ( `state` ) scoped `tenant_id`; thiếu row → 404 (C05).

---

### C07 — Không `staffSessionId` client input (PASS)

Draft §4.1 đã cấm — giữ nguyên. Response `staffSessionId` chỉ để client so khớp `GateOp.staffSessionId` trong `canApplyOfflineReplay` / scope guard — không dùng cho authz.

---

### C08 — Client mapping iOS (FAIL → amend trước consume)

**Bắt buộc sau BE:**

| GET outcome | `GateOp` |
| --- | --- |
| 200 + `historical: true` | **Không** `phase: 'admitted'`. Phase `unknown` hoặc phase mới `recorded` (nếu thêm) + message trung tính: **«Đã ghi nhận trước đó»** / biến thể undo-revoke (copy riêng, không tone admit) |
| `checkinState === 'CURRENT'` | Vẫn **không** admit UX — chỉ cập nhật `checkinId` + message đối soát; không rung admit |
| 404 | Giữ `unknown`, non-admit |
| 401/403 | Non-admit; không hydrate queue giả |

**Cấm:** Tạo `QueuedOfflineScan` từ receipt; replay POST từ `GateOp` thiếu immutable fields (`ORPHAN-COORDINATOR-DECISION.md` §6, contract `OfflineSyncEvent` ~74–92).

**Root adjudication:** **Chấp nhận** — không waive.

---

### C09 — Ledger durable semantics (PASS)

Source khớp draft: chỉ INSERT ledger khi apply thành công (`offline-sync.ts` ~523–540). REJECTED/CONFLICT không row → GET 404. `status: 'APPLIED'` trên 200 là đúng với schema (không cột status trong DB — derived).

---

### C10 — Endpoint / contracts package (INFO)

`packages/contracts/src/offline-sync.ts` chưa có route receipt — additive OK. Thêm `OFFLINE_SYNC_RECEIPT_NOT_FOUND`, endpoint constant, types §C02.

---

### C11 — M10 invariant alignment (PASS sau C01–C08)

| Invariant | Đánh giá |
| --- | --- |
| Restart đối soát cùng operation | GET keyed `clientEventId` + authz actor/session — **OK** nếu không `assertOpenForGate` (C03) |
| Không thành công giả offline | 404 → unknown; không `admitted` từ GET (C08) |
| Logout / user B không đọc receipt A | Token B + ledger A → 404 sau authz (C05); O02 không đổi |
| Undo/revoke online-only | `checkinState` phản ánh read-time; không re-admit (C02) |

---

## Exact contract amendments (tóm tắt cho architect / BE)

1. **DTO:** §C02 — `historical: true`, `checkinState`, bỏ admission fields và `actorUserId`.
2. **Authz:** §C03–C04 — permission + active assignment hiện tại; không `assertOpenForGate`; ownership ledger + session gốc (inactive OK).
3. **Errors:** §C05 — 404 uniform cho ledger mismatch / missing join; 401/403 chỉ identity/permission/assignment.
4. **OpenAPI:** Document read-only, no client `staffSessionId`.
5. **Client:** §C08 — mapping neutral; cập nhật `F02-OFFLINE-RECEIPT-2026-10-24.md` §4.2, §4.3, §7, §8.

---

## Threat / abuse matrix

| ID | Scenario | Kỳ vọng sau amend |
| --- | --- | --- |
| T-A1 | Actor B, `clientEventId` của A | 404 |
| T-A2 | Token tenant T1, ledger T2 (RLS) | 404 / no row |
| T-A3 | Đoán UUID `clientEventId` chưa apply | 404 |
| T-A4 | Path `eventId` ≠ ledger | 404 |
| T-A5 | Staff không active assignment hiện tại | 403 `SESSION_NOT_ACTIVE` |
| T-A6 | Receipt sau undo/revoke | 200 `historical`, `checkinState` ≠ CURRENT, UI non-admit |
| T-A7 | GET sau check-in window closed | 200 (nếu authz pass) — không block C03 |
| T-A8 | Client gửi `staffSessionId` query | Bỏ qua / không có param |
| T-A9 | User B token + A's id | 404 |
| T-A10 | Corrupt FK join | 404 fail-closed |

---

## Test matrix (contract-level; BE chưa implement)

| # | Case | HTTP | Body highlights |
| --- | --- | --- | --- |
| T1 | Ledger current, ticket USED | 200 | `historical: true`, `checkinState: 'CURRENT'` |
| T2 | Sau undo | 200 | `checkinState: 'UNDONE'` |
| T3 | Sau revoke | 200 | `checkinState: 'TICKET_REVOKED'` |
| T4 | Actor B ledger A | **404** (amended) | — |
| T5 | Session gốc user B, caller A | **404** (amended) | — |
| T6 | Không active session hiện tại | 403 | — |
| T7 | Chưa apply / REJECTED | 404 | — |
| T8 | Wrong path event | 404 | — |
| T9 | Window closed, còn assignment | 200 | C03 |
| M1–M4 | iOS consume | — | Theo C08; không rerun full suite trong task này |

---

## Implementation readiness

| Slice | Sẵn sàng? | Blocker |
| --- | --- | --- |
| **Contract doc** | **Không** | C01, C02, C03, C05, C08 chưa reflected trong `F02-OFFLINE-RECEIPT-2026-10-24.md` |
| **Backend** | **Không** | Chưa code; phụ thuộc contract amend + helper session C04 |
| **iOS consume** | **Không** | Phụ thuộc OpenAPI freeze + C08 |

---

## Security verdict

**FAIL** — draft architect §4–§7 chưa đạt mandatory non-admit / M10 / oracle boundaries. Sau khi root freeze amendments §4 của artifact này vào architecture doc, có thể mở **Backend 35phút** theo `DECISION-F02-FULL-2026-10-24.md`; security re-check trên SHA implement (không kế thừa PASS này).

---

## Checks

```text
git rev-parse HEAD → b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37
Source read: packages/backend/src/offline-sync.ts, event-policy.ts, gate.ts;
  packages/contracts/src/offline-sync.ts; apps/mobile/src/gate/offline-scan-reconciliation.ts;
  migration 202610170013_d7_offline_sync
Không chạy lại full test suite (theo task spec)
```

**Reviewer:** James · independent của Dexter architect session.
