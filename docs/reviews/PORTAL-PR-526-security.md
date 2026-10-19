# PORTAL — PR #526 security revalidation 2 (SEC-526-1 after rebase / #520)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_17188f6a-8485-4571-8775-9f1177e55878` · dispatch `ctx_15baf2e78109` · task `task_0f2839eb6d83` · Role `reviewer-security` · Agent cursor |
| Implementer | PR #526 author / merge worker (≠ this reviewer; ≠ DoD reviewer) |
| Scope | Issue **#520** · PR **#526** · Reval **SEC-526-1** after `origin/main` merge into PR tip — advisory lock + concurrent test + catalog must-keep |
| Paths | `packages/backend/prisma/migrations/202610190003_p2_onboard_pending_registration/migration.sql`, `packages/backend/test/tenant-registration.test.cjs`, `packages/backend/test/rls-catalog.test.cjs` |
| Architecture impact | **Có** — SECURITY DEFINER `register_pending_tenant` abuse controls |
| Prior FAIL | `a42df3aec0c62222f05235f8babf8f7dc7459a30` — concurrent COUNT→INSERT race |
| Prior PASS (pre-rebase) | `01a66d0b15e6367b2a26987ec06b99cbb573c051` |
| **Exact tip SHA under review** | **`eff5f90d274840a2460a02ca3a4f90371a70f229`** |
| Verdict Security | **PASS** |

## Threat / abuse cases examined (reval focus)

| Abuse case | Result |
| --- | --- |
| Registration spam under **concurrency** (same actor, distinct Idempotency-Key) | **Still mitigated** — `PERFORM pg_advisory_xact_lock(872350, hashtext(p_actor_user_id::text));` remains **before** idempotency / rate COUNT / max-PENDING COUNT / inserts. Byte-identical to prior PASS for this migration file vs `01a66d0`. |
| Concurrent test coverage | **Still present** — 5-way race with `rateMax: 1` / `maxPendingOwned: 1`; asserts 1 win, 4 `RATE_LIMITED`, ≤1 PENDING owned; pool size 6. Unchanged vs `01a66d0`. |
| Catalog / FORCE RLS owner policy | **Preserved through merge** — `tenant_registrations` ∈ `DEFINER_OWNER_TABLES` and required tables list **alongside** `role_presets` (from #525). No drop of P2-ONBOARD catalog entry. |
| Cross-actor rate bypass via lock collision | **Not exploitable for caps** — `hashtext` collision only over-serializes. |
| Cross-tenant / RLS on `tenant_registrations` | **Unchanged / sound** — FORCE RLS + owner policy; EXECUTE granted to `ticket_runtime` only. |
| Unauthenticated / unverified email / auto-ACTIVE / secrets in response | **Not regressed** by rebase (serial path unchanged). |
| PENDING branding mutation (SEC-526-2) | **Out of scope** — Low hardening; not a merge blocker for this reval. |

## Findings

| ID | Severity | Class | Status |
| --- | --- | --- | --- |
| SEC-526-1 | Medium | Abuse-control race | **Resolved** — still closed at `eff5f90` after rebase (lock + concurrent test intact). |
| SEC-526-2 | Low | Incomplete PENDING freeze | **Hardening / known gap** — `updateTenantBranding` status assert still absent; not required to pass this reval. |

No new medium+ findings introduced by the merge commit relative to the prior security PASS.

## Rebase / merge delta (security-relevant)

```text
git diff 01a66d0b15e6367b2a26987ec06b99cbb573c051 eff5f90d274840a2460a02ca3a4f90371a70f229 -- \
  packages/backend/prisma/migrations/202610190003_p2_onboard_pending_registration/migration.sql \
  packages/backend/test/tenant-registration.test.cjs
→ empty (advisory lock + race test unchanged)

rls-catalog.test.cjs merge resolution:
→ keeps tenant_registrations AND role_presets in DEFINER_OWNER_TABLES + required tables

package.json test:db:
→ keeps tenant-registration.test.cjs; adds role-presets.test.cjs
```

## Checks on exact SHA

```text
git rev-parse (review target)
→ eff5f90d274840a2460a02ca3a4f90371a70f229

CI (PR #526 tip):
→ https://github.com/hangndat/ticket-solution/actions/runs/39196344260
→ conclusion=success · headSha=eff5f90d274840a2460a02ca3a4f90371a70f229
→ database-isolation (rls / rls-catalog) pass

Static: CRG rebuilt for orientation; source + migration SQL + `git diff` vs prior PASS authoritative.
Local node --test in this worktree: MODULE_NOT_FOUND `pg` (deps not installed) — did not block verdict;
rely on empty security-path diff vs prior PASS + CI green on exact SHA.
```

## Limitations (review process)

- Review only — **không merge**, không đổi Project Status, không deploy.
- SEC-526-2 remains optional hardening / known gap (same as prior reval).
- DoD gate thuộc `reviewer-dod` / coordinator; security PASS độc lập với GitHub Approve UI.
- Environments that applied `202610190003` before the lock body existed still need `CREATE OR REPLACE FUNCTION` redeployed (ops note, unchanged).

## Verdict

**PASS** — SEC-526-1 concurrent abuse race remains closed at exact SHA `eff5f90d274840a2460a02ca3a4f90371a70f229` after rebase onto `main`. SEC-526-2 branding freeze remains optional hardening and was explicitly out of scope for this reval.
