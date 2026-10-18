# D11-B3 — Attendee iOS handoff (#235)

**Issue:** [#235](https://github.com/hangndat/ticket-solution/issues/235) · Story [#233](https://github.com/hangndat/ticket-solution/issues/233) · Epic [#222](https://github.com/hangndat/ticket-solution/issues/222)  
**Spec:** `docs/tasks/d11/D11-B3-attendee-ios.md` · PD `docs/design/D11-PRODUCTION-UX-UI.md` §1.1 / §2.1–2.2 / §6.3  
**Ownership:** `apps/mobile` only · Team `BLUA62D52G` · **không** EAS Cloud Build  
**Role:** `ios` · `docs/agents/roles/ios.md`

## Thay đổi

| Surface | Việc |
| --- | --- |
| Ví / QR | Hierarchy PD: tên sự kiện + trạng thái VI primary; UUID / credentialVersion secondary selectable |
| Đổi mã / claim | `presentRedeemDecision` — copy VI plain; auth / stale / unknown / pending không giả vé |
| Events | Demo ≥2 tenant (`demo-fun` / `demo-studio`) apply brand chrome; label `Tổ chức:` |
| Brand logout | Clear branding SecureStore cache + ThemeProvider reset khi signed-out (S-P0-C) |
| Copy guest | Bỏ Keycloak / Nest / schema version khỏi chrome khách |

## Không đổi

- QR payload / offline display / SessionBoundary / Keychain / auth contract
- Offline redeem (cấm)
- Gate staff (#231) · web · API

## Checks

```bash
cd apps/mobile && pnpm test && pnpm typecheck && pnpm lint
```

- Unit: `src/attendee/attendee-outcome-copy.test.ts` (+ screen-state-copy)
- Headless: `scripts/sim-uat.sh` → `apps/mobile/.uat-artifacts/d11-b3/`

## Brand-test S-P0-C (≥2 tenant)

| Tenant | Marker |
| --- | --- |
| `demo-fun` | Demo FUN Collective · `#245B47` · FUN FEST · Demo |
| `demo-studio` | Demo Studio Organization · `#59428A` · Studio Night · Demo |

Sau «Đổi tổ chức demo»: chrome/org name đổi; không lẫn brand tenant trước.

## Limits

- Simulator ≠ device UAT; ≠ store; ≠ pilot ready
- Prototype HTML ≠ runtime pass
- TicketSummary không có `eventName` — tên sự kiện từ demo catalog khi khớp `eventId`
