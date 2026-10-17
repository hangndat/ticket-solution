# ADR-18 — Offline Gate sync (D7)

Ngày: 2026-10-17  
Trạng thái: **Đã chốt (contract #105)** — apply durable thuộc Issue #106  
Đối chiếu: [ADR-06](../TECHNICAL-DESIGN.md) (online reserve/confirm), [DECISION-LOG](../DECISION-LOG.md) O05/O10, contract `@ticket/contracts` `offline-sync.ts`

## Quyết định

Cho phép **staff Gate** queue `CHECKIN_OFFLINE` trên thiết bị khi mất mạng, rồi **replay** lên server qua:

`POST /v1/gate/events/{eventId}/offline-sync`

Server vẫn là nguồn chuẩn cho USED/revoked. RLS + tenant deny-by-default không đổi. Online reserve/confirm (ADR-06) giữ nguyên cho đường online.

## Sửa so với ADR-06 / TD §9.5

ADR-06 và §9.5 trước đây **cấm** queue confirm offline. O10 đưa Offline Gate multi-device vào MVP → ADR-18 **nới có kiểm soát**:

| Trước (ADR-06) | Sau (ADR-18) |
| --- | --- |
| Không queue confirm offline | Queue `CHECKIN_OFFLINE` trên client; sync batch khi online lại |
| Không cam kết chống trùng khi mất mạng | Cam kết **một vé → một check-in** (O05) sau sync: earliest replay order thắng |
| Web Gate không offline | Web/iOS staff cùng contract; UX riêng (D7-S2/S3) |

## Contract tóm tắt

| Khái niệm | Quy tắc |
| --- | --- |
| Event payload | `clientEventId`, `type=CHECKIN_OFFLINE`, `eventId`, `ticketId`, `clientOccurredAt`, `clientSeq`, `payloadVersion=1` |
| Idempotency | `clientEventId` unique per tenant; cùng key + cùng payload → DUPLICATE; khác payload → `OFFLINE_SYNC_IDEMPOTENCY_CONFLICT` |
| Clock skew | `|clientClockAt − serverNow|` và `|clientOccurredAt − serverNow|` ≤ **300s**; vượt → `OFFLINE_SYNC_CLOCK_SKEW_EXCEEDED` (không apply) |
| Replay order | Apply theo `clientOccurredAt ASC`, rồi `clientSeq ASC`, rồi `clientEventId ASC` |
| Conflict | Vé đã USED: item `CONFLICT` với `ALREADY_CHECKED_IN` hoặc `OFFLINE_SYNC_CONFLICT_LOST` + winning ids khi biết |
| Batch | Max **50** events / request |
| Authz | Bearer staff + active `staffSessionId` + tenant từ membership/assignment (không tin tenant từ QR) |

Chi tiết type/code: `packages/contracts/src/offline-sync.ts`.  
HTTP schema: `apps/api` OpenAPI path `/v1/gate/events/{eventId}/offline-sync`.

## Ngoài phạm vi (#105)

- Durable apply / DB migration / conflict resolution runtime → **#106**
- iOS SecureStore queue UI → D7-S2
- Web offline banner → D7-S3
- Undo/revoke offline — **không** hỗ trợ trong D7 (online only)

## #105 stub

Endpoint xác thực + validate transport rồi trả **501** `OFFLINE_SYNC_NOT_IMPLEMENTED` cho đến khi #106 wire apply.
