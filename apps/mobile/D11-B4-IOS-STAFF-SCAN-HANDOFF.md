# D11-B4 — iOS staff scan Gate UX (#231)

| Trường | Giá trị |
| --- | --- |
| Issue | [#231](https://github.com/hangndat/ticket-solution/issues/231) · parent #230 · Epic #222 |
| Branch | `hangndat/d11-ios-gate` |
| Impl SHA | `46a9f23820196043553265dab50034470eeb9613` |
| Base | `e8512d0055e0e9d6585007e8363b6224a7138b12` |
| Ownership | `apps/mobile` only |
| Role | `ios` · `docs/agents/roles/ios.md` |

## Đã làm

- Composition Gate theo PD: ngữ cảnh sự kiện/cổng/phiên · vùng quét · outcome lớn · hàng đợi · giám sát.
- Copy VI phân biệt online/offline/pending/APPLIED/DUPLICATE/CONFLICT/REJECTED/unknown/queued/already-checked-in.
- `unknown` / `queued` / CONFLICT / DUPLICATE **không** dùng tone admit (xanh cho vào).
- Banner “Trực tuyến” đổi sang tone `default` (connectivity ≠ admission).
- `admissionKind` UI-only trên `GateOp` — **không** đổi `classifyScan` / reconcile / race protocol.
- Module `gate-outcome-copy.ts` + unit tests.

## Checks

```bash
cd apps/mobile && pnpm test && pnpm typecheck && pnpm lint
# 191 pass · tsc clean · eslint clean
```

## Local build (không EAS Cloud)

- Team `BLUA62D52G` (pbxproj + xcodebuild).
- `expo prebuild --platform ios` + `pod install` + `xcodebuild` Debug/Release simulator.
- DerivedData task-owned: `apps/mobile/.uat-artifacts/d11-b4-ios/DerivedData/`
- Logs: `…/prebuild.log`, `…/xcodebuild-sim.log`, `…/xcodebuild-sim-release.log`
- Fixture bake (không đổi prod default trong `app.config.ts`):
  - `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4111`
  - `EXPO_PUBLIC_OIDC_ISSUER=http://127.0.0.1:18091/realms/ticket`
  - `EXPO_PUBLIC_OIDC_CLIENT_ID=ticket-mobile`
  - tenant/event fixture UUIDs

## Headless sim UAT

| Mục | Giá trị |
| --- | --- |
| Simulator | **D11-Gate-UAT** `121ECECA-D9F9-45D6-BC69-789958E07055` (task-owned; không đụng sim booted khác) |
| Metro | cổng **8111** (Debug cần Metro; UAT screenshot dùng **Release** embed bundle) |
| Artifacts | `apps/mobile/.uat-artifacts/d11-b4-ios/staff-scan.png` · `staff-home.png` |
| Tool | `scripts/sim-uat.sh` + AXe / simctl — không chuột macOS |

A11y quan sát trên Staff: banner ngoại tuyến, «Ngữ cảnh cổng», «Vùng quét», «Chờ mã quét», giám sát chưa rõ, API `127.0.0.1:4111`.

## Giới hạn

- Backend fixture #237 (API :4111 / OIDC :18091) **chưa** handoff sẵn — không chạy check-in/offline sync E2E thật; không mock auth production.
- Screenshot outcome denied sau type input bị flake AXe focus; phủ bằng unit `gate-outcome-copy.test.ts` + `supervisor.test.ts`.
- Device UAT thật: không (không có thiết bị task-owned).
- `worker_done` = code/PR/evidence — **không** claim acceptance / Hoàn thành / pilot.

## Cleanup task-owned

- Metro 8111 process (worker start) — tắt sau bàn giao.
- Simulator D11-Gate-UAT có thể shutdown; không shutdown sim người khác.
- `ios/` / DerivedData gitignored — giữ local cho audit.

## Files changed

- `apps/mobile/src/screens/staff.tsx`
- `apps/mobile/src/gate/gate-outcome-copy.ts` (+ test)
- `apps/mobile/src/gate/gate-scan.ts`
- `apps/mobile/src/gate/offline-queue.ts` (+ test banner)
- `apps/mobile/src/gate/supervisor.test.ts`
- `apps/mobile/src/components/screen-state-copy.ts`
