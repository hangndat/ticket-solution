# Evidence — Issue #106 / #107 [D7-S1-T2/T3] Offline sync apply + queue replay

Ngày: 2026-10-17  
Branch: `hangndat/d7-be-offline-sync`  
Issues: [#106](https://github.com/hangndat/ticket-solution/issues/106), [#107](https://github.com/hangndat/ticket-solution/issues/107) · Story [#104](https://github.com/hangndat/ticket-solution/issues/104) · Epic [#103](https://github.com/hangndat/ticket-solution/issues/103)

## Phạm vi

- **#106:** Durable conflict resolution + idempotent `CHECKIN_OFFLINE` apply (`applyOfflineSyncBatch`, ledger `offline_sync_events`)
- **#107:** API `POST /v1/gate/events/{eventId}/offline-sync` + worker `replayOfflineSyncBatch` (cùng apply path); audit `gate.offline_sync.apply`

## Checks

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/backend exec node --test test/offline-sync-unit.test.cjs
pnpm --filter @ticket/backend exec node --test test/offline-sync-apply.test.cjs
pnpm --filter @ticket/backend exec node --test test/rls-catalog.test.cjs
pnpm --filter @ticket/api openapi && pnpm --filter @ticket/api test
pnpm --filter @ticket/worker test
```

## Limitations

- Client iOS/web queue UI → D7-S2/S3
- Undo/revoke offline vẫn online-only (ADR-18)
- Contract #105 (PR #173) nằm trên cùng nhánh lịch sử; merge cần phối hợp với base Epic

## Artifact

Exact tip SHA ghi trên Issue/PR comment sau commit push.
