# VD10 — Batch B-IOS-UI (DS-IOS-01..06) + solid primary violet

**Worker:** Zico (ios) · **Worktree:** `vd09-marketing-neon`  
**Checks:** `pnpm --filter @ticket/mobile typecheck` · `pnpm --filter @ticket/mobile test` (pass)

## Product decision (2026-10-25)

- **Primary accent:** solid `#7C4DED` (no gradient/glow) on attendee CTAs, tabs, links, chips, atmosphere wash.
- **Deny/destructive:** `#B3213A` on gate deny and destructive `Button` (unchanged).
- **Marketing `signal`:** `#E11D48` remains in `brand/vemoki/tokens.json` / `brandGenerated.signal` for marketing surfaces only (not product chrome).

## Finding status

| ID | Sev | Status | Notes |
| --- | --- | --- | --- |
| DS-IOS-01 | High | **Fixed** | `Button` destructive border/label/spinner → `colors.deny` (#B3213A) |
| DS-IOS-02 | Med | **Fixed** | `colors.deny` + `themeColors().deny` → #B3213A (not `brand.signal`) |
| DS-IOS-03 | Med | **Fixed** | `PublishedEventCard` primary CTA → shared `Button` + `eventsCopy.cardPrimaryCta` |
| DS-IOS-04 | Low | **Fixed** | Primary `Button` solid `colors.accent` (`brand.primary`); removed `LinearGradient` / signal glow |
| DS-IOS-05 | Low | **Fixed** | Focus ring `borderWidth` 3 on non-ghost `Button` |
| DS-IOS-06 | Low | **Fixed** | Simulator PNGs refreshed — solid violet CTAs/tabs/links; deny screen unchanged red |
| DS-IOS-07 | Med | **Fixed** | `sync-tokens.mjs` exports `primary`; `defaultThemeTokens().signal` → `brand.primary` |
| DS-IOS-08 | Med | **Fixed** | Account destructive row label → `colors.deny` (was `brand.signal`) |

## Simulator evidence (local)

| File | Screen |
| --- | --- |
| `docs/reviews/assets/vd10-ios/ios-events-feed.png` | Events catalog (MFest header, solid violet card CTA) |
| `docs/reviews/assets/vd10-ios/ios-event-detail-fixture.png` | Published MFest · Demo detail |
| `docs/reviews/assets/vd10-ios/ios-redeem-global.png` | Redeem global |
| `docs/reviews/assets/vd10-ios/ios-ticket-detail-fixture.png` | Demo fixture event (`ticketsolution://events/demo-mfest`) |
| `docs/reviews/assets/vd10-ios/ios-staff-access-deny.png` | Staff soft-deny (`ticketsolution://staff`) |

Capture: Metro `8083` + `EXPO_PUBLIC_UAT_SCREENSHOT=1` (LogBox suppressed); in-app `axe` navigation + `ticketsolution://` only (no `vemoki://` sheet). Script: `apps/mobile/scripts/capture-vd10-screenshots.sh`. Full set (gitignored): `apps/mobile/.uat-artifacts/vd10/`.

## Implementation notes (primary / tokens)

- `apps/mobile/scripts/sync-tokens.mjs` — `buildTokensModule` includes `colors.primary`; regen `tokens.generated.ts`.
- `colors.accent` / runtime `theme.signal` default → `brand.primary` (#7C4DED).
- Removed `src/theme/attendee-primary.ts`; `expo-linear-gradient` remains installed but **unused** in `apps/mobile/src` (safe to prune in a dep-only follow-up).
- `color-mix.test.ts` updated for primary→ink mix (utility retained for future tints).

## Remaining red / signal usages (intentional)

| Location | Color | Why |
| --- | --- | --- |
| `tokens.generated.ts` `signal` | `#E11D48` | Marketing token in SoT; not wired to product accent |
| `colors.deny` / destructive UI | `#B3213A` | Product deny/destructive |
| `brand.destructive` | `#8A1F1F` | Form validation semantic (TOKENS.md) |
| Gate admit / unknown | green / amber | Scan outcome semantics |
