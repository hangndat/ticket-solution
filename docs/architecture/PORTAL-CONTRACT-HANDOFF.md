# Portal contracts — import CSV + privacy projections handoff

| Trường | Giá trị |
| --- | --- |
| Mode | **Thiết kế** (docs-only) — Role `architect` · [`docs/agents/roles/architect.md`](../agents/roles/architect.md) |
| Epic / Issues | Epic [#406](https://github.com/hangndat/ticket-solution/issues/406) · Task [#422](https://github.com/hangndat/ticket-solution/issues/422) (H-I1/H-I2) · Task [#431](https://github.com/hangndat/ticket-solution/issues/431) (H-A1/H-C1/H-P1/H-P2) |
| Story parents | #421 (import/invitations) · #430 (audit/codes/platform) |
| Architecture impact | **Có** — shared Nest routes + MinIO quarantine + PG import/invitation jobs + privacy allowlists |
| Base SHA đã đọc | **`b63556e1698ca2f60a87aade890d257d5d0a832a`** (import/inventory/BFF); tip branch khi ghi handoff **`448a225aacff2235c0d842c6645a5b60ec5ec3cb`** (chỉ thêm `revokeMember` — không đổi H-I/H-A) |
| Authority | ADR-20 §7.1 · `packages/contracts/src/import-invite.ts` · `PORTAL-BACKEND-GAPS` H-I*/H-A1/H-C1/H-P* · Decision Log O06 |
| Kết luận | **Đủ để triển khai trong scope** — coordinator chốt `packages/contracts` theo bảng dưới; BE consume; **không** cắt BFF về sync legacy |
| Non-goals | Không sửa shared contracts / root lock / feature code trong Task này; không permission mới; không enterprise / multi-event BI; không prod/DNS/store |

---

## 1. Phạm vi và non-goals

### Mục tiêu

1. **H-I1 / H-I2:** Handoff contract đủ để implement multi-step CSV import (CODES + GUESTS) + guest invitations list/dispatch-preview/dispatch/claim — **không** ADR cắt sync.
2. **H-A1 / H-C1 / H-P\*:** Xác minh và đóng DTO privacy projections theo ADR-20 §7.1 (đối chiếu source role-map / schema).
3. Chốt **upload mechanism**, **DTO fields**, **route/method**, **limits/lifecycle**, **DB invariants**, **security/concurrency tests** để coordinator viết contracts và BE implement.

### Non-goals

- Không cắt `IMPORT_ENDPOINTS` về chỉ `POST …/imports` sync `codes[]`.
- Không tạo permission `audit.read` / `inventory.read` / role-map migration.
- Không invent status `SUCCESS` cho import/invitation/code (dùng enum hiện có / đã freeze trong CTR).
- Không mở retention O06 số mới; error-report TTL kỹ thuật ≠ retention policy sản phẩm.
- Không spawn worker; không OpenAPI regen trong Task architect.

---

## 2. Evidence đã đọc (facts)

| Fact | Location @ `b63556e…` |
| --- | --- |
| CTR import/invite shapes + `IMPORT_ENDPOINTS` **thiếu upload** | `packages/contracts/src/import-invite.ts` |
| Legacy sync API only | `apps/api/src/inventory.ts` `POST …/imports` body `{ codes, eventQuota? }` → `importRedemptionCodes` ≤500 |
| BFF đã kỳ vọng multi-step + multipart upload | `apps/web/app/api/bff/admin/imports/route.ts`, `…/imports/upload/route.ts` → upstream `POST …/imports/files` |
| Web path helper upload | `importsUploadPath` → `/v1/tenants/{t}/events/{e}/imports/files` |
| Upload response shape web parse | `ImportFileUploadResponse { fileId, fileHash, byteLength }` |
| Asset pattern (đối chiếu, **không** chọn cho CSV) | `CONFIG_ENDPOINTS.assetInit/finalize` + `config-assets.ts` quarantine + presign PUT |
| MinIO private buckets | `MINIO_BUCKET_IMPORTS` (ENV) · ADR-14 · `packages/backend/src/minio.ts` |
| Codes schema | `RedemptionCode`: `id`, `code_hmac`, `status`, `source_id`, `ticket_type_id` — **không** raw code |
| Code states observed | `AVAILABLE`, `HELD`, `CONSUMED` (issue/approval/inventory) — **không** bịa thêm |
| Staff audit table | `AuditLog`: actor/action/resource/reason/`sanitized_diff`/operationId |
| Platform audit table | `platform_audit_logs`: actor/action/resource/tenant/`sanitized_diff` |
| Perm map | `inventory.import`, `report.read` trong `MANAGER_EVENT`; Supervisor **không** có `report.read` |
| Platform MFA | `PLATFORM_MFA_ACR_VALUES` default `2`; audience `platform-api` / `ticket-platform-api` |
| Gap matrix | `docs/plans/PORTAL-BACKEND-GAPS.md` G-I1/G-I2/G-A1/G-C1/G-P1/G-P2 |
| Product decision #422 | **Implement** CTR multi-step — không cắt BFF sync |
| Invitation list fail-closed | `apps/web/src/admin/invitation.ts` reject raw `invitedEmail` / `token` |
| **Chưa có** PG `import_jobs` / guest `invitations` tables | prisma schema @ SHA |

**CRG:** `list_graph_stats_tool` OK; embeddings thiếu → lean-ctx + source verify (source thắng).

---

## 3. Quyết định kiến trúc (chốt)

### D1 — H-I1: multi-step job, giữ legacy sync tương thích

| | Chọn | Không chọn |
| --- | --- | --- |
| Primary | Job lifecycle: upload → create(`fileId`) → preview → commit (+ get/errors) | ADR cắt BFF về sync-only |
| Legacy | Giữ `POST …/imports` với body `{ codes: string[] }` ≤500 **không** `kind` — response shape hiện tại `{ imported, ticketTypeId, sourceId }` | Đổi semantics legacy thành job status giả |
| Job create | Body CTR `ImportCreateBody` (`kind`, `sourceId`, `ticketTypeId`, `fileId` \| `rawCodes`) + header `Idempotency-Key` | Client-supplied MinIO key |

**Content negotiation trên cùng path create:**

- **Legacy:** JSON `{ codes }` (và optional `eventQuota`) — không `kind` → sync path hiện có.
- **Job:** JSON có `kind` ∈ {`CODES`,`GUESTS`} + mapping + (`fileId` \| `rawCodes`≤500) → trả `ImportJob`, **không** ghi codes/invitations cho đến commit.

### D2 — Upload: Nest multipart bounded + server-minted `fileId` (không presign CSV)

**Chọn:** `POST /v1/tenants/{t}/events/{e}/imports/files` **multipart/form-data** (field `kind`, `file`) → Nest stream/bounded buffer → validate → put private MinIO quarantine → trả `{ fileId, fileHash, byteLength }`.

Portal/web BFF đã proxy: `/api/bff/admin/imports/upload` → upstream path trên.

| Phương án | Lợi | Hại | Verdict |
| --- | --- | --- | --- |
| **A — Multipart Nest (+ BFF proxy)** | Khớp BFF/tests hiện có; server sniff UTF-8/CSV trước khi durable; key do server mint; một hop authz | API process nhận tới `IMPORT_LIMITS.maxBytes` (10 MiB) | **Chọn** |
| **B — Presign init/finalize như assets** | Giống C-B assets; giảm body qua API | BFF upload phải viết lại; CSV text cần finalize validate giống assets; CORS/presign thêm surface; client có thể PUT non-CSV vào key | **Không** cho H-I1 |
| **C — Chỉ sync `codes[]`** | Ít việc | Phá multi-step UI; #422 cấm | **Cấm** |

**Trust:** object key layout server-only:

```text
tenants/{tenantId}/events/{eventId}/imports/quarantine/{fileId}
```

- Client **không** gửi `objectKey` / upload URL.
- Bucket imports **private**; list/detail/`ImportJob` DTO **không** trả object key, upload URL, hay **presigned** download URL.
- Error report: **`GET …/imports/:importId/errors` authenticated stream** (Bearer + event authz) → `text/csv` (BFF `interpretImportErrorsDownload` đã parse stream, không JSON URL). **Không** nhúng presigned URL vào list/job DTO.
- TTL: `IMPORT_ERROR_REPORT_TTL_HOURS_DEV` (24h) = **default kỹ thuật dev/unset only** — **không** khẳng định TTL production mới. Object cleanup production neo **O06** (DECISION-LOG): object store job xóa **≤ 90 ngày** sau hết hạn nghiệp vụ; audit **730 ngày**.

### D3 — Preview không reserve; commit PG idempotent

| Bước | Hành vi |
| --- | --- |
| Preview | Parse CSV + mapping; đếm valid/error/invitation; `estimatedQuota` **ước lượng chỗ trống**; **cấm** tăng `quota_buckets.allocated` / hold codes |
| Commit CODES | Giữ semantics legacy `importRedemptionCodes`: insert `redemption_codes` `AVAILABLE` + HMAC — **không** `allocated++` (quota chỉ tăng lúc **issue** ticket — `issue.ts`) |
| Commit GUESTS | Insert invitation rows (`PENDING`); **không** `allocated++`; **không** tạo ticket/code hold |
| Dispatch | Gửi mail / `DISPATCHED` state only; **không** reserve/`allocated++` trước claim |
| Claim → issue | Quota allocate + code/ticket theo path `issue` hiện có (claim bound email verified) — đây mới là chỗ SoT quota |
| Commit mech | `Idempotency-Key` bắt buộc; khớp `previewRevision` + `mappingRevision` + `fileHash`; stale → `IMPORT_STALE_PREVIEW` |
| Concurrency | `SELECT … FOR UPDATE` trên import job row; một commit thắng; replay cùng key → `replayed: true` + cùng response |
| Transaction | Codes HMAC insert **hoặc** invitation rows trong **một** PG TX; outbox mail **sau** commit (ADR-17); không success giả nếu TX rollback |
| Row caps | `tenant_limits.import_rows_per_job` ∩ `IMPORT_LIMITS.maxRows` (10_000); vượt → fail, không partial insert |

### D4 — Invitations (H-I2) + claim (H-I3 attendee)

- List: `InvitationSummary` masked only; fail-closed nếu raw email/token.
- `dispatch-preview`: `estimatedQuota` only; **không** mail, **không** reserve.
- `dispatch`: yêu cầu `previewRevision`; idempotent; concurrent conflict ổn định (`IDEMPOTENCY_CONFLICT` / revision mismatch).
- `claim`: attendee host; token one-time; **email verified** khớp invitation bound email; mismatch → `INVITATION_EMAIL_MISMATCH`.

### D5 — Privacy projections (H-A1 / H-C1 / H-P\*) — xác minh ADR-20 §7.1

Không tạo permission mới. DTO allowlist dưới đây là authority cho `portal-admin.ts` (+ platform module nếu tách file).

---

## 4. Contract đề xuất — Import / files / invitations

### 4.1 Endpoints (bổ sung upload vào `IMPORT_ENDPOINTS`)

Prefix Nest thực tế: `/v1` (BFF forward đã dùng `/v1/tenants/...`).

| Key | Method + path | Authz | Notes |
| --- | --- | --- | --- |
| **upload** *(mới)* | `POST /tenants/:tenantId/events/:eventId/imports/files` | `inventory.import` + event assignment | multipart; xem §3 D2 |
| create | `POST /tenants/:tenantId/events/:eventId/imports` | same / legacy | Job vs legacy theo D1 |
| get | `GET …/imports/:importId` | same | Cross-tenant/event → 404 |
| preview | `POST …/imports/:importId/preview` | same | Body optional mapping bump |
| commit | `POST …/imports/:importId/commit` | same | Idempotency-Key |
| errors | `GET …/imports/:importId/errors` | same | Masked CSV/JSON; short-lived |
| listInvitations | `GET …/invitations?cursor&limit&state?` | same (GUESTS ops) | Masked |
| dispatchPreview | `POST …/invitations/dispatch-preview` | same | No reserve |
| dispatch | `POST …/invitations/dispatch` | same | Idempotency-Key |
| claim | `POST …/invitations/claim` | attendee verified | Host `app.` OK |

### 4.2 DTO fields (chốt cho coordinator)

Giữ shapes hiện có trong `import-invite.ts`. **Thêm tối thiểu:**

```ts
// Upload
export interface ImportFileUploadResponse {
  fileId: string;      // server UUID
  fileHash: string;    // hex sha256 of raw bytes accepted
  byteLength: number;  // 1..IMPORT_LIMITS.maxBytes
}

/** Additive on create — all optional for legacy BFF compatibility. */
export interface ImportCreateBody {
  kind: ImportKind;
  sourceId: string;
  ticketTypeId: string;
  fileId?: string;
  rawCodes?: string[];
  mappingRevision?: number;                 // omit → server default 1
  columnMapping?: { code?: string; email?: string }; // omit → header defaults
}

/**
 * Preview body — land cùng PR contracts #422.
 * Web BFF hiện chỉ forward mappingRevision?; omitted → stored mapping
 * hoặc default header `code` (CODES) / `email` (GUESTS).
 */
export interface ImportPreviewBody {
  mappingRevision?: number;
  columnMapping?: { code?: string; email?: string };
}

// Errors = authenticated CSV stream (NOT JSON envelope / NOT presigned URL):
// GET …/errors → 200 text/csv | 403 | 404 | 410 IMPORT_ERROR_REPORT_EXPIRED
// Columns: line, fieldId, code, message — message must not echo full PII/raw codes
```

**Mapping theo kind (một file / một logical field):**

| kind | Logical field bắt buộc | Cấm |
| --- | --- | --- |
| `CODES` | `code` (header default `code`) | map `email` trên cùng file |
| `GUESTS` | `email` (header default `email`) | map `code` trên cùng file |

- Đổi `columnMapping` (hoặc logical header) → server **tăng** `mappingRevision` (hoặc reject stale client revision).
- Preview + commit: validate `mappingRevision` + `fileHash` (+ `previewRevision` trên commit).
- **Không** ép `ImportPreviewBody` required — omit giữ consumer web hiện tại.

**Validation upload (Nest):**

| Check | Fail code |
| --- | --- |
| size 1..`maxBytes` (10 MiB) | `IMPORT_FILE_INVALID` / row limit sibling |
| Content-Type / filename `.csv` hoặc `text/csv` / `text/plain` | `IMPORT_FILE_INVALID` |
| UTF-8 (reject UTF-16 BOM / invalid sequences) | `IMPORT_FILE_INVALID` |
| Row count ≤ min(`IMPORT_LIMITS.maxRows`, tenant `import_rows_per_job`) khi preview | `IMPORT_ROW_LIMIT` |
| Formula-injection risk on export path only; import store raw then sanitize **messages** in error report | — |

**ImportJobStatus (không mở rộng):**  
`CREATED` → `PREVIEW_READY` → `COMMITTING` → `COMPLETED` \| `FAILED`.  
Không thêm `SUCCESS` / `PARTIAL_SUCCESS`.

**Commit response:** giữ `status: 'COMPLETED'` literal hiện có (không synonym).

**`IMPORT_ENDPOINTS.upload` (chốt):**  
`'POST /tenants/:tenantId/events/:eventId/imports/files'` — khớp BFF `importsUploadPath`.

### 4.3 Lifecycle file / job

```text
[multipart upload] → MinIO quarantine + file row (fileId, hash, kind, expires)
       ↓
[create job + fileId] → ImportJob CREATED (PG)
       ↓
[preview + mapping] → PREVIEW_READY (counts, revisions, sampleErrors≤N)
       ↓
[commit + revisions + hash] → COMMITTING → COMPLETED | FAILED
       ↓
[errors GET] → masked report; TTL; no raw CSV re-download of quarantine by default
```

- Quarantine object XÓA/expire sau commit thành công hoặc TTL (worker) — business SoT là PG rows.
- `rawCodes` legacy trên job create: cho phép ≤500 **không** tạo file; vẫn qua preview/commit nếu `kind` set (không bypass quota rules).

---

## 5. Contract đề xuất — Audit / codes / platform (Task #431)

### 5.1 H-A1 — Event audit browser

```
GET /v1/tenants/{t}/events/{e}/audit?cursor&limit&from&to&action
```

| | Chốt |
| --- | --- |
| Permission | **`report.read`** + event assignment (như reporting) |
| Roles | Owner cần assignment; Manager allowlist; **CS / Scanner / Supervisor không** |
| Response item | `PortalAuditEntry`: `auditId`, `actorUserId`, `action`, `resourceType`, `resourceId`, `createdAt`, `operationId?`, optional **`reasonCode`** (stable allowlist only, vd. gate reject codes) |
| **Cấm** | free-text `reason` (có thể chứa PII/token/raw code); raw email/phone/token/code/`code_hmac`; **mọi** dump `sanitizedDiff` / payload; total count giả |
| Cursor | opaque `nextCursor`; limit 1..100 default 20 |
| Retention | **O06 đã chốt** (DECISION-LOG): audit TTL **730 ngày** — list chỉ hàng còn trong TTL; **không** invent TTL production mới |

### 5.2 H-C1 — Codes inventory browse

```
GET /v1/tenants/{t}/events/{e}/codes?cursor&limit&state&sourceId&q
```

| | Chốt |
| --- | --- |
| Permission | **`inventory.import`** + event assignment |
| Item | `PortalCodeSummary`: `codeId`, `state` (`AVAILABLE`\|`HELD`\|`CONSUMED` only — mirror DB), `sourceId`, `ticketTypeId`, `codeSuffixMasked?` (optional, chỉ nếu derive **không** từ hmac reverse) |
| **Cấm** | raw code, `code_hmac`, pepper version |
| `q` | CS-style: hash input server-side (`hashRedemptionCode`); **không** echo `q` raw trong response |

### 5.3 H-P-AUDIT / H-P1 / H-P2 — Platform

| ID | Route | Auth | Projection |
| --- | --- | --- | --- |
| **H-P-AUDIT** | `GET /v1/platform/audit?cursor&limit&from&to&action&tenantId?` | Platform Operator + MFA verifier (`acr`/`ACR=2`, audience platform — **không** staff `report.read`) | `PlatformAuditEntry`: `auditId`, `actorUserId`, `action`, `resourceType`, `resourceId`, `tenantId`, `createdAt` — **không** free-text reason, **không** dump `sanitized_diff` |
| **H-P1** | `GET /v1/platform/tenants?cursor&limit` | same Operator+MFA | `PortalPlatformTenantSummary`: `tenantId`, `slug`, `name`, `status` (`PENDING`\|`ACTIVE`\|`SUSPENDED`), `version`; thêm `createdAt` **chỉ nếu** cột nguồn có — **không** secrets/contact dump mặc định trên list |
| **H-P2** | `GET /v1/platform/tenants/{id}/health` | same Operator+MFA | Xem DTO dưới — counts only |

```ts
/** H-P2 — không fake Redis/SMTP/DB global per-tenant */
export interface PortalPlatformTenantHealth {
  tenantId: string;
  observedAt: string; // ISO server clock
  /** Mirror PlatformTenantDetail.usage — counts only */
  usage: {
    events: number;
    staffActive: number;
    staffPendingInvites: number;
    emailToday: number;
  };
  notifications: {
    pending: number;
    failed: number;
    dead: number; // providerStatus DEAD
  };
  outbox: {
    pending: number;
    failed: number;
  };
}
```

**Cấm trên health:** recipient/provider payload, raw error strings, SMTP/Redis/DB “up” boolean giả per-tenant, SLA/`success` status bịa. Đây là **counter observability**, không chẩn đoán infra toàn cục.

`PLATFORM_OIDC_REQUIRED_ACR=2` khớp `PLATFORM_MFA_ACR_VALUES=2` — không copy ví dụ `vemoki-mfa` web vào portal.

---

## 6. DB / security invariants (BE phải test)

1. Tenant context **transaction-local**; parameterized SQL; runtime role không bypass RLS.
2. Import commit và invitation dispatch: **PostgreSQL SoT** cho quota/codes/invitation state; Redis không quyết định.
3. Preview / dispatch-preview / guest **dispatch**: zero writes to `quota_buckets.allocated`. CODES commit may insert `AVAILABLE` codes (legacy semantics) **without** `allocated++`. Guest commit/dispatch **không** allocate; allocate chỉ tại claim→issue.
4. Idempotency unique `(actor, command, client_key)` (pattern `platform_operations` / tenant ops) — replay không double-insert codes.
5. Concurrent commit same `importId`: one `COMPLETED`; loser gets conflict or replay envelope — never double allocate.
6. Cross-tenant `importId` / `invitationId` → **404** (không leak).
7. List projections fail-closed on forbidden fields (mirror web invitation parser).
8. Quarantine keys / presigned URLs never in list/job DTOs; errors = authz Bearer CSV stream (410 when expired per technical TTL; prod object lifecycle = O06 ≤90d).
9. Legacy sync path behavior **unchanged** for `{ codes }` body (compatibility).
10. Claim: token single-use; bound email must match verified attendee email.

---

## 7. Test matrix (evidence khi implement — exact SHA)

| # | Case | Pass khi |
| --- | --- | --- |
| I1 | Upload >10 MiB / non-UTF8 / non-CSV | 422 `IMPORT_FILE_INVALID` \| `IMPORT_ROW_LIMIT`; no orphan job |
| I2 | Preview sau upload | counts OK; `quota_buckets.allocated` unchanged |
| I3a | Commit CODES | `AVAILABLE` codes inserted; **allocated unchanged**; job `COMPLETED` |
| I3b | Commit GUESTS + dispatch | invitations PENDING→DISPATCHED; **allocated unchanged** until claim/issue |
| I3c | Errors GET | 200 `text/csv` stream under Bearer; body không chứa URL/presign |
| I4 | Commit stale revision/hash | `IMPORT_STALE_PREVIEW`; no partial rows |
| I5 | Commit replay same Idempotency-Key | `replayed: true`; identical body; no dup HMAC rows |
| I6 | Concurrent commits | ≤1 success allocate; other conflict/replay |
| I7 | Legacy `POST` `{codes}` ≤500 | existing shape; no job required |
| I8 | Cross-tenant importId | 404 |
| I9 | Errors download | masked; no raw code column; expired → 404/410 |
| V1 | Invitation list raw email/token | reject/fail-closed |
| V2 | Dispatch-preview | no mail outbox; no quota reserve |
| V3 | Dispatch + replay | idempotent; revision required |
| V4 | Claim wrong email / reused token | `INVITATION_EMAIL_MISMATCH` / `INVITATION_TOKEN_INVALID` |
| A1 | Audit without `report.read` / Supervisor | 403 |
| A2 | Audit item không có free-text `reason`, không `sanitizedDiff`, không PII | schema assert |
| C1 | Codes list without hmac/raw | schema assert; `q` not echoed |
| C2 | Codes without `inventory.import` | 403 |
| P1 | Platform audit/tenants/health with staff token | 401/403 |
| P2 | Platform with MFA acr≠2 | deny |
| P3 | Platform audience attendee | deny |

Security-sensitive slices → `reviewer-dod` + `reviewer-security` trên exact SHA sau PR.

---

## 8. Ownership / dependencies thật

| Việc | Owner | Dep |
| --- | --- | --- |
| Apply DTO/endpoints vào `packages/contracts` (`import-invite.ts`, `portal-admin.ts`, export index) | **coordinator** (#422, #431) | Handoff này |
| Regen OpenAPI / lockfile nếu cần | **coordinator** | sau contracts |
| Nest + PG migration import_jobs / import_files / invitations + MinIO quarantine | **backend** | contracts tip |
| Worker parse/commit heavy / TTL cleanup (nếu tách khỏi request thread) | **backend** / worker | job table |
| Portal/web wire (đã có BFF phần lớn) | **web** | Nest routes live |
| DoD / security exact SHA | reviewers độc lập | PR |

**Parallel:** coordinator contracts #422 ∥ #431 (cùng package — **serialize git** trên `packages/contracts` nếu cùng branch; hoặc tuần tự commit theo file). BE bắt đầu sau contracts tip có upload + privacy DTOs. Web portal foundation **không** bị chặn toàn bộ bởi H-I1 nếu màn khác ready.

---

## 9. Phương án đã xét / loại

| Phương án | Lý do loại |
| --- | --- |
| Cắt BFF sync-only | #422 + `T-COORD-CTR-I` cấm; mất parity UI Steps |
| Presigned CSV như assets | BFF multipart đã có; CSV cần server UTF-8 validation trước durable |
| Permission `audit.read` / `inventory.read` | ADR-20 §7.1 superseded |
| Supervisor tự có audit từ tên role | `eventPermissionsForRole('Supervisor')` không có `report.read` |
| Trả `sanitizedDiff` / `code_hmac` trên list | Privacy fail |
| Status `SUCCESS` cho import | CTR đã freeze `COMPLETED`/`FAILED` |

---

## 10. Coordinator confirmations (đã nhận qua mailbox — không mở thêm SP)

| # | Chốt | Status |
| --- | --- | --- |
| C1 | `IMPORT_ENDPOINTS.upload` = `POST …/imports/files` khớp BFF | **Confirmed** |
| C2 | `ImportPreviewBody` (+ optional create mapping) land cùng contracts #422 | **Confirmed** |
| C3 | Errors = authenticated masked CSV stream; không JSON envelope / presign mặc định | **Confirmed** |
| C4 | Preview/create mapping fields **optional** — omit → stored/default header; không vỡ web BFF | **Confirmed** |
| C5 | Free-text `reason` khỏi audit list DTO | **Confirmed** |
| C6 | Platform health = sanitized counts (`PortalPlatformTenantHealth` §5.3); list = id/slug/name/status/version | **Confirmed** |
| C7 | Root/coordinator authority chốt contracts cuối | **Confirmed** |

**Unresolved còn lại:** không — đủ để coordinator implement contracts; lệch path upload chỉ được nếu đồng bộ BFF cùng PR.

**Authority contracts:** handoff = design input; không tự merge OpenAPI.

---

## 11. Kết luận

**Đủ để triển khai trong scope** cho coordinator shared-contracts Tasks #422 và #431.

- Import: multi-step + **multipart quarantine upload** + legacy sync tương thích.
- Privacy: ADR-20 §7.1 projections xác minh khớp source (perm + schema).
- Không phải security/UAT PASS; BE/tests/reviewer exact SHA vẫn bắt buộc trước Hoàn thành.
