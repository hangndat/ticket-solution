# Composer benchmark — PR #850 · Issue #846 readiness

| Field | Value |
| --- | --- |
| Model | Composer 2.5 |
| Role | `dod+sec` ([reviewer-merged.md](../agents/roles/reviewer-merged.md)) |
| Reviewer | Orca worker `task_63044342d287` (benchmark; ≠ implementer session) |
| Review start (UTC) | 2026-10-23T05:12:38Z |
| Review end (UTC) | 2026-10-23T05:15:30Z |
| Token/time allowance | unknown (not measured) |

## Scope

| Item | Ref |
| --- | --- |
| PR | [#850](https://github.com/hangndat/ticket-solution/pull/850) — feat(portal): Platform Operator mutate (#844) |
| Primary Issue | [#844](https://github.com/hangndat/ticket-solution/issues/844) G-791-2/3 |
| Readiness Issue | [#846](https://github.com/hangndat/ticket-solution/issues/846) D-7 cutover (ADR-20 §8 / ADR-22 legacy removal) |
| **Exact SHA** | `6f700d9e278bd346cdb56326304d6385c6701f41` |
| Paths | `apps/portal/app/api/bff/platform/**`, `apps/portal/src/ops/platform-{zone,mutate-panels}.tsx`, `apps/portal/tests/platform-mutate-zone.test.ts`, `docs/reviews/PR844-EVIDENCE.md` |
| Architecture impact | Có — portal parity prerequisite for Epic #840 / D-7; **this PR does not** remove `apps/web` admin/platform (that is #846). |

## CI / checks (GitHub REST on SHA)

```text
./scripts/gh-dod-evidence.sh 850
head.sha=6f700d9e278bd346cdb56326304d6385c6701f41
ci=success · portal=success · changes=success
web/backend/mobile/database-isolation=skipped (expected for portal-only diff)
```

**Tests run locally this session:** none (read-only benchmark; CI cited above).

**Missing / not re-run on reviewer machine:** `cd apps/portal && pnpm test && pnpm typecheck && pnpm lint && pnpm build` (claimed green in PR body).

## Code vs acceptance (#844)

| Dimension | Assessment |
| --- | --- |
| **Code (parity)** | BFF routes + UI panels cover provision, GET detail, status, limits, support-grant create; client uses `portalMutate` + `crypto.randomUUID()` idempotency keys; interpreters tested in `platform-mutate-zone.test.ts`. |
| **Acceptance (DoD)** | Issue #844 requires headless Operator UAT with PNG per mutate + axe serious/critical = 0. PR evidence documents **blocked** Keycloak `ticket-platform-web` flow; only unsigned shell screenshot. **Acceptance incomplete.** |

## Security review (auth / CSRF / tenant / idempotency)

| Control | Evidence on SHA |
| --- | --- |
| CSRF on mutates | `assertMutatingBrowser` on POST/PUT platform mutates; client `portal-fetch` sends `CSRF_HEADER` from cookie (`platform-mutate-panels.tsx` → `portalMutate`). |
| Idempotency | UUID required server-side; forwarded as `Idempotency-Key` upstream (e.g. `tenants/route.ts` L46–52, L91–94). |
| Platform authz | `forwardPlatformBearer` verifies platform OIDC token + `requiredAcr` / `maxAuthAgeSeconds` before upstream call (`upstream.ts` ~L113–152). |
| Tenant input | `isUuid` on path `tenantId` and grant fields; list projection strips sensitive keys (`platform-zone.ts` `TENANT_FORBIDDEN`). |
| Grant scope | BFF rejects scopes other than `cs.read` (`support-grants/route.ts` L50–56). |
| Optimistic concurrency | `expectedVersion` required on status/limits mutates (integer validation). |

No mock auth in BFF; mutations proxy to Nest with bearer — consistent with existing portal BFF style (`assertMutatingBrowser`, not web’s `assertMutatingBrowserAsync`).

## Findings

| ID | Severity | Blocks merge | Path / line (SHA) | Evidence | Closing condition |
| --- | --- | --- | --- | --- | --- |
| F01 | blocker (acceptance) | **Yes** (DoD #844) | `docs/reviews/PR844-EVIDENCE.md` | UAT script blocked: Keycloak platform browser flow fails before Operator MFA; no mutate-action PNGs, no axe run. | Re-run `apps/portal/scripts/pr844-platform-uat.mjs` after flow fix; attach evidence per action + axe 0 serious/critical on integrated SHA. |
| F02 | should-fix | No (code) | `docs/reviews/PR844-EVIDENCE.md` L7 | Evidence table cites SHA `4f81173`, not pinned review SHA `6f700d9`. | Update evidence row to tip SHA or note revalidation unchanged behavior. |
| F03 | nit | No | `apps/portal/app/api/bff/platform/tenants/[tenantId]/route.ts` | GET detail omits `ensureCsrfCookie()` while tenants list GET sets it (`tenants/route.ts` L8). | Align with portal GET convention if coordinator wants consistency (optional). |

## Issue #846 readiness (D-7 cutover)

| Gate | Status |
| --- | --- |
| #843 G-791-1 | **Merged** (PR #848) |
| #844 G-791-2/3 | **Open** — PR #850 not merged; acceptance gap F01 |
| #845 G-791-4 | **Merged** (PR #849) |
| `main` legacy tree | `apps/web/app/admin`, `apps/web/app/platform`, `live-pulse-legacy.css` **still present** |
| #846 DoD commands | Not executable on `main` until cutover work lands |

**Readiness verdict:** **Not ready** to start/close #846. Merge #850 only after #844 acceptance gates (or explicit coordinator decision on UAT deferral). #846 additionally needs full D-7 deletion + web CI + integrated portal Operator UAT (G-791-5 on cutover SHA).

## Architecture (ADR-20 / ADR-22)

- **ADR-20 / Epic #840:** This PR closes portal-side Operator mutate gap (BA parity); advances cutover **prerequisite**, not cutover itself.
- **ADR-22:** Legacy web DS/routes remain until #846; no “Done: legacy removed” update in this PR (expected).

## Verdicts

| Gate | Verdict | Rationale |
| --- | --- | --- |
| **DoD (#844 / PR #850)** | **FAIL** | Code parity and portal CI green on SHA; mandatory Operator UAT + axe evidence missing (F01). Distinction: **code complete**, **acceptance not complete**. |
| **Security** | **PASS** | CSRF + UUID idempotency + platform MFA bearer forwarding and input validation match scope; no new auth bypass or tenant leakage found in diff at SHA. |
| **#846 readiness** | **Not ready** | Dependency #844 open; legacy web surfaces intact; cutover tasks not started. |

## Independence

Implementer: `hangndat` on branch commits. Review: dispatched Composer 2.5 benchmark worker (separate session).
