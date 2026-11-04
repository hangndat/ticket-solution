# Review: Backend outbox refactor — fenced persistence isolation

**Exact SHA reviewed:** `29c43b35cc3f8bc9563d229755c352d54fabf4e6`
**Base compared:** `1175c090178f85aea2f3123911fb8f32623b4bf3`
**Scope:** `packages/backend/src/outbox.ts`, new `packages/backend/src/outbox-fence.ts`
**Implementer:** Minh · **Reviewer:** James (independent, role `reviewer-merged`) · **Review type:** DoD + Security, UI N/A (no UI changed)
**Architecture impact:** Có — internal persistence boundary (outbox fenced lease/retry/attempt/terminal writes extracted to a new module)

## Summary

This is a pure code-move refactor. All six functions handling fenced lease
acquisition, retry scheduling, attempt recording, and terminal state writes
(`appendAttempt`, `scheduleRetryFenced`, `fenceOutboxToProcessing`,
`lockOutboxLease`, `markOutboxCompleteFenced`, `markOutboxDeadFenced`) were
deleted from `outbox.ts` and re-added to `outbox-fence.ts` with identical
bodies (only cosmetic Prettier re-wrapping of a few long lines differs).
`outbox.ts` now imports these six names back from `./outbox-fence` and calls
them exactly as before. `outbox-fence.ts` imports the `ClaimedOutboxRow` type
back from `outbox.ts` (type-only import, erased at compile time — no runtime
circular dependency).

## Verdicts

- **DoD: PASS.** Processor (`processClaimedOutbox`, `relayOutboxOnce`,
  `deliverTicketIssuedApns`) now delegates fenced lease, retry, attempt, and
  terminal persistence to `outbox-fence.ts`, matching the acceptance
  criterion. No other file imports the moved functions, so there is no public
  API surface change (confirmed via CRG `importers_of` — only `outbox.ts`
  imports `outbox-fence.ts`).
- **Security: PASS.** Every SQL statement in the moved functions retains its
  original `tenant_id = ...::uuid` predicate (RLS/tenant isolation
  unchanged), lease-owner/lease-token/`lease_expires_at > clock_timestamp()`
  fencing is unchanged, and no new raw-SQL interpolation was introduced —
  all values still flow through tagged-template parameters
  (`tx.$executeRaw` / `tx.$queryRaw`).

## Checks and their source

| Check                                               | Result                                                                                                                                                                                                                       | Source                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Backend build                                       | PASS                                                                                                                                                                                                                         | Coordinator evidence, this SHA                                      |
| Lint                                                | PASS                                                                                                                                                                                                                         | Coordinator evidence, this SHA                                      |
| `test:job04-regression`                             | 7/7                                                                                                                                                                                                                          | Coordinator evidence, this SHA                                      |
| `test:architecture-recovery`                        | 28/28 (first attempt exited 137 amid Docker load; retry passed)                                                                                                                                                              | Coordinator evidence, this SHA                                      |
| Prettier (new module)                               | PASS                                                                                                                                                                                                                         | Coordinator evidence, this SHA                                      |
| Diff check                                          | PASS                                                                                                                                                                                                                         | Coordinator evidence, this SHA                                      |
| CRG graph readiness                                 | Built fresh for this worktree at this exact SHA (graph was empty prior; `head_matches_build: true` after build)                                                                                                              | This review, `list_graph_stats_tool` + `build_or_update_graph_tool` |
| Body-identical move verification                    | Confirmed — diff shows deletion in `outbox.ts` / addition in `outbox-fence.ts` of the same six function bodies, SQL predicates and fencing clauses byte-for-byte (cosmetic line-wrap only)                                   | This review, `git diff` line-by-line read                           |
| Call-site resolution across the new module boundary | `scheduleRetryFenced`: 2/2 call sites resolved direct (`processClaimedOutbox`, `relayOutboxOnce`); `markOutboxCompleteFenced`: 4/4 resolved direct; `fenceOutboxToProcessing`: 4/4 resolved direct; no unresolved call sites | This review, CRG `callers_of`                                       |
| No external importers of moved internals            | Only `outbox.ts` imports `outbox-fence.ts`                                                                                                                                                                                   | This review, CRG `importers_of`                                     |

I reused the coordinator's build/lint/test evidence as-is (same exact SHA, no
source changes since) rather than re-running it, and ran one focused
verification of my own — a line-by-line diff read plus CRG caller/importer
checks — to confirm the move preserved behavior precisely, since that is the
one claim the coordinator's test suite doesn't directly prove (passing tests
show the composed behavior is unchanged overall, not that every predicate
and fencing clause is untouched).

## Findings

None. No behavior, SQL predicate, lease/fencing, retry/ordinal, or
ACCEPTED/DELIVERED-state logic change found. No severity items to report.

## Limitations

- I did not re-run the test suite or build myself; I reused the
  coordinator's evidence for this exact SHA since no source changed between
  evidence collection and this review.
- PRD/TECHNICAL-DESIGN §11/ADR-12/ADR-17 were consulted for the notification
  state model context (ACCEPTED vs DELIVERED, retry/ordinal semantics) to
  judge whether the move altered any of it; it did not, so no deeper
  doc cross-reference was needed beyond confirming the diff was a pure
  extraction.
- This review only covers `outbox.ts` and `outbox-fence.ts` as scoped; no
  other god-module slices were touched or reviewed here.

## Next owner

No action required — safe to proceed to the next god-module slice in
`docs/plans/GOD-CLASS-REFACTOR-REPO-WIDE-2026-11-03.md`. If a future PR adds
new callers of the fenced functions, re-verify `importers_of` on
`outbox-fence.ts` stays limited to intended callers, and re-run CRG
`get_impact_radius_tool` against that diff before merge.
