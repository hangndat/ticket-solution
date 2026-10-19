# D13 — PR #357 R3 DoD + security revalidation (#351) AFTER rebase onto main

| Field | Value |
| --- | --- |
| Reviewer / session | James · Orca `term_f09395ac-d949-4605-802d-e674ce3ada41` · dispatch `ctx_1ed52f90e346` · task `task_92b69e9a6674` · roles `reviewer-dod` + `reviewer-security` · ≠ implementer (`d13-be-idp-erasure`) · prior R3 `term_006360ac…` (same verdict, revalidated) |
| Scope | Issue **#351** · PR **#357** · BE `packages/backend` (+ API upsert gate, worker IdP pipeline, CI account-deletion shard) |
| Architecture impact | **Có** — SEC-2 Keycloak erase + fail-closed tombstone denylist; đối chiếu `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` §5 (D2/D4/D6, R3) + coexistence với SEC-1 ACK (PR **#352** đã merge `a0a4c99a…`) |
| Prior review | R2 **PASS** @ `f8c17c730016f1dca07aed00bd0cd4127ef2f1d8` — **VOID** sau rebase (SHA mới) |
| Behavior / B1 SHA | `e999d15cb4c4ee750b5265662a0e7c0640a97ce8` — fail-closed denylist when keyring missing |
| **Exact tip SHA** | **`1dd2308e1387c3a7d7feb2baeb77f3a20cdb3dfe`** (`git rev-parse` = PR `headRefOid` live API) |
| Verdict DoD | **FAIL** |
| Verdict Security | **FAIL** (integration regression vs merged ACK path; B1 denylist itself still closed) |

## Rebase / ancestry facts (tip)

- `origin/main` merge-base ancestor of tip; PR **#352** merge commit `a0a4c99a18ee0cafa71f242046e7c0e8a5baa5b6` **in ancestry**.
- Migrations present: `202610180003_d13_ack_revoke_staff_sessions`, `202610180004_d13_sec2_idp_erasure`, `202610180005_d13_sec2_tombstone_key_guard`.
- `packages/backend/package.json` `test:db` includes **both** `account-ack-session-revoke.test.cjs` **and** `account-idp-erasure.test.cjs`.
- `.github/workflows/ci.yml` account-deletion shard files include **both** ACK + IdP erasure tests (+ `account-session-revoke`, `platform`).

## B1 denylist (still closed on tip)

Source @ tip confirms R3 / B1 fail-closed for **upsert denylist**:

1. `assertIdentityAllowedForUpsert` — on `TombstoneKeyringError`, if `listUnexpiredTombstoneKeyIds` non-empty → `denyUpsertForDenylist()`; allow unset only when zero live tombstones.
2. Historical key absent from ring → deny.
3. `readTombstoneKeyring` — invalid JSON / empty array → `KEYRING_INVALID` (never coerce empty usable ring).
4. Local: `SEC-2 B1: completed → unset/invalid/old-key-missing keyring denies upsert…` + keyring parse unit cases **pass** on tip.

Handoff §5.4 R3 (“Missing/empty required keyring … → fail closed + alert”) **met for denylist verify path**.

## Blocker — conflict regression vs merged PR #352 ACK (R3)

**Symptom (local + CI identical):**

`SEC-1 ACK: revoke at request; Gate denies; REJECTED keeps revoked; open blocked; apply idempotent`  
→ `processDueAccountAnonymizations(...).applied` expected `1`, actual `0`  
(`account-ack-session-revoke.test.cjs` ~L436).

**Root cause (source):** After SEC-2, `processDueAccountAnonymizations` loads tombstone keyring; on `TombstoneKeyringError` it alerts, sets `keyring=null`, then for each due row calls `mark_account_deletion_idp_attempt(... 'IDP_KEYRING_MISSING' ...)` and **`continue`s without** `prepareSnapshotAndApply` / PG scrub. ACK tests do not inject a synthetic keyring, so due processing never increments `applied`.

ACK revoke-at-request itself still runs earlier in the same test (create request → sessions `REVOKED`); failure is at the **due-worker / apply coexistence** stage that PR #352 DoD relied on after merge.

**CI on tip** `1dd2308e1387c3a7d7feb2baeb77f3a20cdb3dfe` — Actions run `39113576095`:

| Check | Result |
| --- | --- |
| backend / web / mobile / other DB shards | SUCCESS |
| **database-isolation (account-deletion …)** | **FAIL** (same ACK assertion) |
| Aggregate `ci` | **FAIL** |

## Architecture / handoff đối chiếu (tip)

| Handoff gate | Tip @ `1dd2308e…` |
| --- | --- |
| D2/D4 — `COMPLETED` iff PG + IdP `DELETED`/`NOT_FOUND` | SEC-2 tests T4/T5/T7 still pass |
| D6 / R1 — bounded denylist + OIDC ≤24h | T16/T17 pass |
| R3 — HMAC keyring fail-closed (upsert) | **B1 closed** @ `e999d15…` |
| SEC-1 ACK + apply coexistence after #352 on main | **Broken in shared due-worker path** — ACK suite red; CI account-deletion red |

Design drift: SEC-2 worker gate on missing keyring is consistent with “no COMPLETED without keyring,” but **unreconciled** with ACK suite / prior apply-without-IdP expectation after rebase onto main that already contains #352. Not an architect ADR rewrite — needs BE fix (test env injection and/or documented due-worker contract) before PASS.

## Checks on exact tip

```text
git rev-parse HEAD
→ 1dd2308e1387c3a7d7feb2baeb77f3a20cdb3dfe
gh pr view 357 --json headRefOid → same

pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test --test-concurrency=1 \
  test/account-idp-erasure.test.cjs \
  test/keycloak-erasure-http.test.cjs \
  test/account-session-revoke.test.cjs \
  test/account-ack-session-revoke.test.cjs
→ 14 pass / 1 fail (ACK apply idempotent / processDue.applied)

CI Actions 39113576095 @ 1dd2308e1387c3a7d7feb2baeb77f3a20cdb3dfe → account-deletion FAIL / ci FAIL

Independent re-run 2026-10-19 (worktree @ `1dd2308…`, `pnpm install` + build):
→ same 14 pass / 1 fail (`account-ack-session-revoke.test.cjs` L436 `applied` 0≠1); B1 suite green.
```

CRG: MCP unavailable in detached worktree path; source + local tests + GitHub check-runs authoritative @ `1dd2308e…`.

## Findings

| ID | Severity | Status |
| --- | --- | --- |
| B1 | Blocker (prior) | **Still closed** @ behavior `e999d15…` (denylist upsert) |
| **R3-C1** | **Blocker (new)** | **Open** — after rebase onto main+#352, ACK due-worker test + CI account-deletion red because missing keyring skips PG apply |

## Known gaps (unchanged; không cứu tip)

- Live production Keycloak DELETE không chạy trong PR (HTTP fixture only).
- Compose empty keyring placeholder remains coordinator-owned.

## Limitations (review process)

- Review only — không merge / không đổi Project Status / không deploy.
- Không implement fix trong session reviewer (cần fix-worker riêng).

## Verdict

**FAIL** (DoD) · **FAIL** (Security integration gate) trên exact SHA `1dd2308e1387c3a7d7feb2baeb77f3a20cdb3dfe`.

R2 PASS @ `f8c17c7…` **void**. B1 denylist fail-closed **vẫn đúng** trên `e999d15…`, nhưng tip **không** green: conflict regression với merged PR #352 ACK revoke (`processDue` + missing keyring → `applied=0`) khiến CI account-deletion fail. Revalidate sau fix trên SHA mới.
