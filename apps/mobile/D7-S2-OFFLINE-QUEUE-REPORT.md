# D7-S2 — iOS offline scan queue (#109 / #110 / #111)

**Branch:** `hangndat/d7-ios-offline-queue`  
**Story:** #108 · **Epic:** #103  
**Ownership:** `apps/mobile` only  
**Contract mirror:** Issue #105 / ADR-18 (`offline-sync-contract.ts` until `@ticket/contracts` merges)

## Delivered

| Issue | Scope | Implementation |
| --- | --- | --- |
| #109 | Persist scan queue | `OfflineScanQueue` + SecureStore (`offline-queue-store.ts`) — survives re-hydrate; monotonic `clientSeq` per device+session |
| #110 | Replay + conflict | `POST …/offline-sync` batch ≤50; maps `OFFLINE_SYNC_*` / `ALREADY_CHECKED_IN` → VI staff copy; `NOT_IMPLEMENTED` keeps pending |
| #111 | UI offline/sync VI | Staff banner (`offlineBannerCopy`) + queue list + “Đồng bộ hàng đợi ngay” on `StaffScreen` |

## Behaviour notes

- Queued scans use Gate phase `queued` — **never** admission until server APPLIED/DUPLICATE.
- Offline enqueue requires an existing `staffSessionId` (open session while online first).
- Connectivity via `/health` probe + fetch failures (no new NetInfo lockfile dep).

## Checks

```bash
cd apps/mobile && pnpm test && pnpm typecheck && pnpm lint
```

- 148 tests pass (incl. `src/gate/offline-queue.test.ts`, gate-scan offline signals)
- `tsc --noEmit` clean
- `eslint src` clean

## Evidence artifacts

- Unit: `apps/mobile/src/gate/offline-queue.test.ts`
- Banner screenshots (VI copy): `apps/mobile/uat-evidence/d7-s2/*.png`
  - `d7-s2-offline-banner.png`
  - `d7-s2-syncing-banner.png`
  - `d7-s2-conflict-banner.png`
- Also copied under gitignored `apps/mobile/.uat-artifacts/` for sim-uat path parity

## Limitations

- Durable server apply still stubbed until BE #106 — client keeps pending on `OFFLINE_SYNC_NOT_IMPLEMENTED`.
- Full Simulator UI drive deferred; headless banner PNGs + unit replay cover acceptance for this slice.
- Contract types mirrored locally until PR #173 (`@ticket/contracts` offline-sync) lands on `main`.

## Impl SHA

`0877c2972879bd8de933f57012f779547ae7f514`
