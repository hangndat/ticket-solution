# DoD review — Issue #12 (Membership deny-by-default + thu hồi)

| Trường | Giá trị |
| --- | --- |
| Issue | [#12](https://github.com/hangndat/ticket-solution/issues/12) |
| Reviewer | Cursor DoD reviewer (không phải agent implement) |
| Commit | `346bf9e` — `feat(backend): D1 membership deny-by-default and revoke locks` |
| Base | `main` (ancestor; tip local lúc review `05c5e5a`) |
| Ngày | 2026-10-16 |
| **Khuyến nghị Project Status** | **PASS** → có thể đặt **Hoàn thành** cho DoD Issue #12 |

## Tóm tắt điều hành

Commit `346bf9e` trên `main` giao đủ lớp authz membership/event assignment: deny-by-default (`AuthzError`), RLS FORCE trên `memberships` / `event_assignments`, revoke dùng `FOR UPDATE` xung đột với `FOR SHARE` trên privileged check (TD §5.2), và test DB chứng minh request sau revoke bị từ chối (`MEMBERSHIP_REVOKED`). Không có stub auth cho phép silent. **Finding không chặn Hoàn thành:** `lockActiveMembershipForShare` chưa áp `activated_at <= now` dù helper `isMembershipActive` đã deny future activate.

## Checklist DoD

| # | Tiêu chí | Kết quả | Ghi chú ngắn |
| --- | --- | --- | --- |
| 1 | Deny-by-default khi thiếu membership / quyền | **PASS** | Không row / chưa activate / thiếu permission → `AuthzError`; không đường “allow by default” |
| 2 | Revoke có hiệu lực request tiếp theo | **PASS** | Sau `revokeMembership` commit → `MEMBERSHIP_REVOKED`; hold `FOR SHARE` làm revoke `lock_timeout` |
| 3 | RLS tenant isolation (ENABLE+FORCE) | **PASS** | Policy `app.tenant_id`; cross-tenant count/update/insert bị chặn; `rls.test.cjs` assert 5 bảng FORCE |
| 4 | Không stub auth production | **PASS** | Chỉ `AuthzError` fail-closed; grant helpers ghi rõ test/admin; runtime `NOBYPASSRLS` |
| 5 | Khớp TD §5.2 (shared lock / revoke conflict) | **PASS** | Comment + SQL `FOR SHARE` / `FOR UPDATE`; test concurrent lock |
| 6 | Evidence test unit + DB | **PASS** | `membership-unit` trong `test`; `membership` + `rls` trong `test:db` (worker evidence + review source) |
| 7 | Khuyến nghị Hoàn thành | **PASS** | Đủ tiêu chí Issue #12; wire Nest HTTP map `AuthzError` là việc follow-up khi mở route nghiệp vụ |

## Chi tiết theo tiêu chí

### 1. Deny-by-default

- `requireTenantPermission` luôn khóa membership active trước khi xét permission; thiếu row / `activated_at IS NULL` → `MEMBERSHIP_REQUIRED`; thiếu permission → `PERMISSION_DENIED`; có `eventId` thì bắt buộc assignment active + permission trên assignment.
- `isMembershipActive`: null activate, future activate, revoked → `false` (unit test).
- Default `permissions: []` trên schema/migration — không implicit grant theo role name.

### 2. Revoke semantics (request tiếp theo)

- `revokeMembership` / `revokeEventAssignment`: `FOR UPDATE` rồi set `revoked_at`; idempotent nếu đã revoke.
- `lockActiveMembershipForShare`: `FOR SHARE` rồi reject nếu `revoked_at !== null` → `MEMBERSHIP_REVOKED`.
- Test DB: privileged request OK trước revoke; concurrent revoke trong lúc hold → `lock_timeout`; sau revoke commit → mọi `requireTenantPermission` (tenant + event path) fail `MEMBERSHIP_REVOKED`.
- Khớp TD §5.2: thao tác đã commit trước revoke vẫn hợp lệ; request mới sau revoke bị từ chối.

### 3. RLS

- Migration `202610160003_d1_membership`: `ENABLE` + `FORCE ROW LEVEL SECURITY`; `REVOKE ALL … FROM PUBLIC`; grant runtime giới hạn; policy isolation theo `current_setting('app.tenant_id')`.
- Test: `db.membership.count()` ngoài tenant = 0; tenant B không thấy/không update membership A; cross-tenant insert dưới context A bị reject.
- `rls.test.cjs` mở rộng assert FORCE RLS cho `memberships` và `event_assignments`; owner `migration_owner`; role không `rolbypassrls`.

### 4. Không stub auth

- Không mock identity / “always allow” trong `packages/backend/src`.
- `AuthzError.retryable` mặc định `false`.
- `grantMembership` / `grantEventAssignment` là helper test/admin có comment — không phải bypass production path.
- Chưa wire Nest controller nghiệp vụ gọi `requireTenantPermission` trong commit này (đúng phạm vi D1 proof library); không tạo endpoint stub 200.

### 5. Gaps / findings (không FAIL DoD #12)

| ID | Severity | Mô tả | Khuyến nghị |
| --- | --- | --- | --- |
| F1 | **Medium** | `lockActiveMembershipForShare` chỉ check `activated_at !== null`, không so với “now”; `isMembershipActive` thì deny future activate — lệch nếu dùng scheduled activation | Dùng chung predicate active (hoặc `activated_at <= now()`) trong lock path trước khi phụ thuộc future activate |
| F2 | Low | Revoke assignment inactive map về `EVENT_ASSIGNMENT_REQUIRED` (không có code `…_REVOKED` riêng) | OK nếu contract chấp nhận; thêm code riêng nếu client cần phân biệt |
| F3 | Low / scope | Chưa có HTTP exception filter map `AuthzError` → 403 trong `apps/api` | Làm khi mở tenant/staff routes; giữ fail-closed |
| F4 | Nit | Test DB không cover riêng `revokeEventAssignment` sau commit | Bổ sung khi event-scoped revoke là P0 path |

Không có finding **Critical** về stub auth, thiếu FORCE RLS, hoặc revoke không chặn request tiếp theo.

## Bằng chứng đã xem

- Commit: `346bf9e971cec9a4b7960a8449ee165b7da58716` trên `main`.
- Nguồn: `membership.ts`, `authz-error.ts`, `index.ts` exports, migration SQL, `schema.prisma`, `membership.test.cjs`, `membership-unit.test.cjs`, diff `rls.test.cjs` / `package.json`.
- Tài liệu: Issue #12 body + comment Chờ duyệt; TD §5.2; DECISION-LOG điều kiện membership + revoke có test.
- Reviewer **không** sửa code sản phẩm; **không** chạy lại Docker `test:db` trong phiên này (dựa source + worker evidence PASS). Unit test cần `pnpm build` (`dist/`) — script `test` đã `pnpm build && …`.

## Khuyến nghị cuối

**PASS** cho Definition of Done Issue #12:

- Đủ để Project Status → **Hoàn thành** và đóng Issue nếu board chỉ yêu cầu proof membership/RLS/revoke như mô tả.
- Giữ F1 trong backlog trước khi dùng `activated_at` tương lai cho lịch kích hoạt.
- Không mở business endpoints chỉ vì #12 xanh — vẫn cần identity (#11) + gọi `requireTenantPermission` trên từng route theo TD.
