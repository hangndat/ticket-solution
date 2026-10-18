# Epic #406 / Task #424 — PR #459 security review (H-I3 claim)

| Field | Value |
| --- | --- |
| Reviewer / session | Orca `term_b78f0888-3b65-41c9-ac20-71cfb6124603` · dispatch `ctx_8819645a76f5` · task `task_748f2701a6f7` · Role `reviewer-security` · Agent cursor |
| Implementer | ≠ this reviewer session (independence OK) |
| Scope | Issue **#424** · Epic **#406** · PR **#459** · H-I3 invitation claim harden: token leak, one-time claim, email verified, RLS, injection |
| Paths | `packages/backend/src/guest-invitations.ts`, `packages/backend/test/import-invitations.test.cjs` (+ supporting read: `apps/api/src/inventory.ts` claim wire-up, `packages/backend/src/oidc.ts`) |
| Architecture impact | **Có** — claim tokens / one-time redeem semantics |
| **Exact SHA** | **`6519d7bf204df75d4aec390285f6dffa8fc22189`** |
| Verdict Security | **PASS** |

## Checklist

| Control | Result |
| --- | --- |
| No token leak (logs/responses) | **Pass** — claim returns `IssuedTicketResult` / pending only; test asserts raw token absent from JSON; diff adds no logging of token |
| One-time claim / replay | **Pass** — `CLAIMED` requires prior completed `redemption.redeem` for same `(actor, Idempotency-Key)`; else 410; `FOR UPDATE` + redeem consumption as depth |
| Email verified gate | **Pass** — `emailVerified` + `actorEmail` required; API passes JWT-derived `user.emailVerified` (`email_verified === true` only) |
| RLS / tenant isolation | **Pass** — lookup adds `tenant_id`; runs in `withTenant` (`app.tenant_id` GUC) |
| Injection / unsafe SQL | **Pass** — Prisma tagged templates / bound params only |

## Threat / abuse cases examined

| Abuse case | Result |
| --- | --- |
| Raw invitation token echoed in HTTP claim response | Blocked — response is redeem outcome only; regression test in diff |
| Re-claim with new Idempotency-Key after success | 410 `INVITATION_TOKEN_INVALID` before second issue |
| Concurrent double claim (different keys) | Row `FOR UPDATE` serializes; second sees `CLAIMED` → 410 |
| Same-user idempotent retry (same key) | Prior op allows replay → same ticket (`replayed: true`) |
| Stolen token + different user (matching verified email) | No prior op for that `actor_user_id` → 410 |
| Unverified identity claims | 403 `EMAIL_NOT_VERIFIED` (test added) |
| Client-forged `emailVerified` in body | Not accepted — only OIDC `email_verified === true` via `actor()` |
| Wrong-tenant claim with valid token | No row / event mismatch → 410; explicit `tenant_id` predicate + RLS |
| SQL injection via token / key | Parameterized `$queryRaw` / `$executeRaw` |
| Unauthenticated claim | Bearer auth on claim route (pre-existing) |

## Findings

| ID | Severity | Status |
| --- | --- | --- |
| — | — | **No fix-before-merge findings** |

## Hardening (không chặn PASS)

1. Error text `"Invitation token was already claimed"` vs invalid can confirm prior consumption if token already known — low oracle; mint entropy (`randomBytes`) makes brute force infeasible.
2. No cross-tenant claim regression test in this diff — recommend for DoD evidence; not exploitable given predicate + `withTenant`.
3. Expiry checked before `CLAIMED` replay → post-expiry idempotent retry returns expired (availability, not double-issue).
4. Replay does not explicitly assert `claimed_by === actorUserId`; actor-scoped `operations` unique key + redeem `request_hash` cover the threat model.

## Checks on exact SHA

```text
git rev-parse HEAD
→ 6519d7bf204df75d4aec390285f6dffa8fc22189

git diff origin/main...6519d7bf204df75d4aec390285f6dffa8fc22189 --stat
→ packages/backend/src/guest-invitations.ts
→ packages/backend/test/import-invitations.test.cjs

Static review: claimGuestInvitation (tenant_id + CLAIMED replay gate),
InventoryService.claim (JWT emailVerified), oidc email_verified === true,
withTenant set_config, hashToken SHA-256, H-I3 tests in import-invitations.test.cjs.
Security-review subagent + independent source read. No exploit PoC.
```

CRG note: workspace graph was stale vs this tip; **source + diff at exact SHA** are authoritative for this verdict.

## Limitations

- Review only — no code changes, no merge, no Project Status update, no deploy.
- Did not re-run DB isolation suite in this session; relied on code/test review + implementer tests in diff.
- `gh pr view/comment` may be blocked by GitHub GraphQL rate limit at review time; artifact is durable here.

## Verdict

**PASS** — H-I3 claim hardening at `6519d7bf204df75d4aec390285f6dffa8fc22189` meets the security checklist (no token leak, one-time claim, verified-email gate, tenant-scoped lookup/RLS, parameterized SQL).
