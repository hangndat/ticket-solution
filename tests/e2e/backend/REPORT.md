# Backend E2E regression — kết quả tại baseline `022cb80fd159dad2a7ebd0eeeea07fd64391f90a`

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

## Giới hạn còn mở

- Các ca H cần HTTPS hostname run, Keycloak issuer/JWT thật và manifest case riêng từ harness; local verifier hay `app.inject` fixture không đủ. Các ca R cần worker process, Mailpit, restart/kill/lease và tài nguyên run riêng. Xem `FIXTURES.md`.
- POL-02 có test D lọc audit quá 730 ngày khi đọc, nhưng chưa thấy sweeper anonymize ticket/check-in 365 ngày hoặc xóa audit quá 730 ngày trong worker hiện hành; POL-03 thiếu object cleanup 90 ngày theo O06. Đây là gap feature/test, không đánh PASS bằng hằng số retention.
- JOB-08 là OUT theo PLAN: không có provider callback handler/transport hiện hành để kiểm chữ ký/raw body/order.
- Không có kết luận full 46 ID PASS; `coverage.json` giữ blocked khi còn nhánh chưa được chứng minh.
