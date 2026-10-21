# D13 — App Review accounts: ticket reset after device smoke (prod ops)

| Field | Value |
| ----- | ----- |
| Date (UTC+7 ops) | **2026-10-21** |
| Tenant / event | `uat-device` · **Device UAT Event** (`a1111111-1111-4111-8111-111111111111` / `b2222222-2222-4222-8222-222222222222`) |
| Attendee | `review-attendee@vemoki.com` |
| Staff (scanner) | `review-staff@vemoki.com` (`gate.confirm`, `gate.undo`) |
| Worker docs tip SHA | `git rev-parse HEAD` on branch PR (no secrets in git) |
| QR artifact (operator) | `~/Desktop/vemoki-review-ticket-qr.png` · VPS `/opt/vemoki/secrets/app-review/review-attendee-ticket-qr.png` (mode `600`) |
| Passwords | VPS `/opt/vemoki/secrets/app-review/asc-sign-in-required.txt` only — **ASC paste** |

## Incident (device smoke)

On a **real iPhone** smoke, staff `review-staff@vemoki.com` scanned attendee ticket `8c556fad-e0d1-4c5b-a8c8-b14eb70e1758` (QR for `review-attendee@vemoki.com`). The staff app showed **“Đã vào cổng”** — a **real** online check-in was confirmed on prod. The ticket left `ACTIVE` (`USED`). Apple review needs at least one **ACTIVE** ticket with a displayable QR.

**Operator rule:** scanning with the **production staff app + camera** is a **confirm** path, not a dry-run. Treat every staff scan on prod demo tickets as consuming check-in capacity until undone.

## Remediation (2026-10-21 — official APIs only)

| Step | Method | Result |
| ---- | ------ | ------ |
| 1. Read ticket | Prod DB read-only | `8c556fad-…` → `USED`; check-in `4e402ffc-9240-4a67-8c09-8613f2751ece` (not undone) |
| 2. Undo check-in | `POST /v1/gate/events/{eventId}/checkins/{checkinId}/undo` as `review-staff` + `reason` | **201** → ticket `ACTIVE` |
| 3. Spare ACTIVE ticket | `POST /v1/tenants/{tenantId}/events/{eventId}/redemptions` as `review-attendee`, code `UAT-DEVICE-03` | **201** → `02c06057-5dfa-4b59-bf61-505ee92b8c9b` |
| 4. QR PNG (primary scan ticket) | Backend `renderCredentialQrPng` on `8c556fad-…` (credential v1) | Overwrote Desktop + VPS secret paths above |
| 5. Verify attendee wallet | `GET /v1/me/tickets` (prod API) | **200** · **2× `ACTIVE`** (primary + spare) |
| 6. Verify staff dry-run | `POST …/sessions` → `POST …/reservations` on primary → **no** `confirm` → `sessions/revoke` | **200** reserve OK; primary still `ACTIVE` |

### Ticket inventory after reset (review-attendee)

| Ticket ID | Role | State |
| --------- | ---- | ----- |
| `8c556fad-e0d1-4c5b-a8c8-b14eb70e1758` | **Primary** — QR in `vemoki-review-ticket-qr.png` / ASC attachment | `ACTIVE` |
| `02c06057-5dfa-4b59-bf61-505ee92b8c9b` | **Spare** — second scan attempt in app (attendee QR screen) | `ACTIVE` |

Check-in `4e402ffc-…` has `undone_at` set (undo audit retained).

## Before handoff to Apple reviewer

1. **Reset tickets** if any prod staff scan succeeded: `gate.undo` (staff with `gate.undo`) **or** issue new ACTIVE tickets via redemption inventory — **never** raw SQL state edits when API exists.
2. **After every internal smoke** on prod demo accounts: undo check-ins or rotate to spare tickets; re-export QR PNG for the ticket attached to ASC.
3. **Do not** use `review-staff` on prod to “preview” scan unless you plan to undo immediately.
4. Credentials remain **ASC-only** (`asc-sign-in-required.txt`); this doc uses placeholders only.

## Proposals (not implemented — coordinator / product)

Ways to reduce “reviewer exhausts tickets” without weakening prod gate semantics:

| Option | Idea | Tradeoff |
| ------ | ---- | -------- |
| **A. Multi-ticket pool** | Keep **≥2 ACTIVE** tickets on `review-attendee` (primary QR file + spare in-app); top up via unused `UAT-DEVICE-*` codes when inventory allows | Requires ops to track IDs; still need undo after real confirms |
| **B. Post-smoke undo SOP** | Documented operator step: after any staff scan smoke, call **undo** on last check-in before ASC/TestFlight handoff | Depends on staff account + `gate.undo`; fails if undo window/policy tightens |
| **C. Separate staff training tenant** | Staff camera UAT on non-ASC tenant; ASC path read-only until review week | Extra tenant/event setup |
| **D. Staging stack for scan QA** | Full scan E2E on non-prod; prod limited to reviewer paste credentials | Infra cost; prod still needed for ASC “production” demo |
| **E. Inventory headroom** | Seed extra redemption codes on Device UAT Event for automated re-issue | Quota/cleanup discipline |

**Recommendation (ops):** **A + B** for near-term ASC — maintain **two ACTIVE** tickets and mandatory **undo after every prod smoke**; coordinator decides on C/D for next review cycle.

## Cross-links

- Account provisioning baseline: [D13-S5-T2-DEMO-REVIEWER.md](./D13-S5-T2-DEMO-REVIEWER.md)
- ASC paste copy: [../asc/app-review-notes.md](../asc/app-review-notes.md)
- Gate undo permission: `gate.undo` on staff membership (see D12/D13 security reviews)

## Acceptance (this task)

- [x] Ticket status checked (DB + API)
- [x] Check-in undone via `gate` undo API
- [x] Spare ACTIVE ticket issued for `review-attendee`
- [x] QR PNG updated (Desktop + VPS secret path)
- [x] `GET /v1/me/tickets` + staff reserve without confirm verified
- [x] Doc records camera scan = real confirm + smoke undo requirement
- [ ] Independent DoD reviewer on docs PR SHA (coordinator)
