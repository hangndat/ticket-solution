# D13 PR #352 — DoD + Security revalidation (R2)

| Trường | Giá trị |
| --- | --- |
| Reviewer / session | Cursor · Roles `reviewer-dod` + `reviewer-security` · Orca `ctx_b3f11a590974` / `task_4f2c79f13498` (≠ implementer; ≠ R1 FAIL `ctx_44d4acfacb72`) |
| Scope | Issue #349 / PR #352 / `packages/backend` (ACK revoke + Gate deny + SEC-R1 trigger lock) |
| Architecture impact | **Có** — đối chiếu `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` §4 (A+R1+R2 ACK+apply) |
| Commit SHA đã duyệt | `626b860bc328b379b7125795100b5cedfd85675e` |
| Behavior SHA (SEC-R1) | `9797aefa2205fda75092c627211df2df2ba323a3` |
| Supersedes | FAIL R1 @ `e12d68e7a8319bc33b786f11527ec9c32be4e55d` (comment PR #352; artifact local `docs/reviews/D13-PR352-DOD-SECURITY.md` chưa land trên branch) |
| Branch | `hangndat/d13-be-ack-session-revoke` (worktree tip = finalSHA) |

## Verdict

- **DoD:** **PASS**
- **Security:** **PASS** (blocker SEC-R1 đã đóng trên finalSHA)
- **Overall:** **PASS** — supersede FAIL R1; **không** merge / Project / prod trong session này
- SEC-2 IdP (PR #357, tip `a0eb3cb…`, OPEN): **riêng** — không gán joint semantics

## Prior FAIL (R1) — đã đóng

R1: trigger `staff_sessions_deny_if_deletion_open` chỉ `EXISTS` → TOCTOU READ COMMITTED với ACK `revoke_sessions_for_user` → **ACTIVE ∧ REQUESTED** (40/40).

Fix `9797aef`: trigger `PERFORM assert_can_open_staff_session(NEW.user_id)` → cùng `lock_user_session_mutation` / advisory `(872341, hashtext(user_id))` với ACK trước `EXISTS`.

## Source (exact)

- Migration `202610180003_d13_ack_revoke_staff_sessions`: lock → revoke / assert; trigger gọi assert; apply gọi lại revoke (idempotent).
- `createAccountDeletionRequest`: revoke trong cùng `withActor` tx (lỗi → rollback REQUESTED).
- `openStaffSession`: assert → map `ACCOUNT_DELETION_OPEN`; INSERT vẫn qua trigger.
- Lock ordering: INSERT/assert/revoke đều lấy advisory **trước** mutation session / check deletion — không đảo khóa với ACK; xact lock tái nhập trong cùng txn.
- REJECTED / audit / RLS / cross-tenant: không đổi semantics (R5 sessions ở REVOKED; audit không DELETE; FORCE RLS catalog giữ).

## Checks (SHA `626b860bc328b379b7125795100b5cedfd85675e`)

```text
git rev-parse HEAD
→ 626b860bc328b379b7125795100b5cedfd85675e

pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test \
  test/account-ack-session-revoke.test.cjs \
  test/account-session-revoke.test.cjs \
  test/rls-catalog.test.cjs
→ 5/5 pass (gồm SEC-R1 40 rounds + pg_locks barrier)
```

CI run `39111696883` headSha=`626b860bc328b379b7125795100b5cedfd85675e`:

- shard `account-deletion` chạy `test/platform.test.cjs test/account-session-revoke.test.cjs test/account-ack-session-revoke.test.cjs`
- log: `✔ SEC-R1: uncommitted raw INSERT cannot race ACK into ACTIVE+REQUESTED`; `ℹ tests 5` / `pass 5` / `fail 0`
- không dựa CI xanh SHA cũ hơn tip

### A/B race (reviewer ephemeral DB; không sửa source)

| Trigger | Rounds | Lock waiter | ACTIVE∧REQUESTED |
| --- | ---: | --- | ---: |
| OLD `EXISTS` only | 20 | không | **20/20** |
| FIXED `assert_can_open_staff_session` | 20 | có | **0/20** |

Verdict probe: `FIX_CONFIRMED`.

## Architecture

Handoff §4 D1: revoke SECURITY DEFINER tại ACK **và** apply idempotent; deny open khi request mở; REJECTED không restore — khớp implementation finalSHA. Gap §4.4 apply-only (PR #348) đã được PR #352 đóng. SEC-2 IdP vẫn ngoài scope.

## Limitations (honest)

1. SEC-2 / IdP delete-disable **chưa** merge (PR #357 riêng) — store gate vẫn cần SEC-2 theo handoff.
2. Reviewer **không** merge / không sửa Project / không deploy.
3. Một lần chạy local song song trước đó `account-session-revoke` flake `scanned=0`; re-run cô lập + CI exact SHA đều PASS — ghi nhận nhiễu, không blocker.
4. Artifact R1 FAIL không có trên branch tip (chỉ comment Issue/PR) — R2 supersede bằng artifact này + comment mới.
5. CRG MCP trong session báo HEAD lệch worktree khác; evidence dựa `git rev-parse` + source/CI/log trên worktree này.

## Findings

| ID | Severity | Status |
| --- | --- | --- |
| SEC-R1 TOCTOU trigger lock | blocker (R1) | **Closed** @ `9797aef` / tip `626b860` |
| CI thiếu suite ack-race | known gap (R1) | **Closed** @ `626b860` (`ci.yml` shard account-deletion) |
