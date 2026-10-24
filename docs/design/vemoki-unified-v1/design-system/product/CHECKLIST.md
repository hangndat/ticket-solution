# UX/UI Acceptance Checklist

## Visual consistency
- [ ] Reuse Vemoki brand mark, Sora, Be Vietnam Pro; neon only in high-value brand moments.
- [ ] Marketing remains high-energy; attendee feels celebratory; Staff is legible and safe; Portal is operational.
- [ ] No fake social proof, usage claims, customer logos, or disguised demo data.

## iOS Attendee
- [ ] Events cards, detail, redeem, wallet/QR, account work with authorization and tenant branding.
- [ ] QR passes scanner hardware/device tests and is not misrepresented when cached offline.
- [ ] Dynamic Type, VoiceOver, safe area, dark/light accessibility, loading/errors verified.

## iOS Staff (Gate only)
- [ ] Gate camera, manual admission fallback, and history are native routes only.
- [ ] Event/gate/session scoping stays visible and authoritative.
- [ ] Duplicate, rejected, queued, unknown, conflict are never painted 'admitted'.
- [ ] Offline sync/recovery and idempotency don't change with styling.
- [ ] Native simulator + physical scanner/device UAT evidence as appropriate.

## Attendee Web
- [ ] Public event, redeem, QR/tickets, account/support work across screen sizes.
- [ ] No Gate scan/manual admission or browser camera feature.
- [ ] Valid deep links, auth recoveries, error states, responsive/browser QA.

## Portal
- [ ] Role/tenant/event context and menu reflect backend permissions.
- [ ] Ant Design v6 theme compatible with existing build and app registry.
- [ ] Dense tables remain usable on narrow screens; no squeezed illegible grids.
- [ ] Gate reports require report.read and remain read-only. No Gate scan.
- [ ] Export, approvals, imports, CS and notification flows don't regress.

## Cross-surface
- [ ] Data statuses accurate, asOf timestamps where needed, no fake real-time.
- [ ] WCAG AA, keyboard/focus, iOS accessibility, reduced motion, text scaling.
- [ ] React/TypeScript lint, test, typecheck, build + privacy/security regressions.
- [ ] PR, evidence and review before saying implementation is complete.
