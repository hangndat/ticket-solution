# PORTAL — PR #526 security revalidation (SEC-526-1 / #520)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_752990a1-6283-4fae-850a-5bd697fcf26f` · dispatch `ctx_06d861139c22` · task `task_cb4357dc8fc0` · Role `reviewer-security` · Agent cursor |
| Implementer | PR #526 author session (≠ this reviewer; ≠ DoD reviewer) |
| Scope | Issue **#520** · PR **#526** · Reval **SEC-526-1** only: advisory lock + concurrent test for PENDING registration rate / max-PENDING caps |
| Paths | `packages/backend/prisma/migrations/202610190003_p2_onboard_pending_registration/migration.sql`, `packages/backend/test/tenant-registration.test.cjs`, `packages/backend/test/rls-catalog.test.cjs` (context: `tenant-registration.ts`, API route — unchanged in fix commit) |
| Architecture impact | **Có** — SECURITY DEFINER `register_pending_tenant` abuse controls |
| Prior verdict | **FAIL** at `a42df3aec0c62222f05235f8babf8f7dc7459a30` (concurrent COUNT→INSERT race) |
| **Exact tip SHA under review** | **`01a66d0b15e6367b2a26987ec06b99cbb573c051`** |
| Verdict Security | **PASS** |

## Threat / abuse cases examined (reval focus)

| Abuse case | Result |
| --- | --- |
| Registration spam under **concurrency** (same actor, distinct Idempotency-Key) | **Mitigated** — `pg_advisory_xact_lock(872350, hashtext(p_actor_user_id::text))` before idempotency / rate COUNT / max-PENDING COUNT / inserts; matches D13 `872341` pattern with distinct namespace. |
| Concurrent test coverage | **Present** — 5 parallel `registerPendingTenant` with `rateMax: 1`, `maxPendingOwned: 1`; asserts 1 win, 4 `RATE_LIMITED`, ≤1 PENDING owned; pool size 6. |
| Idempotency under lock | **Mitigated** — lock then `FOR UPDATE` on `(actor_user_id, client_key)`; same-key replay serializes safely. |
| Cross-actor rate bypass via lock collision | **Not exploitable for caps** — `hashtext` collision only over-serializes (perf), does not raise another actor’s caps. |
| Cross-tenant / RLS on `tenant_registrations` | **Unchanged / sound** — FORCE RLS; owner policy for DEFINER; runtime via SECURITY DEFINER; grants to `ticket_runtime` only. Catalog now lists `tenant_registrations` in `DEFINER_OWNER_TABLES`. |
| Unauthenticated / unverified email / auto-ACTIVE / secrets in response | **Still mitigated** (serial review at `a42df3a`; fix commit does not regress). |
| PENDING branding mutation (SEC-526-2) | **Out of scope** — Low hardening from prior review; not a blocker for this reval. |

## Findings

| ID | Severity | Class | Status |
| --- | --- | --- | --- |
| SEC-526-1 | Medium | Abuse-control race | **Resolved** on `01a66d0` — advisory xact lock + concurrent DB test. |
| SEC-526-2 | Low | Incomplete PENDING freeze | **Hardening / out of scope** — `updateTenantBranding` still lacks status assert; not required to pass this reval. |

No new medium+ findings in the fix diff.

## Checks on exact SHA

```text
git rev-parse (review target)
→ 01a66d0b15e6367b2a26987ec06b99cbb573c051

git show 01a66d0 --stat
→ migration.sql (+advisory lock), rls-catalog.test.cjs (+tenant_registrations),
  tenant-registration.test.cjs (+concurrent race + pool 6)

Static: CRG full rebuild (orientation); source + migration SQL + test matrix authoritative.
Compared lock style to D13 session revoke: pg_advisory_xact_lock(<ns>, hashtext(user)).
Cursor security-review subagent on branch changes vs a42df3a → PASS (no medium+).
This session: no exploit PoC; Docker isolation concurrent suite not re-executed here
(docker info hung / no DATABASE_URL) — rely on test code review + prior implementer matrix.
```

## Limitations (review process)

- Review only — **không merge**, không đổi Project Status, không deploy.
- Operational note: environments that already applied `202610190003` before this commit need the updated `CREATE OR REPLACE FUNCTION` body redeployed (in-place migration edit). Rollout/ops, not a logic flaw in the lock.
- DoD / CI gate thuộc `reviewer-dod` / coordinator; security PASS độc lập với DoD UI approve.

## Verdict

**PASS** — SEC-526-1 concurrent abuse race is closed at exact SHA `01a66d0b15e6367b2a26987ec06b99cbb573c051`. SEC-526-2 branding freeze remains optional hardening and was explicitly out of scope for this reval.
