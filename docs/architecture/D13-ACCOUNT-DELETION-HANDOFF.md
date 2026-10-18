# D13 — Account deletion IdP + session revoke handoff

| Field | Value |
| --- | --- |
| Mode | **Thiết kế** (docs-only) — Role `architect` · `docs/agents/roles/architect.md` |
| Issue | [#344](https://github.com/hangndat/ticket-solution/issues/344) |
| Parent | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · findings from Task [#320](https://github.com/hangndat/ticket-solution/issues/320) / PR [#342](https://github.com/hangndat/ticket-solution/pull/342) |
| Source SHA read | **`8bc744e0c765db6e073628b35941115872d7af5b`** |
| Review evidence | [PR comment 6247253660](https://github.com/hangndat/ticket-solution/pull/342#issuecomment-6247253660) · `docs/reviews/D13-PR342-DOD-SECURITY.md` (SEC-1 / SEC-2) |
| Architecture impact | **Có** — auth trust boundary + durable retry for erasure spanning PostgreSQL ↔ Keycloak |
| O06 | **Không đổi số** (anonymize ≤30d; audit TTL 730d; ticket/object stubs out of scope) |
| Kết luận | **Đủ để triển khai trong scope** sau khi coordinator xác nhận các mục §8 |
| Agent | Cursor · Orca `ctx_7b2d0969ad4c` · `task_15b4e41e7e26` |

## 1. Mục tiêu / non-goals

### Mục tiêu (đóng blocker store)

1. **SEC-1:** Sau yêu cầu/anonymize, không còn `staff_sessions` ACTIVE cho user đó → Gate `assertSessionActive` fail-closed.
2. **SEC-2:** Không còn đường “login Keycloak cùng subject → `upsertFromVerifiedIdentity` tạo user app mới” sau khi erasure đã chấp nhận.

### Non-goals

- Không đổi số O06 / retention ticket 365d / object 90d / audit 730d.
- Không xóa `audit_logs` / `platform_audit_logs` (PII trong audit vẫn theo TTL 730d — scrub app identity only).
- Không thêm SaaS IdP; không BullMQ; không rewrite Gate/OIDC toàn hệ.
- Không sửa `apps/**` / lockfile / shared OpenAPI trong Task architect này.
- Không deploy prod / mutate prod DB / commit secrets.

## 2. Hiện trạng @ SHA (facts)

| Fact | Location |
| --- | --- |
| ACK → `REQUESTED` + O06 policy | `packages/backend/src/account-deletion.ts` `createAccountDeletionRequest` |
| Worker poll/relay → `processDueAccountAnonymizations` | `apps/worker/src/index.ts` L79 / L108 |
| Apply SQL: clear email, rotate `subject`→`anon:<requestId>`, revoke `device_tokens`, null attendee email, `COMPLETED` | `…/202610180001_d12_o06_account_anonymize/migration.sql` |
| **Không** revoke `staff_sessions` | same apply function |
| Gate trusts ACTIVE session by `(tenant, event, session, user_id)` | `packages/backend/src/gate.ts` `assertSessionActive` (callers ~L383, ~L532) |
| Manual revoke exists but requires tenant actor + `PERMISSION_UNDO` | `revokeStaffSession` — **không** dùng được cho self-delete cross-tenant bulk |
| `staff_sessions` FORCE RLS theo `app.tenant_id` | migration `202610170005_d3_gate` |
| Upsert identity = unique `(issuer, subject)` create-or-update | `packages/backend/src/users.ts` `upsertFromVerifiedIdentity` |
| After subject rotate, same OIDC subject **creates new user** | platform test @ SHA; SQL comment intentional |
| No Keycloak Admin client in worker/API | search @ SHA empty |
| Durable side-effects pattern | ADR-17 leased PG `outbox` (tenant-scoped) — **không** khớp users global |

## 3. Invariants / trust boundaries

1. **PostgreSQL = source of truth** cho business deletion state; Keycloak là IdP side-effect.
2. **Deny-by-default authz** giữ nguyên; deletion ACK chỉ qua OIDC verified bearer (`selfActor`).
3. **Runtime `ticket_runtime` NOBYPASSRLS**; cross-tenant session revoke phải đi **SECURITY DEFINER** owned by `migration_owner` (+ owner policy nếu FORCE RLS chặn owner — cùng pattern `event_attendees_owner` trong migration O06).
4. **Không mock auth** trên production path.
5. **Audit retain:** apply không `DELETE` audit; không log email/OTP/token thô.
6. **Idempotency:** re-apply PG và re-call IdP phải an toàn (404 / already-disabled = success).

## 4. SEC-1 — Stale `staff_sessions`

### 4.1 Phương án

| | **A — Extend `apply_account_anonymization` (đề xuất)** | **B — Soft-check trong `assertSessionActive` only** |
| --- | --- | --- |
| Ý | Trong cùng SECURITY DEFINER apply: `UPDATE staff_sessions SET status='REVOKED', revoked_at=now() WHERE user_id=v_user_id AND status='ACTIVE'` (+ owner policy nếu cần) | Thêm điều kiện: user subject `anon:%` hoặc open deletion → reject session |
| Ưu | Atomic với scrub; mọi tenant một lần; khớp revoke `device_tokens`; Gate callers không đổi | Không migration session rows |
| Nhược | Cần policy/index `user_id`; audit `gate.session.revoke` bulk optional | **Không** đóng session; offline token còn ACTIVE trên device đến khi check — **không đủ store** |
| Phức tạp | Thấp | Thấp nhưng **không đạt mục tiêu** |

**Giữ hiện trạng:** không chấp nhận (SEC-1 P1).

**Chọn A.** Option B chỉ là defense-in-depth tùy chọn sau A, không thay A.

### 4.2 Timing: revoke lúc REQUEST vs lúc apply

| | **R1 — Revoke tại ACK `createAccountDeletionRequest`** | **R2 — Revoke trong apply (worker)** | **R1+R2 (đề xuất)** |
| --- | --- | --- | --- |
| Ý | Ngay khi user xác nhận xóa | Khi anonymize chạy (hiện due ≈ ngay) | ACK gọi helper revoke; apply revoke idempotent |
| Ưu | Fail-closed sớm; không phụ thuộc worker tick | Một chỗ SQL | Cửa sổ nhỏ nhất |
| Nhược | ACK path cần DEFINER helper (users global, sessions multi-tenant) | Cửa sổ đến tick worker (nhỏ) | Thêm 1 call idempotent |

**Đề xuất R1+R2:** helper SQL `revoke_sessions_for_user(p_user_id uuid)` SECURITY DEFINER; gọi từ ACK + từ apply.

### 4.3 Consumers blocked đến khi SEC-1 landed

- Gate reserve/confirm/undo paths dùng `assertSessionActive`
- Store release gate / App Review honesty (“xóa tài khoản” vẫn check-in được)
- **Không** block IdP design consumers — SEC-1 **có thể ship độc lập**

### 4.4 BE Task SEC-1 (độc lập)

| Item | Path / note |
| --- | --- |
| Migration | `packages/backend/prisma/migrations/<ts>_d13_revoke_sessions_on_delete/` — `REVOKE` + `CREATE POLICY staff_sessions_owner … TO migration_owner`; `CREATE OR REPLACE` apply + optional `revoke_sessions_for_user`; index `(user_id) WHERE status='ACTIVE'` |
| TS | `packages/backend/src/account-deletion.ts` — gọi revoke helper trên ACK nếu R1 |
| Worker | không bắt buộc đổi nếu chỉ apply SQL |
| Tests | `packages/backend/test/platform.test.cjs` + `gate.test.cjs`: open session → delete ACK/apply → `assertSessionActive` / confirm fails; second apply idempotent; RLS catalog vẫn PASS |
| Compatibility | Client Gate phải nhận `SESSION_NOT_ACTIVE`; không đổi OpenAPI shape bắt buộc |

## 5. SEC-2 — Keycloak IdP + re-login recreate

### 5.1 Vì sao subject-rotate alone không đủ

`upsertFromVerifiedIdentity` keys trên `(issuer, subject)`. Apply đổi `subject` → `anon:<requestId>` **giải phóng** OIDC subject gốc → login lại **INSERT user mới**. IdP account còn sống = lỗ hổng identity, không chỉ “PII app”.

### 5.2 Phương án IdP

| | **I1 — Disable IdP user + logout sessions (đề xuất MVP)** | **I2 — Delete IdP user** | **I3 — App tombstone only (no IdP Admin)** |
| --- | --- | --- | --- |
| Semantics | `enabled=false` + invalidate Keycloak sessions; optional hard-delete later | `DELETE /users/{id}` | Bảng `identity_tombstones(issuer, subject)` chặn upsert; IdP vẫn login UI |
| App Review | Không đăng nhập được ≈ account không dùng lại | Cứng hơn | Yếu — IdP vẫn tồn tại; rủi ro review/copy |
| Idempotence | 404 user / already disabled → success | 404 → success; conflict nếu email reuse | Dễ |
| Recovery | Re-enable trong cửa sổ support (ops) | Khó | N/A |
| Phức tạp | Admin API + durable state | Cao hơn (email unique, orphan) | Thấp nhưng **không đủ** nếu policy yêu cầu IdP erase |

**Chọn I1** cho MVP store. I2 = phase sau nếu counsel/ops yêu cầu hard delete. I3 chỉ bổ sung defense-in-depth **cùng** I1 (tombstone trước khi rotate), không thay I1.

### 5.3 Durable state (không nhét tenant `outbox`)

`outbox` hiện **tenant-scoped** (ADR-17) — không phải chỗ đúng cho user-global IdP job.

**Đề xuất:** mở rộng `account_deletion_requests` (cùng bảng, tránh job framework mới):

| Column (đề xuất) | Ý |
| --- | --- |
| `original_issuer text` | Snapshot trước rotate |
| `original_subject text` | Snapshot trước rotate |
| `idp_status text` | `PENDING` \| `SUCCEEDED` \| `NOT_FOUND` \| `FAILED` |
| `idp_attempts int` | Bounded retry |
| `idp_next_attempt_at timestamptz` | Backoff |
| `idp_last_error_code text` | Sanitized (no token) |

**State machine (đề xuất — cần coordinator xác nhận):**

```text
REQUESTED
  → worker: PG scrub + session revoke + snapshot issuer/subject
     + set idp_status=PENDING (chưa COMPLETED)
  → worker: Keycloak disable(+logout)
     success/404 → idp_status=SUCCEEDED|NOT_FOUND; state=COMPLETED
     retryable error → idp_status=FAILED; stay REQUESTED (or ANONYMIZING*); bump attempts/backoff
```

\*Nếu muốn tách rõ “PG xong / IdP chưa”: thêm state `ANONYMIZING` vào CHECK constraint — **cần xác nhận** vì đụng `account_deletion_one_open` partial unique và API clients.

**Alternative nhỏ hơn (ít đụng state enum):** giữ `state=REQUESTED`直到 cả PG+IdP xong; dùng cột `pg_applied_at` để đánh dấu PG đã scrub (idempotent skip scrub). `COMPLETED` chỉ khi IdP xong. **Đề xuất ưu tiên alternative này** để tránh mở rộng enum nếu coordinator muốn tối thiểu.

**Không** đặt `COMPLETED` khi chỉ PG xong mà IdP còn pending — API/UI sẽ nói dối store gate.

### 5.4 Ordering / failure matrix

| Step | Success next | Failure |
| --- | --- | --- |
| 1 Snapshot `original_issuer/subject` + revoke sessions (DEFINER) | 2 | Abort; stay REQUESTED; no subject rotate |
| 2 PG scrub (email null, subject→anon:, device_tokens, attendees) + `pg_applied_at` | 3 | Abort before rotate if possible; retry whole; **never** COMPLETED |
| 3 Keycloak: find user by username/id from subject mapping; `enabled=false`; logout-all | 4 | Retryable (5xx/timeout/network): backoff, `idp_status=FAILED`; **PG đã scrub OK** — không rollback PII (forward recovery). Non-retryable config: escalate ops |
| 4 `idp_status=SUCCEEDED\|NOT_FOUND`; `state=COMPLETED` | done | — |

**404 / already disabled:** treat as success (`NOT_FOUND` or `SUCCEEDED`).  
**Timeout:** leave PENDING/FAILED; worker retry; do not COMPLETED.  
**IdP success then crash before COMPLETED:** retry disable is idempotent; then COMPLETED.

**Fail-closed re-login trong lúc REQUESTED / pg_applied:**

- `upsertFromVerifiedIdentity`: nếu tồn tại open deletion (`REQUESTED`/`UNDER_REVIEW`) cho user map từ `(issuer,subject)` **hoặc** tombstone/snapshot match → **reject** (IdentityError), không create user mới.
- Sau COMPLETED: tombstone `(original_issuer, original_subject)` durable (table nhỏ hoặc unique trên request columns) → upsert reject vĩnh viễn cho subject đó; IdP disable là lớp 1.

### 5.5 Keycloak Admin — least privilege

| Item | Recommendation |
| --- | --- |
| Client | Dedicated confidential client in realm `ticket` (e.g. `vemoki-erasure`) — **not** personal admin user in app code |
| Roles | Tối thiểu: `view-users`, `manage-users` (disable + logout). Tránh `realm-admin` |
| Creds | Env on worker only: `KEYCLOAK_BASE_URL`, `KEYCLOAK_ERASURE_CLIENT_ID`, `KEYCLOAK_ERASURE_CLIENT_SECRET` (or client credentials JWT). **Never** commit; `.env.example` placeholders only |
| API | Token endpoint client_credentials → Admin REST disable user + logout. Map OIDC `sub` → Keycloak user id via API search |
| Network | Worker → Keycloak internal Docker/VPS network; timeout bounded (e.g. 5–10s) |

### 5.6 Consumers blocked on SEC-2 design confirmation

- BE IdP erasure implementation Task
- Ops Keycloak realm client provisioning
- App Review notes / privacy honesty around “account cannot sign in again”
- **SEC-1 không chờ** SEC-2

## 6. Recommended end-to-end sequence (MVP)

```text
POST /v1/me/account-deletion-requests (OIDC)
  → insert/upgrade REQUESTED + policy O06
  → revoke_sessions_for_user(userId)           # SEC-1 R1
  → (optional) reject new Gate openStaffSession if open deletion

Worker tick processDueAccountAnonymizations
  → list_due (REQUESTED & policy set & due)
  → FOR UPDATE request
  → if pg_applied_at is null:
       snapshot issuer/subject; scrub+rotate; revoke sessions again; set pg_applied_at
  → attempt Keycloak disable+logout (I1)
  → on success/404: idp_status=…; state=COMPLETED
  → on retryable fail: idp_status=FAILED; backoff; leave REQUESTED

upsertFromVerifiedIdentity
  → deny if tombstone / open deletion matches issuer+subject
```

Audit: existing platform/gate audit actions only; **no** new PII fields; optional `account_deletion.idp_disabled` with request id only.

## 7. Regression test matrix (BE)

| # | Case | Expect |
| --- | --- | --- |
| T1 | Open staff session → ACK deletion | Sessions REVOKED; Gate confirm → `SESSION_NOT_ACTIVE` |
| T2 | Apply anonymize twice | Second `applied=0`; sessions remain REVOKED |
| T3 | Apply clears email/subject; audit count unchanged | O06 retain |
| T4 | IdP disable success → COMPLETED | `idp_status=SUCCEEDED` |
| T5 | IdP 404 → COMPLETED | `idp_status=NOT_FOUND` |
| T6 | IdP 503 then success | Stays non-COMPLETED until retry succeeds; no new user on login attempt |
| T7 | After pg scrub, same subject login before IdP done | upsert **rejected** |
| T8 | After COMPLETED, same subject login | upsert **rejected** (tombstone) + IdP disabled |
| T9 | RLS catalog / NOBYPASSRLS | Still PASS |
| T10 | No Keycloak creds in test | Fake IdP adapter inject in unit/db test |

UAT headless (sau impl, session khác): request deletion → Gate session dead; login again fails or cannot recreate privileged access.

## 8. Quyết định cần coordinator xác nhận

1. **SEC-1:** Chốt **A + R1+R2** (revoke DEFINER + ACK và apply idempotent)? → **Đề xuất: Có** (có thể dispatch BE ngay).
2. **SEC-2 semantics:** MVP **disable** (I1) vs hard **delete** (I2)? → **Đề xuất: I1**.
3. **COMPLETED meaning:** chỉ khi PG+IdP xong (dùng `pg_applied_at`, giữ enum)? vs thêm state `ANONYMIZING`? → **Đề xuất: `pg_applied_at` + COMPLETED = both**.
4. Tombstone table riêng vs columns trên `account_deletion_requests`? → **Đề xuất: columns + unique index `(original_issuer, original_subject)` where not null** (đủ MVP).
5. Có bắt buộc deny `openStaffSession` khi đang REQUESTED? → **Đề xuất: Có** (hardening nhỏ, cùng SEC-1 Task).

Ngoài các mục trên: **không** cần user đổi O06.

## 9. Handoff ownership / tasks

| Task | Ownership | Deps | Notes |
| --- | --- | --- | --- |
| **BE-S1** Session revoke | `backend` · `apps/api`? minimal · `packages/backend` migration+tests · worker unchanged nếu SQL-only | Coordinator xác nhận §8.1 | Unblocks Gate safety; **parallel** với IdP |
| **BE-S2** IdP disable + durable columns + upsert deny | `backend` · `packages/backend` · `apps/worker` IdP adapter · env example | §8.2–8.4; ops client | Blocked on this handoff confirm |
| **Ops** Keycloak client `vemoki-erasure` + secret trên worker host | coordinator/ops | After §8.2 | No SaaS |
| **BA/docs ASC** (optional follow) | `product-ba` | After BE-S2 | Refresh review notes: cannot re-auth |
| DoD/security revalidation | `reviewer-dod` + `reviewer-security` | After merge SHAs | Exact SHA mới; **không** tự review bởi author design |

### Paths đụng (impl)

- `packages/backend/prisma/migrations/*`
- `packages/backend/src/account-deletion.ts`
- `packages/backend/src/users.ts` (deny upsert)
- `packages/backend/src/gate.ts` (optional open deny)
- `packages/backend/src/keycloak-erasure.ts` (**new**, worker-facing)
- `apps/worker/src/index.ts` (wire erasure after/near anonymize)
- `packages/backend/test/platform.test.cjs`, `gate.test.cjs`, fake IdP tests
- `.env.example` placeholders only

## 10. Kết luận

| Hạng mục | Status |
| --- | --- |
| SEC-1 design | **Đủ để triển khai** — Option A + R1+R2; độc lập IdP |
| SEC-2 design | **Đủ để triển khai** sau xác nhận disable + COMPLETED semantics (§8) |
| ADR mới? | Không bắt buộc nếu follow ADR-09/11/17 + O06; optional short ADR chỉ khi coordinator muốn ghi nhận IdP disable contract |
| Verdict | **Đề xuất** chấp nhận handoff → spawn BE-S1 ngay; BE-S2 sau confirm §8 |

**Blocked consumers:** store deletion release gate; Gate staff after self-delete; IdP re-login recreate.  
**Unblocked by SEC-1 alone:** stale session exploit path.  
**Still blocked until SEC-2:** full identity erasure / App Review “cannot use account again”.
