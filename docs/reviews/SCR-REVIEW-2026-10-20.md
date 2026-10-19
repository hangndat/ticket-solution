# SCR-E1 — Single-code redemption (partial BE) — Security + DoD review

| Trường | Giá trị |
| --- | --- |
| **Issue / Epic** | SCR-E1 (single-code redemption) |
| **Reviewer** | Worker `task_e9fcb2c83555` · roles `reviewer-security` + `reviewer-dod` |
| **Implementer** | Coordinator session (not this review) |
| **Review basis** | **Working tree** on `hangndat/Single-code` (uncommitted) |
| **Base parent SHA** | `550bab1739a49e4afc90c0db554bad7b1740249a` |
| **Tip SHA (unchanged)** | `550bab1739a49e4afc90c0db554bad7b1740249a` — no implementer commit on branch tip |
| **Diff scope** | `git diff 550bab1739a49e4afc90c0db554bad7b1740249a` + untracked paths in task spec |
| **Architecture** | [`docs/architecture/single-code-redemption.md`](../architecture/single-code-redemption.md) · [`docs/plans/SINGLE-CODE-REDEMPTION-PLAN.md`](../plans/SINGLE-CODE-REDEMPTION-PLAN.md) |

## Checks run (working tree)

| Command | Result |
| --- | --- |
| `node --test packages/backend/test/code-routing.test.cjs` | **PASS** (4 tests: normalize, fingerprint, digest aliases, resolve token round-trip) |
| CI on integrated SHA | **Not run** — no commit / no PR SHA |

## Scope reviewed

- Migration `packages/backend/prisma/migrations/202610200001_single_code_routing/`
- `packages/backend/src/code-routing*.ts`, `resolve-token.ts`, `inventory.ts`, `issue.ts`
- `apps/api/src/redemptions-resolve.ts`, `tickets.ts`, `app.ts`
- `packages/contracts/src/redemption-resolve.ts`
- Plan doc (AC reference only)

Out of scope for this slice: web/iOS global entry (untracked BFF paths only skimmed), backfill ops execution, OpenAPI regen.

---

## Security assessment

### Threat / abuse cases considered

| Case | Finding |
| --- | --- |
| Cross-tenant data leak via resolver | Global lookup hits `code_routing_digest_aliases` + `code_routing_groups` only (no tenant-scoped `redemption_codes` scan). Public projection loaded inside `withTenant(target.tenantId)` — **acceptable** for designed trust boundary. **Gap:** no PostgreSQL **SECURITY DEFINER** resolver (architecture §4.1 / §5); app role `ticket_runtime` reads routing tables via parameterized raw SQL. |
| Enumeration (invalid vs ambiguous vs consumed) | `assertRoutableTarget` maps 0/multi-group and non-`ROUTABLE` → generic `CODE_INVALID`. **Minor:** closed window returns `REDEMPTION_WINDOW_CLOSED` (distinct from invalid) — aligns with architecture table variant naming. |
| Resolve token forgery / replay | `signResolveToken` / `verifyResolveToken`: HMAC-SHA256, `timingSafeEqual`, 15m TTL, binds `actorUserId`, `routingGroupId`, `tenantId`, `eventId`, `routedCodeId`. `verifyResolveTokenForIssue` re-checks group + code via alias lookup — **sound when token is sent**. |
| Bypass resolve on issue (global flow) | **`verifyResolveTokenForIssue` only runs when header present** (`issue.ts`). Architecture §5.2 + AC-2 require **mandatory** `X-Redemption-Resolve-Token` for global flow (`RESOLVE_TOKEN_REQUIRED` if missing). Error code exists in contracts but **never thrown** — **fix before merge / before `SINGLE_CODE_RESOLVE_GLOBAL=on`**. Tenant-bound legacy path correctly remains token-optional. |
| Rate limit abuse | `POST /redemptions/resolve`: `tryConsumeRateLimit` 30 / 10m per **OIDC user id** (`tenantId: user.userId` bucket). **Gap vs AC-6:** no IP bucket, no per-hmac failure bucket on resolve/issue. |
| Raw code in logs | No new logging of `body.code` in `redemptions-resolve.ts` / resolver paths reviewed. Nest default request logging not audited here — **hardening:** ensure access logs redact resolve body in prod. |
| RLS on new tables | Migration grants `SELECT/INSERT/UPDATE` on routing tables to `ticket_runtime`; **no RLS policies** on `code_routing_*`. Consistent with global registry pattern but **differs from architecture SDF** — relies on API layer never exposing candidate rows. |
| Global gate | `countAmbiguousRoutingGroups > 0` → resolve disabled (503 `RESOLVE_DISABLED`) — matches AC-4 intent. Flag `SINGLE_CODE_RESOLVE_GLOBAL` default off via env — **good**. |
| Import routing registry | `importCodes` wires `routingRegistry` when pepper/fp secrets configured; silent skip if misconfigured — **drift risk** (codes without aliases). |

### Security verdict

**PASS with known gap**

Blockers before enabling global resolve in any shared/staging environment:

1. Enforce `RESOLVE_TOKEN_REQUIRED` for global flow (signal: client `redemptionFlow: global`, optional header `X-Redemption-Flow: global`, or require token when resolve global flag on **and** code has routing alias — pick one consistent with §5.2).
2. Add IP + per-digest failure rate limits per AC-6 (or document deferral with coordinator approval).

Hardening (non-blocking for WIP): PostgreSQL SDF for resolve lookup; RLS or revoke broad `ticket_runtime` SELECT on `code_routing_candidates`; integration tests for auth/rate-limit/enumeration.

---

## DoD — AC §2 partial (BE resolve + token binding)

| Criterion | Status | Notes |
| --- | --- | --- |
| `POST /v1/redemptions/resolve` bearer required | **PASS** | `requireUser` → IdentityError / 401 path |
| Resolve read-only (no hold/quota/issue) | **PASS** | Lookup + `buildRedemptionResolveResponse` only; issue path unchanged |
| Response shape vs contracts / architecture §5.1 | **PASS** | Fields + `resolveToken` / `resolveExpiresAt` / `redemptionFlow: global` |
| Generic errors invalid/ambiguous | **PASS** | `CODE_INVALID` copy |
| Issue: token verify when provided | **PASS** | Header `x-redemption-resolve-token`; stale/mismatch → `RESOLVE_TOKEN_STALE` |
| Issue: token **mandatory** global flow | **FAIL (gap)** | See security #4 — AC-2 unchecked |
| Tenant-bound unchanged | **PASS** | No token → no verify branch |
| Insert hooks all pepper aliases | **PASS** | `attachCodeRoutingOnInsert` + import wiring |
| Ambiguity platform gate | **PASS** | Implemented on resolve path |
| API/integration tests for resolve | **GAP** | Unit tests only |

### DoD verdict (partial slice)

**PASS with known gap** — resolve + binding **verification** match architecture for happy path; **mandatory binding on issue** and SDF/rate-limit depth do not yet match doc/AC for production flag-on.

---

## Combined verdict

| Gate | Verdict |
| --- | --- |
| Security | **PASS with known gap** |
| DoD (AC §2 partial) | **PASS with known gap** |
| **Overall** | **PASS with known gap** |

**Not authorized:** merge, commit, Project `Hoàn thành`, or prod flag.

**Revalidation:** After implementer commit, cite new `git rev-parse HEAD`, run CI, re-run API/integration tests; re-check `RESOLVE_TOKEN_REQUIRED` enforcement.

---

## Findings summary

| ID | Severity | Finding |
| --- | --- | --- |
| SCR-SEC-1 | **Should-fix (pre flag-on)** | Global flow does not require resolve token on issue; `RESOLVE_TOKEN_REQUIRED` unused |
| SCR-SEC-2 | **Should-fix** | Rate limit: user bucket only (AC-6 IP + per-hmac failure) |
| SCR-ARCH-1 | **Known gap** | Resolver implemented in app SQL, not SECURITY DEFINER SDF per architecture |
| SCR-OPS-1 | **Should-fix** | Import may skip routing registry if routing secrets missing (silent) |
| SCR-QA-1 | **Should-fix** | No API tests for `POST /redemptions/resolve` (auth, 429, disabled, generic 422) |

## Limitations

- Review on **uncommitted** working tree at base SHA; no GitHub CI evidence.
- Web BFF `apps/web/app/api/bff/redeem/resolve/` not deep-reviewed (out of BE partial scope).
- Penetration testing not performed.
