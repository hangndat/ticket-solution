# Evidence — Issue #105 [D7-S1-T1] Offline sync contract

Ngày: 2026-10-17  
Branch: `hangndat/d7-be-offline-contract`  
Issue: [#105](https://github.com/hangndat/ticket-solution/issues/105) · Story [#104](https://github.com/hangndat/ticket-solution/issues/104)

## Phạm vi đã giao

- Freeze transport: payload `CHECKIN_OFFLINE`, idempotency `clientEventId`, clock skew ±300s, conflict codes, replay order
- OpenAPI path `POST /v1/gate/events/{eventId}/offline-sync`
- Docs ADR-18; stub apply → 501 `OFFLINE_SYNC_NOT_IMPLEMENTED` (#106)

## Checks

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/backend exec node --test test/offline-sync-unit.test.cjs
pnpm --filter @ticket/api openapi
pnpm --filter @ticket/api test
```

- Commit: `70a9c197a6827715834c9ad9d65a90c65ff25be0`
- PR: https://github.com/hangndat/ticket-solution/pull/173 (base `hangndat/d7-offline-gate`)

## Ngoài phạm vi

- Durable apply / conflict resolution runtime (#106)
- iOS/web clients (D7-S2/S3)
