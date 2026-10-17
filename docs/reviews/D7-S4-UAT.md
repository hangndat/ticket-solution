# D7-S4 — Milestone gate UAT (headless)

**Ngày:** 2026-10-17  
**Story:** [#115](https://github.com/hangndat/ticket-solution/issues/115) · **Task:** [#116](https://github.com/hangndat/ticket-solution/issues/116)  
**Epic:** [#103](https://github.com/hangndat/ticket-solution/issues/103)  
**Role:** Cursor QA / milestone gate (không EAS Cloud; không cliclick / ORCA computer mouse)

## SHA under review (exact)

| Slice | Merge / tip | Exact SHA |
| --- | --- | --- |
| Integration tip (`origin/main` at gate run) | tip | `d6f53624ca8d5cd5410bf75ac614748eba1d7971` |
| Web gate offline (PR [#182](https://github.com/hangndat/ticket-solution/pull/182)) | merge | `e511058b6c149ef89a5b3b5b9b23f9d16502f9d4` |
| iOS offline queue (PR [#178](https://github.com/hangndat/ticket-solution/pull/178)) | merge | `0c8bcdf7846703628f6abbf98c4c06c896fb3aac` |
| BE offline sync (PR [#183](https://github.com/hangndat/ticket-solution/pull/183)) | merge | `0ff9460b7324512841a4aa115b838189455e4bd9` |

S1–S3 claimed **Hoàn thành** on Project #3 after merges above.

## T1 — Web headless UAT (#116)

### Commands

```bash
# Unit (gate decide + connectivity)
pnpm --filter @ticket/web exec tsx --test tests/gate-decide.test.ts tests/gate-connectivity.test.ts
# → 10/10 pass

# Next dev (UAT host) — worktree d7-web-offline (gate sources ≡ main for apps/web/app/gate)
pnpm exec next dev --hostname 127.0.0.1 --port 3010

# Playwright offline mode (never steals macOS mouse)
node apps/web/tests/gate-offline-uat.mjs http://127.0.0.1:3010
# → ok: offlineBanner=true, data-link=offline, CHECKIN_OFFLINE guide present

scripts/web-uat.sh screenshot http://127.0.0.1:3010/gate apps/web/.uat-artifacts/d7-s4-gate-online.png
```

### Result

| Check | Result |
| --- | --- |
| Online `/gate` 200 | PASS |
| Playwright `context.setOffline(true)` → banner `data-testid=gate-offline-banner` | PASS |
| Banner VI guides iOS `CHECKIN_OFFLINE` | PASS |
| Confirm submit disabled while offline | PASS |
| Unit gate-decide + connectivity | 10/10 PASS |

### Screenshots (curated)

- [`d7-uat/web/d7-s4-gate-offline.png`](./d7-uat/web/d7-s4-gate-offline.png)
- [`d7-uat/web/d7-s4-gate-online.png`](./d7-uat/web/d7-s4-gate-online.png)

## T1 — iOS sim-uat offline queue (#116)

### Commands

```bash
# Unit (incl. offline-queue.test.ts) — worktree d7-ios-offline / main tip sources
pnpm --filter @ticket/mobile test
# → 148/148 pass

# Headless Simulator (AXe + simctl — scripts/sim-uat.sh; no cliclick)
SIM=F191CF59-4B73-44E5-BFA8-4CE439EB31AD   # iPhone 17 Pro Booted
xcrun simctl launch "$SIM" com.hangndat.ticket
scripts/sim-uat.sh screenshot "$SIM" apps/mobile/.uat-artifacts/d7-s4-sim-launch.png
scripts/sim-uat.sh tap --label "Nhân viên" --udid "$SIM"
scripts/sim-uat.sh screenshot "$SIM" apps/mobile/.uat-artifacts/d7-s4-staff-screen.png
scripts/sim-uat.sh describe "$SIM"
```

### Result

| Check | Result |
| --- | --- |
| Launch `com.hangndat.ticket` (Vemoki) via simctl | PASS |
| Staff tab «Nhân viên» reachable (AXe tap) | PASS |
| Staff scan UI shows fail-closed copy (không admit khi phản hồi mất) | PASS |
| Offline queue unit + banner copy tests | 148/148 PASS |
| Live offline banner with pending queue on device | **GAP** — session `signed-out`; enqueue requires prior online `staffSessionId` |

### Screenshots (curated)

- [`d7-uat/ios/d7-s4-sim-launch.png`](./d7-uat/ios/d7-s4-sim-launch.png) — Events
- [`d7-uat/ios/d7-s4-staff-screen.png`](./d7-uat/ios/d7-s4-staff-screen.png) — Staff / Quét cổng (`Phiên: signed-out`)
- [`d7-uat/ios/d7-s2-offline-banner.png`](./d7-uat/ios/d7-s2-offline-banner.png) — VI offline queue banner (S2 evidence, retained)
- [`d7-uat/ios/d7-s2-syncing-banner.png`](./d7-uat/ios/d7-s2-syncing-banner.png)
- [`d7-uat/ios/d7-s2-conflict-banner.png`](./d7-uat/ios/d7-s2-conflict-banner.png)

## Gaps (explicit)

1. **iOS live offline enqueue/replay on Simulator** not driven end-to-end in this gate run (signed-out; no staff OIDC session). Covered by unit tests + S2 banner PNGs + staff screen fail-closed copy.
2. Web UAT ran against `d7-web-offline` worktree Next process; gate file tree matches merged PR #182 behavior. Integration SHA cited is `origin/main` tip above.
3. Sim UI showed Expo Go chrome on the running app; native local build evidence is separate (#117).

## Related artifacts

- [#117 iOS build](./D7-S4-IOS-BUILD.md)
- [#118 deploy prod](./D7-S4-DEPLOY-PROD.md) — **NOT authorized** (skipped)
