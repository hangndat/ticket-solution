# VD10 — Batch B-IOS-UI (DS-IOS-01..06) + brand lockup refresh

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
| DS-IOS-06 | Low | **Fixed** | Simulator PNGs refreshed — no ↗ on default wordmarks; new demo banner/lockup; gradient card CTA |
| DS-IOS-07 | Med | **Fixed** | `sync-tokens.mjs` + `signalGlyph` on tenant branding API; platform `signalMark` empty; `TenantLogo` hides glyph unless tenant provides `signalGlyph` |

## Simulator evidence (local)

| File | Screen |
| --- | --- |
| `docs/reviews/assets/vd10-ios/ios-events-feed.png` | Events catalog (MFest header, Vemoki card banner, gradient CTA) |
| `docs/reviews/assets/vd10-ios/ios-event-detail-fixture.png` | Published MFest · Demo detail |
| `docs/reviews/assets/vd10-ios/ios-redeem-global.png` | Redeem global |
| `docs/reviews/assets/vd10-ios/ios-ticket-detail-fixture.png` | Demo fixture event (`ticketsolution://events/demo-mfest`) |
| `docs/reviews/assets/vd10-ios/ios-staff-access-deny.png` | Staff soft-deny (`ticketsolution://staff`) |

Capture: Metro `8083` + `EXPO_PUBLIC_UAT_SCREENSHOT=1` (LogBox suppressed); in-app `axe` navigation + `ticketsolution://` only (no `vemoki://` sheet). Script: `apps/mobile/scripts/capture-vd10-screenshots.sh`. Full set (gitignored): `apps/mobile/.uat-artifacts/vd10/`.

## Implementation notes (DS-IOS-04 / brand)

- Dependency: `expo-linear-gradient` (Expo SDK 58, via `expo install`).
- Tokens: `src/theme/color-mix.ts`, `src/theme/attendee-primary.ts` — DEC-01 parity with `packages/ui` `attendeePrimary` gradient stop.
- Demo raster: `brand/vemoki/lockup.png` → `assets/demo/logo.png`; `apps/web/public/demo/banner.png` → `assets/demo/banner.png`.
- `icon.png` / splash unchanged (prior VD10 review).
