# O06 Retention — Handoff kiến trúc: POL-02 (ticket/check-in PII, 365d) & POL-03 (object purge, ≤90d)

**Role:** architect (Dexter) · **Mode:** Thiết kế (không implement) · **Base SHA:** `eb2ebc6f08521c72f09518a078ce012cdbfa73d9` (worktree `hangndat/local-e2e-regression`, shared tree — không ghi đè file đang dirty của phiên khác).

**Authority:** [DECISION-LOG.md §O06](../DECISION-LOG.md) (dòng 269–285) · [docs/ops/O06-OPTIONS.md](../ops/O06-OPTIONS.md). Số liệu đã chốt, **không đổi** ở đây.

**Route:** cost tier `high` / effort `high` (override so với default `advanced`/`medium` của Dexter trong `company/employees.json`) — lý do: anonymize PII và xoá object store là tác vụ một-chiều trên dữ liệu đa-tenant RLS; sai thiết kế gây mất dữ liệu nghiệp vụ hoặc rò rỉ PII giữa tenant, không thể rollback bằng revert code.

## 1. Phạm vi

**Trong scope (thiết kế, chưa code):**
- POL-02 — "Vé / check-in sau event: giữ 365 ngày rồi anonymize PII; giữ aggregate/KPI" (O06-OPTIONS mục 1 dòng "Vé / check-in sau event").
- POL-03 — "Object store (QR/export): signed URL ngắn hạn + job xoá object ≤ 90 ngày sau hết hạn nghiệp vụ".

**Ngoài scope (không thiết kế lại ở đây):**
- POL-01 / account anonymize ≤30d — đã implement đầy đủ (`packages/backend/src/account-deletion.ts`, migrations `202610180001`→`202610180005`, `202610280003`). Chỉ dùng làm pattern tham chiếu.
- Audit log TTL 730 ngày — quyết định riêng trong cùng dòng O06, chưa có migration/implementation nào; đây là bảng và clock độc lập (không phụ thuộc POL-02/03), để task riêng.
- Vùng dữ liệu (data residency), SLA hỗ trợ (các trục 7–12 O06) — không liên quan kiến trúc retention.
- Deploy `/privacy`, production, store — không tự ủy quyền từ handoff này (đúng AGENTS.md).

**Nguồn đã đọc:** `packages/backend/src/retention-o06.ts`, `account-deletion.ts`, `export.ts`, `minio.ts`, `import-jobs.ts` (hàm `cleanupExpiredImportFiles`), `qr-ticket.ts`, `tenant-context.ts`, `apps/worker/src/worker-relay.ts`, `worker-job-metrics.ts`; migrations `202610160001_foundation`, `202610160004_d2_issue_ticket`, `202610170005_d3_gate`, `202610170009_d4_cs_export_devices`, `202610170010_e_be_event_lifecycle`, `202610170012_f_be_form_consent`, `202610180001/002/003/004/005_*o06*`, `202610250001_ar891_worker_budget`, `202610280003_account_deletion_sla_metric`; `packages/backend/test/rls-catalog.test.cjs`; `docs/TECHNICAL-DESIGN.md` §13, §15.

## 2. Ràng buộc bắt buộc

- Tenant context transaction-local (`withTenant`/`withActor`, `tenant-context.ts:8-62`); mọi bảng tenant-scoped `ENABLE + FORCE ROW LEVEL SECURITY`; `ticket_runtime` không bypass RLS.
- Sweep retention là **cross-tenant theo thiết kế** (một worker quét tất cả tenant due) — chỉ được làm qua hàm `SECURITY DEFINER` hẹp, owner `migration_owner`, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO ticket_runtime`, trả về tối thiểu (không PII, không cross-tenant row) — đúng pattern `list_due_account_anonymizations` (`202610180001.../migration.sql:13-39`) và `claim_exports_batch` (`202610170009.../migration.sql:45-85`).
- `test/rls-catalog.test.cjs` giữ allowlist `DEFINER_OWNER_TABLES` — bảng nào một hàm `SECURITY DEFINER` được phép viết phải khai báo ở đó, nếu không test fail. Đã có sẵn: `events`, `redemption_requests`, `event_attendees`, `exports` (dòng 33–60 file test). → không cần sửa catalog cho các bảng này; chỉ cần sửa nếu Phương án B (bảng job riêng) được chọn.
- Không được xoá audit rows (comment lặp lại nhiều migration: "Explicit non-goals: do not DELETE audit rows").
- Không tái dùng `apply_account_anonymization`/`account_deletion_requests` cho POL-02 — khác trigger (event-end, không phải user request) và khác bán kính dữ liệu (user dùng chung nhiều event; xoá `users.email` ở granularity event là sai).

## 3. Dữ liệu PII cụ thể & "event-end clock"

| Trường | Vị trí | Vai trò | Hành động đề xuất |
| --- | --- | --- | --- |
| `redemption_requests.answers_json` | `202610170012_f_be_form_consent/migration.sql:17,30` — comment: *"Immutable normalized answers snapshot; never copied into audit_logs"* | Dữ liệu form đổi vé (tên/SĐT/CMND tuỳ cấu hình form) — PII chính của "ticket/check-in" | `NULL` tại mốc 365d |
| `event_attendees.canonical_email` | tạo ở `202610160004.../migration.sql:106-119`; comment ở `202610180001.../migration.sql:97` *"Event-scoped attendee email projection (keep row/aggregates)"* | Email snapshot theo event — cột này **được thiết kế sẵn** để scrub độc lập với `users.email` | `NULL` tại mốc 365d (idempotent — có thể đã `NULL` do POL-01 chạy trước) |
| `tickets`, `checkins`, `checkin_reservations` | — | Không chứa PII thô, chỉ FK `owner_user_id`/`actor_user_id` | **Giữ nguyên** — đây chính là "aggregate/KPI" O06 yêu cầu giữ |
| `ticket_credentials.encrypted_token`/`token_hash` | `202610160004.../migration.sql:204-217` | Credential QR sống (bearer để check-in) | **Chưa có quyết định** — xem §6.3 |
| `users.email`/`subject` | — | Dùng chung nhiều event/tenant của 1 user | **Ngoài phạm vi POL-02** — chỉ POL-01 (user tự yêu cầu) được sửa |

**Event-end clock:** `events.ends_at` (`202610170010_e_be_event_lifecycle/migration.sql:11`, nullable, `CHECK ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at`).

**Vấn đề chưa có đáp án trong code/decision log:**
1. `ends_at` **có thể NULL** (event draft/legacy chưa điền). O06 không nói event thiếu `ends_at` thì sao.
2. Event `business_status = 'CANCELLED'` có `cancelled_at` riêng (`events_cancel_fields_chk`) — mốc "event kết thúc" của event bị huỷ là `cancelled_at` hay vẫn `ends_at` gốc (có thể ở tương lai)?

→ Đề xuất của Dexter (chưa phải quyết định — coordinator/product chốt): `ends_at IS NULL` → **loại khỏi sweep** (fail-closed, không suy đoán ngày) + cảnh báo vận hành định kỳ (đếm event thiếu `ends_at` quá X ngày kể từ tạo) để product bổ sung thủ công; event `CANCELLED` dùng `COALESCE(cancelled_at, ends_at)` vì event huỷ không còn "diễn ra" theo nghĩa nghiệp vụ. Lý do chọn fail-closed thay vì fallback suy đoán: suy đoán sai ngày có thể xoá PII sớm hơn cam kết hợp đồng (vi phạm nghĩa vụ giữ dữ liệu tối thiểu) hoặc giữ PII lâu hơn luật cho phép — cả hai đều là lỗi một-chiều.

**Eligibility/holds:** không có cơ chế legal/dispute hold nào trong codebase hiện tại (không tìm thấy khái niệm hold/litigation gắn với ticket/event). O06 không nhắc hold cho trục này → mặc định 365d là cứng, không có exception path. Nếu cần hold, đó là tính năng mới ngoài phạm vi O06 đã chốt — phải mở quyết định riêng, **không tự thêm** ở đây.

## 4. Phương án thiết kế (POL-02)

### Phương án A — Đề xuất: cờ idempotency trên `events`, quét theo *event* (không bảng job riêng)

- Migration: `ALTER TABLE events ADD COLUMN ticket_pii_anonymized_at timestamptz`; index `(ends_at) WHERE ticket_pii_anonymized_at IS NULL`.
- `list_due_ticket_pii_anonymizations(p_limit)` — `SECURITY DEFINER`, cross-tenant, `SELECT ... FOR UPDATE SKIP LOCKED` trên `events` theo mốc §3, trả `(tenant_id, event_id)` — hình dạng giống `claim_exports_batch`.
- `apply_ticket_pii_anonymization(p_tenant_id, p_event_id)` — `SECURITY DEFINER`, một transaction: `UPDATE event_attendees SET canonical_email = NULL ... WHERE tenant_id/event_id AND canonical_email IS NOT NULL`; `UPDATE redemption_requests SET answers_json = NULL ... WHERE tenant_id/event_id AND answers_json IS NOT NULL` (giữ `terms_accepted`/`consent_accepted_at`/`form_definition_hash`/`terms_content_hash` — không phải PII, là bằng chứng consent cần giữ cho tranh chấp); cuối cùng `UPDATE events SET ticket_pii_anonymized_at = clock_timestamp() WHERE id = ... AND ticket_pii_anonymized_at IS NULL` — guard idempotent giống `apply_account_anonymization` (COMPLETED-check).
- Worker: job class mới `process_ticket_pii_anonymizations` vào `WORKER_JOB_CLASSES` (`worker-job-metrics.ts:3-9`), lane step mới trong `maintenance()` (`worker-relay.ts:222-228` là mẫu), `STEP_BUDGET_MS`/`OLDEST_DUE_BUDGET_SECONDS` entries riêng (không urgent theo giờ — có thể để budget rộng hơn `process_account_anonymizations`), thêm nhánh UNION trong `worker_due_job_snapshot()` (`202610250001_ar891_worker_budget/migration.sql`) — vẫn giữ nguyên tắc "chỉ aggregate, không PII/tenant id" (`worker-job-metrics.ts:19`).

**Trade-off batch size:** một event lớn (S1 capacity scenario TD §14.1 — 50k attendee) khiến `UPDATE` 2 bảng chạm tới hàng chục nghìn dòng trong 1 transaction. Chạy 1 lần/event sau 365 ngày không phải hot path nên chấp nhận được, nhưng `statement_timeout`/step budget của worker phải đủ lớn — **cần đo thử trên dữ liệu kích thước thật trước khi set budget cứng, không giả định vô hạn.** Nếu đo thấy quá chậm, chia nhỏ theo `LIMIT` trong loop là phương án dự phòng (phức tạp hơn vì cần cờ tiến độ phụ, không chỉ 1 timestamp).

### Phương án B — Không chọn: bảng job riêng `ticket_pii_retention_jobs` (giống `account_deletion_requests`)

- Ưu: tách state machine, audit riêng từng lần sweep, dễ thêm lease/backoff nếu sau này cần multi-step.
- Nhược: không có lý do kỹ thuật cần lease/backoff ở đây — không gọi hệ thống ngoài (không IdP), một `UPDATE` đơn là xong. Thêm bảng + state machine là over-engineering cho một flag 1-chiều mỗi event.
- Chỉ nên chuyển sang B nếu đo thực tế ở Phương án A cho thấy cần chia nhiều bước có lease (xem trade-off batch size trên).

**Kết luận mục này: Phương án A — đủ để triển khai phần cấu trúc, với 2 câu hỏi `ends_at`/`cancelled_at` ở §3 cần coordinator/product chốt trước khi viết migration thật.**

## 5. POL-03 — Object purge (≤90 ngày sau hết hạn nghiệp vụ)

**Phát hiện quan trọng — "QR object" không tồn tại trong object store hiện tại.** Toàn bộ call site `putObject(` trong `packages/backend/src` (không tính test):
- `export.ts:554` — CSV export (`owner_user_id` email đã `maskEmail()` qua `csv-guard.ts`, xem `export.ts:466-488`).
- `import-jobs.ts:626` — file CSV quarantine do tenant tải lên để bulk-issue (PII thô, chưa mask).
- `config-assets.ts:412` — brand asset (logo), không phải PII, không nên nằm trong phạm vi retention này.

QR ảnh được render on-the-fly (`qr-ticket.ts:33 renderCredentialQrPng`) và **không bao giờ persist vào MinIO** — mỗi lần hiển thị QR là render lại từ `ticket_credentials.encrypted_token`. Vậy cụm "QR/export objects" trong O06-OPTIONS hiện chỉ khớp với **bucket exports** (và có thể **import quarantine**), không khớp một tính năng QR-object đã xây. → **Cần product/coordinator xác nhận phạm vi POL-03 = exports + import quarantine trước khi code**, để tránh implementer tự suy diễn hoặc bỏ sót.

**Gap hạ tầng — không có cách xoá object thật.** `ObjectStore`/`MinioConfig` (`minio.ts:19-31`) chỉ có `putObject`/`getObject`/`createPresignedPutUrl`, **không có `deleteObject`**. `import-jobs.ts:1501-1503` đã tự ghi nhận điều này: *"Best-effort object delete via overwrite empty not available — drop DB row. Object store may retain until O06 retention sweeper."* → `cleanupExpiredImportFiles` hiện tại chỉ xoá **row DB**, bytes trong MinIO **không bao giờ bị xoá**. Đây là bằng chứng cụ thể nhất rằng POL-03 chưa thể triển khai đúng nghĩa cho tới khi `deleteObject` tồn tại.

**"Hết hạn nghiệp vụ" ≠ `exports.expires_at` hiện tại.** `exports.expires_at` (`export.ts:21 DEFAULT_TTL_SECONDS=86400`) là TTL *truy cập download* (24h), không phải mốc nghiệp vụ của O06. Đề xuất: dùng cùng event-end clock với POL-02 (`events.ends_at`, hoặc `COALESCE(cancelled_at, ends_at)`) cho business-expiry của `exports`, **không** dùng `exports.expires_at` — đồng bộ một clock cho mọi dữ liệu event-scoped, tránh 2 định nghĩa "hết hạn" khác nhau trong cùng policy. Đây là quyết định cần chốt.

**Thiết kế đề xuất (sau khi có `deleteObject` và phạm vi được xác nhận):**
- Thêm `deleteObject(objectKey): Promise<void>` vào `ObjectStore` (cùng pattern SigV4 `signedRequest` method PUT/GET đã có, `minio.ts:95-222`, dùng method `DELETE`; coi HTTP 404 là thành công — object không tồn tại = đã đạt mục tiêu, giống cách `idp.deleteUserBySubject` coi `NOT_FOUND` là `DELETED` ở `account-deletion.ts:397`).
- `claim_expired_retention_objects(p_limit, p_lease_owner)` — `SECURITY DEFINER`, cross-tenant, quét `exports` (`object_key IS NOT NULL AND purged_at IS NULL AND <event business-expiry> + 90d <= now()`), hình dạng giống `claim_exports_batch`; thêm cột `exports.purged_at timestamptz` để đánh dấu đã xoá object (giữ row/metadata — `row_count`, `status` — cho KPI, chỉ xoá `object_key`/bytes).
- `import_files` cần cùng xử lý nếu xác nhận nằm trong phạm vi — **chưa đọc đủ schema `import_files`** để khẳng định có field business-expiry tương đương; implementer phải đọc toàn bộ trước khi mở rộng (ngoài 3 cột thấy qua `cleanupExpiredImportFiles`: `tenant_id, id, object_key, consumed_at, expires_at`).
- Lease/backoff: tái dùng pattern `backoffSeconds()` (`account-deletion.ts:218-220`) để 2 worker không gọi `DELETE` trùng trên 1 row; rủi ro thấp hơn IdP call vì MinIO `DELETE` tự idempotent (404 không phải lỗi), nhưng vẫn cần lease để tránh 2 worker cùng `UPDATE` 1 row cùng lúc.

## 6. Nhất quán backup/erasure (trục #5 O06) — không thiết kế, chỉ flag

`docs/TECHNICAL-DESIGN.md` §15.3 đã nói restore từ backup/PITR có thể làm dữ liệu "sống lại", nhưng hiện **không có bước nào trong RUNBOOK đối soát lại retention sau mỗi restore** (ví dụ: chạy lại sweep POL-02/03 ngay sau restore để đảm bảo PII đã xoá quá cửa sổ không quay lại production access). Việc này thuộc runbook vận hành (ngoài path file Architect được giao sửa) — ghi nhận cho reviewer-dod/ops đưa vào RELEASE-CHECKLIST hoặc RUNBOOK trước pilot thật, không tự viết runbook ở đây.

## 7. Xác minh cần thu (test matrix)

- **Boundary:** event `ends_at = now() − 365d − 1s` (due) vs `now() − 365d + 1s` (chưa due); `ends_at IS NULL` (loại khỏi sweep theo đề xuất §3); event `CANCELLED` trước đủ 365 ngày theo `ends_at` gốc.
- **Idempotent:** gọi `apply_ticket_pii_anonymization` 2 lần liên tiếp cho cùng event — lần 2 phải no-op sạch (giống `apply_account_anonymization` COMPLETED-guard).
- **Cross-tenant proof:** 2 tenant có event trùng mốc biên 365 ngày; sweep tenant A không được đụng `redemption_requests`/`event_attendees` của tenant B — mở rộng mẫu test hiện có (`packages/backend/test/account-idp-erasure.test.cjs`) sang 2 bảng này.
- **RLS catalog:** chạy lại `test/rls-catalog.test.cjs` sau khi thêm hàm mới — xác nhận không cần sửa `DEFINER_OWNER_TABLES` (đã có `events`/`redemption_requests`/`event_attendees`/`exports`); nếu chọn Phương án B phải tự thêm bảng mới vào danh sách đó, nếu không test fail.
- **Object purge:** `deleteObject` trả 404 vẫn phải được worker coi là thành công; export đã bị purge không còn tải được qua `downloadExport` (status/`object_key` đã xoá).
- **Rollback:** `UPDATE ... SET x = NULL` là một-chiều, không thể khôi phục `answers_json`/`canonical_email` ngoài backup trong RPO — migration tự thân an toàn forward (chỉ `ADD COLUMN` nullable), nhưng rollback migration **không** hoàn tác dữ liệu đã anonymize (đúng tính chất "irreversible" đã nêu trong Task Spec, không phải lỗi thiết kế).

## 8. Giám sát

- Thêm `count_overdue_ticket_pii_anonymizations()` theo mẫu `count_overdue_account_deletion_requests()` (`202610280003_account_deletion_sla_metric/migration.sql`) — cảnh báo event quá hạn sweep.
- `worker_due_job_snapshot()` thêm nhánh cho 2 job mới để `queue_snapshot` log (`worker-relay.ts:264-286`) và gauge `worker_job_oldest_due_age_seconds`/`worker_job_due_count` phản ánh đúng; `OLDEST_DUE_BUDGET_SECONDS` cho job PII/object purge nên rộng hơn `process_account_anonymizations` (không urgent theo giờ như SLA 24/7 Gate).

## 9. Kết luận

**Đủ để triển khai trong scope (implementer có thể bắt đầu ngay, không cần chờ):**
- Cấu trúc claim/apply/idempotent/lease theo Phương án A — mẫu đã có đủ 3 nơi tham chiếu (`account-deletion.ts`, `export.ts` claim batch, `import-jobs.ts` cleanup).
- Danh sách trường PII cụ thể cần xoá cho POL-02: `redemption_requests.answers_json`, `event_attendees.canonical_email` — giữ nguyên mọi cột khác.
- Việc `ObjectStore` thiếu `deleteObject` — phải bổ sung trước khi POL-03 có ý nghĩa thật (không chỉ xoá DB row như code cũ).
- Test matrix §7 — viết trước, dùng làm acceptance cho implementation.

**Cần làm rõ (blocker — coordinator/product quyết, Architect không tự chốt số/phạm vi):**
1. `events.ends_at IS NULL` → loại khỏi sweep (đề xuất) hay có mốc khác?
2. Event `CANCELLED` dùng `cancelled_at` hay `ends_at` gốc làm mốc 365 ngày?
3. `ticket_credentials` (QR credential còn sống) có thuộc phạm vi xoá/revoke của POL-02 không — O06 không nói rõ.
4. Phạm vi POL-03 "QR/export objects" = bucket `exports` (+ `import_files`?) hiện có, hay một tính năng QR-object tương lai chưa code? Cần xác nhận trước khi implementer bắt tay.
5. "Hết hạn nghiệp vụ" cho `exports` dùng event `ends_at` (đề xuất, đồng bộ POL-02) hay một mốc khác?
6. Có cần cơ chế legal/dispute hold chặn anonymize 365d cứng không, hay giữ nguyên không có exception như hiện tại?

Không có blocker nào ngăn các Task độc lập (ví dụ thêm `deleteObject`, viết test boundary) chạy song song trong khi chờ 6 câu hỏi trên — chỉ phần ghi migration cột/clock cuối cùng cần chờ xác nhận để không phải sửa lại số đã apply trên dữ liệu thật.
