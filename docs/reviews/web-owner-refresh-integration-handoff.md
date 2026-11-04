# Web RedeemForm owner refresh boundary — integration handoff

**SHA:** c17f4c26b34b5a00bc795811998f43f9507982af (branch `hangndat/god-web-refactor-pr`, ff-rebased onto main 9993d354ef1e2dda8835175ceee24e5b28389466)

## Fast-forward

Branch was created at d1ab1d2e; fast-forwarded cleanly to 9993d354 before cherry-picking (no scope impact — only `scripts/` and `docs/agents` tooling changes landed on main in between).

## Cherry-picks (in order, clean, no conflicts)

- `8151d651` refactor(web): isolate owner redemption refresh state
- `c4f71257` style(web): format redemption refresh files
- `2d20d596` refactor(web): own redemption refresh lifecycle outside form

All three touch only `apps/web/**` (redeem-form.tsx, new `src/redeem/owner-refresh.{ts,md}`, `tests/owner-redemption-scope.test.ts`) — in Web scope, no cross-slice conflicts.

## Baseline

No prior Web reviewer report exists for this specific feature under `docs/reviews/`; validated fresh rather than inheriting a PASS.

## Checks (apps/web)

- `pnpm --filter @ticket/web test` — 333/333 pass (workspace deps `@ticket/contracts`, `@ticket/ui`, `@ticket/web-session` rebuilt first; dist was stale after the fast-forward).
- `pnpm --filter @ticket/web typecheck` — clean.
- `pnpm --filter @ticket/web lint` — clean (`--max-warnings 0`).
- `npx prettier --check` on the 4 changed files — all formatted.
- Diff path audit (`git diff --name-only 9993d354..HEAD`): only the 4 files above, all under `apps/web/**`.

## Invariants verified

- Owner status fetch/BFF contract: `fetchOwnerRedemptionStatus` / `OwnerRedemptionStatus` unchanged, still the transport/validation boundary (`owner-status.ts`).
- Auth: unauthorized path still routed to `messageForApiError('UNAUTHENTICATED', ...)`.
- Locale: `locale` threaded through `refreshOwnerRedemption` into `messageForOwnerStatus`/`redeemFormCopy`.
- Generation/stale guard: `isCurrent: () => !isStale(generation)` preserved; stale outcome short-circuits before any state write.
- Queued/retry: `pendingRequestId`/`busy` gating in `refreshOwnerStatus()` call site unchanged.
- JSX: both `onClick={refreshOwnerStatus}` call sites (lines 1207, 1226) untouched.

## Limitations

- CRG `detect_changes_tool` flags `RedeemForm` and `refreshOwnerStatus` as direct test gaps (risk 0.70/0.65) — coverage is indirect via `owner-redemption-scope.test.ts` exercising `refreshOwnerRedemption`/`ownerRefreshPlan` rather than the form wrapper directly; pre-existing pattern, not introduced by this integration.
- Not pushed/PR'd per task scope; working tree has the 3 cherry-picked commits plus this handoff doc, uncommitted.
