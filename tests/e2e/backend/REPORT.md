# Backend E2E regression — kết quả tại baseline `022cb80fd159dad2a7ebd0eeeea07fd64391f90a`

## DB-15 / DB-16 (Issue #1030)

Đã bổ sung test PostgreSQL cô lập cho DB-15: đối soát confirm, reject, undo và audit history; `USED` đơn lẻ không làm tăng check-in; retry SMTP lỗi qua relay thật đi từ chưa terminal tới DEAD; cancel event giữ các số report. Test DB-16 kiểm Owner/Manager, event chưa assignment, tenant khác, cursor, clamp limit, watermark và transaction RLS. Hai selector D cũ cùng selector mới đã PASS trong lượt phát triển; cần chạy lại trên SHA sạch cuối và review độc lập.

H Keycloak/API thật đã PASS diagnostic run `mvxkyku6-2a175b` (worktree chưa commit, không phải evidence exact SHA): DB-15 issue/confirm/reject/undo/cancel và DB history; DB-16 assignment, phân trang, giới hạn, watermark, tenant khác và digest snapshot dưới role `ticket_runtime`. H thiết lập trực tiếp notification UNKNOWN/DEAD để kiểm report; retry tới DEAD thực chạy ở D. Review O12 trước đây tại `docs/reviews/D11-EVENTREPORT-O12-DOD.md` giải nghĩa KPI là confirm chưa undo; câu chữ O12 “operation APPLIED” có thể đọc thành lũy kế và cần làm rõ riêng, không đổi runtime trong task này. Kết quả chạy sạch và SHA sẽ được báo trên PR; James cần review độc lập.

## Cập nhật sau sửa product

`pnpm test:integration:local --suite D` đã chạy lại trên PostgreSQL cô lập: **38/38 selector PASS**, exit 0. Riêng POL-01 xác nhận metric `account_deletion_idp_sla_overdue` đếm 1 theo fixture quá 30 ngày. Sửa ở `packages/backend/src/account-deletion.ts` và migration `202610280003_account_deletion_sla_metric`; migration phải áp dụng trước runtime. Kết quả baseline 37/38 bên dưới là lịch sử trước sửa, không phải trạng thái hiện tại. Full 46 ID acceptance vẫn chưa được chứng minh vì các nhánh H/R và gap nêu cuối báo cáo.

## Phạm vi và cách đọc

Đã map đủ 46 ID được giao (DB-01–19, GATE-01–09, JOB-01–08, SEC-01–06, POL-01–04) trong `coverage.json`: 45 `blocked`, 1 `out`, với 82 mapping tới 51 selector duy nhất (38 D, 13 U). `tests` trỏ đến **tên assertion thực** của test hiện có hoặc `retention-db.test.cjs`; `layers` là lớp đã được test đó chứng minh. `U` là unit/`app.inject` với dependency fixture hoặc JWT local, không tính là H theo PLAN vì không có Keycloak thật. D chạy PostgreSQL Docker với runtime role. Không có R vì chưa chạy worker process + Mailpit của harness. `blocked` có nghĩa ca chưa đủ toàn bộ điều kiện của PLAN, dù selector con đã PASS; `out` chỉ dùng cho JOB-08 vì callback transport/handler không tồn tại hiện tại.

Runner: `node tests/e2e/backend/entry.mjs --list [--case ID] [--suite D|H|R|U]`; thực thi bằng cách bỏ `--list`, thêm `--no-build` nếu các package đã build current checkout. Mỗi selector chạy tên test đã map, không tính PASS từ filename hoặc source-text assertion. `--suite H`/`R` hiện trả lỗi thiếu selector thay vì báo PASS rỗng. Docker daemon và image `postgres:18.1-alpine` cần sẵn để chạy D; test tự tạo/xóa container riêng qua `finally`.

## Checks đã chạy

| Check                                                         | Kết quả                 | Bằng chứng                                                                                                                                      |
| ------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `git rev-parse HEAD`                                          | PASS                    | SHA baseline đúng như trên.                                                                                                                     |
| `docker info --format '{{.ServerVersion}}'`, `pnpm --version` | PASS                    | Docker 29.8.2, pnpm 10.32.1.                                                                                                                    |
| `pnpm --filter @ticket/backend test:architecture-quota`       | PASS                    | Suite nền quota/approval/issue chạy 19.1 giây, exit 0.                                                                                          |
| `node --check` bốn file `.mjs/.cjs` mới                       | PASS                    | Không lỗi cú pháp.                                                                                                                              |
| `entry.mjs --case DB-03 --suite D --no-build`                 | PASS                    | 2 test PG: last-seat/idempotency/operation/outbox và mixed AUTO/MANUAL 5 event, 20 calls/event.                                                 |
| `entry.mjs --case GATE-09 --no-build`                         | PASS cho selector con   | 2 test PG receipt authz/state/read-only/corrupt join và 1 `app.inject` 422; thiếu H Keycloak/ownership/rate.                                    |
| `entry.mjs --case JOB-06 --suite D --no-build`                | PASS                    | PG lock cancellation, bounded shutdown/reclaim, 20k ticket synthetic trong suite nền; không là R process crash.                                 |
| `entry.mjs --case SEC-04 --no-build`                          | PASS cho 3 selector con | 1 API+PG local verifier resolve RLS, 2 `app.inject` Retry-After import-list/tenant-limits; không là H Keycloak. Log `sec04-run.log`.            |
| `entry.mjs --case DB-01 --suite D --no-build`                 | PASS                    | 3 PG tests: FORCE RLS/runtime no BYPASS, no tenant context/pool reuse, owner aggregate isolation.                                               |
| `entry.mjs --case GATE-01 --suite D --no-build`               | PASS                    | O31 gate list/create/open, FK cross-event, RLS, backward compatibility.                                                                         |
| `entry.mjs --case POL-01 --suite D --no-build`                | FAIL ở test mới         | 3 test PG erasure cũ PASS; test mới xác nhận PG scrub, retry IdP, terminal state/tombstone rồi fail duy nhất ở `slaOverdue` 0 vs admin count 1. |
| `entry.mjs --suite D --no-build`                              | **37 PASS / 1 FAIL**    | Toàn bộ 38 selector D được chọn đã chạy; failure duy nhất là `[POL-01]` ở metric trên. Log chi tiết: `domain-run.log`.                          |
| `entry.mjs --suite U --no-build`                              | **14 PASS**             | 13 selector U; pattern validation offline sync chọn 2 test. Log chi tiết: `unit-run.log`.                                                       |

## Finding: metric quá hạn account deletion bị RLS che

Repro nhỏ nằm trong `retention-db.test.cjs`: hai request synthetic được đặt `requested_at` cách hiện tại 29 và 31 ngày trên PostgreSQL cô lập. Lượt đầu thiếu provider: cả hai PG scrub, trạng thái vẫn `REQUESTED`; query admin trên bảng thấy chính xác 1 request quá 30 ngày. Lượt sau IdP adapter trả `DELETED`: cả hai chuyển `COMPLETED`, `original_issuer/subject` bị xóa, digest tối thiểu còn; lượt retry tiếp theo không gọi IdP lại. Các assertion dữ liệu này đều vượt qua trước assertion cuối: `processDueAccountAnonymizations(...).slaOverdue` trả 0 dù admin count là 1.

Căn cứ trực tiếp: `packages/backend/src/account-deletion.ts` dòng 428–434 đếm `account_deletion_requests` qua `db.$queryRaw` không `withActor`; migration `202610170012_d4_platform_m01` dòng 240–242 áp RLS bảng này theo `app.actor_id`, trong khi runtime role không có actor context ở worker. Đây là **gap observability** cho metric cảnh báo, không phải bằng chứng request đã vượt deadline thực tế: trong repro, PG và IdP hoàn tất sau retry giả lập. Không đổi expected outcome hoặc sửa product trong dispatch test.

## Cập nhật DB-11 (SHA `fbbe33d9f7e8c1df6c812ab51f31594f99641114`, worktree `f04-db11-invite`)

`entry.mjs --case DB-11 --suite D --no-build` PASS 2/2 selector trên PostgreSQL cô lập mới tạo/xóa đúng trước-sau run (container `ticket-db11-invite-*`, nhãn `ticket.task=task_ba3f850ed0ac`, tự dọn qua `finally`): `import-invitations.test.cjs` (H-I1/H-I2/H-I3, không đổi) và test mới `db11-invite-ttl-claim.test.cjs`. Test mới chứng minh trên service PostgreSQL thật: staff invite TTL đúng `security.inviteTtlSeconds` (48h); hết hạn thật (backdate `expires_at` trong transaction tenant-scoped) bị `INVITE_INVALID_OR_EXPIRED`, không tạo `memberships`; email verified không khớp bị chặn cùng mã, không mutation; một lần dùng — actor thứ hai cùng email dùng lại token đã accept bị `INVITE_ALREADY_USED`, chỉ actor đầu có membership. Attendee claim: token staff/attendee không thể dùng lẫn (cross-use bị `INVITATION_TOKEN_INVALID`/`INVITE_INVALID_OR_EXPIRED`, không đổi quota, claim không tạo membership); invitation expired/revoked bị `INVITATION_EXPIRED`/`INVITATION_REVOKED`, không mint `redemption_codes`, quota không đổi; wrong-owner — actor khác (issuer+subject khác, cùng email, đúng DB-02) replay invitation đã `CLAIMED` bằng Idempotency-Key mới bị `INVITATION_TOKEN_INVALID`, đúng một `tickets` row cho invitation và `owner_user_id` giữ nguyên actor đã claim thật.

**Finding nhỏ (không sửa runtime):** `claimGuestInvitation` lazy-expire `UPDATE guest_invitations SET state='EXPIRED'` chạy trong cùng `withTenant` transaction với throw `INVITATION_EXPIRED`, nên bị rollback cùng lúc — row ở lại `DISPATCHED` tới khi `listGuestInvitations` quét cơ hội mới chuyển `EXPIRED`. AC "expired không tạo vé" vẫn đúng (không mint code/ticket); chỉ là state hiển thị trễ. Đề xuất coordinator xem xét tách UPDATE khỏi transaction chính nếu cần state tức thời.

H Keycloak/HTTP cho DB-11 **BLOCKED**: `tests/e2e/http/live.test.mjs` + `tests/e2e/harness/seed.mjs` + `FIXTURES.md` cần case mới (staff invite accept endpoint + attendee claim endpoint qua HTTPS/Keycloak issuer thật, fixture PENDING/EXPIRED/REVOKED/CLAIMED). Đây là harness dùng chung cho mọi ID H khác; đề xuất Dispatch riêng (role backend + coordinator) để thêm case an toàn, không rủi ro case H đang PASS khác (DB-02/DB-09/DB-10).

## Cập nhật DB-11 H (Dispatch riêng, PR #1061/worktree `f04-db11-invite`)

Thêm case `[DB-11] live HTTP` vào `tests/e2e/http/live.test.mjs` (đăng ký ở `CASE_IDS` cùng file, và ở `tests/e2e/http/entry.mjs`/`tests/e2e/harness/run.mjs` — hai danh sách case trùng lặp khác cần sửa riêng), cộng fixture generic cho DB-11 trong `tests/e2e/harness/seed.mjs` (`controlDatabaseUrl`, `formVersion`/`termsVersion`). Không dùng account/harness mới — chỉ tái dùng `owner`/`attendee`/`otherAttendee` sẵn có của mọi case để tránh rủi ro cho DB-09/DB-10.

`pnpm test:e2e:http -- --case=DB-11` **PASS** qua endpoint thật + Keycloak password grant thật cho owner/attendee/otherAttendee:
- Staff invite (`POST /tenants/:id/invites`, `POST /me/membership-invites/accept`): TTL đúng 48h (`security.inviteTtlSeconds`); accept thành công tạo đúng 1 membership; replay cùng actor/cùng token idempotent không tạo membership thứ hai; backdate `expires_at` qua control DB → `INVITE_INVALID_OR_EXPIRED` (422), không membership; token đúng nhưng actor verified khác email → cùng mã, không đổi membership hiện có.
- Attendee claim (import GUESTS thật qua `/imports/files` → job → preview → commit, rồi `dispatch-preview`/`dispatch`, rồi `POST invitations/claim`): happy-path mint đúng 1 ticket và +1 `quota_buckets.allocated`; replay cùng Idempotency-Key idempotent (cùng `ticketId`, không mint thêm); replay Idempotency-Key mới trên invitation đã `CLAIMED` → `INVITATION_TOKEN_INVALID` (410), không ticket thứ hai; backdate `expires_at` qua control DB → `INVITATION_EXPIRED` (410), không ticket/quota mutation; actor khác (otherAttendee, email khác) claim invitation của attendee → `INVITATION_EMAIL_MISMATCH` (403), không ticket.
- Cross-use cả hai chiều: token staff invite gọi `invitations/claim` → `INVITATION_TOKEN_INVALID` (410); token guest invitation gọi `me/membership-invites/accept` → `INVITE_INVALID_OR_EXPIRED` (422); không bên nào đổi membership/ticket/quota.

Regression H lân cận sau khi sửa harness dùng chung (`seed.mjs`/`run.mjs`/`entry.mjs`): `pnpm test:e2e:http -- --case=DB-09,DB-10` **PASS** cả hai, không bị ảnh hưởng bởi thay đổi.

Evidence trên checkout sạch đúng SHA (sau commit): SHA `730c78fea5745947bcf0d5a209acee5cb3869b14`, `pnpm test:e2e:http -- --case=DB-11` run `mvuob2lw-a7465e`, `sourceProvenance.evidenceExactShaEligible=true`, `workingTreeDirty=false`; không còn container Docker nào sau run.

**Finding khi viết test (đã sửa trong test, không sửa runtime):** `invited_email` ở `guest_invitations` được backend canonicalize (trim + lowercase) tại commit; test ban đầu dùng case gốc của account `otherAttendee` (camelCase) để tra lại invitation id nên không khớp — đã sửa test tự lowercase trước khi tra. Không phải bug runtime.

Giới hạn: không tạo thêm Keycloak account mới để test "một lần dùng" theo đúng nghĩa hai actor khác nhau *cùng một email thật* (D-layer đã chứng minh trực tiếp qua actorUserId khác nhau trong DB); ở H, "một lần dùng" được chứng minh tương đương qua idempotency-key mới trên invitation đã CLAIMED (cùng actor) — đủ để phủ accept-path thực tế qua HTTP mà không thêm fixture/account chung mới có thể ảnh hưởng case khác.

## Cập nhật DB-12 (PR liên kết #1030, worktree `f04-db12-published`)

D (`config-publish.test.cjs`, `published-events.test.cjs`) đã đủ từ trước: publish versioned/immutable, optimistic concurrency trên save (`expectedVersion`) và rollback (`expectedPublishedVersion`/`expectedRevision`, `REVISION_CONFLICT`/`CONFIG_VERSION_MISMATCH`), preview trả `cacheControl: 'no-store'` ở data layer, quota/codes không đổi qua rollback, draft/unpublished/UNLISTED/tenant SUSPENDED fail-closed. Phần thiếu theo `coverage.json` trước Dispatch này chỉ là H.

Thêm case `[DB-12] live HTTP` vào `tests/e2e/http/live.test.mjs` (đăng ký ở `CASE_IDS` cùng file, và ở `tests/e2e/http/entry.mjs`/`tests/e2e/harness/run.mjs`), cộng fixture generic cho DB-12 trong `tests/e2e/harness/seed.mjs` (chỉ thêm event `draft-only` chưa publish cùng tenant; event chính tái dùng config v1 generic đã save+publish sẵn cho mọi case, không seed thêm history trùng). `pnpm test:e2e:http -- --case=DB-12` **PASS** qua endpoint thật + Keycloak bearer thật cho `owner`:

- Baseline: public detail (`GET /public/tenants/:slug/events/:slug`, không token) trả đúng version 1 đã seed; draft-only (saved, chưa publish) 404 ở detail và không xuất hiện ở public list.
- Save v2 qua `POST config-versions` (`expectedVersion=1` → version 2) rồi `POST publish` (`expectedVersion=2`) → public detail cập nhật `publishedConfigVersion=2` và nội dung v2.
- Rollback với `expectedPublishedVersion`/`expectedRevision` cũ (1/1, thực tế đang là 2/3) → 409, public projection và `quota_buckets`/`redemption_codes` không đổi so với baseline.
- Rollback đúng token (`expectedPublishedVersion=2`, `expectedRevision=3`, `targetVersion=1`) → 201, tạo version mới (3) từ target, public detail phản ánh version 3 với nội dung v1 gốc (không replay v2); `audit_logs` có cả `event.publish` và `event.config.rollback`; business state (quota/codes) không đổi qua cả hai nhánh.
- Preview (`GET config-versions/1/preview`) không token → 401; có token owner → 200.
- Publish `draft-only` ở cuối ca rồi xác nhận public list chỉ gồm đúng 2 slug mong đợi (event chính + draft-only), không rò event nào khác.

Regression harness dùng chung: `pnpm test:e2e:http -- --case=DB-09` và `--case=DB-10,DB-11` **PASS** cả ba, không bị ảnh hưởng bởi thay đổi `seed.mjs`/`run.mjs`/`entry.mjs`/`CASE_IDS`.

Evidence trên checkout sạch đúng SHA (sau commit `b6ff8a9ee504182e590cf37cf85788fb9d16a143`): `pnpm test:e2e:http -- --case=DB-12` run `mvupjy77-513ff2`, `sourceProvenance.evidenceExactShaEligible=true`, `workingTreeDirty=false`.

**BLOCKED thật, không phải thiếu test — đã báo coordinator trước khi mở nhánh:** `docs/TECHNICAL-DESIGN.md` §379 ("Critical responses `Cache-Control: no-store`") và §405 ("Public content cache key chứa canonical host + tenant + event + published config version + locale") chưa có ở runtime. Bằng chứng: `apps/api/src/published-events.ts` (public catalog/detail controller) không có decorator `Cache-Control` nào, khác các controller khác cùng repo (`inventory.ts`, `gate.ts`, `reporting.ts`, `tickets.ts`, `tenant-limits.ts` đều dùng `@Header('Cache-Control', 'private, no-store')`); `apps/api/src/config.ts` dòng ~374 route preview đọc header `cache-control` của client vào biến `_cacheControl` không dùng, không set response header tương ứng. Không có field `locale` ở bất kỳ đâu trong `packages/contracts`. `infra/admission/Caddyfile` không có cache directive cho `/public/*`. Coordinator xác nhận (msg_69030d65a81d, trả lời escalation msg_63b8cae5c655) giữ nguyên trạng BLOCKED và không mở sửa runtime/contract trong Dispatch test-only này; quyết định runtime để ở review sản phẩm riêng. `coverage.json` DB-12 giữ `status: "blocked"` phản ánh đúng việc này — không thêm failing acceptance selector vào CI cho phần cache/locale/no-store.

## Cập nhật DB-14 (PR liên kết #1030, worktree `f04-db14-form-entitlement`)

Thêm `packages/backend/test/db14-form-entitlement.test.cjs` (PostgreSQL cô lập): consent `form_version`/`terms_version` + hash trên `redemption_requests`, từ chối config có markup/script/unknown body keys/field type ngoài allowlist, `entitlement_snapshot` trên `tickets` không đổi sau publish/rebrand và sau khi `ticket_types.entitlement_snapshot` bị sửa; redeem stale `terms-v1` sau publish `terms-v2` trả `TERMS_VERSION_STALE` (idempotency envelope `ok:false`).

Thêm case `[DB-14] live HTTP` (`live.test.mjs`, `entry.mjs`, `run.mjs`, `seed.mjs` entitlement seed + `controlDatabaseUrl`): Keycloak bearer thật — redeem lưu entitlement v1, HTTP `config-versions` từ chối `<style>` và unknown body keys, publish v2 đổi public brand/terms, vé cũ giữ entitlement + consent v1, `TERMS_VERSION_STALE` trên redeem stale, redeem v2 thành công.

Checks (SHA sau commit): `node tests/e2e/backend/entry.mjs --case DB-14 --suite D --no-build` PASS; `pnpm test:e2e:http -- --case=DB-14` run `mvuqsqyn-c0f918` PASS. `coverage.json` DB-14 → `pass`, layers D+H. Không đổi runtime/contract.

**F01 fix (DoD revalidation):** D/H assert `form_definition_hash` và `terms_content_hash` trên `redemption_requests` khớp hash suy ra từ form/terms published (seed/save payload), khác v1↔v2; vé/request v1 giữ hash v1 sau publish v2. Evidence SHA sạch `0dc5e1f50147a54466e258ac972f47709c02f4f5`: D `entry.mjs --case DB-14 --suite D --no-build` PASS; H `pnpm test:e2e:http -- --case=DB-14` run `mvurdu1z-873d1d` PASS, `workingTreeDirty=false`.

## Cập nhật JOB-01 (Issue #1032, worktree `f04-job01-durable-outbox`)

Thêm `tests/e2e/backend/job-01-durable-outbox.test.cjs` (R) và `redis-fixture.cjs`: cấp vé khi worker tắt → vé ACTIVE, outbox/notification PENDING; restart Redis cô lập không COMPLETE/ACCEPTED sớm và Mailpit trống; worker process thật + Mailpit một email đúng recipient/tenant slug. D giữ `issue.test.cjs` + `outbox-fence.test.cjs`. `coverage.json` JOB-01 → `implemented`, layers D+R.

Checks: `node tests/e2e/backend/entry.mjs --case JOB-01 --no-build` PASS 3/3 selector; artifact `tests/e2e/.artifacts/mvuj01-579677a/summary.json`. Không assert exactly-once SMTP/inbox/read.

## Cập nhật JOB-02 (Issue #1032, worktree `f04-job02-lease-fence`)

Thêm `tests/e2e/backend/job-02-lease-fence.test.cjs` (R): cấp vé khi worker tắt → outbox PENDING; worker A claim với SMTP treo, SIGKILL sau claim; lease PG hết hạn tự nhiên (~30s); snapshot due/reclaim; worker B + Mailpit relay một logical email; `processClaimedOutbox` với lease token worker A chết không gọi provider và không COMPLETE lại. D giữ `outbox-fence.test.cjs#MembershipInvite`. `coverage.json` JOB-02 → `implemented`, layers D+R.

Checks: `node tests/e2e/backend/entry.mjs --case JOB-02` PASS 2/2 selector (D+R, ~54s build+run). Không assert exactly-once SMTP delivery.

## Cập nhật JOB-03 (Issue #1032, worktree `f04-job03-smtp-failures`)

Thêm `tests/e2e/backend/job-03-smtp-failures.test.cjs` (R), `tests/e2e/backend/smtp-fixture.cjs`, `packages/backend/test/fixtures/exit-after-smtp.cjs`. D giữ `issue.test.cjs` (relay fail + retry) và U `worker-provider-deadline.test.cjs`. R: worker process + SMTP reject/stall/Mailpit; crash-after-accept qua relay subprocess + SMTP thật (Mailpit), reclaim worker main.js. `coverage.json` JOB-03 → `implemented`, layers D+U+R. Không assert exactly-once SMTP.

Checks (SHA `d54f3e3d8ce2d4f177fb8f6d2957e89b09516f19`): `node tests/e2e/backend/entry.mjs --case JOB-03` PASS 4/4 selector (1 D, 1 U, 2 R). Crash window: `exit-after-smtp.cjs` + real `createSmtpEmailAdapter`/Mailpit, not SIGKILL of worker mid-accept; recovery via `apps/worker/dist/main.js`.

## Giới hạn còn mở

### JOB-03 revalidation F01 (code SHA `ffb997d2be34b436c62eec7d1a06b3330c6ee35e`)

`markOutboxDeadFenced` xóa `outbox.next_attempt_at` khi chuyển DEAD, giữ nguyên điều kiện lease fence. R cap test đọc cả `outbox.next_attempt_at` và `notifications.next_attempt_at`: NULL tại DEAD và sau quiet window 2,5 giây; worker process còn sống, đúng 3 attempts/provider calls, vé ACTIVE. Trên checkout sạch code SHA này: `node tests/e2e/backend/entry.mjs --case JOB-03 --suite D` PASS 1/1; `node tests/e2e/backend/entry.mjs --case JOB-03 --suite R --no-build` PASS 3/3; `pnpm --filter @ticket/backend test:worker-budget-db` PASS. `pnpm --filter @ticket/backend test:architecture-recovery` bị giới hạn output/time 120 giây của lean-ctx, exit 137 sau nhiều test pass; không ghi là PASS. F02 giữ giới hạn relay subprocess sau SMTP accept trước PG ack, chưa chứng minh SIGKILL main worker.

- Các ca H cần HTTPS hostname run, Keycloak issuer/JWT thật và manifest case riêng từ harness; local verifier hay `app.inject` fixture không đủ. Các ca R cần worker process, Mailpit, restart/kill/lease và tài nguyên run riêng. Xem `FIXTURES.md`.
- POL-02 có test D lọc audit quá 730 ngày khi đọc, nhưng chưa thấy sweeper anonymize ticket/check-in 365 ngày hoặc xóa audit quá 730 ngày trong worker hiện hành; POL-03 thiếu object cleanup 90 ngày theo O06. Đây là gap feature/test, không đánh PASS bằng hằng số retention.
- JOB-08 là OUT theo PLAN: không có provider callback handler/transport hiện hành để kiểm chữ ký/raw body/order.
- Không có kết luận full 46 ID PASS; `coverage.json` giữ blocked khi còn nhánh chưa được chứng minh.
