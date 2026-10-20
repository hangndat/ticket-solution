# DoD review — Issue #606 / PR #607 (attendee probe in-flight dedupe)

| Field | Value |
| ----- | ----- |
| Reviewer | Cursor worker (James · dod) — **≠** implementer (Nam) |
| Issue | [#606](https://github.com/hangndat/ticket-solution/issues/606) |
| PR | [#607](https://github.com/hangndat/ticket-solution/pull/607) |
| Exact SHA | `5b666d3a2be4f51664a1323c6948ab85c5500d06` |
| Worktree reviewed | `r-606-ios-dedupe-review` (`pr-607`) |
| Verdict | **PASS** |

## Scope

Diff vs `main` (3 files only):

- `apps/mobile/src/tickets/attendee-probe-inflight.ts` (new)
- `apps/mobile/src/tickets/attendee-probe-inflight.test.ts` (new)
- `apps/mobile/src/tickets/use-attendee-owned-tickets.ts`

**Confirmed:** `apps/mobile/src/identity/session-boundary.ts` **not** in PR diff.

## AC — in-flight dedupe

- Key: `attendeeProbeInflightKey(userId, sessionScope)` → ``${userId}:${sessionScope}`` — partitions by user and wallet session scope (`__owner__` vs tenant id).
- Concurrent calls for the same key share one `runProbe` invocation; different users or scopes do not share.
- Map entry removed in `.finally()` on the shared promise — covered for success (`ok`), error-like probe result (`unauthorized`), and post-settle second call (2 network invocations).
- Logout/login user switch: different `userId` → different keys; no cross-user promise reuse (test: `does not reuse probe across users`).

## AC — `useAttendeeOwnedTickets` public contract

- Return shape unchanged: `{ tickets, loading, verified }`.
- On successful probe, still `await session.load(sessionScope, 'me-tickets', async () => rows)` so other readers via `session.read` get warm cache.
- Only behavioral change: probe path uses `dedupedAttendeeProbeMeTickets(..., probeMeTickets)` instead of direct `probeMeTickets`.

## Local verification (reviewer session)

```text
# apps/mobile
node --test src/tickets/attendee-probe-inflight.test.ts
# 4 pass, 0 fail

npx tsc --noEmit -p tsconfig.json
# exit 0 (after pnpm install at repo root)

npx eslint src/tickets/attendee-probe-inflight.ts \
  src/tickets/attendee-probe-inflight.test.ts \
  src/tickets/use-attendee-owned-tickets.ts
# exit 0
```

No dedicated unit test file for `use-attendee-owned-tickets.ts` in repo.

## CI evidence (SHA tip)

```text
./scripts/gh-dod-evidence.sh 607

repo=hangndat/ticket-solution pr=607
head.sha=5b666d3a2be4f51664a1323c6948ab85c5500d06
state=open mergeable=true
ci	completed	success
mobile	completed	success
changes	completed	success
turbo-persist	completed	success
(remaining checks skipped)
```

## Limitations / gaps

- Rejected-probe paths do not call `session.load` (unchanged from pre-PR behavior).
- Dedupe module does not assert bearer token in key; scope is `userId` + `sessionScope` as designed in Issue #606.

## Security

No new secrets, no session-boundary changes, no broad identity refactor. Dedupe is module-local `Map`; test-only reset export is clearly named.
