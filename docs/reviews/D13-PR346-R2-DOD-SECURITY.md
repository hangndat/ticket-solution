# D13 PR #346 — Revalidation R2 DoD + Security (Task #344)

| Field | Value |
| --- | --- |
| Reviewer roles | `reviewer-dod` · `docs/agents/roles/reviewer-dod.md` + `reviewer-security` · `docs/agents/roles/reviewer-security.md` |
| Agent / session | Cursor · Orca dispatch `ctx_31d69c31dff7` · terminal `term_7c5c1976-e3e1-43e3-b4eb-5ed0f6261b69` · task `task_bb991be1ddc1` |
| Independence | ≠ architect amendment author; ≠ prior FAIL reviewer dispatch `ctx_4d436bb9fc88` / `task_3e865fda5d6e`; ≠ SEC-1 implementer #345 |
| Scope | Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · Issue [#344](https://github.com/hangndat/ticket-solution/issues/344) · PR [#346](https://github.com/hangndat/ticket-solution/pull/346) |
| Path under review | **`docs/architecture/D13-ACCOUNT-DELETION-HANDOFF.md` only** |
| Exact SHA under review | **`f6e2e14231288f1a7901bce631ba0b490490f2fb`** (`git rev-parse` = PR `headRefOid` = worktree HEAD) |
| Prior FAIL SHA | `ab3f3c48a788cf6927026f573e42918ae48c12ef` — `docs/reviews/D13-PR346-DOD-SECURITY.md` |
| Architecture impact | **Có** — account deletion spanning PostgreSQL + Keycloak |
| Date (UTC) | 2026-10-18T08:06:09Z |
| Primary sources | Apple [5.1.1(v)](https://developer.apple.com/support/offering-account-deletion-in-your-app/) · Keycloak Admin REST latest ([GET users](https://www.keycloak.org/docs-api/latest/rest-api/index.html) `username`+`exact`; [DELETE users/{id}](https://www.keycloak.org/docs-api/latest/rest-api/index.html) → **204**) · Keycloak `Constants` ([DEFAULT_ACCESS_TOKEN_LIFESPAN=300](https://www.keycloak.org/docs-api/latest/javadocs/constant-values.html), `DEFAULT_SESSION_MAX_LIFESPAN=36000`) · `jose` `JWTClaimVerificationOptions.maxTokenAge` · O06 `docs/DECISION-LOG.md` · source `packages/backend/src/oidc.ts` / `platform-oidc.ts` |

## Dual verdict (do not collapse)

| Gate | Verdict | Meaning |
| --- | --- | --- |
| **A. Architect handoff vs Issue #344 AC** (I2 DELETE ≤30d, COMPLETED=PG+IdP, allowlist, lease, SEC-1 A+R1+R2, matrix T1–T20) | **PASS** | Actionable for BE-S2; O06 numbers untouched; no fabricated public API |
| **B. Security / privacy denylist sufficiency** (R1–R5 vs prior SEC-D1) | **PASS** | Indefinite retention **rejected**; TTL **48h** after IdP terminal; keyring dual-accept; canonical HMAC; missing key fail-closed; R5 stay REVOKED |
| **C. Claim “Đủ để triển khai trong scope” / spawn BE-S2** | **PASS** | Retention/rotation decisions **resolved** at this tip; clear acceptance list below — **no** inventing TTL/pepper |

**Overall for coordinator:** prior FAIL @ `ab3f3c48…` **cleared** on tip `f6e2e142…`. Safe to spawn BE-S2 against this handoff. Store full-deletion release gate vẫn chờ SEC-1 (ACK+apply) + SEC-2 impl live — không đổi. Không kế thừa verdict cũ; artifact này chỉ cover SHA trên.

---

## 1. Checks (exact SHA)

```bash
git rev-parse HEAD
# f6e2e14231288f1a7901bce631ba0b490490f2fb

gh api repos/hangndat/ticket-solution/pulls/346 --jq .head.sha
# f6e2e14231288f1a7901bce631ba0b490490f2fb

gh api repos/hangndat/ticket-solution/commits/f6e2e14231288f1a7901bce631ba0b490490f2fb/check-runs \
  --jq '[.check_runs[]|select(.name=="ci" or .name=="changes")|{name,conclusion}]'
# [{"name":"ci","conclusion":"success"},{"name":"changes","conclusion":"success"}]
# ownership / runtime jobs skipped (docs path filter) — expected
```

Docs-only: **no** runtime platform/RLS re-run for this review.

**Source prerequisite (not pretended present):**

```text
packages/backend/src/oidc.ts:87–91 — jose.jwtVerify({ issuer, audience, algorithms }) — NO maxTokenAge
packages/backend/src/platform-oidc.ts:60–64 — same — NO maxTokenAge
infra/keycloak/realm-ticket.json — no accessTokenLifespan / SSO max pin
```

Handoff R1 correctly marks **BE-S2 must add** `maxTokenAge: 24h` + `clockTolerance: 300` (and/or explicit checks) **and** ops proof live realm `accessTokenLifespan` ≤24h before prod erasure — **not** claiming baseline already enforces.

CRG: `list_graph_stats_tool` OK (docs review; API claims from Keycloak/Apple/`jose` primary + source read).

---

## 2. R1–R5 amendment vs FAIL @ `ab3f3c48…`

| ID | Prior FAIL ask | Tip `f6e2e142…` | Result |
| --- | --- | --- | --- |
| **R1 Digest TTL** | Numeric TTL + purge owner; reject “until ADR” | `expires_at = idp_deleted_at + 48h`; accepted max access ≤24h + 5m skew; worker **hourly** purge; verifier bound **impl prerequisite** | **PASS** |
| **R2 Storage** | Column vs table + purge | Columns on `account_deletion_requests` + indexes; no separate denylist table MVP; worker purge | **PASS** |
| **R3 Pepper/keyring** | Dual-pepper; API+worker; no unsafe drop | Named keyring shared API+worker; mint=`currentKeyId`; verify=all keys until digests expire; **cấm** drop early / re-HMAC without plaintext; missing keyring → **fail-closed + alert** | **PASS** |
| **R4 Canonical HMAC** | Freeze byte formula | `HMAC-SHA256(secret, UTF8(JSON.stringify([exactAllowlistedIssuer, exactSub])))`; no extra slash normalize; encoding pick-one in impl+tests | **PASS** |
| **R5 REJECTED** | Stay revoked vs restore | §4.5 / R5: sessions **remain REVOKED**; re-auth only if no open deletion and not anonymized | **PASS** |

**Privacy gate:** D6 + D7 reject indefinite digest and silent O06 730d extension. 48h window justified as ≥ (24h access max + skew) + hourly purge margin — **not** audit retention. Digest ≠ PII plaintext; still a retention decision — now **explicit and bounded**.

---

## 3. Identity resolve / fuzzy deletion / coordinator contract

| Expectation | Tip assessment |
| --- | --- |
| Coordinator: direct **`sub` = Keycloak user UUID** production path | **PASS** — §3.5 + §5.6 step 4: `GET …/users/{id}` with `id = original_subject` là **ưu tiên duy nhất production** |
| Zero fuzzy email/username delete | **PASS** — cấm fuzzy; T12 forbids `q=` search delete |
| Architect `username`+`exact=true` | **PASS as ops-only fallback** — chỉ khi contract `sub≠UUID` **chưa pin** → **ops blocker**, không đoán. Khớp Keycloak Admin REST: `username` + `exact` áp dụng exact match (browsed 2026-10-18). **Không** coi fallback là production default |

Không còn DOC-1 blocker: production path = UUID GET; list-users exact chỉ fallback có evidence.

---

## 4. False completion / missing key / inactive worker purge

| Risk | Tip | Verdict |
| --- | --- | --- |
| Path/config 404 → false COMPLETED | Distinguished from user-resource 404 / GET-by-id absence (§5.5) | **PASS** |
| Disable-only → COMPLETED | Forbidden; `DISABLED_PENDING_DELETE` stays `REQUESTED` | **PASS** |
| Missing/empty keyring or missing `currentKeyId` | Fail-closed + alert; no mint / no skip denylist (R3) | **PASS** |
| Inactive worker / delayed purge | Deny lookup = digests **chưa hết hạn** (`expires_at`); purge = cleanup. Worker down → HMAC bytes có thể linger past TTL đến job kế; **security window** vẫn do `expires_at` + open REQUESTED + verifier bound — không mở lại indefinite retention | **PASS** (ops residual: purge lag — should-fix note, không chặn BE-S2) |

---

## 5. Live API / primary source cross-check

| Claim | Primary evidence | Tip OK? |
| --- | --- | --- |
| Apple disable insufficient | 5.1.1(v) primary wording browsed | Yes |
| DELETE user success | Admin REST `DELETE /admin/realms/{realm}/users/{user-id}` → **204** (also lists 400/403; tip matrix 204/200 — 200 = nit only) | Yes |
| List users exact username | `username` + `exact` query params on GET users | Yes |
| Default access lifespan 300s / session max 36000s | Keycloak `Constants` javadoc constant-values | Yes |
| jose maxTokenAge | `packages/backend/node_modules/jose` types: `maxTokenAge` requires `iat` | Yes |
| O06 30d / 730d unchanged | DECISION-LOG O06; tip denylist TTL **riêng** | Yes |

---

## 6. SEC-1 / ACK gap (non-blocking for denylist)

§4.4 correctly records PR [#348](https://github.com/hangndat/ticket-solution/pull/348) may be apply-only — ACK revoke still required by D1. **Tracker riêng #345**; không làm FAIL gate B/C của handoff denylist. Store release vẫn cần ACK+apply + SEC-2 live.

---

## 7. Actionable BE-S2 acceptance list (implement against this tip)

Do **not** invent public REST or retention numbers. Acceptance:

1. Migration: internal columns §5.3 (`pg_applied_*`, lease, `idp_*`, tombstone digest/key_id/expires_at + indexes); **no** public `state` enum widen.
2. **Verifier prerequisite (must land with/before denylist rely):** `oidc.ts` + `platform-oidc.ts` reject missing `iat` or age/`exp-iat` above **24h + 5m** (`maxTokenAge` / explicit); tests T16.
3. Ops gate before **prod** erasure: evidence realm (+ client overrides) access token lifespan **≤ 24h**; else blocker — do not assume default 300s.
4. Mint digest at PG apply with R3/R4; set final `expires_at = idp_deleted_at + 48h` on IdP terminal; scrub `original_*` at terminal.
5. `keycloak-erasure.ts`: allowlisted Admin base/realm; **GET-by-id UUID = sub**; DELETE; classify path 404 ≠ user absence; worker-only erasure secret.
6. Worker: lease → apply → optional disable → DELETE → COMPLETED iff PG+IdP; **hourly** purge expired digests; SLA overdue metric sanitized (T20).
7. Upsert/API after verify: deny open REQUESTED **or** unexpired digest hit (T9/T17).
8. Keyring env placeholders in `.env.example` only; fail-closed if missing (T18).
9. R5: REJECTED → sessions stay REVOKED (T19).
10. Fake IdP adapter; no real Keycloak in CI (T15).

**Still blocked for store release:** SEC-1 ACK+apply merged + SEC-2 I2 COMPLETED semantics live (§5.8).

---

## 8. Findings summary

| ID | Severity | Notes |
| --- | --- | --- |
| ~~SEC-D1~~ | **Resolved** @ `f6e2e142…` | R1–R5 concrete; indefinite rejected |
| SEC-D2 | **Addressed in tip** | SLA overdue metric specified — implement in BE-S2 T20 |
| OPS-1 | should-fix / prod gate | Realm lifespan ≤24h evidence before prod erasure (already in tip) |
| OPS-2 | should-fix | Purge lag when worker inactive — deny must honor `expires_at` (already); monitor worker liveness |
| DOC-3 | nit | Matrix “204/200 delete” — Admin REST documents **204** for DELETE user |
| SEC-1-ACK | tracker | PR #348 apply-only gap — outside denylist PASS; keep #345 open until ACK |

**No** fabricated endpoints. **No** O06 number changes. **No** false “source already has maxTokenAge”.

---

## 9. Out of scope (honored)

- No code/design edits; no merge; no deploy; no Project Status mutation.
- Did not re-review SEC-1 runtime PR #348 beyond tip’s gap note.
- Did not self-approve own future BE-S2 implementation.

## Verdict

**PASS** — DoD + security revalidation on exact SHA `f6e2e14231288f1a7901bce631ba0b490490f2fb`.

Coordinator: may treat handoff tip as sufficient to spawn **BE-S2**; revalidate again only if tip content changes after this SHA.
