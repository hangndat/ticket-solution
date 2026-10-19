# UAT gap evidence — PR #557 · Issue #555 (iOS Phase 3)

| Field | Value |
| ----- | ----- |
| Wave | UX-UI-P3 · UAT gap (post DoD PASS with known gap) |
| Session | Wave leader `task_8ebfe868fd7f` / `ctx_7d39f2155129` (fan-out blocked → inline consolidation) |
| PR commit SHA | `f67cf35bfbab5b60702839a4848e5243473f9930` |
| DoD artifact | `docs/reviews/ux-ui-p3-ios-555-pr557-dod.md` (PASS with known gap) |

## Staff-access deny (O02) — gap closed for PR slice

DoD reviewer re-ran sim-uat on attendee persona → `vemoki://staff` deny UI. Evidence unchanged at SHA `f67cf35`:

| Artifact | Path |
| -------- | ---- |
| Screenshot | `apps/mobile/.uat-artifacts/ux-ui-p3-555-dod/staff-access-deny.png` |
| AX | «Không có quyền Nhân viên», CTA «Về Sự kiện» (see DoD § Headless sim-uat) |

Device: `Epic527-iOS-Gates` (`4AD7F2DC-5533-4C66-875C-A430DF3C734C`). Stub: `node scripts/o02-me-events-stub.mjs` (port 4370).

**Wave leader note:** Orca `emulator attach` not re-run this pass; prior DoD sim-uat + artifacts satisfy AC «staff-access deny gap» for #557. Policy: local sim only, no EAS cloud.

## Membership-invite deep link — still open

Installed sim binary at review time showed Expo **Unmatched Route** for `vemoki://invite?token=…` while source at `f67cf35` defines `/membership-invite` + tests. Artifacts document the gap:

| Artifact | Path |
| -------- | ---- |
| Bridge / cold | `apps/mobile/.uat-artifacts/ux-ui-p3-555-dod/membership-invite-bridge.png`, `membership-invite-cold.png` |

**Remediation:** `expo run:ios` / local prebuild rebuild dev client (Team `BLUA62D52G`) from SHA `f67cf35` before milestone gate (b); out of scope for merge blocker per DoD verdict.

## Unit / CI (unchanged)

- `pnpm --filter @ticket/mobile test` — 231 pass @ DoD
- CI run [39202130805](https://github.com/hangndat/ticket-solution/actions/runs/39202130805) — **pass** on PR head

## Merge recommendation

Coordinator may merge **#557** when board process allows: staff deny UAT evidenced; membership-invite runtime gap accepted per DoD or closed in follow-up rebuild task. D13 / App Store **PENDING** — no spawn this wave.
