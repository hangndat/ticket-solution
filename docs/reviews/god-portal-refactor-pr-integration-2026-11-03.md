# Portal god-module refactor integration — handoff

- Date: 2026-11-03
- Employee: Higo (role: portal)
- Branch: `hangndat/god-portal-refactor-pr`
- Final SHA: `17c865e7` (on top of `9993d354` = origin/main)

## What happened

1. Fast-forwarded the branch from `d1ab1d2e` to `origin/main` (`9993d354`) — clean fast-forward, no conflicts (tooling/dispatch-evidence changes only, outside `apps/portal`).
2. Cherry-picked, in order:
   - `5869b3dc` — `refactor(portal): isolate guest list state` → applied as `76abecef`, no conflicts.
   - `61320b95` — `refactor(portal): separate notification commands from response views` → applied as `48be6b84`, no conflicts.
3. Added `17c865e7` — Prettier reformat of the untouched remainder of `apps/portal/src/ops/notifications.ts` (pre-existing drift, not introduced by either cherry-pick) to satisfy the scoped Prettier check. No logic changed.

## Path diff vs origin/main

Confined to `apps/portal`:

- `apps/portal/src/guests/guest-list-page.ts` (new)
- `apps/portal/src/guests/guest-workspace.tsx`
- `apps/portal/src/guests/use-guest-list-page.ts` (new)
- `apps/portal/src/ops/notification-commands.ts` (new)
- `apps/portal/src/ops/notifications.ts`
- `apps/portal/tests/guest-workspace-query.test.ts`
- `apps/portal/tests/ops-notification-bff.test.ts`

No cross-slice or contract files touched.

## Conflict decisions

None — both cherry-picks applied cleanly against the fast-forwarded `main`.

## Behavior preserved (verified by reading post-pick code + passing tests)

- Tenant/event path encoding and BFF URL mapping: `portal C-N BFF paths` suite green (includes "encodes a supplied identifier").
- Idempotency/fingerprint reuse: "reuses an uncertain mutation key only for the same fingerprint" passes.
- Notification ACCEPTED semantics unchanged: `notifications.ts` still carries "ACCEPTED ≠ delivered" guard, `providerStatusLabel`/`isProviderStatusFull` logic untouched by the command-boundary split; `notification-commands.ts` only relocates command-dispatch code, not status interpretation.
- Locale/stale-response handling: notification BFF body parser tests (template preview, publish idempotency key requirement, reminder UTC schedule) all pass.
- Guest list query behavior (UUID search gating, cursor suppression during UUID search, redemption PII masking): all pass under `guest workspace list query (F01/F02/F04)`.

## Checks (all run at final SHA `17c865e7`)

- `pnpm --filter @ticket/portal test`: 317/317 pass (0 fail). Needed one-time local build of `@ticket/web-session` and `@ticket/contracts` workspace packages — pre-existing setup step, unrelated to these commits.
- Focused re-run: `tests/guest-workspace-query.test.ts` + `tests/ops-notification-bff.test.ts` → 22/22 pass.
- `pnpm --filter @ticket/portal typecheck`: clean.
- `pnpm --filter @ticket/portal lint` (`eslint . --max-warnings 0`): clean.
- Scoped `prettier --check` on the 7 changed files: clean after the formatting commit above.
- `git diff --name-only origin/main..HEAD`: confirms no files outside `apps/portal` changed.

## Remaining risks

- CRG graph impact radius (depth 1) flagged `EventGuestsPage`, `NotificationsOpsPanel`, `NotificationsTemplatesSection`, and BFF route files as dependents of the changed files; these were not modified and their own tests (`ops-filters`, `mutation-cs-notification`) pass, but they were not individually re-reviewed line-by-line beyond the test suite.
- Prior reports in `docs/reviews`/`docs/plans` for these two commits were treated as baseline only; this handoff is the approval record for the current SHA.
- Not pushed, no PR opened, per task instructions.
