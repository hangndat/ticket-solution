# VD-06 / Issue #879 — Staff scan UI evidence

| Field | Value |
| --- | --- |
| Branch | `hangndat/vd06-ios-staff` |
| **Code SHA** | `85f90ce3` (staff scan UI behavior; unchanged through evidence tip) |
| **Evidence tip** | Run `git rev-parse HEAD` after each commit on branch (includes doc-only + fix rounds) |
| Base | `992a85e9` |
| Scope | `apps/mobile/**` only |

## Summary

- Staff scan: large `StaffGateScanStatusPanel` under camera (`gate-scan-outcome-panel`); camera toast only for terminal admit/recorded flash (`shouldShowCameraToast`).
- Sticky outcomes (queued/unknown/denied/conflict-class) stay on panel with amber/unknown surfaces — no green admit.
- COPY-GUIDE queued headline: «Chờ đồng bộ — Chưa xác nhận vào cổng» in `gate-outcome-copy` + `gate-scan-status-ui`.
- Camera denied: `gate-camera-denied` card with Settings CTA when blocked.
- Sticky ops: event title + `Phiên cổng · {shortId}` + connectivity/session strip (unchanged classifier/API/idempotency/offline).

## Checks

Re-run on **current branch tip** after fix rounds (not the historical code SHA alone):

```bash
node scripts/ui-budget.mjs --scope mobile
pnpm --filter @ticket/contracts build
cd apps/mobile && pnpm test && pnpm typecheck && pnpm lint
```

Initial worker dispatch (code @ `85f90ce3`): test/typecheck/lint pass; **ui-budget** failed on review SHA `88c67a32` until F01 semantic surfaces (fix round 1).

- **ui-budget (mobile):** pass after F01 (`mobile.tsx_hex_literals` back to baseline 0)
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
