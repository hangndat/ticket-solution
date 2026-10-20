# Backend deep verify — Issue #619 (H1/H2/H3/H5/H6)

| Trường | Giá trị |
| --- | --- |
| Reviewer | `reviewer-dod` · worker `task_74430e44ba61` |
| Issue | [#619](https://github.com/hangndat/ticket-solution/issues/619) |
| PR | Không (review trên `main`) |
| Commit SHA (exact) | `c76657c35bd876e425b247234e5fde57fa80e322` |
| Scope | `packages/backend/src/import-jobs.ts`, `outbox.ts`, `event-admin.ts`; tham chiếu `apps/api/src/events.ts` |
| Architecture impact | Không |
| Verdict | **FAIL** — 5/5 nghi vấn **Xác nhận** bằng đọc code + repro DB (H1/H5); H2/H3/H6 bằng đọc code + test liên quan |

## Lệnh đã chạy (SHA `c76657c…`)

| Lệnh | Kết quả |
| --- | --- |
| `git fetch origin main && git rev-parse origin/main` | `c76657c35bd876e425b247234e5fde57fa80e322` (khớp `HEAD`) |
| `pnpm install` + `pnpm --filter @ticket/contracts build` + `pnpm --filter @ticket/backend build` | Thành công (chuẩn bị test) |
| Repro H5: Docker Postgres 18.1, `tenant_limits.max_events=1`, `createEvent` lần 1 OK, replay cùng idempotency key | **`H5_RESULT replay_blocked_by_max_events`** (`PlatformError` `TENANT_LIMIT_REACHED`) |
| Repro H1 (mô hình PG): `BEGIN` → `INSERT` trùng PK (`23505`) → `INSERT` khác trong cùng tx | **`PG_UNIQUE_THEN_INSERT 23505 25P02`** |
| Repro H1 end-to-end `commitImportJob` với duplicate code | **Không hoàn tất** — setup import (`lockEvent`) timeout `57014` trong script tạm; không dùng làm bác bỏ H1 |
| `pnpm --filter @ticket/backend test:db` (full) | **Không chạy** (thời gian); đã đọc `test/import-invitations.test.cjs`, `test/event-lifecycle.test.cjs`, `test/cs-export.test.cjs`, `test/platform.test.cjs` |

## H1 — `commitImportJob` unique trong transaction, nhánh `skipped`

**Kết luận: Xác nhận**

**Bằng chứng code:** Vòng `for` bọc `INSERT` trong `try/catch`, tăng `skipped` khi message chứa constraint name, **không** `SAVEPOINT` / subtransaction.

```1122:1187:packages/backend/src/import-jobs.ts
        try {
          await tx.$executeRaw`
            INSERT INTO redemption_codes (
              ...
            )
          `;
          committed += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message.includes('redemption_codes_hmac_unique')) {
            skipped += 1;
            continue;
          }
          throw error;
        }
```

(Cùng pattern cho `guest_invitations_email_event_uq` tại 1151–1186.)

**Hành vi PostgreSQL:** Sau lỗi unique (`23505`), transaction ở trạng thái aborted; lệnh tiếp theo trong cùng tx → `25P02` (repro tối giản ở bảng lệnh trên).

**Test:** `test/import-invitations.test.cjs` assert `committedRowCount` / idempotency replay, **không** assert `skippedRowCount` hay duplicate trong một commit.

**Mức độ:** Cao — commit import có ≥1 duplicate (trong file hoặc với DB) có thể fail toàn job thay vì skip.

**Task fix đề xuất:** `SAVEPOINT` per row (hoặc `INSERT … ON CONFLICT DO NOTHING` + đếm), test DB `skippedRowCount` với CSV 3 dòng (1 mới, 1 trùng file, 1 trùng DB).

---

## H2 — Email/APNs trong `withTenant`, rollback → gửi trùng

**Kết luận: Xác nhận**

**Bằng chứng code:**

- `withTenant`: `statement_timeout` 5s, transaction timeout **10s** (`tenant-context.ts` 20–26).
- `TicketIssued`: một callback `withTenant` (281–691) giữ transaction mở trong khi gọi `email.sendTicketIssued` (500–513) và `apns.send` (624–630) **trước** `markOutboxCompleteFenced` (689).
- Lỗi sau gửi (push, timeout tx, v.v.) → `catch` (694–713) gọi `scheduleRetryFenced` → outbox có thể vẫn `PENDING`/`LEASED` trong khi provider đã nhận.

```498:513:packages/backend/src/outbox.ts
        // Send outside long DB work but still inside tenant tx for fencing after.
        const result = await email.sendTicketIssued({ ... });
```

`MembershipInvite` / `InvitationReady` gửi mail **ngoài** tx đầu (chỉ `PROCESSING` trong tx), giảm nhưng không loại H2 cho `TicketIssued`.

**Test:** `cs-export.test.cjs` cover APNs fail-closed / retry notification state, **không** assert “exactly-once” email khi tx rollback sau `sendTicketIssued`.

**Mức độ:** Cao (email/push trùng khi retry).

**Task fix đề xuất:** Tách pattern invite: commit trạng thái notification + outbox phase 1 trong tx ngắn; gọi provider sau commit; hoặc outbox “sent marker” idempotent trước provider. Test: mock provider + cố rollback sau send → không retry duplicate.

---

## H3 — Invite outbox: thiếu fence `lease_owner` / `lease_token`

**Kết luận: Xác nhận**

**Bằng chứng code:** `MembershipInvite` (và bước `PROCESSING` của `InvitationReady`) chỉ `status = 'LEASED'`, không ràng `lease_owner` / `lease_token`, không kiểm `Number(updated)`:

```97:103:packages/backend/src/outbox.ts
          await tx.$executeRaw`
            UPDATE outbox
            SET status = 'PROCESSING', updated_at = now()
            WHERE tenant_id = ${row.tenant_id}::uuid
              AND id = ${row.outbox_id}::uuid
              AND status = 'LEASED'
          `;
```

So với `TicketIssued`:

```282:293:packages/backend/src/outbox.ts
        const fenced = await tx.$executeRaw`
          UPDATE outbox
          ...
            AND lease_owner = ${options.leaseOwner}
            AND lease_token = ${row.lease_token}
        `;
        if (Number(fenced) === 0) {
          return 'stale' as const;
        }
```

`markOutboxCompleteFenced` (862–878) có fence lease nhưng nhánh invite có thể đã gửi mail khi lease stale.

**Mức độ:** Trung bình–cao (double-send / ack sai worker).

**Task fix đề xuất:** Đồng bộ fence với `TicketIssued`; assert `rows === 0` → skip send; test hai worker lease.

---

## H5 — `createEvent` replay bị chặn bởi `max_events`

**Kết luận: Xác nhận**

**Bằng chứng code:** Kiểm `max_events` + `COUNT(*)` **trước** `claimOperation` / replay (`537–553` trước `658–666`).

**Repro DB (SHA trên):** `max_events=1`, tạo event thành công; replay cùng idempotency key → `TENANT_LIMIT_REACHED` thay vì `replayed: true`.

**Test:** `event-lifecycle.test.cjs` replay `createEvent` **không** set `tenant_limits.max_events`.

**Mức độ:** Cao (idempotency client hỏng khi tenant ở giới hạn).

**Task fix đề xuất:** Nếu deterministic `eventId` đã tồn tại hoặc `claimOperation` replay → bỏ qua quota; test `max_events=1` + replay.

---

## H6 — `cloneEvent` bỏ `max_events` / SUSPENDED; mutation khác

**Kết luận: Xác nhận** (phạm vi Issue + mở rộng có căn)

**Bằng chứng code:**

- `createEvent`: `lockTenantPolicyForShare` + `assertTenantAllowsAdminMutation` + `max_events` (`535–553`).
- `cloneEvent` (`996+`): **không** gọi policy lock / `max_events`; insert event trực tiếp (`1048–1066`).
- `updateEvent`, `archiveEvent`, `cancelEvent`: **không** `assertTenantAllowsAdminMutation` (chỉ `createEvent` trong `event-admin.ts`).
- `apps/api/src/events.ts`: `clone`/`patch`/… chỉ `withTenant` → backend; **không** lớp SUSPENDED riêng.

**Test:** `platform.test.cjs` SUSPENDED chặn `redeemAndIssueTicket`, không cover `cloneEvent` / `updateEvent`.

**Mức độ:** Cao (`clone` + quota); trung bình (SUSPENDED trên admin mutation).

**Task fix đề xuất:** (1) `cloneEvent` dùng cùng policy + quota như `createEvent`; (2) audit toàn `event-admin` + API; (3) test SUSPENDED + `max_events` cho clone/update.

---

## Tóm tắt

| ID | Kết luận | Evidence chính |
| --- | --- | --- |
| H1 | Xác nhận | `import-jobs.ts:1122–1187`; PG `23505`→`25P02`; không test `skippedRowCount` |
| H2 | Xác nhận | `outbox.ts:281–691` + `tenant-context.ts:20–26` |
| H3 | Xác nhận | `outbox.ts:97–103` vs `282–293` |
| H5 | Xác nhận | `event-admin.ts:537–553`; repro `replay_blocked_by_max_events` |
| H6 | Xác nhận | `cloneEvent` thiếu guard; `updateEvent` thiếu SUSPENDED |

## Giới hạn

- Không chạy full `test:db` CI trên SHA.
- Repro `commitImportJob` duplicate chưa end-to-end (lock/timeout setup).
- Không review PR merge; không sửa code sản phẩm trong task này.

## Đề xuất Task fix (GitHub)

1. **#619-H1** — SAVEPOINT/ON CONFLICT + test `skippedRowCount` import CODES/GUESTS.
2. **#619-H2** — Outbox TicketIssued: provider ngoài tx / two-phase; test no duplicate on retry.
3. **#619-H3** — Lease fence cho MembershipInvite + InvitationReady PROCESSING.
4. **#619-H5** — `createEvent` idempotent replay vs `max_events`.
5. **#619-H6** — Policy + quota cho `cloneEvent`; SUSPENDED cho event admin mutations.
