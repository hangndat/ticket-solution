# D7-S4 — Milestone gate UAT (headless)

**Ngày:** 2026-10-17  
**Story:** [#115](https://github.com/hangndat/ticket-solution/issues/115) · **Task:** [#116](https://github.com/hangndat/ticket-solution/issues/116)  
**Epic:** [#103](https://github.com/hangndat/ticket-solution/issues/103)  
**PR:** [#190](https://github.com/hangndat/ticket-solution/pull/190)  
**Role:** Cursor iOS worker (sim-uat / AXe — không cliclick / Computer Use; không EAS Cloud)

## SHA under evidence (exact)

| Slice | Exact SHA |
| --- | --- |
| Client tip (`hangndat/d7-milestone` after this evidence push) |  |
| Behavior (mobile offline UAT code) | `c8606fe59a8e5771aac79c420736960781d3ee3a` |
| Server / integration (`origin/main` API with `POST …/offline-sync`) | `f7c88ffd6f936b6da56aa8cea8451f3ae889c278` |
| Prior DoD reval FAIL tip | `94eade19cd8d436cdab117eb654cf5407158eb1a` |

## DoD reval FAIL closed (F1/F2)

Reviewer findings on tip `94eade1…` / behavior `c8606fe…` (Codex `ctx_8f56cdb5a7d3`):

1. **F1:** Documents queue dump `localStatus=pending` after terminate, before restart/replay — **closed** (`d7-s4-queue-pending.json` + AX pending excerpt).
2. **F2:** DB checkins transcript `0 → 1 → 1` with timestamps + SHAs — **closed** (`d7-s4-checkins-transcript.md`).
3. Distinct screenshots (SHA256) for verified / after-restart-pending / after-replay / retry-nodup — **closed** (no byte-copies of staff-verified).

## T1 — iOS sim-uat offline queue (#116) — PASS (F1/F2 reval)

### Preconditions

- Simulator `F191CF59-4B73-44E5-BFA8-4CE439EB31AD` (iPhone 17 Pro)
- API `:3001` from **`origin/main`** `f7c88ffd…` (includes `POST /v1/gate/events/:eventId/offline-sync`) — this feature branch does not carry BE offline-sync; runtime used main worktree binary
- Keycloak ROPC `staff@example.com` / `staff-demo`
- Embedded HBC from `expo export` into Debug `Vemoki.app`
- Deep links: `vemoki://uat/staff-session?access_token=…`, `vemoki://uat/scan?ticketId=…&preferOffline=1`
- Ticket under test: `ace74a71-7646-431a-a73e-7281848002a1`
- clientEventId (this run): `2a5bfe8b-dd0d-4b71-a46a-95c8c66e0057`

### Commands (headless)

```bash
SIM=F191CF59-4B73-44E5-BFA8-4CE439EB31AD
ROOT=/Users/admin/orca/workspaces/ticket-solution/d7-milestone
UAT=$ROOT/apps/mobile/.uat-artifacts
TICKET=ace74a71-7646-431a-a73e-7281848002a1

# Staff session verified
TOKEN=$(curl -s -X POST 'http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/token' \
  -d 'grant_type=password' -d 'client_id=ticket-mobile' \
  -d 'username=staff@example.com' -d 'password=staff-demo' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
xcrun simctl openurl "$SIM" "vemoki://uat/staff-session?access_token=${TOKEN}" &
xcrun simctl launch "$SIM" com.hangndat.ticket
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-staff-verified.png"

# Offline enqueue (session open online, then CHECKIN_OFFLINE)
xcrun simctl openurl "$SIM" "vemoki://uat/scan?ticketId=${TICKET}&preferOffline=1"
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-offline-enqueued.png"
# AX: OFFLINE_ENQUEUED pending=1

# Persist across process kill — dump Documents BEFORE restart (F1)
xcrun simctl terminate "$SIM" com.hangndat.ticket
# Documents/ticket-gate-offline/queue-<userId>.json → localStatus=pending
# → docs/reviews/d7-uat/ios/d7-s4-queue-pending.json

# Pause API so cold restart cannot auto-replay (evidence-only)
# cold launch + Staff tab → pending UI screenshot
xcrun simctl launch "$SIM" com.hangndat.ticket
scripts/sim-uat.sh tap --udid "$SIM" --label 'Nhân viên'
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-offline-after-restart.png"
# DB checkins still 0

# Restore API (origin/main) → staff-session triggers replay
xcrun simctl openurl "$SIM" "vemoki://uat/staff-session?access_token=${TOKEN}"
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-offline-after-replay.png"
# DB: checkins=1; queue localStatus=applied

# Retry same ticket offline — no duplicate check-in
xcrun simctl openurl "$SIM" "vemoki://uat/scan?ticketId=${TICKET}&preferOffline=1"
# DB: checkins still 1
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-offline-retry-nodup.png"
```

### Result

| Check | Result |
| --- | --- |
| Staff session `Phiên: verified` (not signed-out) | PASS |
| Offline enqueue `OFFLINE_ENQUEUED pending=1` | PASS |
| F1: Documents dump after terminate `localStatus=pending` (same ticketId/clientEventId) | PASS |
| Persist across terminate; checkins=0 before replay | PASS |
| After-restart UI pending (API paused) — distinct PNG | PASS |
| Online replay → `localStatus=applied`, checkinId set, DB checkins=1 | PASS |
| Retry same ticket → checkins remains 1 (no duplicate) | PASS |
| Screenshot SHA256 all distinct (no staff-verified byte copies) | PASS |
| Tooling | sim-uat.sh / AXe / simctl only |

### Artifacts (curated under `docs/reviews/`)

- [`d7-uat/ios/d7-s4-staff-verified.png`](./d7-uat/ios/d7-s4-staff-verified.png)
- [`d7-uat/ios/d7-s4-offline-enqueued.png`](./d7-uat/ios/d7-s4-offline-enqueued.png) — `OFFLINE_ENQUEUED pending=1`
- [`d7-uat/ios/d7-s4-queue-pending.json`](./d7-uat/ios/d7-s4-queue-pending.json) — **F1** redacted Documents dump (`pending`)
- [`d7-uat/ios/d7-s4-ax-pending-pre-terminate.txt`](./d7-uat/ios/d7-s4-ax-pending-pre-terminate.txt) — AX pending (not applied)
- [`d7-uat/ios/d7-s4-offline-after-restart.png`](./d7-uat/ios/d7-s4-offline-after-restart.png) — pending while API paused
- [`d7-uat/ios/d7-s4-ax-after-restart.txt`](./d7-uat/ios/d7-s4-ax-after-restart.txt)
- [`d7-uat/ios/d7-s4-offline-after-replay.png`](./d7-uat/ios/d7-s4-offline-after-replay.png)
- [`d7-uat/ios/d7-s4-offline-retry-nodup.png`](./d7-uat/ios/d7-s4-offline-retry-nodup.png)
- [`d7-uat/ios/d7-s4-queue-final.json`](./d7-uat/ios/d7-s4-queue-final.json) — `applied` + checkinId
- [`d7-uat/ios/d7-s4-checkins-transcript.md`](./d7-uat/ios/d7-s4-checkins-transcript.md) — **F2** `0 → 1 → 1` + SHAs

### Screenshot SHA256 (this reval)

```
d9d530849d580d0bee9718baa046cd0952068832ba86437fe2ac590e2416d96e  d7-s4-staff-verified.png
dceafca85cc9253e9f03cbaf1a4db09db827ef3fb6b593072b8f6eda730f5eff  d7-s4-offline-enqueued.png
1e640cd0192bee3a41de145f23c19e0f89b0b8a298de7f6045f8106fa10f72fa  d7-s4-offline-after-restart.png
af73b6d7ea01e5be0870417971ae7d2a8baf1b241134ece7292928b42f311981  d7-s4-offline-after-replay.png
a3b11fec2ba7570fd174318befb0dedaad7e87428b18c3673d90c41e856bb5ed  d7-s4-offline-retry-nodup.png
```

### Client fixes retained (iOS ownership, prior commit `c8606fe`)

- Gate offline queue durable store → `expo-file-system`
- Accept HTTP **201** on gate session open
- UAT deep-link helpers: `uat/staff-session`, `uat/scan?preferOffline=1`
- `createUuid` via `expo-crypto`

## Web UAT (#116) — retained from prior gate

See prior section evidence (Playwright offline `/gate`) — unchanged; SHAs in history above.

## Related

- [#117 iOS build](./D7-S4-IOS-BUILD.md) — excerpt [`d7-s4/xcodebuild-d7-excerpt.log`](./d7-s4/xcodebuild-d7-excerpt.log)
- [#118 deploy](./D7-S4-DEPLOY-PROD.md) — **skip** (not authorized)
