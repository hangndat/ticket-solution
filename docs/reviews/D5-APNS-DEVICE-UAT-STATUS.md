# D5 APNs device UAT — status

**Date:** 2026-10-17  
**Device:** Dexter iPhone 16 Pro (`00008140-000605803C01801C` / CoreDevice `06CAC741-EB05-55B0-AAE6-14D7B49F50BB`)  
**Build:** local Release `com.hangndat.ticket` (Team `BLUA62D52G`, `aps-environment=development`, provisional UN auth)  
**Fixture user:** `2183e5c3-f29b-40d4-972f-99530bf980a9` (attendee)

## Verdict

| Gate | Result |
| --- | --- |
| Native APNs device token on device | **PASS** |
| `POST /v1/me/device-tokens` → `device_tokens` row | **PASS** (`environment=sandbox`) |
| APNs provider **ACCEPTED** (HTTP 200) | **PASS** |
| On-device **DELIVERED** (visible NC / lock screen) | **PASS** |

ADR-12: ACCEPTED and DELIVERED both evidenced this session.

## Evidence

### Device token + backend register

- WDA Register (`testID` `register-apns-device-token`) → UI:  
  `Native APNs token ready 3f9d…dcdb (64 chars). Backend registration saved.`
- Prod DB (`ticket_owner` / `ticket_solution`):

```text
 count = 1
 token prefix 3f9d99d9c0d8d31fd3364c30
 environment  sandbox
 user_id      2183e5c3-f29b-40d4-972f-99530bf980a9
 created_at   2026-10-17 14:25:49.782+00
```

### APNs ACCEPTED (sandbox)

Direct HTTP/2 to `api.sandbox.push.apple.com` with AuthKey `4HL2CWNN69` / Team `BLUA62D52G` / topic `com.hangndat.ticket`:

| # | HTTP | apns-id | note |
| --- | --- | --- | --- |
| 1 | 200 | `9f8216c7-e0d7-4cc4-9b12-0d33dc6801d3` | earlier probe |
| 2 | 200 | `c81aff7b-466a-4e77-942d-7ad47cefd80b` | earlier probe |
| 3 | 200 | `10e15be2-047c-416a-a7a7-6e9865bd4e24` | earlier probe |
| 4 | 200 | `69DE800B-FF21-4DAA-FB20-B42CE1463ECA` | body `D5 DELIVERED check 14:41:25` → on-device |

### DELIVERED (on-device)

After unlock (`passcodeRequired=false`), WDA unlock + home + NC swipe (top-left):

- Lock screen / Notification Center shows **Vemoki** notification:
  - Title: **Vé đã sẵn sàng**
  - Body: **D5 DELIVERED check 14:41:25**
  - Provisional prompt: “Keep receiving notifications from the Vemoki app?”
- Artifacts:
  - `apps/mobile/.uat-artifacts/d5-delivered-PASS.png` (WDA)
  - `apps/mobile/.uat-artifacts/d5-delivered-PASS-dvt.png` (DVT)
  - `apps/mobile/.uat-artifacts/d5-delivered-nc-cli.png`
  - `/tmp/d5-apns-delivered-attempt.json` (`http:200`, apns-id `69DE800B-…`)

### Worker outbox redrive (known gap)

Inserted `TicketIssued` outbox earlier stayed `PENDING`; VPS worker still on D4 email/MinIO path and did not write `notifications` push rows. ACCEPTED+DELIVERED above are from **direct sandbox send** with the same AuthKey class as worker config — not yet end-to-end worker → APNs → device.

## Fixes landed locally (uncommitted / node_modules patch)

1. **`apns-device-token.ts`**: skip `requestPermissionsAsync` (hung under WDA/iOS 26); token via `getDevicePushTokenAsync`; Metro `require()` instead of `await import()` (Release Hermes); surface native error detail.
2. **`push-status.tsx`**: Registering feedback, UI watchdog, `testID`, busy a11y label.
3. **`AppDelegate.swift`**: early `registerForRemoteNotifications`; forward token callbacks; provisional `requestAuthorization` for NC delivery without Allow dialog.
4. **`PushTokenModule.swift` (node_modules)**: native 12s timeout on global queue.
5. **`Vemoki.entitlements`**: `aps-environment=development` to match USB Development profile.

Unit tests: `apns-device-token.test.ts` 9/9 pass.

## Remaining (Issue #6 polish, not blocking ACCEPTED+DELIVERED proof)

1. Worker-path: deploy/restart worker that processes TicketIssued with `options.apns` so `notifications.state='ACCEPTED'` lands in DB.
2. Commit/PR mobile fixes + document node_modules patch strategy.
3. Optional: production entitlement build when leaving sandbox tokens; confirm “Keep” provisional → alert for banners.
