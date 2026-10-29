# O06 Retention — Handoff kiến trúc: POL-02 (ticket/check-in PII, 365d) & POL-03 (object purge, ≤90d)

**Role:** architect (Dexter) · **Mode:** Thiết kế (không implement) · **Base SHA:** `eb2ebc6f08521c72f09518a078ce012cdbfa73d9` (worktree `hangndat/local-e2e-regression`, shared tree — không ghi đè file đang dirty của phiên khác).

**Authority:** [DECISION-LOG.md §O06](../DECISION-LOG.md) (dòng 269–285) · [docs/ops/O06-OPTIONS.md](../ops/O06-OPTIONS.md). Số liệu đã chốt, **không đổi** ở đây.

**Route:** cost tier `high` / effort `high` (override so với default `advanced`/`medium` của Dexter trong `company/employees.json`) — lý do: anonymize PII và xoá object store là tác vụ một-chiều trên dữ liệu đa-tenant RLS; sai thiết kế gây mất dữ liệu nghiệp vụ hoặc rò rỉ PII giữa tenant, không thể rollback bằng revert code.

## 0. Quyết định bổ sung — User, 2026-10-29

User đã chốt sau restart, trực tiếp trả lời 6 điểm "Cần làm rõ" ở §9 (danh sách gốc giữ nguyên bên dưới để truy vết, đã gạch là **Đã chốt**):

1. **`events.ends_at IS NULL` → loại khỏi sweep** (giữ đúng đề xuất fail-closed §3 — không suy đoán ngày).
2. **Event `CANCELLED` dùng `cancelled_at` làm mốc clock** (không phải `ends_at` gốc, không phải `COALESCE` — `cancelled_at` là giá trị dùng khi nó đã set).
3. **`ticket_credentials` (QR credential) nằm ngoài phạm vi POL-02** — sweep không đọc/sửa/revoke bảng này; vòng đời credential (bao gồm reissue/revoke) tiếp tục do [TICKET-REISSUE-HANDOFF.md](./TICKET-REISSUE-HANDOFF.md) quyết định độc lập, không liên quan trigger 365d.
4. **Phạm vi object của POL-03 = chỉ `exports`** — loại `import_files`/import quarantine và "QR object" (đã xác nhận không tồn tại ở §5) khỏi phạm vi; không mở rộng `cleanupExpiredImportFiles` theo policy này.
5. **Business-expiry clock của `exports` = `events.ends_at`** — dùng `ends_at` cả khi event đã `CANCELLED`; loại khỏi sweep nếu `ends_at` NULL. Clock này riêng với clock POL-02 ở điểm 2.
6. **Không có cơ chế legal/dispute hold** — 365d là cứng, không exception path, giữ đúng mặc định đã ghi ở §3.

Các mục còn lại trong §3/§4/§5/§9 dưới đây đã được sửa trực tiếp để phản ánh 6 điểm trên; phần nào chỉ còn giá trị lịch sử được giữ nguyên và đánh dấu rõ.

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
| `ticket_credentials.encrypted_token`/`token_hash` | `202610160004.../migration.sql:204-217` | Credential QR sống (bearer để check-in) | **Ngoài phạm vi POL-02** (đã chốt, §0 điểm 3) — sweep không đụng bảng này |
| `users.email`/`subject` | — | Dùng chung nhiều event/tenant của 1 user | **Ngoài phạm vi POL-02** — chỉ POL-01 (user tự yêu cầu) được sửa |

**Event-end clock:** `events.ends_at` (`202610170010_e_be_event_lifecycle/migration.sql:11`, nullable, `CHECK ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at`).

**Đã chốt (User, 2026-10-29 — xem §0):**
1. `ends_at` **có thể NULL** (event draft/legacy chưa điền) → **loại khỏi sweep** (fail-closed, không suy đoán ngày) + cảnh báo vận hành định kỳ (đếm event thiếu `ends_at` quá X ngày kể từ tạo) để product bổ sung thủ công.
2. Event `business_status = 'CANCELLED'` có `cancelled_at` riêng (`events_cancel_fields_chk`) → mốc "event kết thúc" dùng **`cancelled_at`** (không phải `ends_at` gốc).

**Clock riêng theo policy (§0):**

```sql
-- ends_at NULL loại event khỏi cả hai sweep, kể cả khi đã hủy
pol02_clock(e) = CASE
  WHEN e.ends_at IS NULL THEN NULL
  WHEN e.business_status = 'CANCELLED' THEN e.cancelled_at
  ELSE e.ends_at
END
pol03_export_expiry(e) = e.ends_at
```

Lý do chọn fail-closed cho `ends_at IS NULL` thay vì fallback suy đoán: suy đoán sai ngày có thể xoá PII sớm hơn cam kết hợp đồng (vi phạm nghĩa vụ giữ dữ liệu tối thiểu) hoặc giữ PII lâu hơn luật cho phép — cả hai đều là lỗi một-chiều.

**Eligibility/holds (đã chốt — §0 điểm 6):** không có cơ chế legal/dispute hold nào trong codebase hiện tại và **User xác nhận không thêm** — 365d là cứng, không có exception path. Không mở quyết định hold ở nhánh này nữa.

**Ticket credentials (đã chốt — §0 điểm 3):** `ticket_credentials` nằm **ngoài phạm vi POL-02** — sweep POL-02 không đọc/sửa/revoke bảng này dưới bất kỳ hình thức nào (không `UPDATE status`, không xoá). Vòng đời credential tiếp tục do thiết kế reissue/revoke riêng ([TICKET-REISSUE-HANDOFF.md](./TICKET-REISSUE-HANDOFF.md)) quyết định, độc lập hoàn toàn với trigger 365d của O06.

## 4. Phương án thiết kế (POL-02)

### Phương án A — Đề xuất: cờ idempotency trên `events`, quét theo *event* (không bảng job riêng)

- Migration: `ALTER TABLE events ADD COLUMN ticket_pii_anonymized_at timestamptz`; index `(ends_at) WHERE ticket_pii_anonymized_at IS NULL`.
- `list_due_ticket_pii_anonymizations(p_limit)` — `SECURITY DEFINER`, cross-tenant, `SELECT ... FOR UPDATE SKIP LOCKED` trên `events` lọc theo `pol02_clock(e)` (§3 — yêu cầu `ends_at` không NULL; `cancelled_at` nếu `CANCELLED`, ngược lại `ends_at`) `+ interval '365 days' <= now()`, trả `(tenant_id, event_id)` — hình dạng giống `claim_exports_batch`.
- `apply_ticket_pii_anonymization(p_tenant_id, p_event_id)` — `SECURITY DEFINER`, một transaction: `UPDATE event_attendees SET canonical_email = NULL ... WHERE tenant_id/event_id AND canonical_email IS NOT NULL`; `UPDATE redemption_requests SET answers_json = NULL ... WHERE tenant_id/event_id AND answers_json IS NOT NULL` (giữ `terms_accepted`/`consent_accepted_at`/`form_definition_hash`/`terms_content_hash` — không phải PII, là bằng chứng consent cần giữ cho tranh chấp); cuối cùng `UPDATE events SET ticket_pii_anonymized_at = clock_timestamp() WHERE id = ... AND ticket_pii_anonymized_at IS NULL` — guard idempotent giống `apply_account_anonymization` (COMPLETED-check).
- Worker: job class mới `process_ticket_pii_anonymizations` vào `WORKER_JOB_CLASSES` (`worker-job-metrics.ts:3-9`), lane step mới trong `maintenance()` (`worker-relay.ts:222-228` là mẫu), `STEP_BUDGET_MS`/`OLDEST_DUE_BUDGET_SECONDS` entries riêng (không urgent theo giờ — có thể để budget rộng hơn `process_account_anonymizations`), thêm nhánh UNION trong `worker_due_job_snapshot()` (`202610250001_ar891_worker_budget/migration.sql`) — vẫn giữ nguyên tắc "chỉ aggregate, không PII/tenant id" (`worker-job-metrics.ts:19`).

**Trade-off batch size:** một event lớn (S1 capacity scenario TD §14.1 — 50k attendee) khiến `UPDATE` 2 bảng chạm tới hàng chục nghìn dòng trong 1 transaction. Chạy 1 lần/event sau 365 ngày không phải hot path nên chấp nhận được, nhưng `statement_timeout`/step budget của worker phải đủ lớn — **cần đo thử trên dữ liệu kích thước thật trước khi set budget cứng, không giả định vô hạn.** Nếu đo thấy quá chậm, chia nhỏ theo `LIMIT` trong loop là phương án dự phòng (phức tạp hơn vì cần cờ tiến độ phụ, không chỉ 1 timestamp).

### Phương án B — Không chọn: bảng job riêng `ticket_pii_retention_jobs` (giống `account_deletion_requests`)

- Ưu: tách state machine, audit riêng từng lần sweep, dễ thêm lease/backoff nếu sau này cần multi-step.
- Nhược: không có lý do kỹ thuật cần lease/backoff ở đây — không gọi hệ thống ngoài (không IdP), một `UPDATE` đơn là xong. Thêm bảng + state machine là over-engineering cho một flag 1-chiều mỗi event.
- Chỉ nên chuyển sang B nếu đo thực tế ở Phương án A cho thấy cần chia nhiều bước có lease (xem trade-off batch size trên).

**Kết luận mục này:** Phương án A; policy clock đã được user chốt ở §0 và §3.

## 5. POL-03 — Object purge (≤90 ngày sau hết hạn nghiệp vụ)

**Phát hiện quan trọng — "QR object" không tồn tại trong object store hiện tại.** Toàn bộ call site `putObject(` trong `packages/backend/src` (không tính test):
- `export.ts:554` — CSV export (`owner_user_id` email đã `maskEmail()` qua `csv-guard.ts`, xem `export.ts:466-488`).
- `import-jobs.ts:626` — file CSV quarantine do tenant tải lên để bulk-issue (PII thô, chưa mask).
- `config-assets.ts:412` — brand asset (logo), không phải PII, không nên nằm trong phạm vi retention này.

QR ảnh được render on-the-fly (`qr-ticket.ts:33 renderCredentialQrPng`) và **không bao giờ persist vào MinIO** — mỗi lần hiển thị QR là render lại từ `ticket_credentials.encrypted_token`. Vậy cụm "QR/export objects" trong O06-OPTIONS hiện chỉ khớp với **bucket exports**, không khớp một tính năng QR-object đã xây.

**Đã chốt (User, 2026-10-29 — §0 điểm 4): phạm vi POL-03 = chỉ `exports`.** `import_files`/import quarantine **loại khỏi phạm vi** policy này — `cleanupExpiredImportFiles` (`import-jobs.ts:1501-1503`) giữ nguyên hành vi hiện tại (chỉ xoá DB row), không mở rộng thêm `deleteObject` cho nó trong Task này. "QR object" xác nhận không tồn tại nên không có gì để loại trừ thêm ở đó — câu trong O06-OPTIONS chỉ còn ý nghĩa với `exports`.

**Hạ tầng:** `deleteObject` đã được bổ sung vào `ObjectStore`/`MinioConfig` và có unit test; chưa có worker POL-03 gọi primitive này. `cleanupExpiredImportFiles` vẫn chỉ xoá row DB và nằm ngoài phạm vi policy lần này.

**"Hết hạn nghiệp vụ" ≠ `exports.expires_at` hiện tại.** `exports.expires_at` (`export.ts:21 DEFAULT_TTL_SECONDS=86400`) là TTL *truy cập download* (24h), không phải mốc nghiệp vụ của O06. User chốt business-expiry của export là `events.ends_at`, kể cả event đã hủy; `ends_at IS NULL` loại export khỏi sweep POL-03.

**Thiết kế đề xuất (sau khi có `deleteObject`; phạm vi đã xác nhận = chỉ `exports`):**
- Dùng `deleteObject(objectKey): Promise<void>` đã có; coi HTTP 404 là thành công.
- `claim_expired_retention_objects(p_limit, p_lease_owner)` — `SECURITY DEFINER`, cross-tenant, quét `exports` (`object_key IS NOT NULL AND purged_at IS NULL AND events.ends_at + 90d <= now()`), hình dạng giống `claim_exports_batch`; thêm cột `exports.purged_at timestamptz` để đánh dấu đã xoá object (giữ row/metadata — `row_count`, `status` — cho KPI, chỉ xoá `object_key`/bytes).
- `import_files` **loại khỏi phạm vi** (§0 điểm 4) — không mở rộng xử lý này sang `import_files`; không cần đọc thêm schema đó cho Task này.
- Lease/backoff: tái dùng pattern `backoffSeconds()` (`account-deletion.ts:218-220`) để 2 worker không gọi `DELETE` trùng trên 1 row; rủi ro thấp hơn IdP call vì MinIO `DELETE` tự idempotent (404 không phải lỗi), nhưng vẫn cần lease để tránh 2 worker cùng `UPDATE` 1 row cùng lúc.

## 6. Nhất quán backup/erasure (trục #5 O06) — không thiết kế, chỉ flag

`docs/TECHNICAL-DESIGN.md` §15.3 đã nói restore từ backup/PITR có thể làm dữ liệu "sống lại", nhưng hiện **không có bước nào trong RUNBOOK đối soát lại retention sau mỗi restore** (ví dụ: chạy lại sweep POL-02/03 ngay sau restore để đảm bảo PII đã xoá quá cửa sổ không quay lại production access). Việc này thuộc runbook vận hành (ngoài path file Architect được giao sửa) — ghi nhận cho reviewer-dod/ops đưa vào RELEASE-CHECKLIST hoặc RUNBOOK trước pilot thật, không tự viết runbook ở đây.

## 7. Xác minh cần thu (test matrix)

- **Boundary:** event `ends_at = now() − 365d − 1s` (due) vs `now() − 365d + 1s` (chưa due); mọi event `ends_at IS NULL`, kể cả `CANCELLED`, bị loại khỏi sweep. Event `CANCELLED` có `ends_at` không NULL nhưng chưa due và `cancelled_at` quá 365d → POL-02 due theo `cancelled_at`; POL-03 vẫn dùng `ends_at`. Event `CANCELLED` có `cancelled_at IS NULL` bất thường → POL-02 fail-closed.
- **Idempotent:** gọi `apply_ticket_pii_anonymization` 2 lần liên tiếp cho cùng event — lần 2 phải no-op sạch (giống `apply_account_anonymization` COMPLETED-guard).
- **Cross-tenant proof:** 2 tenant có event trùng mốc biên 365 ngày; sweep tenant A không được đụng `redemption_requests`/`event_attendees` của tenant B — mở rộng mẫu test hiện có (`packages/backend/test/account-idp-erasure.test.cjs`) sang 2 bảng này.
- **RLS catalog:** chạy lại `test/rls-catalog.test.cjs` sau khi thêm hàm mới — xác nhận không cần sửa `DEFINER_OWNER_TABLES` (đã có `events`/`redemption_requests`/`event_attendees`/`exports`); nếu chọn Phương án B phải tự thêm bảng mới vào danh sách đó, nếu không test fail.
- **Object purge:** `deleteObject` trả 404 vẫn phải được worker coi là thành công; export đã purge không còn tải được qua `downloadExport`; event `ends_at IS NULL` không được purge, và event hủy vẫn dùng `ends_at` để tính 90d. `import_files` ngoài phạm vi task này.
- **Rollback:** `UPDATE ... SET x = NULL` là một-chiều, không thể khôi phục `answers_json`/`canonical_email` ngoài backup trong RPO — migration tự thân an toàn forward (chỉ `ADD COLUMN` nullable), nhưng rollback migration **không** hoàn tác dữ liệu đã anonymize (đúng tính chất "irreversible" đã nêu trong Task Spec, không phải lỗi thiết kế).

## 8. Giám sát

- Thêm `count_overdue_ticket_pii_anonymizations()` theo mẫu `count_overdue_account_deletion_requests()` (`202610280003_account_deletion_sla_metric/migration.sql`) — cảnh báo event quá hạn sweep.
- `worker_due_job_snapshot()` thêm nhánh cho 2 job mới để `queue_snapshot` log (`worker-relay.ts:264-286`) và gauge `worker_job_oldest_due_age_seconds`/`worker_job_due_count` phản ánh đúng; `OLDEST_DUE_BUDGET_SECONDS` cho job PII/object purge nên rộng hơn `process_account_anonymizations` (không urgent theo giờ như SLA 24/7 Gate).

## 9. Kết luận

**Trạng thái sau quyết định User 2026-10-29 (§0): Đủ để triển khai trong scope — không còn blocker chính sách.** Cả 6 điểm "Cần làm rõ" gốc đã chốt (lưu lại dưới đây cho truy vết, đã đánh dấu kết quả):

1. ~~`events.ends_at IS NULL` → loại khỏi sweep (đề xuất) hay có mốc khác?~~ → **Loại khỏi sweep** (đúng đề xuất).
2. ~~Event `CANCELLED` dùng `cancelled_at` hay `ends_at` gốc?~~ → **`cancelled_at`** (không `COALESCE`, không `ends_at` gốc).
3. ~~`ticket_credentials` có thuộc phạm vi POL-02 không?~~ → **Không** — ngoài phạm vi, vòng đời do thiết kế reissue riêng quyết định.
4. ~~Phạm vi POL-03 = `exports` (+ `import_files`?) hay QR-object tương lai?~~ → **Chỉ `exports`**; loại `import_files` và QR-object (không tồn tại).
5. ~~"Hết hạn nghiệp vụ" cho `exports` dùng `ends_at` hay mốc khác?~~ → **`events.ends_at`**, kể cả khi event `CANCELLED`.
6. ~~Cần legal/dispute hold không?~~ → **Không** — 365d cứng, không exception.

### Thứ tự triển khai đề xuất (migration → code → test, không đổi thứ tự để tránh áp sai mốc lên dữ liệu thật)

1. **Hạ tầng object store:** `deleteObject` đã có; kiểm chứng lại primitive trong integration test POL-03.
2. **Migration 2 — POL-02 schema:** `ALTER TABLE events ADD COLUMN ticket_pii_anonymized_at timestamptz` + index cho `pol02_clock` (cân nhắc index trên `(ends_at, cancelled_at, business_status) WHERE ticket_pii_anonymized_at IS NULL`, đo plan thật). Hàm `list_due_ticket_pii_anonymizations`, `apply_ticket_pii_anonymization` (SECURITY DEFINER, theo §4 Phương án A).
3. **Migration 3 — POL-03 schema:** `ALTER TABLE exports ADD COLUMN purged_at timestamptz`. Hàm `claim_expired_retention_objects` (SECURITY DEFINER, join `events` lấy `ends_at`).
4. **Code — worker:** job class mới `process_ticket_pii_anonymizations` + `process_export_object_purge` vào `WORKER_JOB_CLASSES`, lane step trong `maintenance()`, `STEP_BUDGET_MS`/`OLDEST_DUE_BUDGET_SECONDS` riêng cho 2 job, nhánh UNION mới trong `worker_due_job_snapshot()`.
5. **Code — monitoring:** `count_overdue_ticket_pii_anonymizations()` theo mẫu `count_overdue_account_deletion_requests()`.
6. **Test — viết trước khi hoặc cùng lúc với bước 2–4** (test matrix §7 là acceptance): boundary (bao gồm case `cancelled_at` ưu tiên đúng), idempotent, cross-tenant proof (mở rộng `account-idp-erasure.test.cjs`), RLS catalog (`rls-catalog.test.cjs` — không cần sửa `DEFINER_OWNER_TABLES` vì dùng Phương án A trên bảng đã khai báo), object purge (404-as-success, event NULL-clock bị loại).
7. **Vận hành:** cập nhật RUNBOOK/RELEASE-CHECKLIST thêm bước re-sweep sau PITR restore (§6 — ghi nhận cho reviewer-dod/ops, không viết ở Task Architect này).

### Việc còn lại không phải chính sách (kỹ thuật, implementer tự xử lý khi code)

- Đo `statement_timeout`/step budget thật cho `apply_ticket_pii_anonymization` trên event cỡ lớn (50k attendee, §4 trade-off) trước khi set budget cứng; không giả định vô hạn.
- Xác nhận plan index cho filter theo `pol02_clock` có cần index riêng/generated column hay quét seq trên `events` due là đủ rẻ ở quy mô hiện tại — đo trên dữ liệu thật.
- **Sequencing migration:** Task song song [TICKET-REISSUE-HANDOFF.md](./TICKET-REISSUE-HANDOFF.md) cũng đề xuất migration cùng ngày (`202610290001_ticket_credentials_reissue`) — coordinator phải xác nhận thứ tự số thật giữa 2 bộ migration (O06 POL-02/POL-03 vs reissue) tại thời điểm implement, tránh trùng slot.
- Giá trị cảnh báo vận hành cụ thể (ngưỡng "quá X ngày" cho event thiếu `ends_at`, `OLDEST_DUE_BUDGET_SECONDS` cho 2 job mới) — chưa có số, implementer/ops đề xuất dựa trên SLA vận hành hiện có, không phải quyết định kiến trúc.
- Bước re-sweep sau PITR restore (§6) — thuộc runbook ops, chưa viết, cần Task riêng trước pilot thật.

Không còn câu hỏi chính sách nào chặn migration/code — các việc còn lại ở trên là lựa chọn kỹ thuật/vận hành trong lúc implement, không cần coordinator/product chốt thêm.
