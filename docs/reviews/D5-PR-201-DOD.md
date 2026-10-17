# DoD review — PR #201 (D5 APNs token-first + TestFlight build 9)

| Field | Value |
| --- | --- |
| Reviewer | Cursor DoD (Orca worker `term_af0175cc-b70f-4c79-b4ab-b89bd806f713`, task `task_37bc47637d3a`, dispatch `ctx_4a5446029096`, run `run_1cf84b159363`) — ≠ implementer (PR author / tip commit `hangndat`) |
| Scope | PR #201 `hangndat/d5-ios-apns-tf` → `main`; Issue #6 / D5 APNs device UAT (token-first register + TF). Paths: `apps/mobile/**` + `docs/reviews/D5-APNS-DEVICE-UAT-STATUS.md` |
| Commit SHA | `06950dcae284788ef0723033495554974d0d0899` (confirmed `git rev-parse HEAD` + `gh pr view 201` commits + CI `head_sha`) |
| Checks | Local on SHA: `pnpm --filter @ticket/mobile exec node --test src/push/apns-device-token.test.ts` → **9 pass / 0 fail**. CI run `39042893451` on tip: `mobile` **SUCCESS**, `ci` **SUCCESS**, `changes` / `turbo-persist` SUCCESS (web/backend/db/d5-* skipped as path-filtered) |
| Verdict | **PASS with known gap** |

## Checklist (task scope)

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Token-first APNs (no permission-dialog hang) | **PASS** | `registerApnsDeviceToken` no longer calls `getPermissionsAsync` / `requestPermissionsAsync`; goes straight to `getDevicePushTokenAsync` with 15s `Promise.race` timeout. Comment documents WDA/iOS 26 hang rationale. |
| 2 | Hermes-safe `require()` | **PASS** | `defaultNotifications` / `defaultPlatform` / `defaultBoundary` use Metro `require()` (not `await import`) for Release Hermes stability. |
| 3 | Register busy / testID | **PASS** | `push-status.tsx`: busy label `Registering…`, a11y busy label, `testID="register-apns-device-token"`, 12s UI watchdog fail-closed to `unavailable`. |
| 4 | `ticketPublic` pushProvider fallback | **PASS** | `push.ts` `readBakedPushProvider()` → `expo-constants` `extra.ticketPublic.pushProvider` when `EXPO_PUBLIC_PUSH_PROVIDER` unset. |
| 5 | TF `buildNumber` 9 | **PASS** | `app.config.ts` `buildNumber: '9'`; README TestFlight line `0.1.0 (9)`. |
| 6 | Evidence doc ACCEPTED+DELIVERED | **PASS** | `docs/reviews/D5-APNS-DEVICE-UAT-STATUS.md` records sandbox HTTP 200 apns-ids + on-device NC/lock-screen DELIVERED with artifact paths; explicitly separates direct sandbox send from worker E2E. |
| 7 | Fail-closed: no fake delivered / no Expo Push SaaS / no `.p8` | **PASS** | `push.ts` still `delivered: false` only; refuses `delivered: true` claims. `apns-device-token.ts` uses native device token only (docs forbid `getExpoPushTokenAsync` / `exp.host`). Empty/throw token → `unavailable`, no POST. No `.p8` / private key material in PR paths (AuthKey id `4HL2CWNN69` in UAT doc is key id, not secret blob). |
| 8 | Ownership: mobile + docs/reviews only | **PASS** | `git diff main...06950dc --name-only` → 8 files, all under `apps/mobile/` or `docs/reviews/`. No BE/web. |
| 9 | Unit tests on SHA | **PASS** | 9/9 including new “no permission gate” fail-closed case. |
| 10 | CI mobile on PR #201 | **PASS** | Actions `39042893451`: `mobile` SUCCESS, aggregate `ci` SUCCESS. Reviewer does **not** merge. |
| 11 | `SessionScopedPushStatus` on My Tickets | **PASS** | `my-tickets.tsx` mounts `<SessionScopedPushStatus />` in verified wallet scroll. |

## Known gaps (non-blocking — documented OK)

1. **Worker `TicketIssued` path not E2E:** UAT status records outbox stayed `PENDING`; ACCEPTED+DELIVERED proven via **direct** sandbox APNs HTTP/2 with the same AuthKey class — not yet worker → APNs → device. Must not be conflated with fake client-side `delivered: true` (client correctly never claims that).
2. **AppDelegate provisional / native patches not in PR:** UAT doc lists local `AppDelegate.swift` early `registerForRemoteNotifications` + provisional auth, `PushTokenModule.swift` (node_modules) timeout, and `aps-environment=development` entitlements. `ios/` is gitignored — **not** in this PR. Source/JS on tip is sufficient for token-first register + TF `buildNumber` bump, but **binary parity for provisional NC delivery depends on local prebuild/native patches** not reproducible from this PR alone. Call-out for TF binary vs git source.
3. **Cosmetic stale surface (non-blocking):** result union still includes `'permission-denied'` and JSDoc still says “Request notification permission” though register path no longer returns/requests permission. No runtime fake success.

## Findings

No blocking correctness or security findings on exact SHA `06950dcae284788ef0723033495554974d0d0899`. Diff matches intent: token-first register avoids permission dialog hang; Hermes `require()`; Register busy/testID/watchdog; baked pushProvider fallback; TF build 9; UAT evidence honest about direct-send vs worker gap. Fail-closed client delivery claims and Expo Push SaaS avoidance hold. Graph `detect_changes` against this tip returned empty function map (stale index vs HEAD) — disregarded; source on SHA wins.

## Verdict

**PASS with known gap** on exact SHA `06950dcae284788ef0723033495554974d0d0899`. Safe for coordinator merge of mobile token-first + TF build metadata + UAT status doc. Revalidate if tip gains further behavior commits. Worker E2E and committing/reproducing provisional AppDelegate/entitlement patches remain follow-ups outside this PR’s merge gate.
