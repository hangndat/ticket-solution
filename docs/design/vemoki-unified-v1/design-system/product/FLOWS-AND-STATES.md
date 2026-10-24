# User Journeys, Edge Cases, and State Contracts

## Journey A — Attendee iOS

1. Open **Sự kiện** and browse event cards (published only). Event details show organizer branding, timezone and invitation terms.
2. Redeem an invite code. Verify email when required. Never reserve quota without authorization; UX states: input → verifying → accepted/awaiting approval/rejected/rate-limited/unknown.
3. On confirmed issue, open **Vé của tôi** and select event ticket. Show signed QR credential *only when delivered by current backend contract*, else a truthful not-ready state. Offline cached display ≠ admission.
4. At Gate, attendee shows QR, but never operates scanning controls.
5. After use, ticket status updates when authoritative sync arrives; stale display states are explicit.
6. Account/logout removes appropriate cached tickets and tenant branding. Failed auth and deletion-request acknowledgments are not completed deletion.

**Core states:** no published events, loading, expired event, event unavailable, code invalid, code redeemed, exhausted quota, email verification required, pending approval, slow network, unknown issuance, wallet empty, offline cached wallet, invalid ticket, cancelled ticket, used ticket, logout.

## Journey B — Staff iOS / physical Gate

1. Authenticate to Staff workspace; discover only assigned events and authorized gates.
2. Select event, gate/device, staff session; online/offline indicator and pending sync count are visible.
3. Scan QR via native camera; lock repeated scan UI while operation is in-flight.
4. Render one unambiguous outcome and instruction:
   - Confirmed admitted: allow entry.
   - Duplicate/invalid: stop entry; provide supervisor/history path.
   - Offline queued/pending/unknown: hold/recover, **no implied admission**.
   - Conflict: escalate.
5. Manual fallback runs only in the native staff app, under the same permissions and logging. No browser fallback.
6. History and queue sync are scoped to actor, event, session and permission; no broad historical lookup.

**Core states:** no event assignment, event removed, no gate selected, camera denied, camera unavailable, online, weak connection, offline queue empty/nonempty, syncing, retry with same idempotency key, duplicate, revoked, conflict, unknown, confirmed admit, no permissions, session expired, reconciliation after restart, device switch, wrong event token, supervisor escalation.

**Physical operations:** keep buttons within one-thumb reach, maintain large status/result panel, no blocking toast over camera target, fallback clearly labeled. Never hide event context behind a bottom sheet with the camera active.

## Journey C — Attendee Web / app.vemoki.com

1. Follow event/invitation link → public event details.
2. Redeem invitation code → verify identity, review result and open ticket.
3. Access wallet/ticket QR from responsive browser; handle guest email/recovery route.
4. No Gate scan routes, camera, staff work controls or organizer dashboards.

**Core states:** deep link invalid, tenant/event not found, event private/inaccessible, invite code expired, insufficient quota, network interrupted, OTP issue, account not verified, QR loading, QR stale, ticket revoked, denied access, no web camera checks.

## Journey D — Organizer Portal

1. Login as authorized owner/manager/event staff → select organization/event explicitly.
2. Overview → readiness checklist → configure event, types, sources/quota, branding and publish.
3. Import guests; validate CSV, observe job status, handle partial failures. Issue/schedule invitations with deduplication and trace.
4. Support attendees: scoped search, masked PII, audit, resend with cooldown.
5. View Gate read-only report **only if `report.read`**. Timestamp metrics and expose unknown/stale states. Never scan QR or confirm an admission from portal.
6. Operator platform console remains a separate privilege/audience.

**Core states:** no org membership, multiple orgs, revoked role, invalid tenant, event draft/published/cancelled, pending import, partial import, quota exhausted, approval needed, no guest matches, audit unknown, report stale, no reporting permission, export failed, auth expired, dangerous form unsaved, background job retry.

## Legacy Gate web retirement — migration requirement

The repository previously allowed `app.vemoki.com/gate` and some historical plans explicitly kept Web Gate. User decision 2026-10-24 is **native Mobile Staff only**. Before implementation, inventory all links and API consumer routes, define exact disposition of legacy `/gate` UI, adjust navigation, contracts, tests, monitoring and documentation. Prefer a safe explanatory legacy page or bounded redirect rather than silently reintroducing scanning; preserve compatibility only as approved. Do not claim migration finished from this design artifact.

## Acceptance criteria (cross-surface)

- [ ] No web scanner, check-in form or `gate.confirm` action anywhere on attendee web/Portal; `report.read` read-only views remain capability gated.
- [ ] Staff scan outcome messages follow authoritative classifications, with green **only** for confirmed admission.
- [ ] Mobile offline queued/pending states cannot be mistaken for admitted; recovery exists.
- [ ] QR visible with adequate quiet zone, true backend credential when implemented; sample QR never presented as a valid ticket.
- [ ] Organization/event context remains visible on every privileged operation.
- [ ] Loading/empty/error/offline/forbidden/unknown/stale have actionable distinct treatments.
- [ ] Permissions validated by server; frontend menu restrictions not treated as authorization.
- [ ] No fabricated clients, testimonials, scale commitments or live metrics.
- [ ] Screen reader/VoiceOver, 200% zoom, Dynamic Type and reduced motion verified.
- [ ] Web responsive checkpoints at 320/360/390/430/768/1024/1440 without overflow; mobile UAT on owned iOS simulator/device.
