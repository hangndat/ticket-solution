# God-backend-refactor-pr integration — 2026-11-03

Employee: Gonic (backend). Architecture impact: Có. Cost tier: advanced (tenant/RLS/lease race).

## What was done

1. Fast-forwarded `hangndat/god-backend-refactor-pr` from `d1ab1d2e` to `origin/main` at
   `9993d354ef1e2dda8835175ceee24e5b28389466` (clean fast-forward, no conflicts).
2. Cherry-picked, in order, onto the fast-forwarded branch:
   - `1175c090` → `6390239f` — refactor(backend): isolate import CSV parsing from job lifecycle
   - `29c43b35` → `10babcc8` — refactor(backend): isolate fenced outbox persistence
3. Both cherry-picks applied with **zero conflicts** (`package.json` auto-merged on the first pick).

Final branch SHA: **`10babcc8d808e183c2867b8e2398d56cc95d5d27`**.

## Path audit

Diff from `d1ab1d2e` to HEAD touches only:

- `packages/backend/package.json`
- `packages/backend/src/import-csv.ts` (new)
- `packages/backend/src/import-jobs.ts`
- `packages/backend/src/outbox-fence.ts` (new)
- `packages/backend/src/outbox.ts`
- `packages/backend/test/import-csv.test.cjs` (new)

All within `packages/backend` scope. No cross-slice touches. CRG `get_impact_radius_tool`
(base `9993d354`, depth 2) reports 59 nodes directly changed, **0 nodes impacted** within 2 hops
and 0 additional files affected — blast radius is self-contained to the four changed files.
`callers_of(fenceOutboxToProcessing)` confirms all 4 call sites in `processClaimedOutbox` still
resolve directly (confidence_tier EXTRACTED) after the split.

## Diff review (manual, line-by-line against base)

Both commits are pure extractions — code moved verbatim into new files, only whitespace/line-wrap
differs, with re-export imports added at the call sites. Confirmed preserved:

- **Import CSV**: `assertUtf8Csv` (UTF-16 BOM reject, invalid UTF-8 reject, BOM strip),
  `parseCsvRows` quote/escape handling, `normalizeMapping` CODES/GUESTS cross-mapping guards,
  `parsePayload` row-limit check, email validation + canonicalization, duplicate-in-file detection
  (case-insensitive for codes), and `maskCodeHint` masking in the error CSV — byte-identical logic,
  now in `import-csv.ts` with header comment "No DB or object-store access."
- **Outbox fence**: `fenceOutboxToProcessing` (`status='LEASED' AND lease_owner=... AND
lease_token=... AND lease_expires_at > clock_timestamp()` → `PROCESSING`), `lockOutboxLease`,
  `markOutboxCompleteFenced`, `markOutboxDeadFenced` (all with the same lease-token/expiry
  predicates), `scheduleRetryFenced` (ordinal/retry/backoff logic, push-pending fan-out,
  ACCEPTED/DEAD short-circuit), `appendAttempt` (`ON CONFLICT (tenant_id, notification_id,
ordinal) DO NOTHING`) — all moved verbatim to `outbox-fence.ts` with header comment "No provider
  I/O runs here." Provider I/O (`deliverTicketIssuedApns`, `sendBudgetedEmail`, SMTP/APNs calls)
  stays in `outbox.ts`, unchanged, outside the moved functions.
- ACCEPTED vs DELIVERED distinction untouched (not part of either diff).

## Checks run (this SHA)

| Check                                                                                                             | Result                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @ticket/backend typecheck`                                                                         | **PASS** (clean after `pnpm --filter @ticket/contracts build` + `prisma generate`, both required pre-existing env setup, unrelated to this diff)                                                                                                                                                        |
| `pnpm --filter @ticket/backend lint`                                                                              | **PASS**                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @ticket/backend build`                                                                             | **PASS**                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @ticket/backend test` (61 unit tests incl. new `import-csv.test.cjs`, 4/4)                         | **PASS**                                                                                                                                                                                                                                                                                                |
| `pnpm --filter @ticket/backend test:import-list` (import+invitation DB integration)                               | **PASS** (1/1)                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @ticket/backend test:job04-regression` (outbox-fence, job04-resend-caps, worker-provider-deadline) | **PASS** (7/7)                                                                                                                                                                                                                                                                                          |
| `pnpm --filter @ticket/backend test:architecture-recovery` (lease reclaim/fence races, AR891-T3 suite)            | **PASS** (28/28), **first try** — no exit137 this run, unlike the earlier baseline run cited in the task brief                                                                                                                                                                                          |
| `npx prettier --check` on the 5 changed files                                                                     | outbox.ts flagged, but confirmed via diff against base `d1ab1d2e` that the same formatting drift **pre-exists before these cherry-picks** (unrelated pre-existing lines, e.g. long argument lists around L154–305, L633–647, L1203–1280) — not introduced by this integration, out of scope to fix here |

## Baseline review context

No existing `docs/reviews/*.md` references commit SHAs `1175c090` or `29c43b35` directly — these
are fresh, single-author product commits not yet tied to a merged PR, so there is no prior
independent reviewer report specific to this exact diff to use as a baseline. The manual diff
review above (byte-for-byte comparison against the pre-refactor functions) is the available
baseline for this integration; treat it as not-yet-independently-reviewed.

## Findings / residual items

- None blocking. The prettier drift in `outbox.ts` predates this work and is outside this task's
  scope (backend-only refactor integration, not a formatting cleanup).
- Recommend a DoD review per `docs/agents/workflows/review.md` (reviewer ≠ implementer) before
  merge, since no independent reviewer report exists yet for these two commits specifically.

Not pushed, no PR opened, no merge, no reset, no tooling/company changes.
