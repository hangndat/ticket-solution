# Backend E2E fixtures

## D và U chạy độc lập

`entry.mjs --case <ID> --suite D` chọn assertion DB từ các suite hiện có. Các test này tự chạy `postgres:18.1-alpine` trên cổng loopback ngẫu nhiên, tạo database/role riêng, migrate bằng `migration_owner`, rồi gọi domain bằng login thuộc `ticket_runtime` không `BYPASSRLS`; container được xóa trong `finally`. Chúng dùng identity/email `example.test` tổng hợp, không dùng manifest hay database dev. `retention-db.test.cjs` dùng `pg-fixture.cjs` cùng cách cô lập, namespace container `ticket-e2e-backend-*`, và IdP adapter lỗi/thành công có kiểm soát chỉ cho lớp D.

`U` là unit hoặc `app.inject` không có JWT Keycloak thật. Không tính `U` thay cho H; `--suite H` hiện không có selector đủ contract. `--suite R` chạy worker process + Mailpit/Redis cô lập trong `tests/e2e/backend/*.test.cjs` (JOB-01, DB-09 reissue). `entry.mjs --list` cho biết test nào đang được chọn và lý do coverage còn blocked. `--no-build` chỉ dùng sau khi đã build current checkout của `@ticket/contracts`, `@ticket/backend` và package cần thiết.

## Manifest cần để mở H/R

Mỗi case H/R cần một `manifest.cases[caseId]` riêng theo `harness/contract.ts`, gồm `tenantId`, `tenantSlug`, `eventId`, `eventSlug`, và `accounts` gắn actor thích hợp; không chia sẻ mutation giữa case. Các mục dưới đây là `data` hoặc field optional cần bổ sung khi harness provision:

| Nhóm                     | Fixture tối thiểu cần provision                                                                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-01–04, SEC-01–02      | Tenant A/B, owner/otherAttendee, staff active/revoked/unassigned, hai identity cùng email khác issuer+subject; code và quota độc lập cho từng case. DB-01–03 nay có manifest H thật trong `tests/e2e/harness/seed.mjs` + `tests/e2e/http/live.test.mjs` (xem `tests/e2e/http/FIXTURES.md`); DB-04 và issuer+subject thứ hai của DB-02 (cần realm Keycloak thứ hai) vẫn chưa có manifest.                                                                                                            |
| DB-05–09                 | Type/source quota hữu hạn và `null`, mã AUTO/MANUAL, owner verified/unverified, operation key riêng, request pending và clock/TTL theo config.                                                                                                                 |
| DB-10–11, JOB-07, SEC-05 | CSV path riêng, import job/file ID, attendee invitation và staff invite riêng, object prefix/bucket của run; không dùng URL ký sẵn làm authz test API.                                                                                                         |
| DB-12–14, DB-16–17       | Draft/published projection version+locale, form/terms version, event có/không assignment, tenant PENDING/SUSPENDED, named role preset và limits.                                                                                                               |
| DB-15, GATE-01–09        | Gate ID đúng/sai event, session owned/other/revoked, ticket ACTIVE/REVOKED, reservation token, offline `clientEventId`/`clientSeq`/`occurredAt` biên ±300s, receipt state CURRENT/UNDONE/TICKET_REVOKED/NO_LONGER_CURRENT; dùng ticket riêng cho mỗi mutation. |
| DB-18–19, POL-01–04      | Request deletion, tombstone và key version synthetic, thời gian event/request/object trước/sau cutoff; object còn dùng ở tenant khác; không chờ thời gian thực.                                                                                                |
| JOB-01–06, JOB-08        | Worker process riêng của run, Mailpit mailbox riêng, SMTP failure adapter ở D hoặc proxy lỗi trong R, lease clock có thể điều khiển, Redis riêng; JOB-08 chỉ khi có callback transport/handler thực.                                                           |
| SEC-03–06                | HTTPS hostname run và Keycloak thật cho H; Origin/forwarded/redirect, rate bucket độc lập, CSV/rich text payload, API read/mutate/list/export URL và secret canary synthetic.                                                                                  |

Không seed trước hành vi cần chứng minh trong H; request phải đi qua API với Keycloak thật. Phần H/R phụ thuộc harness TLS, process isolation và seed của coordinator; chưa có manifest thực nên coverage ghi blocked, không skip/todo.
