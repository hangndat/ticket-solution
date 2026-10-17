# D7-S4 — Milestone gate UAT (headless)

**Ngày:** 2026-10-17  
**Story:** [#115](https://github.com/hangndat/ticket-solution/issues/115) · **Task:** [#116](https://github.com/hangndat/ticket-solution/issues/116)  
**Epic:** [#103](https://github.com/hangndat/ticket-solution/issues/103)  
**PR:** [#190](https://github.com/hangndat/ticket-solution/pull/190)  
**Role:** Cursor iOS worker (sim-uat / AXe — không cliclick / Computer Use; không EAS Cloud)

## SHA under evidence (exact)

| Slice | Exact SHA |
| --- | --- |
| Client tip (`hangndat/d7-milestone` after this evidence push) | *(fill after `git rev-parse HEAD` on push tip — see PR #190 tip)* |
| Server / integration (`origin/main` runtime for API + offline-sync) | `f7c88ffd6f936b6da56aa8cea8451f3ae889c278` |
| Prior FAIL tip (DoD c9bd246) | `3f352a5e2710b2a99f19b40bbf480c3fc5ed8d61` |

## T1 — iOS sim-uat offline queue (#116) — PASS (re-run)

### Preconditions

- Simulator `F191CF59-4B73-44E5-BFA8-4CE439EB31AD` (iPhone 17 Pro)
- Local API `:3001`, Keycloak ROPC `staff@example.com` / `staff-demo`
- Embedded HBC from `expo export` into Debug `Vemoki.app` (native+JS same D7 tree)
- Deep links: `vemoki://uat/staff-session?access_token=…`, `vemoki://uat/scan?ticketId=…&preferOffline=1`

### Commands (headless)

```bash
SIM=F191CF59-4B73-44E5-BFA8-4CE439EB31AD
ROOT=/Users/admin/orca/workspaces/ticket-solution/d7-milestone
UAT=$ROOT/apps/mobile/.uat-artifacts
TICKET=ace74a71-7646-431a-a73e-7281848002a1

pnpm --filter @ticket/mobile test   # 182/182 pass

# Staff session (verified via /v1/me — not signed-out)
TOKEN=$(curl -s -X POST 'http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/token' \
  -d 'grant_type=password' -d 'client_id=ticket-mobile' \
  -d 'username=staff@example.com' -d 'password=staff-demo' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
xcrun simctl openurl "$SIM" "vemoki://uat/staff-session?access_token=${TOKEN}" &
xcrun simctl launch "$SIM" com.hangndat.ticket
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-staff-verified.png"

# Offline enqueue (session open online, then CHECKIN_OFFLINE — no live admit)
xcrun simctl openurl "$SIM" "vemoki://uat/scan?ticketId=${TICKET}&preferOffline=1"
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-offline-enqueued.png"
# AX: OFFLINE_ENQUEUED pending=1

# Persist across process kill (queue FileSystem, checkins still 0)
xcrun simctl terminate "$SIM" com.hangndat.ticket
# Documents/ticket-gate-offline/queue-<userId>.json → localStatus=pending

# Restart + online replay
xcrun simctl openurl "$SIM" "vemoki://uat/staff-session?access_token=${TOKEN}" &
xcrun simctl launch "$SIM" com.hangndat.ticket
scripts/sim-uat.sh screenshot "$SIM" "$UAT/d7-s4-offline-after-restart.png"
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
| Persist across terminate (FileSystem queue `localStatus=pending`, checkins=0) | PASS |
| Online replay → `localStatus=applied`, `checkinId` set, DB checkins=1 | PASS |
| Retry same ticket → checkins remains 1 (no duplicate) | PASS |
| Multi-device / already-used conflict banner (earlier run) | PASS (feasible) — VI conflict copy when ticket already USED |
| Unit tests `@ticket/mobile` | 182/182 PASS |
| Tooling | sim-uat.sh / AXe / simctl only |

### Artifacts (curated under `docs/reviews/`)

- [`d7-uat/ios/d7-s4-staff-verified.png`](./d7-uat/ios/d7-s4-staff-verified.png)
- [`d7-uat/ios/d7-s4-offline-enqueued.png`](./d7-uat/ios/d7-s4-offline-enqueued.png) — `OFFLINE_ENQUEUED pending=1`
- [`d7-uat/ios/d7-s4-offline-after-restart.png`](./d7-uat/ios/d7-s4-offline-after-restart.png)
- [`d7-uat/ios/d7-s4-offline-after-replay.png`](./d7-uat/ios/d7-s4-offline-after-replay.png)
- [`d7-uat/ios/d7-s4-offline-retry-nodup.png`](./d7-uat/ios/d7-s4-offline-retry-nodup.png)
- [`d7-uat/ios/d7-s4-queue-final.json`](./d7-uat/ios/d7-s4-queue-final.json) — redacted queue row (`applied` + checkinId)

### Client fixes in this re-run (iOS ownership)

- Gate offline queue durable store → `expo-file-system` (SecureStore/Settings wedged Simulator JS thread)
- Accept HTTP **201** on gate session open
- UAT deep-link helpers: `uat/staff-session`, `uat/scan?preferOffline=1`
- `createUuid` via `expo-crypto` (Hermes lacks `crypto.randomUUID`)

## Web UAT (#116) — retained from prior gate

See prior section evidence (Playwright offline `/gate`) — unchanged; SHAs in history above.

## Related

- [#117 iOS build](./D7-S4-IOS-BUILD.md)
- [#118 deploy](./D7-S4-DEPLOY-PROD.md) — **skip** (not authorized)
