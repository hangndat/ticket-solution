# Review — PR #1173, initial integration revalidation (god-class API pilots)

- **Exact SHA reviewed:** `0398e4b2f969e40194ec2d1989fc4ee1773c965c`
- **Base:** `origin/main` @ `9993d354ef1e2dda8835175ceee24e5b28389466`
- **Scope:** `apps/api/**` (invitation workflow + event catalog extraction) and `docs/plans/GOD-CLASS-REFACTOR-PILOT-2026-11-03.md`, `docs/plans/GOD-CLASS-REFACTOR-PILOT2-2026-11-03.md`
- **Reviewer:** James, role `reviewer-merged`, independent from the original API implementers and from Colin's integration worker (Dispatch `ctx_0ecb7475b3d5`)
- **CRG:** full rebuild run at this exact worktree/SHA (1621 files, 10,122 nodes, 101,769 edges); blast radius of the 6 changed `apps/api/src/*` files queried via `get_impact_radius_tool` — only `apps/api/src/main.ts` and `apps/api/src/openapi.ts` are impacted within 2 hops (both are bootstrap/CLI entry points, no business logic). `callers_of`/`file_summary` used to confirm wiring.

## What changed

Two independent slices landed together on top of `main`:

1. **Invitation workflow extraction** — `listInvitations`, `dispatchPreview`, `dispatch`, `claim`, and `parseInvitationListQuery` moved verbatim out of `InventoryService`/`InventoryController` (in `inventory.ts`) into a new `InvitationService`/`InvitationController` (new file `invitations.ts`). `InventoryService`/`InventoryController` keep import jobs, codes, and quota.
2. **Event catalog extraction** — `ticketType`, `listTicketTypes`, `source`, `listSources` moved verbatim out of `EventAdminService` (in `events.ts`) into a new `EventCatalogService` (new file `event-catalog.ts`). `EventAdminController` is unchanged in name/routes and now injects both `EventAdminService` and `EventCatalogService`.
3. `app.ts` registers `InvitationController`/`InvitationService` and `EventCatalogService` as new Nest providers/controllers, reusing the existing `ticketDeps` object (which already carries `hmac` and `credentialKey` — confirmed at `app.ts:132-133` and `app.ts:210-211`).
4. `openapi-document.ts` adds `INVENTORY_SPLIT_CONTROLLER_KEYS = {'InvitationController'}` mapped back to the legacy `InventoryController` operationId prefix, mirroring the existing `PLATFORM_SPLIT_CONTROLLER_KEYS` pattern. `EventCatalogService`'s routes stay declared on the unrenamed `EventAdminController`, so no equivalent mapping is needed there — correct given the chosen controller shape.
5. Two new test files (`event-catalog.test.cjs`, `invitation-claim-dispatch.test.cjs`) cover UUID-before-identity ordering, fail-closed OIDC misconfiguration, email-verified gating, and idempotency-key enforcement via HTTP injection against `dist/app`.

## DoD verdict: **PASS**

- Diff read in full (1586 lines); every moved method's body is byte-identical to the pre-move version (compared old `inventory.ts`/`events.ts` hunks against new `invitations.ts`/`event-catalog.ts` hunks line by line) — no behavior drift introduced during the move.
- Dependency wiring verified in `app.ts`: `InvitationService` receives the same `ticketDeps` (includes `hmac`, `credentialKey`) that `inventory.ts` used to require; `EventCatalogService` receives the same `ticketDeps` as `EventAdminService`.
- OpenAPI operationId compatibility mechanism verified by actually regenerating the spec (`pnpm --filter @ticket/api openapi`) and diffing against the committed `apps/api/openapi.json` — **zero diff, byte-stable**, confirming paths/operationIds are unchanged for consumers.
- Independently re-ran, not just re-read the worker's claims:
  - `pnpm --filter @ticket/api typecheck` → **PASS** (after building `@ticket/contracts` then `@ticket/backend`, which were not pre-built in this worktree; this is an environment/build-order step, not a PR defect).
  - `pnpm --filter @ticket/api lint` → **PASS**.
  - `pnpm --filter @ticket/api build && pnpm --filter @ticket/api test` → **58/58 PASS**, matching the worker's claim exactly.
- Both pilot handoff docs (`GOD-CLASS-REFACTOR-PILOT-2026-11-03.md`, `GOD-CLASS-REFACTOR-PILOT2-2026-11-03.md`) were read; the stated boundaries ("no backend/DB/route/contract change", "auth order preserved", "OpenAPI operationId preserved via legacy mapping") match what the diff actually does.

## Security verdict: **PASS**

Revalidated the specific invariants named in the task, all preserved:

- **Public endpoints/OpenAPI** — route paths, HTTP methods, and operationIds unchanged (verified by the byte-stable regenerated spec above).
- **Auth ordering** — in both new services, `actor()` still runs bootError/config guard → `verifyBearerToken` → `upsertFromVerifiedIdentity` before any tenant/backend call, same order as before the move. `InvitationController.listInvitations` still validates `tenantId`/`eventId` as UUIDs (`requireUuid`, 422 `SCOPE_REQUIRED`) before parsing the query or touching identity, matching the `event-catalog.test.cjs` and pre-existing invitation test expectations.
- **Tenant/RLS** — every backend call in both new services still passes through `withTenant(db, tenantId, tx => ...)` (event-catalog) or passes `tenantId`/`eventId`/`actorUserId` straight to the unmodified backend functions (`claimGuestInvitation`, `dispatchGuestInvitations`, `listGuestInvitations`, `previewInvitationDispatch`) — no new call sites were introduced, and `packages/backend` was not touched by this PR.
- **Invitation claim/dispatch idempotency** — `claim` still requires `this.deps.credentialKey` (else `OIDC_MISCONFIGURED`), still forwards `idempotencyKey ?? ''` into `claimGuestInvitation`/`dispatchGuestInvitations` unchanged, and the new `invitation-claim-dispatch.test.cjs` exercises email-verified gating and idempotency-key-required paths with an `unreachableDb()` fixture that throws if tenant data is touched before validation — confirms fail-closed ordering is intact.
- **Event catalog lifecycle/validation** — DTO shapes (`CreateTicketTypeBodyDto`, `CreateSourceBodyDto`, etc.) are copied verbatim into `event-catalog.ts`; `EventAdminController`'s route decorators, `requireUuid`, and `fail()` error mapping are untouched, only the service delegate changed (`this.events` → `this.catalog`) for the four catalog methods.
- No new secrets, no new trust boundaries, no change to error-code-to-HTTP-status mapping in either controller's `fail()`.

## Checks actually run vs. reused vs. pending

| Check                                                  | Status                                                                                                                                                                      | How                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Full PR diff read                                      | Done                                                                                                                                                                        | `git diff` (1586 lines) read in full via paginated `ctx_read`                                    |
| CRG build + impact radius + callers query at exact SHA | Done                                                                                                                                                                        | `list_graph_stats_tool`, `get_impact_radius_tool`, `query_graph_tool`                            |
| `apps/api` typecheck                                   | **Re-run, PASS**                                                                                                                                                            | required building `@ticket/contracts` → `@ticket/backend` first (not pre-built in this worktree) |
| `apps/api` lint                                        | **Re-run, PASS**                                                                                                                                                            |                                                                                                  |
| `apps/api` build + full test suite                     | **Re-run, 58/58 PASS**                                                                                                                                                      | matches worker's claim                                                                           |
| OpenAPI byte-stability                                 | **Re-run, PASS**                                                                                                                                                            | regenerated `openapi.json`, `git diff` shows zero changes                                        |
| Clean cherry-pick/rebase claim                         | Not independently re-verified (worktree was already checked out at the exact target SHA on top of the stated base; no conflict markers or orphaned hunks found in the diff) |                                                                                                  |
| CI for PR #1173 on exact SHA                           | **Pending** — a CI watcher is reported running separately; this review does not call CI PASS and leaves that gate to the coordinator                                        |                                                                                                  |
| UI                                                     | N/A per task scope                                                                                                                                                          |                                                                                                  |

## Findings

None at Critical/High/Medium severity. One minor, pre-existing, out-of-scope observation:

- **Low / no action needed this PR**: `docs/plans/GOD-CLASS-REFACTOR-PILOT2-2026-11-03.md` itself notes the `actor()` auth helper is now duplicated across `InvitationService`/`EventCatalogService`/`EventAdminService`/`InventoryService` as "nợ nhỏ" (small debt) to avoid changing failure-path ordering during the pilot. This is an intentional, documented tradeoff for a mechanical extraction PR, not a defect — flagging only so a future consolidation task tracks it. No closure action required for PR #1173.

## Limitations

- Dependencies (`@ticket/contracts`, `@ticket/backend`) were not pre-built in this worktree; typecheck initially failed with `Cannot find module` errors unrelated to this PR's files (`tenant-limits.ts`, `tickets.ts`, etc. — all pre-existing code outside the diff). Building the two workspace packages first resolved it. This is worth fixing at the environment/CI-setup level so future reviewers don't have to rediscover the build order.
- CRG embeddings are disabled in this environment (`sentence-transformers` not installed), so only structural (non-semantic) graph queries were available; sufficient for this review's scope (direct call-graph wiring).
- Did not independently reproduce "clean cherry-pick/rebase" as a git operation (e.g., replaying the two pilot commits onto main) — relied on the fact the worktree is already at the exact target SHA built on the stated base with no visible conflict residue in the diff.

## Next owner

CI gate for PR #1173 at this exact SHA remains open with the coordinator; once CI reports status, this PR is ready to merge from a DoD+Security standpoint — no code changes requested.
