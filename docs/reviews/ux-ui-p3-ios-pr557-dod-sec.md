# DoD + Security review — PR #557 / Issue #555 (iOS Phase 3)

| Field | Value |
| ----- | ----- |
| Reviewer / session | James · dod+sec (Orca `task_69b92974a8df`, independent of implementer) |
| Scope | Issue [#555](https://github.com/hangndat/ticket-solution/issues/555), PR [#557](https://github.com/hangndat/ticket-solution/pull/557), `apps/mobile` only |
| Commit SHA | `f67cf35bfbab5b60702839a4848e5243473f9930` |
| Handoff | `docs/design/ux-ui-revamp/phase-3/` (PD #547) |
| Architecture impact | Không |

## Checks (on exact SHA)

| Check | Result |
| ----- | ------ |
| `git rev-parse HEAD` | `f67cf35bfbab5b60702839a4848e5243473f9930` |
| GitHub CI PR #557 (`mobile`, `ci`, `turbo-persist`) | SUCCESS (workflow run 39202130805) |
| `pnpm --filter @ticket/mobile test` | 231 pass, 0 fail |
| `pnpm --filter @ticket/mobile typecheck` | pass |
| `pnpm --filter @ticket/mobile lint` | pass |
| `scripts/sim-uat.sh` staff-access deny (AC-S2 / handoff §4.2) | **Not run** on this SHA (PR checklist open; coordinator UAT gate) |

## Acceptance (iOS slice)

| ID | Verdict | Evidence |
| -- | ------- | -------- |
| AC-S1 | PASS (code) | `staff-access.tsx` — `LoadingState` title «Đang kiểm tra quyền nhân viên»; probe via `staffEligibility.refresh` before redirect |
| AC-S2 | PASS (code) / gap (UAT) | `StaffAccessDeny` — `Notice` deny + `accessibilityLiveRegion="assertive"` + `AttendeeCta` «Về Sự kiện»; no scanner/camera UI. **No sim-uat screenshot/AXe artifact on SHA** |
| AC-S3 | PASS (code) | `staffEligible` → `<Redirect href="/(tabs)/staff" />` |
| AC-R1 | PASS (code) | `redeem.tsx` — `AttendeeCta` for actions; outcome `Animated.View` + `useFadeInOnMount` + live region |
| Membership bridge (handoff §1.1 iOS) | PASS (code) | `membership-invite.tsx` opens web `/invite#token=` via `buildMembershipInviteWebUrl`; copy distinguishes membership vs `/claim`; `installed-app-link` routes `vemoki://invite` → `/membership-invite` not `/claim` |
| AC-V1 (iOS surfaces in diff) | PASS (code) | Live Pulse theme (`colors`, `fontFamilies.display/body`, `AttendeeCta` signal CTA) on staff deny, redeem, membership bridge |
| Claim distinction | PASS (code) | `claim.tsx` caption: membership on web ≠ event claim screen |

### O02 / PD §6.1 (staff chrome — applicable)

| Gate | Verdict | Notes |
| ---- | ------- | ----- |
| D-O02 | PASS (code) | `parseInstalledAppLink`: `vemoki://staff` → `/staff-access` soft-entry, not direct staff tab |
| D-PD-6.1 | PASS (code) / gap (UAT) | Deny path fail-closed when not eligible; **no dual-persona headless UAT artifact** on SHA |
| D-PERM-UAT | **Gap** | Handoff requires `scripts/sim-uat.sh` for staff-access deny — deferred per PR body |

## Security

**Threat cases considered (mobile diff only):**

1. **Authz bypass via deep link** — Staff entry still gated on `staffEligibility.refresh(session)` after verified identity; unsigned → `staffEligibility.reset()`. No client-side `staffEligible` grant. **No issue.**
2. **Membership invite token handling** — Regex-bounded token (`8–512`); web bridge uses **fragment** `#token=` (not query on product URL). In-app route uses query for Expo params only; accept/CSRF remains on web. **No exploitable bypass**; note: query param in router state is transient (hardening: acceptable for bridge).
3. **Open redirect / wrong origin** — `getProductWebOrigin()` normalizes to `URL.origin`, falls back to `https://app.vemoki.com` on invalid env. **No issue.**
4. **Claim vs membership confusion** — Separate parsers, min token lengths (claim 16+, membership 8+), distinct routes. **No issue.**
5. **Secrets / logging** — No tokens logged; tests use redacted placeholders. **No issue.**
6. **Supply chain** — No `package.json` / lockfile changes in PR diff. **N/A.**

**Security verdict:** **PASS**

## Findings

| Severity | Item |
| -------- | ---- |
| Should-fix (non-blocker) | Run `scripts/sim-uat.sh` staff-access deny on exact SHA (or post-merge integration SHA) before Epic/milestone gate (a); PR #557 checklist item still open |
| Nit | `membership-invite` auto-opens in-app browser on mount — UX surprise, not security |
| Nit | Reviewer did not run local Xcode build (out of Task scope; milestone gate (b) separate) |

## Limitations

- Code-level AC verification only for staff/redeem/invite bridge; headless sim UAT not executed in this review session.
- Web/marketing AC-I*/AC-M* out of ownership slice (not reviewed here).
- Tab hide/show for guest vs staff (full O02 tab chrome) not re-UAT’d on this SHA.

## Verdict

| Layer | Verdict |
| ----- | ------- |
| DoD (acceptance) | **PASS with known gap** — implementation matches Phase 3 iOS AC in code + unit tests; **known gap:** missing `sim-uat.sh` staff-access deny artifact on `f67cf35` (coordinator UAT gate per PR #557). Gap does not indicate authz or fail-closed regression in diff. |
| Security | **PASS** |
| **Combined (Wave C)** | **PASS with known gap** |
