# VD-06 / Issue #879 — Staff scan UI evidence

| Field | Value |
| --- | --- |
| Branch | `hangndat/vd06-ios-staff` |
| **SHA** | `85f90ce3` (run `git rev-parse HEAD` on branch) |
| Base | `992a85e9` |
| Scope | `apps/mobile/**` only |

## Summary

- Staff scan: large `StaffGateScanStatusPanel` under camera (`gate-scan-outcome-panel`); camera toast only for terminal admit/recorded flash (`shouldShowCameraToast`).
- Sticky outcomes (queued/unknown/denied/conflict-class) stay on panel with amber/unknown surfaces — no green admit.
- COPY-GUIDE queued headline: «Chờ đồng bộ — Chưa xác nhận vào cổng» in `gate-outcome-copy` + `gate-scan-status-ui`.
- Camera denied: `gate-camera-denied` card with Settings CTA when blocked.
- Sticky ops: event title + `Phiên cổng · {shortId}` + connectivity/session strip (unchanged classifier/API/idempotency/offline).

## Checks (SHA `85f90ce3`)

```bash
pnpm --filter @ticket/contracts build
cd apps/mobile && pnpm test && pnpm typecheck && pnpm lint
```

- **test:** pass (gate + mobile suite)
- **typecheck:** pass
- **lint:** pass (pre-existing warnings only)

## Gaps / limitations

- **Sim UAT:** not run this dispatch (no `expo prebuild`/Release sim build in session). Physical camera + offline UNKNOWN paths untested on device.
- **Reviewer:** independent review not in scope of worker dispatch.

## K-03 spot-check

| State | Admit green? | Surface |
| --- | --- | --- |
| Fresh APPLIED | Yes (`tone: admit`) | Panel + brief toast |
| Queued / unknown / conflict | No (`tone: unknown`) | Panel sticky |
| Denied | No (`tone: deny`) | Panel sticky |
