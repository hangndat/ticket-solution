# D13 PR #342 — DoD + Security review (Task #320)

| Field | Value |
| --- | --- |
| Reviewer roles | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` + `reviewer-security` · `docs/agents/roles/reviewer-security.md` |
| Agent / session | Cursor · Orca dispatch `ctx_e5bdfae41d42` · terminal `term_7d68f2f0-ec92-45e3-a9a2-e5ed7f1d0dfe` · task `task_1922a9190aba` |
| Independence | ≠ implementer `ctx_8031a686e54e` (done/release) |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · Task [#320](https://github.com/hangndat/ticket-solution/issues/320) · PR [#342](https://github.com/hangndat/ticket-solution/pull/342) |
| Exact SHA under review | **`8bc744e0c765db6e073628b35941115872d7af5b`** (`git rev-parse` = HEAD) |
| Artifact content commit | `de2952d33db1ffdd2c7268d5759f08eb51a6f145` (docs-only; DoD pins **PR HEAD**) |
| Architecture impact (Task) | **Không** (verify/docs) — reviewer flags open IdP/session decisions → proposed **architect** task (below) |
| Date (UTC) | 2026-10-18T07:40:41Z |
| Primary live guidance | Apple [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) · O06 `docs/DECISION-LOG.md` / `docs/ops/O06-OPTIONS.md` · `docs/asc/privacy*` · `docs/plans/D13-APP-STORE-RELEASE-PLAN.md` · BA `docs/reviews/D13-BA-PRIVACY-ELIGIBILITY.md` |

## Dual verdict (separated — do not collapse)

| Gate | Verdict | Meaning |
| --- | --- | --- |
| **A. Docs / verification accuracy** (PR #342 artifact claims vs source @ SHA) | **PASS** | Implementer map is accurate: worker **is** wired; stubs distinguished; `productionClaim=false` honest; local platform+RLS evidence reproducible |
| **B. Full account-deletion / retention / safety release gate** (D13 store / App Review honesty + post-delete access) | **FAIL** | Mandatory gaps: (1) `staff_sessions` not revoked after anonymize → stale Gate access; (2) Keycloak IdP account not delete/disable → re-login recreates app user; **not** waivable as “known gap” for store submit |
| **C. Merge of this docs-only PR** | **Allowed after coordinator policy** | Docs PASS does **not** clear gate B; do **not** mark store / S2 production-ready from this PR alone |

**Overall for coordinator:** treat DoD docs verify as **PASS**; treat account-deletion **release gate as FAIL** → escalate fix + architect; **do not** Hoàn thành D13 deletion safety on this SHA.

---

## 1. Checks (exact SHA)

```bash
git rev-parse HEAD
# 8bc744e0c765db6e073628b35941115872d7af5b

git merge-base --is-ancestor 0a65f3c2f2d51357ee1a6270151d279758188fb7 HEAD && echo ANCESTOR_OK
# ANCESTOR_OK

pnpm --filter @ticket/contracts build && pnpm --filter @ticket/backend build
cd packages/backend && node --test test/platform.test.cjs test/rls-catalog.test.cjs
```

Result (this reviewer worktree, isolated Docker Postgres — **not** production):

```text
✔ platform provision/invite/suspend/support/deletion acceptance
✔ every tenant table is FORCE RLS and ticket_runtime has no BYPASSRLS
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

CI on SHA (GitHub check-runs API): `changes` success · `ci` success · ownership jobs `skipped` (docs-only path filter). GraphQL `gh pr checks` rate-limited at review time — used REST check-runs.

CRG: `list_graph_stats_tool` available but graph `built_at_sha` / worktree mismatch → semantic miss on `processDueAccountAnonymizations`; **source + lean-ctx + `rg` used** (same limitation as implementer).

---

## 2. Source verification (claims vs code @ SHA)

### 2.1 Wired path — **confirmed**

| Claim | Evidence @ `8bc744e0…` |
| --- | --- |
| `POST /v1/me/account-deletion-requests` uses verified OIDC identity | `apps/api/src/platform.ts` `selfActor` → `identityVerifier.verifyBearerToken` → `upsertFromVerifiedIdentity`; `requestDeletion` → `createAccountDeletionRequest` |
| ACK schedules O06 ≤30d | `packages/backend/src/account-deletion.ts` + `retention-o06.ts` (`O06_ACCOUNT_ANONYMIZE_MAX_DAYS=30`, policy `O06-2026-10-18`) |
| Worker calls anonymize (not ACK-only) | `apps/worker/src/index.ts` poll tick L79 + `relayOnce` L108 → `processDueAccountAnonymizations(db, 50)` |
| SQL list/apply SECURITY DEFINER; audit not DELETE | Migration `packages/backend/prisma/migrations/202610180001_d12_o06_account_anonymize/migration.sql` — comment + no `DELETE FROM audit_*`; EXECUTE granted to `ticket_runtime` |
| Idempotent retry | `COMPLETED` → `out_applied=false`; platform test second pass `applied=0` |
| Ticket/object retention stubs | `processDueTicketPiiAnonymizations` / `processDueObjectRetentions` → `NO_JOB_FRAMEWORK` only — **not** falsely claimed as enforced |
| Deploy marker ancestry | `0a65f3c…` is ancestor of tip |

### 2.2 Gaps — **confirmed in source** (not docs fiction)

#### Finding SEC-1 — **P1 / fix-before-store** — `staff_sessions` not revoked

- **Codepath:** `apply_account_anonymization` updates `users` (clear email, rotate `subject` → `anon:<requestId>`), revokes `device_tokens`, nulls `event_attendees.canonical_email`, sets request `COMPLETED`. **No** `UPDATE staff_sessions … status='REVOKED'`.
- **Consumer still trusts ACTIVE sessions:** `packages/backend/src/gate.ts` `assertSessionActive` requires `status='ACTIVE' AND revoked_at IS NULL` for `user_id` — anonymized `users.id` is **preserved** (FK).
- **Reproduction (logic):**
  1. Staff opens Gate session → `staff_sessions` ACTIVE for `user_id=U1`.
  2. U1 completes account-deletion request → worker applies anonymize.
  3. `device_tokens` revoked; IdP/app push cleared; **staff_sessions for U1 remain ACTIVE**.
  4. Subsequent Gate reserve/confirm with that `sessionId` still passes `assertSessionActive`.
- **Impact:** Stale staff Gate access after “account deleted” — violates account-deletion **safety** and App Store 5.1.1(v) expectation that deletion is not mere deactivate of push/email while privileged ops continue.
- **Blocked consumers:** Gate/offline staff path (`apps/api` gate + `apps/mobile` Gate); D13 S5 account-deletion honesty; any claim “access revoked on delete”.
- **Fix ownership:** BE coding Task (migration/helper) — revoke all ACTIVE `staff_sessions` for `v_user_id` inside `apply_account_anonymization` (or equivalent transaction). **Not** waived as known gap.

#### Finding SEC-2 — **P1 / architect+ops** — Keycloak IdP account not delete/disable

- **Codepath:** No Keycloak Admin API / disable/delete in worker, `account-deletion.ts`, or apply SQL (search @ SHA: none).
- **Re-login recreate:** SQL comment + platform test: after subject rotate, same OIDC `(issuer, subject)` `upsertFromVerifiedIdentity` creates **new** `users` row (`assert.notEqual(reReg.userId, attendee.userId)`).
- **Impact vs Apple primary guidance:** Initiation-in-app + ≤30d anonymize can satisfy “reasonable time” **if** communicated; keeping IdP credentials + allowing silent recreate means **account is not erased at the identity provider** — closer to app-row anonymize than full account deletion. Privacy copy (`docs/asc/privacy-policy-draft.md`) describes app anonymize ≤30d and does **not** claim IdP wipe — honesty OK for docs, **insufficient** to declare full-deletion release gate PASS.
- **Blocked consumers:** Store submit / App Review notes claiming complete deletion; ops Keycloak lifecycle; possible architect ADR on IdP erase vs app-only anonymize.
- **Proposal:** Spawn Role `architect` Task — decide IdP disable vs delete vs documented-exception; if erase required, BE+ops Task with Admin API + secrets handling. Do **not** invent design in this review.

#### Finding SEC-3 — **P2 / should-fix** — worker swallows anonymize errors

- `apps/worker/src/index.ts` empty `catch` around `processDueAccountAnonymizations` — requests stay `REQUESTED` (retry OK) but **no** structured failure signal/metrics. Reliability/ops visibility; not the primary release blocker vs SEC-1/2.

#### Finding DOC-1 — **nit** — Tip SHA field vs PR HEAD

- Artifact lists Tip SHA `de2952d…` then correctly instructs DoD to use **PR HEAD**; HEAD is `8bc744e…`. Accurate enough; prefer pinning HEAD in the Tip SHA cell next docs edit.

### 2.3 What is **not** a release-blocker for *account* deletion path

- Ticket PII 365d / object 90d `NO_JOB_FRAMEWORK` — O06 policy documented, enforcement incomplete; **separate** from account anonymize path (artifact correctly separates). Still a **retention** gap for full O06 enforcement, tracked elsewhere — does not alone FAIL docs verify of account path.
- `productionClaim=false` — correct; this PR does **not** prove prod worker is polling anonymize. Story S2 “prod runtime” remains open without prod smoke evidence.

---

## 3. Threat / abuse cases considered (security)

| Case | Result @ SHA |
| --- | --- |
| Unauthenticated deletion ACK | Fail-closed without OIDC (`identityVerifier` required) |
| Cross-user deletion | `withActor` + `user_id` from verified token |
| Double apply / race | `FOR UPDATE` + COMPLETED → `applied=false` |
| Audit wipe via delete | Explicitly not deleted (TTL 730d) |
| Re-login after anonymize | New user row — intentional subject rotate; IdP still alive (SEC-2) |
| Staff continues Gate after delete | **Open — SEC-1** |
| RLS / BYPASSRLS on runtime | Catalog test PASS; DEFINER owned by `migration_owner` |

---

## 4. Verdict summary

| Role lens | Verdict |
| --- | --- |
| DoD — artifact/PR #342 accuracy + Task #320 “path wired” evidence | **PASS** |
| Security — account deletion safety / IdP completeness for D13 release | **FAIL** |
| PASS with known gap? | **No** for gate B — mandatory staff revoke + unresolved IdP decision |

### Coordinator actions (escalate)

1. **Do not** treat PR #342 / Task #320 as clearing D13 account-deletion **release gate**.
2. Open BE fix Task: revoke `staff_sessions` (and review other live sessions/tokens) in `apply_account_anonymization` @ follow-up SHA; revalidation required.
3. Open **architect** Task: IdP Keycloak delete/disable vs documented app-only anonymize for 5.1.1(v) + O06; list exact consumers blocked (App Review notes, Keycloak ops, re-login UX).
4. Docs PR merge: optional (docs PASS); keep Project Task #320 from claiming store-ready production deletion until gates B fixed + evidence.

### Non-goals honored

- No `apps/**` / implementation edits in this review.
- No production DB / secrets / mutate / kill worker DB.
- No merge of reviewed branch by reviewer.
- No waiver of mandatory security via “known gap”.
