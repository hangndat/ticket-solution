# D13 — PR #357 R4 DoD + security revalidation (#351) AFTER R3-C1 fix

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_18f6fe97-7f73-4e36-beb0-d243826412ee` · dispatch `ctx_9fea57686d3d` · task `task_8176324a2cea` · roles `reviewer-dod` + `reviewer-security` · ≠ implementer (`d13-be-idp-erasure` / R3-C1 fix `term_2da82c6c…`) · ≠ R3 `term_006360ac…` |
| Scope | Issue **#351** · PR **#357** · BE `packages/backend` (+ API upsert gate, worker IdP pipeline, CI account-deletion shard) |
| Architecture impact | **Có** — SEC-2 Keycloak erase + fail-closed tombstone denylist; đối chiếu `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` §5 (D2/D4/D6, R3) + coexistence với SEC-1 ACK (PR **#352** merge `a0a4c99a…` in ancestry) |
| Prior review | R3 **FAIL** @ `1dd2308e1387c3a7d7feb2baeb77f3a20cdb3dfe` — blocker **R3-C1** (`docs/reviews/D13-PR357-R3-DOD-SECURITY.md`) |
| Behavior / R3-C1 fix SHA | `c59a6c9c32994bed27c06e0e3a308fe733f89530` — ACK suite injects synthetic keyring + fake IdP |
| **Exact tip SHA** | **`8d5e9d7ce9e9795ec1e28c56dde78d8e05d111b9`** (`git rev-parse` = PR `headRefOid` live API) |
| Verdict DoD | **PASS** |
| Verdict Security | **PASS** |

## Revalidation summary

R3 failed because `account-ack-session-revoke.test.cjs` called `processDueAccountAnonymizations` without a tombstone keyring; SEC-2 due-worker correctly skips PG apply (`IDP_KEYRING_MISSING`) → `applied=0`.

R3-C1 fix is **test-only** (diff vs R3 tip `1dd2308…` → tip `8d5e9d7…`: only `account-ack-session-revoke.test.cjs` + fix evidence docs). Production paths unchanged:

1. **B1 upsert fail-closed** — `assertIdentityAllowedForUpsert` still denies on `TombstoneKeyringError` when live tombstones exist; invalid/empty ring → `KEYRING_INVALID`.
2. **Due-worker mint-before-scrub** — missing keyring still alerts + marks `IDP_KEYRING_MISSING` + `continue` without `prepareSnapshotAndApply` (no PG-only COMPLETED weaken).

ACK suite now injects `ackProcessOpts()` (synthetic `TOMBSTONE_ENV` + `readTombstoneKeyring` + fake IdP `DELETED`) mirroring the session-revoke pattern, so coexistence with merged #352 is exercised without relaxing B1.

## Wiring still present

- `packages/backend/package.json` `test:db` lists **both** `account-ack-session-revoke.test.cjs` **and** `account-idp-erasure.test.cjs`.
- `.github/workflows/ci.yml` account-deletion shard files include **both** ACK + IdP erasure (+ `account-session-revoke`, `platform`).

## Architecture / handoff đối chiếu (tip)

| Handoff gate | Tip @ `8d5e9d7…` |
| --- | --- |
| D2/D4 — `COMPLETED` iff PG + IdP `DELETED`/`NOT_FOUND` | SEC-2 T4/T5/T7 pass; missing IdP never COMPLETED |
| D6 / R1 — bounded denylist + OIDC ≤24h | T16/T17 pass |
| R3 — HMAC keyring fail-closed (upsert) | **B1 closed** @ `e999d15…`; B1 suite green on tip |
| SEC-1 ACK + apply coexistence after #352 | **Restored** via test keyring inject; ACK apply `applied=1` green |

No design drift requiring separate architect gate: production mint-before-scrub invariant preserved; test harness aligned with contract.

## Checks on exact tip

```text
git rev-parse HEAD
→ 8d5e9d7ce9e9795ec1e28c56dde78d8e05d111b9
gh pr view 357 --json headRefOid → same

pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test --test-concurrency=1 \
  test/account-idp-erasure.test.cjs \
  test/keycloak-erasure-http.test.cjs \
  test/account-session-revoke.test.cjs \
  test/account-ack-session-revoke.test.cjs
→ 15 pass / 0 fail
  (includes B1 denylist + ACK apply idempotent / processDue.applied=1)

CI Actions 39114472545 @ 8d5e9d7ce9e9795ec1e28c56dde78d8e05d111b9
→ database-isolation (account-deletion …) SUCCESS
→ aggregate ci SUCCESS (all required jobs green)
```

CRG: `list_graph_stats` + full rebuild then `detect_changes` vs `origin/main` (risk elevated for whole PR surface; R3-C1 delta is test-only). Source + local/CI tests authoritative for this revalidation.

## Findings

| ID | Severity | Status |
| --- | --- | --- |
| B1 | Blocker (prior) | **Still closed** — upsert denylist fail-closed unchanged vs R3 |
| **R3-C1** | Blocker (R3) | **Closed** — ACK suite keyring inject; local + CI account-deletion green |

## Known gaps (unchanged; không chặn PASS)

- Live production Keycloak DELETE không chạy trong PR (HTTP fixture only).
- Compose empty keyring placeholder remains coordinator-owned.

## Limitations (review process)

- Review only — không merge / không đổi Project Status / không deploy.
- Không implement thêm trong session reviewer.

## Verdict

**PASS** (DoD) · **PASS** (Security) trên exact SHA `8d5e9d7ce9e9795ec1e28c56dde78d8e05d111b9`.

R3 FAIL @ `1dd2308…` **void**. R3-C1 closed by test-only inject; B1 denylist + production keyring skip **không** bị weaken. Coordinator có thể merge sau ủy quyền integration (reviewer không merge).
