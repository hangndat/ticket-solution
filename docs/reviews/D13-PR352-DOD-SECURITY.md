# D13 PR #352 — DoD + Security (Issue #349)

| Field | Value |
| --- | --- |
| Reviewer roles | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` + `reviewer-security` · `docs/agents/roles/reviewer-security.md` |
| Agent / session | Cursor · Orca dispatch `ctx_44d4acfacb72` · terminal `term_73a13d98-f993-4f1c-ac96-088ba9562667` · task `task_e365966397cc` |
| Independence | ≠ BE implementer (SEC-1 ACK / PR #352 author; SEC-2 đang worktree khác) · review chỉ đọc SHA PR qua `git fetch` / worktree detach · không sửa impl/CI |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · Issue [#349](https://github.com/hangndat/ticket-solution/issues/349) · PR [#352](https://github.com/hangndat/ticket-solution/pull/352) |
| Paths | `packages/backend` — migration `202610180003_d13_ack_revoke_staff_sessions`, `src/account-deletion.ts`, `src/gate.ts`, `src/gate-error.ts`, `test/account-ack-session-revoke.test.cjs`, `package.json` `test:db` |
| Exact SHA under review | **`e12d68e7a8319bc33b786f11527ec9c32be4e55d`** (= PR `headRefOid` / tip) |
| Behavior SHA | `5a2db727968c1f9f0dbff6b2bff9c6e08739f968` |
| Baseline | PR [#348](https://github.com/hangndat/ticket-solution/pull/348) merge `f673a92014e501b84b2e2a8fc1372815ef597ccc` — **ancestor** của tip |
| Architecture impact | **Có** — ACK revoke / session admission race (handoff §4 D1 A+R1+R2, R5 REJECTED) |
| Handoff | `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` (merged / design branch) |
| Date (UTC) | 2026-10-18 |
| CRG | `list_graph_stats_tool` OK; symbol search miss (SHA ngoài graph HEAD) → đọc source qua `git show` / worktree `e12d68e…` — **source wins** |

## Dual verdict

| Gate | Verdict | Meaning |
| --- | --- | --- |
| **A. DoD / Issue #349 AC** (ACK revoke atomic, Gate `SESSION_NOT_ACTIVE`, REJECTED stay revoked, open blocked, rollback, idempotent apply, cross-user untouched) | **PASS** (functional) | Isolated DB suite 2/2 + apply regression 1/1 + RLS catalog 1/1 trên exact SHA |
| **B. Security** (ACK↔`openStaffSession` race, trigger defense-in-depth, DEFINER grants/owner RLS, least privilege) | **FAIL** | App path có advisory xact lock — OK; trigger `EXISTS` **không** lấy cùng lock → TOCTOU tái hiện **40/40** |
| **C. CI evidence trên tip** | **PASS with known gap** | GitHub `ci` xanh nhưng shard `account-deletion` trên `main` chỉ `platform`+`account-session-revoke`; **không** chạy `account-ack-session-revoke.test.cjs` (worker không được sửa CI — coordinator wiring) |

**Overall for coordinator:** **FAIL** — không merge / không Hoàn thành #349 cho đến khi trigger (hoặc đường INSERT tương đương) serialize bằng `lock_user_session_mutation` (hoặc gọi `assert_can_open_staff_session`) và revalidation exact SHA mới. Functional AC gần đủ; security gate bắt buộc còn lỗ defense-in-depth có ordering chứng minh.

---

## 1. Checks (exact SHA)

```bash
git rev-parse e12d68e7a8319bc33b786f11527ec9c32be4e55d
# e12d68e7a8319bc33b786f11527ec9c32be4e55d

gh api repos/hangndat/ticket-solution/pulls/352 --jq .head.sha
# e12d68e7a8319bc33b786f11527ec9c32be4e55d

# Detached worktree @ tip (không đụng design branch / untracked reviews):
cd /tmp/pr352-dod-wt/packages/backend
node --test \
  test/account-ack-session-revoke.test.cjs \
  test/account-session-revoke.test.cjs \
  test/rls-catalog.test.cjs
# ✔ 4/4 pass (duration ~12.8s)
```

GitHub Actions run `39110418264` trên PR: `ci`/`backend`/các shard DB hiện có → success. **Gap:** matrix tip PR không chứa shard `account-deletion` (có trên `main` với `test/platform.test.cjs test/account-session-revoke.test.cjs` thôi) — suite ACK mới **chưa** nằm trong CI shard.

---

## 2. Architecture / handoff đối chiếu

| Handoff / #349 | Tip `e12d68e…` | Result |
| --- | --- | --- |
| D1 A+R1+R2: `revoke_sessions_for_user` SECURITY DEFINER tại ACK + apply idempotent | Migration `202610180003` + `createAccountDeletionRequest` gọi helper trong cùng `withActor` tx; apply `PERFORM revoke_sessions_for_user` | **PASS** |
| R5 REJECTED không restore session | Không có code restore; test REJECTED → old `REVOKED`, open **mới** được | **PASS** |
| Deny `openStaffSession` khi request mở | `assert_can_open_staff_session` + `GATE_ERROR_CODES.ACCOUNT_DELETION_OPEN` | **PASS** (app path) |
| Race ACK vs session open | `pg_advisory_xact_lock(872341, hashtext(user_id))` trong revoke **và** assert | **PASS** app path; **FAIL** trigger-only |
| SEC-2 IdP | Ngoài scope (đúng) | N/A |

---

## 3. Security checklist

### 3.1 ACK + revoke cùng transaction / rollback — PASS

- `revokeSessionsForUserInTx` sau INSERT/re-ACK trong cùng `withActor` transaction.
- Test `SEC-1 ACK: revoke failure rolls back REQUESTED insert`: forced helper exception → `account_deletion_requests` count = 0.

### 3.2 Cross-tenant revoke + owner RLS / least privilege — PASS

- Helper `OWNER TO migration_owner`, `SECURITY DEFINER`, `SET search_path = pg_catalog, public`.
- `REVOKE ALL … FROM PUBLIC`; `GRANT EXECUTE … TO ticket_runtime` only (lock / revoke / assert / apply).
- `staff_sessions_owner` / `account_deletion_owner` (`USING true`) cho `migration_owner` dưới FORCE RLS — pattern #348 / platform; runtime không nhận BYPASSRLS.
- Test: session staff cùng user ở 2 tenant → `REVOKED`; staff khác cùng tenant vẫn `ACTIVE`.

### 3.3 Duplicate ACK idempotency — PASS

- Open row `FOR UPDATE`; re-ACK cùng `requestId`; revoke lại no-op; audit count không giảm.

### 3.4 Gate `SESSION_NOT_ACTIVE` / open blocked / REJECTED — PASS

- `reserveCheckin` sau ACK → `SESSION_NOT_ACTIVE`.
- `openStaffSession` khi `REQUESTED` → `ACCOUNT_DELETION_OPEN`.
- Sau `REJECTED`: session cũ vẫn `REVOKED`; open session mới (id khác) OK.

### 3.5 Race ACK vs `openStaffSession` / trigger — FAIL (blocker)

**App path (đúng):** cả `assert_can_open_staff_session` và `revoke_sessions_for_user` gọi `lock_user_session_mutation` → `pg_advisory_xact_lock` giữ đến hết transaction. Probe hold-across-ACK với assert+INSERT: **0/40** violation (`ACTIVE` đồng thời `open request`).

**Trigger defense-in-depth (lỗ):** `staff_sessions_deny_if_deletion_open` chỉ `EXISTS` trên `account_deletion_requests` — **không** lấy advisory lock.

Ordering chứng minh (READ COMMITTED):

1. **T_raw** `BEGIN` → `INSERT staff_sessions` (trigger `EXISTS` = false) → hàng ACTIVE **uncommitted** → `pg_sleep`.
2. **T_ack** `INSERT account_deletion_requests` → `revoke_sessions_for_user` (UPDATE … `status='ACTIVE'`) → **không thấy** INSERT chưa commit → `ROW_COUNT` 0 → `COMMIT`.
3. **T_raw** `COMMIT` → session **ACTIVE** trong khi request còn **REQUESTED**.

Probe SQL cô lập trên tip migrations: **40/40** rounds tái hiện (`ACTIVE=1` ∧ `open request=1`). `ticket_runtime` có `INSERT` trên `staff_sessions` → mọi đường INSERT bỏ qua `assert_can_open_staff_session` (raw SQL / bug tương lai) thắng race; trigger hiện **không** đóng lỗ.

**Fix trước merge (gợi ý, không implement trong review):** trong trigger (hoặc thay trigger bằng `PERFORM assert_can_open_staff_session(NEW.user_id)`), gọi `lock_user_session_mutation(NEW.user_id)` **trước** `EXISTS`, cùng namespace lock với ACK revoke.

---

## 4. Findings

| Sev | ID | Finding |
| --- | --- | --- |
| **Blocker** | SEC-R1 | Trigger `staff_sessions_deny_if_deletion_open` TOCTOU vs ACK revoke — 40/40; thiếu common lock với `revoke_sessions_for_user` |
| Should-fix / process | CI-1 | `account-ack-session-revoke.test.cjs` có trong `package.json` `test:db` nhưng **chưa** vào CI `database-isolation` shard `account-deletion` — coordinator wiring (ngoài quyền worker) |
| Nit | — | `hashtext(user_id)` advisory key có thể collision giữa user (contention, không bypass bảo mật) |
| Out of scope | — | SEC-2 IdP — đúng là ngoài PR |

---

## 5. Limitations

- Review worktree detach `/tmp/pr352-dod-wt` @ exact SHA; design branch `hangndat/d13-architect-account-deletion-handoff` và untracked `docs/reviews/D13-PR34*` **không** bị sửa/commit/push.
- Không merge, không Project status, không đụng worktree SEC-2.
- Race probe là SQL song song (không phải stress multi-client production); đủ để chứng minh ordering.
- CRG HEAD ≠ tip PR — source từ git/worktree.

---

## 6. Coordinator next

1. Spawn fix-worker BE: trigger lấy cùng `lock_user_session_mutation` (hoặc `assert_can_open_staff_session`) + regression test cho uncommitted-INSERT-vs-ACK.
2. Revalidation DoD+security trên SHA mới (không kế thừa FAIL này).
3. Wiring CI: thêm `test/account-ack-session-revoke.test.cjs` vào shard `account-deletion` trên integration branch.
4. Giữ #349 `Chờ duyệt` / trả `Đang làm` — **không** Hoàn thành / merge khi SEC-R1 còn mở.
