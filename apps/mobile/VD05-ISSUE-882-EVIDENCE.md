# VD-05 / Issue #882 — Attendee iOS evidence

| Field | Value |
| --- | --- |
| Branch | `hangndat/vd05-ios-attendee` |
| **Code SHA** | `bda842005d0306e060213741e9ad4ca0db91c2ad` |
| Base | `c242b7ce7859d6b0c36fe8fbb333aab37311631a` |
| Scope | `apps/mobile/**` only |

## Summary

- Attendee tab surfaces (Sự kiện, Vé của tôi, Tài khoản): Live Pulse `ScreenAtmosphere` wash; events list adds hero support copy + Dynamic Type cap on headline.
- Wallet offline banner aligned to COPY-GUIDE: «Bản vé đã lưu» / «Trạng thái có thể chưa cập nhật» (+ existing last-sync suffix via `walletOfflineNoticeBody`).
- Ticket detail: shared `TicketStatusPill`, media-plane separator before QR, header a11y/Dynamic Type on title stack.
- OIDC/redeem/QR payload/tenant isolation unchanged; no Wallet store, no attendee scanner.

## Checks

```bash
node scripts/ui-budget.mjs --scope mobile
pnpm --filter @ticket/contracts build
cd apps/mobile && pnpm test && pnpm typecheck && pnpm lint
```

## Gaps / limitations

- **Sim UAT:** not run this dispatch (no local Release sim build in session).
- **Physical QR:** UNKNOWN — not exercised on device this dispatch.
- **Reviewer:** independent `dod+ux` not in worker scope.

## Remaining scope (non-blocking)

- Pixel polish vs `design-system/product/previews/attendee-mobile.png` on device builds.
- Broader Dynamic Type pass on redeem/global-redeem form fields (intentionally uncapped per existing redeem-form comment).
