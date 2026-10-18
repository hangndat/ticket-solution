# D13 PR #346 — DoD + Security review (Task #344 handoff)

| Field | Value |
| --- | --- |
| Reviewer roles | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` + `reviewer-security` · `docs/agents/roles/reviewer-security.md` |
| Agent / session | Cursor · Orca dispatch `ctx_4d436bb9fc88` · terminal `term_472ef3c3-08d2-4899-99bf-49107d0bcdb5` · task `task_3e865fda5d6e` |
| Independence | ≠ architect author dispatch `ctx_7b2d0969ad4c` / `task_15b4e41e7e26` (handoff tip); ≠ SEC-1 implementer #345 |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · Issue [#344](https://github.com/hangndat/ticket-solution/issues/344) · PR [#346](https://github.com/hangndat/ticket-solution/pull/346) |
| Path under review | **`docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` only** (companion `docs/reviews/D13-BE-ACCOUNT-DELETION-VERIFY.md` in same PR **not** re-reviewed here) |
| Exact SHA under review | **`ab3f3c48a788cf6927026f573e42918ae48c12ef`** (`git rev-parse` = PR `headRefOid` = worktree HEAD) |
| Architecture impact | **Có** — account deletion spanning PostgreSQL + Keycloak |
| Date (UTC) | 2026-10-18T07:57:58Z |
| Primary docs browsed | Apple [5.1.1(v) account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) · Keycloak Admin REST [`DELETE /admin/realms/{realm}/users/{user-id}`](https://www.keycloak.org/docs-api/latest/rest-api/index.html) (+ source `UserResource.deleteUser` → **204**) · O06 `docs/DECISION-LOG.md` · prior `docs/reviews/D13-PR342-DOD-SECURITY.md` |

## Dual verdict (do not collapse)

| Gate | Verdict | Meaning |
| --- | --- | --- |
| **A. Architect handoff vs Issue #344 AC** (decisions, ordering/failure, paths, tests; no fabricated API; O06 numbers untouched) | **PASS with known gap** | I2 DELETE ≤30d, COMPLETED=PG+IdP, allowlist issuer, lease, SEC-1 A+R1+R2, regression matrix T1–T15 are actionable for BE-S2 **except** privacy denylist retention/pepper |
| **B. Security design sufficiency** (erasure + privacy promise D6 + session revoke vs SEC-1) | **FAIL** | §5.4 defaults to **indefinite** `subject_tombstone_digest` retention “until separate ADR” while D6 claims **minimal** retention — **must not** approve indefinite retention by silence; pepper/rotation/canonicalization unspecified |
| **C. Claim “Đủ để triển khai trong scope” / spawn BE-S2 without revision** | **FAIL** until coordinator records concrete digest TTL + pepper decisions (or handoff conclusion narrowed + §5.4 rewritten) |

**Overall for coordinator:** treat **I2 / COMPLETED / issuer / lease / SEC-1** as sound design direction; **do not** merge-as-complete or spawn BE-S2 claiming privacy denylist done until **Decisions R1–R5** below are chốt and reflected in the handoff tip (new SHA → revalidation). Store full-deletion release gate remains blocked on landed SEC-1+SEC-2 impl (unchanged).

---

## 1. Checks (exact SHA)

```bash
git rev-parse HEAD
# ab3f3c48a788cf6927026f573e42918ae48c12ef

gh api repos/hangndat/ticket-solution/pulls/346 --jq .head.sha
# ab3f3c48a788cf6927026f573e42918ae48c12ef

gh api repos/hangndat/ticket-solution/commits/ab3f3c48a788cf6927026f573e42918ae48c12ef/check-runs \
  --jq '[.check_runs[]|select(.name=="ci" or .name=="changes")|{name,conclusion}]'
# [{"name":"ci","conclusion":"success"},{"name":"changes","conclusion":"success"}]
# ownership / runtime jobs skipped (docs path filter) — expected
```

Docs-only: **no** runtime platform/RLS re-run required for this review. Source baseline facts still pinned to `8bc744e0c765db6e073628b35941115872d7af5b` (PR #342) — not re-executed here.

CRG: `list_graph_stats_tool` OK; review is architecture-doc — source/API claims cross-checked via Apple + Keycloak primary docs + prior SEC review, not graph-driven code edits.

---

## 2. Checklist vs task / Issue #344

| Requirement | Result @ `ab3f3c48…` |
| --- | --- |
| Actual Keycloak **DELETE** within ≤30d; disable-only insufficient | **PASS** — D3/D4 + §5.1 Apple primary wording; I1 non-terminal; COMPLETED requires `DELETED`/`NOT_FOUND` |
| Issuer/sub mapping; trusted realm routing; no SSRF issuer | **PASS** — D5 + §3.4–5 + §5.6 allowlist + fixed Admin base/realm |
| Worker-only least-privilege credentials | **PASS** — §5.7 `vemoki-erasure`, worker-only secret, no `realm-admin` |
| Retry / lease / idempotency | **PASS** — lease columns + matrix T8/T11; 404 after delete → `NOT_FOUND` OK |
| Durable **COMPLETED** = PG anonymize **and** IdP DELETE/absence | **PASS** — D2 + §5.3 terminal rule; disable ≠ COMPLETED |
| Old JWT / re-login protection | **PASS direction** — open `REQUESTED` + tombstone digest after verify; **gap** on digest durability (below) |
| Deletion observability without PII | **PASS direction** — sanitized `idp_last_error_code` enum; **should-fix** stuck-SLA metrics not specified (carry SEC-3 theme) |
| No fabricated public API / no OpenAPI widen | **PASS** — keeps public state enum; internal flags only; paths under `packages/backend` + worker |
| O06 numbers unchanged | **PASS** — 30d / 730d audit / ticket·object out of scope |
| Digest tombstone retention / pepper vs privacy promise | **FAIL** — see §3 |
| ACK vs apply session revoke vs original SEC-1 | **PASS with notes** — see §4 |

Apple primary (browsed 2026-10-18): *“only offering to temporarily deactivate or disable an account is insufficient”* — handoff citation accurate; I2 choice correct.

Keycloak primary: Admin `DELETE …/users/{id}` success → **204 No Content** (OpenAPI/Javadoc/`UserResource.deleteUser`). Handoff 204/200 + confirmed-absence via GET-by-id 404 after allowlisted path is sound; **do not** treat Admin/realm base-path 404 as user `NOT_FOUND` (already specified — keep in BE tests T5/T6).

---

## 3. Finding SEC-D1 — **P1 / fix-before-BE-S2 privacy claims** — tombstone retention & pepper under-specified

**Evidence:** §5.4 proposes keep `subject_tombstone_digest` on COMPLETED rows **until a separate ADR**, while D6 says “minimal retention khớp O06 — không giữ original PII vô hạn”. Digest is not plaintext sub, but **indefinite retention is still a retention decision**. Pepper rotation is mentioned only as “digest vô hiệu → chấp nhận theo ops” with **no** dual-pepper window, storage, or canonical HMAC bytes.

**Why this fails the privacy promise gate:** Approving the tip as-is would accidentally authorize **indefinite denylist retention** and undefined pepper ops — incompatible with D6 “minimal” without an **explicit** exception.

### Required concrete decisions (coordinator — record in handoff tip, then revalidate SHA)

| ID | Decision needed | Options (pick one; do not leave “until ADR”) |
| --- | --- | --- |
| **R1 Digest TTL** | How long keep digests after COMPLETED? | **(a)** Explicit forever denylist (document privacy exception: non-reversible HMAC, purpose=anti-recreate; not “forgot to set TTL”); **(b)** TTL = access-token max lifetime + skew (e.g. 1h/24h — weak if refresh/offline long); **(c)** TTL = O06 audit **730d** then purge job; **(d)** other numeric TTL with purge owner |
| **R2 Storage shape** | Where + how to purge? | Column on `account_deletion_requests` **or** dedicated `identity_denylist(digest, created_at)` with unique index + TTL job |
| **R3 Pepper** | Secret lifecycle | Env name(s) readable by **API + worker** (both verify); never commit; rotation = **two active peppers** during window N hours/days; after window old digests either re-HMAC’d or accepted dropped per R1 |
| **R4 Canonical HMAC** | Exact bytes | e.g. `HMAC-SHA256(pepper, utf8(issuer) \|\| 0x00 \|\| utf8(sub))` + issuer normalization rule (trailing `/`?) — freeze before coding |
| **R5 REJECTED after ACK revoke** | Session restore? | Confirm **stay revoked** (fail-closed) **or** restore ACTIVE on `REJECTED` — affects SEC-1 R1 product semantics |

Until R1–R4 are written into the handoff, BE-S2 **must not** invent “keep forever” as compliance.

---

## 4. SEC-1 — ACK vs apply revoke (vs original PR #342 SEC-1 AC)

| Item | Assessment |
| --- | --- |
| Original SEC-1 AC | After anonymize, no ACTIVE `staff_sessions` → Gate `assertSessionActive` fail-closed |
| Handoff A + R1+R2 | **Stronger** than AC: revoke at ACK **and** idempotent apply — closes worker-tick window; soft-check-only correctly rejected |
| Risk | ACK path must be **atomic / fail-closed**: if revoke helper fails, do not leave `REQUESTED` without revoke (or roll back ACK). Cross-tenant SECURITY DEFINER + owner policy still required (unchanged) |
| Reject path | Not specified — see **R5** |
| Independence from IdP | Correct — BE #345 unblocked |

**Verdict on SEC-1 design:** sufficient to implement; not a FAIL. BE #345 should treat R1 failure as ACK failure (actionable note, not architect rewrite blocker).

---

## 5. Threat / abuse cases (design)

| Case | Handoff coverage |
| --- | --- |
| Client-supplied issuer → SSRF Admin | Mitigated (allowlist + fixed base URL) |
| Fuzzy email/username delete wrong user | Forbidden; ops blocker if sub≠userId mapping unclear |
| Disable-only marked COMPLETED | Forbidden by terminal rule |
| Concurrent double DELETE | Lease; second 404 → `NOT_FOUND` OK |
| Path/config 404 → false COMPLETED | Distinguished from user absence — good |
| Secret in API process | Worker-only — good |
| PII in IdP error logs | Sanitized codes — good |
| Indefinite digest / pepper loss | **Open — SEC-D1** |
| Stale Gate session after ACK | Covered by R1+R2 design |

---

## 6. Actionable BE-S2 handoff (after R1–R4 chốt)

Do **not** invent new public REST. Implement against confirmed design:

1. Migration: internal columns §5.3 (+ denylist table if R2 says so); no public enum widen.
2. `packages/backend/src/keycloak-erasure.ts`: allowlisted Admin client; resolve by id (prefer `sub` == Keycloak id); if username≡sub contract, use Admin query **`username` + `exact=true`** (official list-users filters) — prefer that over ambiguous `q=username:` wording in §5.6.
3. Worker: lease → PG apply → optional disable/logout → DELETE → scrub `original_*` → COMPLETED only on terminal IdP success.
4. `upsertFromVerifiedIdentity` + post-JWT API gate: deny open REQUESTED **or** digest hit (R1–R4).
5. Tests T4–T15; fake IdP adapter; no real Keycloak required in CI.
6. `.env.example` placeholders only for erasure client + pepper — never real secrets.

**Still blocked for store release:** SEC-1 merged + SEC-2 I2 COMPLETED semantics live (handoff §5.8) — this review does not clear that gate.

---

## 7. Findings summary

| ID | Severity | Gate |
| --- | --- | --- |
| SEC-D1 | **P1** — digest TTL / pepper / canonicalization / storage under-specified; indefinite default must not be approved | B+C **FAIL** |
| SEC-D2 | should-fix — stuck `REQUESTED` past ≤30d SLA observability (metrics/alert) not specified | Hardening |
| DOC-1 | nit — §5.6 `q=username:` → prefer official `username`+`exact=true` when documenting ops contract | Nit |
| DOC-2 | info — PR also adds verify doc; out of this review scope | Info |

**No** fabricated endpoints found. **No** O06 number changes. Apple disable-insufficient correctly applied.

---

## 8. Out of scope (honored)

- No code/contract edits; no merge; no deploy; no Project Status updates.
- Did not review own future BE-S2 implementation.
- Did not re-judge PR #342 code SHA (baseline facts trusted from prior artifact).

## Verdict

**FAIL** (security / privacy denylist readiness + overstated “đủ triển khai”) with **PASS with known gap** on erasure pipeline design (Gate A).

Coordinator next: chốt **R1–R5** → architect amends handoff → **revalidation on new tip SHA** → then BE-S2 may proceed without inventing retention.
