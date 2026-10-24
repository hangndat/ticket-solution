# Vemoki Product Design System v1.0 — Multi-Surface Handoff

**Status:** Design direction approved for implementation planning on 2026-10-24; prototype only, not app acceptance.
**Design decision:** Approved Neon Event Experience direction from marketing, adapted to operational product surfaces.
**Sources reviewed (2026-10-24):** `hangndat/ticket-solution` README/PRD, `apps/mobile` screens and D11 handoffs, `apps/web` attendee routes, `apps/portal` navigation/Ant Design providers, and existing `brand/vemoki/tokens.json`.

## What is included

| Surface | Purpose | Deliverable |
|---|---|---|
| Attendee iOS | Discover event, redeem invitation, wallet, ticket detail, profile | `attendee-mobile.html` screenshot and flow spec |
| Staff iOS | Event/gate context, camera scan, manual fallback, history, offline queue, supervisor escalation | `staff-mobile.html` screenshot, Gate status matrix |
| Attendee Web (`app.vemoki.com`) | Public event information, redeem, QR ticket/wallet, recovery | `attendee-web.html` screenshot and flow spec |
| Organizer Portal (`portal.vemoki.com`) | Event operations, guests, ticket allocation, team, analytics, reports/CS | `portal.html` screenshot and role IA |
| Shared | Foundations, responsive, accessibility, state handling | `DESIGN-SYSTEM.md`, `FLOWS-AND-STATES.md`, `tokens.json`, `implementation/*` |

**Non-negotiable boundary:** Gate camera scan, manual Gate admission, and in-person check-in are **only in the staff workspace of the iOS app**. No web Gate on attendee web or portal. Portal may show Gate reports/monitoring when the backend grants `report.read`. The older roadmap allowed web Gate; this design decision supersedes it as a *new product requirement*, not a claim that all legacy routes have been removed.

## Preview

Open `index.html` locally and navigate to surface prototypes. They are **nonfunctional visual references**, not live product code. All names, events, numbers and QR data are illustrative, not verified users/events. No fabricated organizer logos, endorsements, reviews, or performance benchmarks.

## Repo mapping

- Attendee iOS: `apps/mobile/src/screens/{events,my-tickets,ticket-detail,redeem,account}.tsx`.
- Staff iOS: `apps/mobile/src/screens/{staff-scan,staff-manual,staff-history}.tsx` plus `src/gate/` and staff navigation.
- Attendee Web: `apps/web/app/{page.tsx,wallet,redeem,account,...}`.
- Portal: `apps/portal/*`, current `antd@6.6.6`, `@ant-design/pro-components` and Next App Router.
- Shared: `brand/vemoki/tokens.json`, RN generated token sync and `@ticket/ui`. Avoid global token overrides.

## Implementation order

1. Apply approved behavioral boundary **Gate iOS-only** and inventory legacy web links/routes; define migration/redirect/410 outcome explicitly.
2. Introduce semantic component/token adapters in the respective apps without replacing global brand or auth logic.
3. Implement attendee surfaces via vertical slices (events → redemption → ticket/QR → account).
4. Implement Staff scan state treatment without altering Gate protocols, idempotency, offline reconciliation or authorization.
5. Upgrade Portal shell and operational cards/tables/forms inside Ant Design theme; preserve existing BFF/API contracts.
6. Regression test role boundaries, tenant branding, auth, failures, offline, accessibility and responsive UAT before merging/deploy.

See `IMPLEMENTATION-BACKLOG.md` for tasks and acceptance criteria.

## Preview fidelity and limitations

The PNG previews were rendered with a static HTML/CSS print engine because managed browser navigation was unavailable in this environment. They are **illustrative approximations**, not pixel-accurate Chrome/Safari screenshots or proof of responsive QA. Open the source HTML files in a local browser for closer evaluation and run production visual/accessibility tests in the actual apps. The event photographs and QR illustration are mock data (the sample QR encodes an explicitly invalid design-demo marker).

The stylized `V` glyph in static prototypes is a placeholder; integrate the approved `brand/vemoki/mark.svg` from the repository. Fonts use CSS family declarations and OS fallback in prototypes, not redistributed font files.
