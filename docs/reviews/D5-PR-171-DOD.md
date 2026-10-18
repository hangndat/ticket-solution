# DoD review — PR #171 (D5 Gate device UAT — bake + session persist)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD (Orca worker `term_a231e146-c5ee-4cc2-a5f1-35b6f3f31d26`, task `task_96ba7c6debcf`, dispatch `ctx_ddde229760d5`) — ≠ implementer (PR author / tip commits `hangndat`) |
| Scope | PR #171 `hangndat/d5-ios-gate-device-uat`; Issue #6 (device Gate). Paths: `apps/mobile/**` only |
| Commit SHA | `211be6a944c4892f36815048e23a947c7ea12678` (confirmed `git rev-parse` + `gh pr view 171` commits + CI `head_sha`) |
| Checks | Local (detached worktree tip): `pnpm --filter @ticket/mobile test` → **138 pass / 0 fail**. CI run `39022330311` on tip: `mobile` **SUCCESS**, `ci` **SUCCESS**, `changes` / `turbo-persist` SUCCESS (web/backend/db skipped as path-filtered) |
| Verdict | **PASS with known gap** |

## Checklist (task scope)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Exact tip SHA under review | **PASS** | Tip = conflict-marker fix after bake commit `f21ae6c…`; SHA `211be6a944c4892f36815048e23a947c7ea12678` |
| 2 | Scope `apps/mobile` only | **PASS** | `git diff main...211be6a --name-only` → 10 files, all under `apps/mobile/` |
| 3 | `EXPO_PUBLIC_*` bake for Release | **PASS** | `app.config.ts` `bakePublicConfig`: when `APS_ENVIRONMENT`/`APP_VARIANT`/`EXPO_PUBLIC_APS_ENVIRONMENT=production`, fills `EXPO_PUBLIC_API_BASE_URL` / `OIDC_*` / `PUSH_PROVIDER` + `extra.ticketPublic`. Runtime `config.ts` `pickPublic(env, readTicketPublicExtra())` fallback. Public Vemoki defaults only (no secrets) |
| 4 | Gate staff session persist (no false “Sign in and set API base” when verified) | **PASS** | `SessionBoundary.establish`: `CREDENTIAL_UNREACHABLE` **writes** bearer, stays `signed-out` (never elevates offline). `resolveGateAuth` re-`restore(verifyViaMe)` before deny. Account `isSignedIn = identity.status === 'verified'` only. Staff Notice shows live `API` + `Phiên`. Deny copy is bake/sign-in Vietnamese — not the old empty-API English trap when session is verified |
| 5 | Conflict markers gone | **PASS** | Tip commit removes `<<<<<<<` / `=======` / `>>>>>>>` from `staff.tsx`; `git grep` on tip tree clean |
| 6 | Tests | **PASS** | New cases: unreachable establish persists bearer; API URL env/extra semantics. Full mobile suite **138/138** on tip worktree; CI `mobile` green |
| 7 | No EAS Cloud Build | **PASS** | Diff + README/`app.config` comments forbid EAS Cloud; local Archive / Team bake only. No new `eas.json` / cloud workflow |
| 8 | Team `BLUA62D52G` | **PASS** | `app.config.ts` → `ios.appleTeamId: 'BLUA62D52G'`; README documents same; `buildNumber: '8'` |
| 9 | CI mobile+ci on tip | **PASS** | Actions run `39022330311`, `head_sha=211be6a944c4892f36815048e23a947c7ea12678`, `mobile` + `ci` SUCCESS |

## Known gaps (non-blocking — documented OK)

1. **Push DELIVERED blocked:** no `APNS_KEY_PATH` / `.p8` / `APNS_*` in worker env; must not fake DELIVERED. Parent Issue #6 may stay open for push end-to-end.
2. **Device HID screenshots blocked:** idevicescreenshot / screenshotr unavailable on iOS 26 RSD; bake + launch proven via `devicectl` / sim UAT (AXe) per PR body — not re-run in this review session.

## Findings

No blocking correctness or security findings on tip SHA. Production bake is opt-in via APS production flags and uses public URLs only; debug builds stay fail-closed without inventing API/OIDC. Session persist correctly keeps SecureStore bearer on `/v1/me` unreachable while Account/Gate still require `verified` before claiming signed-in or admitting. Conflict-marker CI fix is clean. Graph `detect_changes` risk noise (stale index / unrelated web-worker nodes) disregarded; source on tip wins.

## Verdict

**PASS with known gap** on exact SHA `211be6a944c4892f36815048e23a947c7ea12678`. Safe to merge for Gate device UAT bake + session persist; revalidate if tip gains further behavior commits, and separately when APNs `.p8` enables push DELIVERED.
