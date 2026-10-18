# D13-S2-T2 — DoD revalidation: BE account anonymize verify (#320)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_a758edd8-6e4e-4a63-91bc-451a5a6be029` · dispatch `ctx_8e210277e12e` · task `task_8be43cf7b8f4` · Role `reviewer-dod` (`docs/agents/roles/reviewer-dod.md`) · agent `cursor` · **≠** implementer PR #342 / #348 / #352 / #357 |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · Task [#320](https://github.com/hangndat/ticket-solution/issues/320) · ownership BE account-deletion path (`apps/api`, `apps/worker`, `packages/backend`) |
| Architecture impact | **Không** (Task #320 verify) — follow-up SEC-1/SEC-2 PRs đã có DoD+security riêng; session này **không** re-open architect gate |
| Prior implementer artifact | `docs/reviews/D13-BE-ACCOUNT-DELETION-VERIFY.md` (PR [#342](https://github.com/hangndat/ticket-solution/pull/342) tip `8bc744e0c765db6e073628b35941115872d7af5b` / merge `e0e381762bd0f2f0d926b2a68195b5be053290ac`) |
| **Exact tip SHA (revalidate)** | **`9910173dc1c4f016448e2bc230ab6843c419b315`** (`origin/main` = merge #386; `git rev-parse`) |
| Supersedes | DoD chỉ neo PR #342 — **không đủ** sau follow-up #348 / #352 / #357 |
| Verdict | **PASS** |
| productionClaim | **false** — local isolated Docker Postgres + CI `database-isolation` trên tip; **không** claim prod DB đã migrate / live Keycloak DELETE |

## 1. Why revalidate tip (not PR #342 alone)

| Merge | PR | What landed after #342 |
| --- | --- | --- |
| `f673a920…` | [#348](https://github.com/hangndat/ticket-solution/pull/348) | SEC-1 apply: revoke `staff_sessions` in anonymize SQL |
| `a0a4c99a…` | [#352](https://github.com/hangndat/ticket-solution/pull/352) | SEC-1 ACK: revoke on request + Gate deny + SEC-R1 lock |
| `d5896f48…` | [#357](https://github.com/hangndat/ticket-solution/pull/357) | SEC-2 IdP erase + tombstone denylist; `COMPLETED` iff PG + IdP terminal |

All four merges are **ancestors** of tip `9910173dc1c4…`. Worktree HEAD `63535b48…` is behind tip by web/mobile-only commits; **`git diff HEAD..tip -- packages/backend apps/worker/src/index.ts apps/api/src/platform.ts` = empty** (BE surface identical to tip).

## 2. Checklist vs #320 AC / prior verify §7

| Gate | Verdict @ tip |
| --- | --- |
| Exact tip SHA cited | **PASS** — `9910173dc1c4f016448e2bc230ab6843c419b315` |
| `POST` / `createAccountDeletionRequest` → `REQUESTED` + O06 policy (30d) | **PASS** — `platform.test.cjs` + ACK suites |
| Worker calls `processDueAccountAnonymizations` (tick + `relayOnce`) | **PASS** — `apps/worker/src/index.ts` L79–82 / L111–114 |
| Anonymize ≤30d / idempotent; audit **not** DELETE | **PASS** — migrations `202610180001`…`005` explicit non-goals; tests keep audit |
| SEC-1 `staff_sessions` revoked (ACK + apply) | **PASS** — closed by #348/#352 (prior gap in verify artifact §5.2) |
| SEC-2 Keycloak erase + fail-closed tombstone; no PG-only `COMPLETED` | **PASS** — closed by #357 (prior gap in verify artifact §5.1) |
| Ticket PII 365d / object 90d still stubs | **PASS limitation** — still `NO_JOB_FRAMEWORK`; **not** claimed enforced |
| RLS / NOBYPASSRLS catalog | **PASS** — `rls-catalog.test.cjs` |
| Local tests ≠ prod | **PASS** — `productionClaim=false` |

## 3. Source map (tip)

| Step | Location |
| --- | --- |
| HTTP ACK | `apps/api` platform routes → `createAccountDeletionRequest` / `getCurrentAccountDeletionRequest` |
| ACK + session revoke | `packages/backend/src/account-deletion.ts` — `revokeSessionsForUserInTx` in same `withActor` tx |
| Worker | `apps/worker/src/index.ts` — `processDueAccountAnonymizations(db, 50, { env, leaseOwner })` |
| PG scrub + IdP finalize | `processDueAccountAnonymizations` → `prepareSnapshotAndApply` / `finalize_account_deletion_idp`; missing keyring/IdP → fail-closed (no terminal `COMPLETED`) |
| Upsert denylist | `assertIdentityAllowedForUpsert` + tombstone keyring |
| Migrations | `202610180001_d12_o06_account_anonymize` … `202610180005_d13_sec2_tombstone_key_guard` |
| Stubs (non-account) | `retention-o06.ts` — `processDueTicketPiiAnonymizations` / `processDueObjectRetentions` → `NO_JOB_FRAMEWORK` |

## 4. Checks on tip

### 4.1 Local (BE tree == tip)

```text
pnpm install --frozen-lockfile
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test --test-concurrency=1 \
  test/platform.test.cjs \
  test/account-session-revoke.test.cjs \
  test/account-ack-session-revoke.test.cjs \
  test/account-idp-erasure.test.cjs \
  test/keycloak-erasure-http.test.cjs \
  test/rls-catalog.test.cjs
→ ℹ tests 18 / pass 18 / fail 0
```

### 4.2 CI exact tip

| Ref | Result |
| --- | --- |
| Actions run `39124777477` | headSha=`9910173dc1c4f016448e2bc230ab6843c419b315` · aggregate **SUCCESS** |
| Job `database-isolation (account-deletion, …)` `117667512636` | **SUCCESS** — `ℹ tests 15` / `pass 15` / `fail 0` (shard subset; includes platform + session/ACK/IdP suites) |

## 5. Findings

| ID | Severity | Status |
| --- | --- | --- |
| Prior IdP gap (§5.1 verify) | Was open @ #342 | **Closed** on tip via #357 |
| Prior `staff_sessions` gap (§5.2 verify) | Was open @ #342 | **Closed** on tip via #348/#352 |
| Ticket/object retention stubs | Known gap | **Open by design** — not #320 scope; must not claim O06 full policy |
| Live prod Keycloak DELETE | Known gap | Fixture/HTTP only in tests; ops/runtime config separate |

No new blockers for #320 acceptance.

## 6. Limitations (review process)

- CRG `semantic_search_nodes` miss for `processDueAccountAnonymizations` (name not indexed); verification via lean-ctx + `git show` tip + tests.
- Review only — không merge, không đổi Project Status, không deploy.
- Headless UAT / physical-device: **N/A** for this BE verify Task AC (API/worker/DB path).

## 7. Verdict

**PASS** — account anonymize path (request → worker → PG scrub → IdP terminal → `COMPLETED`) verified on exact tip **`9910173dc1c4f016448e2bc230ab6843c419b315`**, including follow-ups that closed the #342 known gaps.
