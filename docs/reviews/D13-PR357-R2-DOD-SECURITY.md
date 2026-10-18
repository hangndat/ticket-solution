# D13 — PR #357 R2 DoD + security revalidation (#351)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_8508afe6-b994-48e7-bbac-3445496169ec` · roles `reviewer-dod` + `reviewer-security` · ≠ implementer (`d13-be-idp-erasure` / B1 fix `term_e0de8959…`) |
| Scope | Issue **#351** · PR **#357** · BE `packages/backend` (+ API identity upsert gate, worker IdP pipeline) |
| Architecture impact | **Có** — SEC-2 Keycloak erase + fail-closed tombstone denylist; đối chiếu `docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` §5 (D2/D4/D6, R3) |
| Prior review | FAIL @ `a0eb3cb15c3c9c6e216ae499a72083fd269d9cb6` — blocker **B1** (denylist fail-open when keyring missing/invalid after COMPLETED) · PR comment 2026-10-18 |
| Fix commit | `f8c17c730016f1dca07aed00bd0cd4127ef2f1d8` — `fix(backend): fail-closed tombstone denylist when keyring missing (B1)` |
| **Exact tip SHA** | **`f8c17c730016f1dca07aed00bd0cd4127ef2f1d8`** (`git rev-parse` = PR `headRefOid`) |
| Verdict DoD | **PASS** |
| Verdict Security | **PASS** |

## B1 closure (required for PASS)

Prior FAIL: `assertIdentityAllowedForUpsert` returned after alert when keyring missing/invalid → after `COMPLETED`, open-request gate gone → upsert same `(issuer,sub)` possible under misconfigured/empty compose keyring.

Tip evidence:

1. **`assertIdentityAllowedForUpsert`** — loads `account_deletion_unexpired_tombstone_key_ids()`; on `TombstoneKeyringError`, if any live key ids → `denyUpsertForDenylist()`; allow-unset only when zero live tombstones.
2. **Historical key absent** from ring → deny (no silent skip of digests minted under dropped key).
3. **`readTombstoneKeyring`** — invalid JSON / empty array throw `KEYRING_INVALID` (never coerce to usable empty ring); missing env → `KEYRING_MISSING`.
4. **Migration `202610180005_d13_sec2_tombstone_key_guard`** — DEFINER helper returns distinct unexpired `subject_tombstone_key_id` only (no digests/subjects).
5. **Regression** — `SEC-2 B1: completed → unset/invalid/old-key-missing keyring denies upsert; retained old key denies` + keyring parse unit cases **pass** on tip.

Handoff R3 (“Missing/empty required keyring … → fail closed + alert”) **met** for denylist verify path when live digests exist.

## Architecture / handoff đối chiếu

| Handoff gate | Tip @ `f8c17c7` |
| --- | --- |
| D2/D4 — `COMPLETED` iff PG + IdP `DELETED`/`NOT_FOUND`; disable ≠ terminal | Tests T4/T5 COMPLETED; T7 `DISABLED_PENDING_DELETE` stays `REQUESTED` / `completed=0` |
| D5 — issuer allowlist; delete by UUID `sub`; no fuzzy email | Covered T12/T13 + `keycloak-erasure` Admin-by-id |
| D6 / R1 — bounded denylist + OIDC ≤24h+5m | T16 + T9/T17; TTL 48h after IdP terminal |
| R3 — HMAC keyring fail-closed | **B1 closed** as above |
| T6 — path/config 404 ≠ user absence | T6 + HTTP fixture `IDP_PATH_404` |
| SEC-1 apply revoke | `account-session-revoke.test.cjs` pass (ACK #352 still separate) |

No design drift requiring separate architect blocker for this tip.

## Checks on exact tip

```text
git rev-parse HEAD
→ f8c17c730016f1dca07aed00bd0cd4127ef2f1d8

pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test --test-concurrency=1 \
  test/account-idp-erasure.test.cjs \
  test/keycloak-erasure-http.test.cjs
→ 11 pass / 0 fail

node --test --test-concurrency=1 \
  test/account-session-revoke.test.cjs \
  test/oidc.test.cjs
→ 3 pass / 0 fail

CI Actions run 39112717530 head f8c17c730016f1dca07aed00bd0cd4127ef2f1d8 → success
  (incl. database-isolation account-deletion shard)
```

Secrets: tip `.env.example` / compose use empty placeholders for erasure secret + keyring; no private-key / `sk_live_` material in behavior paths. Test secrets are synthetic `Buffer.alloc`.

## Findings

| ID | Severity | Status |
| --- | --- | --- |
| B1 | Blocker (prior) | **Closed** @ `f8c17c7` with source + tests + CI |

No new blockers on tip.

## Known gaps (accepted; không nuốt B1 / acceptance)

- Live production Keycloak DELETE không chạy trong PR — HTTP fixture + fake adapter only; ops gate trước `KEYCLOAK_ERASURE_ENABLED=1`.
- ACK-time revoke (#352) vẫn tracker riêng; apply-path SEC-1 covered.
- Compose default empty keyring vẫn placeholder — **sau B1** denylist fail-closed khi còn live digests; mint/COMPLETED cũng không tiến khi worker thiếu keyring.

## Limitations (review process)

- CRG MCP `detect_changes`/`list_graph_stats` trong session này resolve graph DB lệch worktree (built SHA ≠ tip); review neo **source @ tip** + lean-ctx + local/CI tests.
- Không merge / không đổi Project Status / không deploy (theo Spec).

## Verdict

**PASS** (DoD) · **PASS** (Security) trên exact SHA `f8c17c730016f1dca07aed00bd0cd4127ef2f1d8` — B1 closed with evidence; IdP DELETE/NOT_FOUND terminal semantics, denylist re-login block, tests+CI green, no secret commits.
