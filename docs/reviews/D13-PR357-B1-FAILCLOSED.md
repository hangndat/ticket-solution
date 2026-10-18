# D13 — PR #357 B1 fail-closed denylist fix (#351)

| Field | Value |
| --- | --- |
| Worker / session | Orca `term_e0de8959-e562-4121-b356-52718934bf16` · Role `backend` · task `task_8d238abbd471` |
| Scope | Issue **#351** · PR **#357** · BE `packages/backend` (+ API path via `createPrismaIdentityUserRepository`) |
| Architecture impact | **Có** — R3 denylist fail-closed |
| Base tip (pre-fix) | `a0eb3cb15c3c9c6e216ae499a72083fd269d9cb6` |
| Finding | Security review B1 — `assertIdentityAllowedForUpsert` fail-open on missing/invalid keyring after COMPLETED |

## What changed

1. **`assertIdentityAllowedForUpsert`** — consult `account_deletion_unexpired_tombstone_key_ids()`; missing/invalid keyring **denies** when any live digests exist; allows only when zero live tombstones (dev placeholder). Required historical `key_id` absent from ring → deny (no silent skip). Alerts sanitized (`code` / `operational_reason` / live key count only — no secrets/subjects).
2. **`readTombstoneKeyring`** — invalid JSON / empty array alert + throw `KEYRING_INVALID` (never coerce to empty usable ring).
3. **Migration `202610180005_d13_sec2_tombstone_key_guard`** — DEFINER helper listing distinct unexpired tombstone key ids for runtime.
4. **`createAccountDeletionRequest`** — `requested_at = clock_timestamp()` so host/Docker clock skew cannot hide rows from `list_due`.
5. **Regression** — B1 completed→unset/invalid/old-key-missing→deny; retained key deny; zero-tombstone unset allow; keyring parse unit cases.
6. **Keycloak HTTP fixture** — `test/keycloak-erasure-http.test.cjs` proves token + Bearer DELETE 204 + user absence + PATH_404 (isolated `http.createServer`, not production IdP).

## Checks (local, isolated Docker PG)

```text
pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test --test-concurrency=1 \
  test/account-idp-erasure.test.cjs \
  test/keycloak-erasure-http.test.cjs
→ 11 pass / 0 fail

# Also:
node --test --test-concurrency=1 test/account-session-revoke.test.cjs test/oidc.test.cjs
```

## Limitations

- Live production Keycloak DELETE still not exercised (fixture HTTP only).
- ACK #352 / PR session-revoke not edited (separate).
- No root env/CI/lockfile/contract changes; compose empty keyring placeholder remains — API now fail-closes when digests exist.
- Exact tip SHA after push recorded in commit / worker_done body.
