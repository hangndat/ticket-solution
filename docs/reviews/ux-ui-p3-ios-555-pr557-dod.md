# DoD review — PR #557 · Issue #555 (Phase 3 iOS: staff thin · invite/claim · redeem polish)

| Field | Value |
| --- | --- |
| Reviewer / session | James · dod — Orca worker `term_70879f71-d646-4180-a95c-58bb1699a3c8` · task `task_8da5cf063e10` · dispatch `ctx_7e36f05036b8` (≠ implementer) |
| Scope | Issue [#555](https://github.com/hangndat/ticket-solution/issues/555) · PR [#557](https://github.com/hangndat/ticket-solution/pull/557) · `apps/mobile/**` only |
| Commit SHA reviewed | `f67cf35bfbab5b60702839a4848e5243473f9930` (`git rev-parse HEAD` on review worktree) |
| Architecture impact | Không (per Issue/PR) |
| Decision IDs | **O02** (staff soft-entry / deny-by-default); PD Phase 3 handoff [#547](https://github.com/hangndat/ticket-solution/issues/547) §1.1–1.2 (membership `/invite` web bridge vs native `/claim`) |
| Verdict | **PASS with known gap** |

## Checks (exact SHA worktree)

| Check | Command / ref | Result |
| --- | --- | --- |
| Unit tests | `pnpm --filter @ticket/mobile test` | **231 pass**, 0 fail |
| Typecheck | `pnpm --filter @ticket/mobile typecheck` | **OK** |
| Lint | `pnpm --filter @ticket/mobile lint` | **OK** |
| CI | [run 39202130805](https://github.com/hangndat/ticket-solution/actions/runs/39202130805) | **changes**, **mobile**, **ci**, **turbo-persist** pass |
| EAS Cloud Build | N/A | **Not used** (policy) |
| sim-uat staff-access deny | See § UAT below | **PASS** (guest attendee persona → `vemoki://staff` deny UI) |
| sim-uat membership invite | See § UAT below | **Gap** — installed sim binary → `Unmatched Route` for `vemoki://invite?token=…` |

## Scope vs ownership

Diff at SHA: 12 files, +411/−84, all under `apps/mobile/src/**`. No `apps/api`, `apps/web`, lockfile, or CI workflow changes. Matches iOS ownership.

## Acceptance (Issue #555 + PD Phase 3 handoff)

| AC area | Evidence | Result |
| --- | --- | --- |
| Membership `/invite` ≠ native `/claim` | `installed-app-link.ts` classifies `membership-invite` → `/membership-invite`; claim stays `/claim`; tests in `installed-app-link.test.ts`, `membership-invite-url.test.ts`; bridge screen `membership-invite.tsx` opens web `#token=` via `buildMembershipInviteWebUrl` | **PASS** (static + unit) |
| Staff-access thin / deny | `staff-access.tsx`: server probe → redirect tab or `StaffAccessDeny` with `AttendeeCta`, fade-in, `accessibilityLiveRegion="assertive"`; deep link `vemoki://staff` → `/staff-access` (O02) | **PASS** |
| Redeem polish | `redeem.tsx`: `AttendeeCta` for submit/refresh/reconcile; outcome panel `useFadeInOnMount` + a11y announcements | **PASS** (code review; redeem screen not re-UAT’d on sim this pass) |
| Claim copy distinction | `claim.tsx` VI note: membership invite on web, not this screen | **PASS** |
| Loading typography (Sora / Be Vietnam Pro) | `LoadingState` in `screen-state.tsx` used on staff-access loading path | **PASS** (inherits existing `BrandFontsGate`) |

## Checklist O02 / PD §6.1 (staff chrome — partial scope)

| Gate | Assessment |
| --- | --- |
| D-O02 | Staff deep links land on soft-access; deny before scanner; no tab elevation without `staffEligible` — **PASS** (code + prior O02 store tests + sim deny) |
| D-PD-6.1 | Task is staff **thin** + deep-link deny, not full tab chrome re-audit — no regression observed on deny path — **PASS** (narrow AC) |
| D-PERM-UAT | Attendee UAT token + `vemoki://staff` deny with VI copy — **PASS** |
| D-READY-NAV | Navigation permission chrome not primary scope of #555 — **N/A** |
| D-DECISION-ROW | O02 + PD §1.1 cited above — **PASS** |

## Findings

### Blockers

None on static review, unit tests, or CI at reviewed SHA.

### Should-fix (non-blocking)

1. **PR checklist:** `scripts/sim-uat.sh` staff-access deny remains unchecked in PR body — reviewer executed equivalent flow (artifact paths below); implementer may tick after reading this artifact.
2. **Local binary vs SHA:** Simulator `com.hangndat.ticket` on `Epic527-iOS-Gates` did **not** include `/membership-invite` route at runtime (`Unmatched Route` for `vemoki://invite?token=…` on cold/warm `openurl`). Link rewrite and screen exist in source at `f67cf35`; **rebuild dev client** (`expo run:ios` / local prebuild, Team `BLUA62D52G`) required for runtime invite UAT on exact SHA.

### Nits

- `StaffAccessDeny` duplicates deny messaging in `Notice` + follow-up `Text` (announcement string) — acceptable for a11y assertive region; optional copy tighten later.

## Headless sim-uat evidence

Device: `Epic527-iOS-Gates` (`4AD7F2DC-5533-4C66-875C-A430DF3C734C`). Stub: `node scripts/o02-me-events-stub.mjs` (port 4370).

```bash
# Staff deny (attendee persona)
xcrun simctl openurl "$SIM" "vemoki://uat/session?access_token=attendee-uat-token"
xcrun simctl openurl "$SIM" "vemoki://staff"
scripts/sim-uat.sh screenshot "$SIM" apps/mobile/.uat-artifacts/ux-ui-p3-555-dod/staff-access-deny.png
```

- Screenshot: `apps/mobile/.uat-artifacts/ux-ui-p3-555-dod/staff-access-deny.png`
- AX tree: «Không có quyền Nhân viên», «Về Sự kiện» CTA present.

```bash
# Membership invite (installed binary — gap)
xcrun simctl openurl "$SIM" "vemoki://invite?token=<32-char-token>"
# → Expo «Unmatched Route» vemoki:///invite?token=…
```

- Screenshots: `apps/mobile/.uat-artifacts/ux-ui-p3-555-dod/membership-invite-bridge.png`, `membership-invite-cold.png`

## Known gaps (intentional for this verdict)

1. **Runtime membership-invite deep link** not validated on simulator until app rebuilt from SHA `f67cf35` (unit tests + `+native-intent` / `membership-invite` route review substitute for this PR slice).
2. **Redeem / claim screens** not re-run through sim-uat on this pass (residual polish; no AC regression flagged in diff).
3. **Milestone gate (b)** local Xcode archive on integrated commit — out of scope for this Task; coordinator tracks at Epic #546 close.

## Merge note

Reviewer **did not merge**. Coordinator may merge after board process when gap (1) is accepted or closed via local rebuild evidence.
