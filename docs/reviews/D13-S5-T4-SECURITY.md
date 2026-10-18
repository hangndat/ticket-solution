# D13-S5-T4 — Security review (authz deletion / demo roles)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_620cd00e-fea8-4f86-8ec8-bd21ad1dc405` · dispatch `ctx_46f584f2d81c` · task `task_1c7b4754046c` · Role `reviewer-security` (`docs/agents/roles/reviewer-security.md`) · Agent cursor · **≠** implementer |
| Scope | Issue **#331** · Parent Story **#309** / Epic **#301** · Security revalidation of S5 deletion + demo paths on main tip |
| Architecture impact | **Không** — review only; đối chiếu handoff đã merge (`docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md`) |
| **Exact commit SHA** | **`9910173dc1c4f016448e2bc230ab6843c419b315`** (`git rev-parse` = Issue #331 unblock comment target) |
| Ancestry (security merges) | PR **#352** ACK revoke `a0a4c99a…` · PR **#357** IdP erasure `d5896f48…` · PR **#361** demo reviewer `6679242…` — all ancestors of tip |
| Prior security (superseded tip, still valid invariants) | PR #352 R2 PASS @ `626b860…` · PR #357 R4 PASS @ `8d5e9d7…` |
| Verdict Security | **PASS** |

## Threat / abuse cases examined

1. **ACK treated as erasure** — client/API claims complete wipe before worker + IdP finish.
2. **IDOR / cross-user deletion** — call `/me/account-deletion-requests` for another `userId`.
3. **Gate session linger** — ACTIVE `staff_sessions` after ACK; race open-session vs ACK revoke (SEC-R1).
4. **PG-only COMPLETED** — scrub without Keycloak DELETE / missing keyring (SEC-2 weaken).
5. **Replay after erase** — re-login / identity upsert with same issuer+subject after tombstone.
6. **Issuer/subject confusion** — IdP DELETE against wrong realm / non-UUID subject / email fallback.
7. **Demo privilege escalation** — App Review accounts become platform owner / `ticket-platform-*`.
8. **Secrets in git** — prod IdP passwords, erasure client secret, tombstone keyring material.

## Findings (by scope)

### 1. ACK ≠ erasure

- API ACK returns `state: 'REQUESTED'` + `anonymizeWithinDays` only (`createAccountDeletionRequest`); never `COMPLETED`.
- Web BFF comment + body: POST is ACK only; requires `confirmation:true` + CSRF + UUID idempotency (`apps/web/app/api/bff/me/account-deletion-requests/route.ts`).
- iOS copy guards forbid “đã xóa” / deleted claims and internal jargon (`account-deletion-copy.ts`).
- SEC-2: `apply_account_anonymization` sets `pg_applied_at` path **without** public COMPLETED until `finalize_account_deletion_idp` (`DELETED`/`NOT_FOUND`).

**Verdict:** OK — no blocker.

### 2. IdP delete + denylist

- Worker `processDueAccountAnonymizations`: mint tombstone **before** PG scrub; missing keyring/IdP → mark fail + `continue` (no PG-only COMPLETED).
- Issuer allowlist = exact `OIDC_ISSUER`; subject must be UUID (no username/email DELETE fallback).
- `assertIdentityAllowedForUpsert` wired on every `upsertFromVerifiedIdentity` — open deletion **or** live tombstone digest → `UNAUTHENTICATED`; missing keyring with live digests fails closed (B1).
- Tombstone secrets from env JSON only — no hardcoded keyring material in source.

**Verdict:** OK — aligns with prior PR #357 R4 PASS; production Keycloak DELETE still HTTP-fixture in CI (known gap, non-blocking).

### 3. `staff_sessions` revoke

- ACK path: `revoke_sessions_for_user` in same `withActor` tx as REQUESTED insert (failure rolls back ACK).
- Apply path: idempotent revoke again.
- `assert_can_open_staff_session` + BEFORE INSERT trigger share advisory lock `lock_user_session_mutation` (SEC-R1 TOCTOU closed).
- App maps `ACCOUNT_DELETION_OPEN` on `openStaffSession`.

**Verdict:** OK.

### 4. Demo / reviewer roles privilege

- Docs + S5-T2 evidence: fixture/review staff limited to membership `STAFF` + `{gate.confirm,gate.undo}` on demo tenant `uat-device`.
- Explicit ban: escalate demo → platform owner / `ticket-platform-*` audience.
- Dedicated `review-*@vemoki.com` passwords **not** in git (VPS `mode 600` only).
- Fixture passwords `attendee-demo` / `staff-demo` published as **realm import fixtures** (not treated as prod secrets); ops rotate dedicated review passwords per ASC cycle.

**Verdict:** OK for authz scope — no privilege escalation path in code/docs beyond intended Gate demo.

### 5. Hardcoded secrets

- Grep of deletion/demo paths at tip: no `client_secret=…`, private keys, or VPS ASC password values in git.
- Erasure client secret / tombstone keyring read from env; misconfig alerts omit secret material.
- Realm fixture demo passwords in `docs/asc/app-review-notes.md` are intentional public fixtures (documented).

**Verdict:** OK.

### 6. RLS / membership deny-by-default (deletion endpoints)

- HTTP: `/v1/me/account-deletion-requests*` uses `selfActor` (standard OIDC `ticket-api` audience) — **not** `platformActor`; `userId` from verified bearer only (no client-supplied target user).
- DB: `account_deletion_requests` **FORCE RLS**; policy `account_deletion_actor` = `user_id = app.actor_id` (set via `withActor`).
- Worker apply/finalize are `SECURITY DEFINER` with `REVOKE ALL … FROM PUBLIC` + `GRANT … TO ticket_runtime` (expected privileged pipeline; not exposed as public SQL).
- Membership/RBAC for Gate remains separate deny paths (`openStaffSession` + deletion-open assert); demo staff is capability-scoped, not platform.

**Verdict:** OK.

## Checks on exact SHA

```text
git rev-parse 9910173dc1c4f016448e2bc230ab6843c419b315
→ 9910173dc1c4f016448e2bc230ab6843c419b315

# Security-critical sources identical on this worktree vs tip (no post-tip drift in scope):
packages/backend/src/account-deletion.ts
packages/backend/src/keycloak-erasure.ts
packages/backend/src/tombstone-keyring.ts
apps/api/src/platform.ts (requestDeletion/selfActor)
apps/web/app/api/bff/me/account-deletion-requests/route.ts
migrations 202610180003 (ACK revoke) + 202610180004 (SEC-2 IdP)

# CI wiring at tip still shards:
test/account-session-revoke.test.cjs
test/account-ack-session-revoke.test.cjs
test/account-idp-erasure.test.cjs
(+ platform.test.cjs) under workflow shard account-deletion
```

Runtime DB suite **not** re-executed in this reviewer session (prior exact-SHA CI/local PASS on #352/#357; tip contains those merges unchanged for listed files). Source + migration + authz wiring reviewed directly.

CRG: `list_graph_stats_tool` ready; semantic nodes for AccountDeletion*; source authoritative for SECURITY DEFINER / RLS.

## Findings table

| ID | Severity | Status |
| --- | --- | --- |
| ACK≡erasure / premature COMPLETED | blocker candidate | **Absent** at tip |
| IDOR delete-other-user | blocker candidate | **Absent** (selfActor + RLS actor) |
| SEC-R1 session race | prior blocker | **Closed** (in ancestry) |
| B1 denylist fail-closed | prior blocker | **Closed** (in ancestry) |
| Demo → platform escalate | blocker candidate | **Absent** (docs + STAFF scope) |
| Secrets committed | blocker candidate | **Absent** (prod passwords VPS-only) |

## Known gaps (do not block PASS)

1. Live production Keycloak Admin DELETE not executed in CI — HTTP fixture / adapter tests only (same as PR #357 R4).
2. ASC fixture passwords are public by design for Sign-in required; dedicated review passwords remain host-local — rotate after each ASC cycle.
3. Coordinator-owned runtime keyring/SMTP/IdP erasure enablement remain ops gates (not code defects on this SHA).

## Limitations

- Security review only — no merge, no Project Status mutation, no deploy, no GitHub comment from worker (coordinator posts #331 if needed).
- Did not re-run full `database-isolation` account-deletion shard in this session.

## Verdict

**PASS** (Security) on exact SHA `9910173dc1c4f016448e2bc230ab6843c419b315`.

S5 deletion/authz surface (ACK ≠ erasure, IdP erase + tombstone denylist, ACK/apply `staff_sessions` revoke, demo role least-privilege, no hardcoded prod secrets, RLS/selfActor deny-by-default) holds at the Issue #331 review tip. Coordinator may treat security gate for #331 as satisfied pending DoD artifact/process on the same SHA.
