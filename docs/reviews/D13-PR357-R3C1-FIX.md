# D13 — PR #357 R3-C1 fix (#351)

| Field | Value |
| --- | --- |
| Worker / session | Orca `term_2da82c6c-2f6f-4932-a16a-07d409f025aa` · Role `backend` · task `task_2cdea8bbaf16` · dispatch `ctx_fad38d13332a` |
| Scope | Issue **#351** · PR **#357** · BE `packages/backend/test` |
| Architecture impact | **Có** — reconcile SEC-2 keyring gate with merged SEC-1 ACK apply (#352) |
| Prior tip (R3 FAIL) | `1dd2308e1387c3a7d7feb2baeb77f3a20cdb3dfe` |
| Prior review | R3 FAIL @ tip — blocker **R3-C1** (PR comment 2026-10-18) · artifact cited `docs/reviews/D13-PR357-R3-DOD-SECURITY.md` |
| Behavior / fix SHA | `c59a6c9c32994bed27c06e0e3a308fe733f89530` |
| **Exact tip SHA** | `4576f9b5c39a2dd32c706b2a6498487059549cd1` |

## Blocker R3-C1

After rebase onto `main` + merged ACK #352, suite `account-ack-session-revoke.test.cjs` called `processDueAccountAnonymizations(db, 50)` **without** synthetic tombstone keyring.

SEC-2 due-worker: missing/invalid keyring → alert + mark `IDP_KEYRING_MISSING` + **skip** `prepareSnapshotAndApply` (tombstone mint is required before PG scrub). Result: `processed.applied === 0` vs expect `1`. CI shard `database-isolation (account-deletion…)` red @ `1dd2308`.

B1 upsert fail-closed when keyring missing + live tombstones remained correct (R3 confirmed).

## Fix (minimal — no B1 weaken)

Inject ACK-suite process options mirroring `account-session-revoke.test.cjs`:

- Synthetic `TOMBSTONE_ENV` (`OIDC_ISSUER` + current key id + keyring JSON)
- `keyring: readTombstoneKeyring(…)`
- Fake IdP `DELETED` (ACK asserts **apply** idempotence, not COMPLETED exclusivity)

**Unchanged:**

1. B1 `assertIdentityAllowedForUpsert` fail-closed denylist when keyring missing/invalid + live digests
2. Production skip of PG apply when worker keyring unset (mint-before-scrub invariant; COMPLETED still iff PG+IdP)
3. `packages/backend/package.json` `test:db` and `.github/workflows/ci.yml` account-deletion shard still list **both** `account-ack-session-revoke` **and** `account-idp-erasure`

## Checks (local, isolated Docker PG)

```text
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test --test-concurrency=1 \
  test/account-ack-session-revoke.test.cjs \
  test/account-idp-erasure.test.cjs \
  test/account-session-revoke.test.cjs
→ 13 pass / 0 fail
```

Includes B1 regression + ACK apply `applied=1` + IdP matrix.

## Limitations

- No production path change for unset keyring (still no PG scrub until keyring present) — intentional: denylist digest must mint before scrub.
- Live Keycloak DELETE still ops/fixture-only.
- Do not merge from this worker; coordinator revalidation **R4** on new tip SHA required (R2/R3 void after behavior commit).

## Exact tip SHA

```text
git rev-parse HEAD
→ 4576f9b5c39a2dd32c706b2a6498487059549cd1

# evidence blob @ 9754352
→ 975435260dc015e663d2d8530b355040adcc1017

# behavior (ACK keyring inject)
→ c59a6c9c32994bed27c06e0e3a308fe733f89530
```
