# VD10 — Batch B-IOS-UI (DS-IOS-01..06)

**Worker:** Zico (ios) · **Worktree:** `vd09-marketing-neon`  
**Checks:** `pnpm --filter @ticket/mobile typecheck` · `pnpm --filter @ticket/mobile test` (pass)

## Finding status

| ID | Sev | Status | Notes |
| --- | --- | --- | --- |
| DS-IOS-01 | High | **Fixed** | `Button` destructive border/label/spinner → `colors.deny` (#B3213A) |
| DS-IOS-02 | Med | **Fixed** | `colors.deny` + `themeColors().deny` → #B3213A (not `brand.signal`) |
| DS-IOS-03 | Med | **Fixed** | `PublishedEventCard` primary CTA → shared `Button` + `eventsCopy.cardPrimaryCta` |
| DS-IOS-04 | Low | **Fixed** | `expo-linear-gradient` + `attendeePrimaryGradient` (signal → color-mix(signal 88%, ink)); primary `Button` matches web `attendeePrimary` |
| DS-IOS-05 | Low | **Fixed** | Focus ring `borderWidth` 2 → 3 on non-ghost `Button` |
| DS-IOS-06 | Low | **Fixed** | Debug sim + Metro 8083; PNGs refreshed with gradient CTAs visible on events card, redeem, fixture event, staff deny |

## Simulator evidence (local)

| File | Screen |
| --- | --- |
| `docs/reviews/assets/vd10-ios/ios-events-feed.png` | Events catalog (card primary CTA) |
| `docs/reviews/assets/vd10-ios/ios-redeem-global.png` | Redeem global |
| `docs/reviews/assets/vd10-ios/ios-ticket-detail-fixture.png` | Fixture event detail (`vemoki://events/demo-mfest`) |
| `docs/reviews/assets/vd10-ios/ios-staff-access-deny.png` | Staff gate soft-deny |

Capture: `xcodebuild` Debug + `expo start --port 8083 --dev-client`; `xcrun simctl openurl` + `simctl io screenshot`. Full set (gitignored): `apps/mobile/.uat-artifacts/vd10/`.

## Implementation notes (DS-IOS-04)

- Dependency: `expo-linear-gradient` (Expo SDK 58, via `expo install`).
- Tokens: `src/theme/color-mix.ts`, `src/theme/attendee-primary.ts` — DEC-01 parity with `packages/ui` `attendeePrimary` gradient stop.
- Destructive variant unchanged (deny red outline); disabled/loading/pressed use existing opacity on shell.
