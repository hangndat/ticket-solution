# VD10 — Batch B-IOS-UI (DS-IOS-01..06)

**Worker:** Zico (ios) · **Worktree:** `vd09-marketing-neon`  
**Checks:** `pnpm --filter @ticket/mobile typecheck` · `pnpm --filter @ticket/mobile test` (pass)

## Finding status

| ID | Sev | Status | Notes |
| --- | --- | --- | --- |
| DS-IOS-01 | High | **Fixed** | `Button` destructive border/label/spinner → `colors.deny` (#B3213A) |
| DS-IOS-02 | Med | **Fixed** | `colors.deny` + `themeColors().deny` → #B3213A (not `brand.signal`) |
| DS-IOS-03 | Med | **Fixed** | `PublishedEventCard` primary CTA → shared `Button` + `eventsCopy.cardPrimaryCta` |
| DS-IOS-04 | Low | **Deferred** | `expo-linear-gradient` not in `apps/mobile` deps — primary stays solid `colors.accent` per coordinator rule |
| DS-IOS-05 | Low | **Fixed** | Focus ring `borderWidth` 2 → 3 on non-ghost `Button` |
| DS-IOS-06 | Low | **Partial** | Simulator PNGs under `.uat-artifacts/vd10/` + `docs/reviews/assets/vd10-ios/`; embedded binary did not attach Metro — card CTA not visible in shots |

## Simulator evidence (local)

| File | Screen |
| --- | --- |
| `docs/reviews/assets/vd10-ios/ios-events-feed.png` | Events catalog |
| `docs/reviews/assets/vd10-ios/ios-redeem-global.png` | Redeem global |
| `docs/reviews/assets/vd10-ios/ios-ticket-detail-fixture.png` | Fixture event route |
| `docs/reviews/assets/vd10-ios/ios-staff-access-deny.png` | Staff gate soft-deny |

Full set (gitignored): `apps/mobile/.uat-artifacts/vd10/`.

## DS-IOS-04 follow-up

Add `expo-linear-gradient` (coordinator-approved) and map primary `Button` to restrained signal gradient aligned with web `attendeeEventSideboxCta` (signal → ink mix), not marketing neon.
