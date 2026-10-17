# D7-S4 F2 — checkins count transcript (redacted)

**Ngày:** 2026-10-17  
**Story/Task:** #115 / #116 · PR #190  
**client tip (docs commit will update):** 763e14951c7a74f081ccb50e08ac0bc8201ac244  
**behavior SHA (mobile):** `c8606fe59a8e5771aac79c420736960781d3ee3a`  
**server/runtime SHA (`origin/main` API with offline-sync):** `f7c88ffd6f936b6da56aa8cea8451f3ae889c278`  
**ticketId:** `ace74a71-7646-431a-a73e-7281848002a1`  
**clientEventId:** `2a5bfe8b-dd0d-4b71-a46a-95c8c66e0057`

## Commands (secrets redacted)

```bash
# Count current checkins for ticket (no secrets in SQL)
psql "$DATABASE_URL" -Atc \
  "SELECT count(*) FROM checkins WHERE ticket_id='ace74a71-7646-431a-a73e-7281848002a1'::uuid AND undone_at IS NULL;"
```

## Timeline (UTC)

| Phase | Timestamp | checkins | Notes |
| --- | --- | --- | --- |
| before_enqueue | 2026-10-17T13:07:38Z | **0** | ticket ACTIVE, queue cleared |
| after_enqueue_before_replay | 2026-10-17T13:07:47Z | **0** | Documents queue `localStatus=pending` dumped; app terminated; API paused for restart UI |
| after_restart_before_replay | 2026-10-17T13:07:59Z | **0** | cold launch + Staff; AX «Đã xếp hàng offline»; queue still pending |
| after_replay | 2026-10-17T13:09:02Z | **1** | online replay → `localStatus=applied`, checkinId set |
| after_retry | 2026-10-17T13:09:16Z | **1** | same ticket preferOffline retry — no duplicate |

## Final DB row (stdout, redacted)

```
                  id                  |              ticket_id               | source  |           client_event_id            |         confirmed_at          
--------------------------------------+--------------------------------------+---------+--------------------------------------+-------------------------------
 431913ad-f107-4a6a-936b-2239f5d78d2e | ace74a71-7646-431a-a73e-7281848002a1 | OFFLINE | 2a5bfe8b-dd0d-4b71-a46a-95c8c66e0057 | 2026-10-17 13:08:51.632922+00
(1 row)
```

## SHA256 of screenshots (must be distinct)

```
d9d530849d580d0bee9718baa046cd0952068832ba86437fe2ac590e2416d96e  /Users/admin/orca/workspaces/ticket-solution/d7-milestone/docs/reviews/d7-uat/ios/d7-s4-staff-verified.png
dceafca85cc9253e9f03cbaf1a4db09db827ef3fb6b593072b8f6eda730f5eff  /Users/admin/orca/workspaces/ticket-solution/d7-milestone/docs/reviews/d7-uat/ios/d7-s4-offline-enqueued.png
1e640cd0192bee3a41de145f23c19e0f89b0b8a298de7f6045f8106fa10f72fa  /Users/admin/orca/workspaces/ticket-solution/d7-milestone/docs/reviews/d7-uat/ios/d7-s4-offline-after-restart.png
af73b6d7ea01e5be0870417971ae7d2a8baf1b241134ece7292928b42f311981  /Users/admin/orca/workspaces/ticket-solution/d7-milestone/docs/reviews/d7-uat/ios/d7-s4-offline-after-replay.png
a3b11fec2ba7570fd174318befb0dedaad7e87428b18c3673d90c41e856bb5ed  /Users/admin/orca/workspaces/ticket-solution/d7-milestone/docs/reviews/d7-uat/ios/d7-s4-offline-retry-nodup.png
```

## Related artifacts

- `d7-s4-queue-pending.json` — F1 Documents dump after terminate, before restart
- `d7-s4-ax-pending-pre-terminate.txt` — AX OFFLINE_ENQUEUED pending=1
- `d7-s4-ax-after-restart.txt` — AX pending while API paused
- `d7-s4-queue-final.json` — applied + checkinId
