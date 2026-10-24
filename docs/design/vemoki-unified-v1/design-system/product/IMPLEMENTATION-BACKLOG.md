# Implementation Backlog — Vemoki Unified Product Design

**Scope:** Design integration into `hangndat/ticket-solution`; no changes made by this handoff. Every slice requires PR review, actual tests, and evidence. Priority P0/P1 is proposed, not a GitHub Project status.

## Epic DS-01 — Shared foundations & migration (P0)

**Story DS-01.1:** Reconcile brand tokens and surface scopes (`brand/vemoki/tokens.json`, RN generated tokens, `@ticket/ui`, Portal AntD theme). No unconditional global rebrand. **AC:** token adapter only affects intended surface; tenant override remains intact; CSS snapshot/unit checks.

**Story DS-01.2:** Define and enforce mobile-only Gate. Inventory `apps/web` `/gate` and all staff/web deep links, legacy UI, tests and documentation. Define approved legacy behavior explicitly; ensure portal has no scan action and no navigation to web Gate. **AC:** Web frontend cannot scan or manually admit; Mobile Staff only uses authorized Gate API; read-only Portal Gate reports remain `report.read` gated. Add direct-route and role security regression tests.

**Story DS-01.3:** Shared status semantics and accessibility. Align `ADMITTED/DUPLICATE/REJECTED/QUEUED/UNKNOWN/CONFLICT` copy with existing classifier and business contracts; do not alter protocol. **AC:** no false-green states; VoiceOver/keyboard/reduced-motion snapshots and unit tests.

## Epic DS-02 — Attendee iOS (P0)

**DS-02.1 Events:** Refresh event list + detail headers with visual imagery and clean information hierarchy. **AC:** published/private semantics unchanged, tenant switch clears stale art, empty/offline/denied states covered.

**DS-02.2 Redeem:** Refine input/OTP/pending/errors. **AC:** no double issue, no misleading issued UI on unknown/pending result, backend retry safe.

**DS-02.3 Wallet & QR:** New card/ticket detail. **AC:** scanner-readable QR at real device dimensions, appropriate safe area/dynamic type; cached-offline display distinct from check-in admission.

**DS-02.4 Account/notifications:** Native account cards and clear privacy language. **AC:** logout clears tickets/branding as current source of truth; deletion request ACK distinguished from erasure.

## Epic DS-03 — Staff iOS Gate (P0, security-critical)

**DS-03.1 Scan workspace:** Event/gate/session context sticky, large scan area, permission prompts. **AC:** camera failure and event not assigned states recover, no expired scope admission.

**DS-03.2 Outcome treatment:** Large semantic outcome panel with duplicate/invalid/queued/unknown distinctions. **AC:** authoritative Green only; no protocol change; unit and headless UAT cover all branches.

**DS-03.3 Offline recovery:** Queue, sync, restart, conflict, history, supervisor path; `Nhập tay` native only. **AC:** no optimistic admission from queue, scoped receipt/history, idempotency preserved, physical-device follow-up recorded if unavailable.

## Epic DS-04 — Attendee Web (P1)

**DS-04.1 Event page & redeem:** Responsive event story → code → identity verification → ticket. **AC:** 320–1440px browser QA, accessibility/semantics, errors, no paid checkout claims.

**DS-04.2 Wallet/ticket page:** White QR with quiet-zone, status, recovery, support. **AC:** no ticket exposure across sessions/tenants; deep-link lifecycle; QR derives from real backend payload.

**DS-04.3 Web Gate retirement:** Coordinate with DS-01.2; ensure no staff scanning UI or leaked legacy links in attendee web. **AC:** direct visits and old bookmarks get approved safe behavior; tests demonstrate absence of scanning capability.

## Epic DS-05 — Organizer Portal (P1)

**DS-05.1 Shell/Navigation:** AntD `ConfigProvider` semantic tokens, grouped sidenav, tenant/event switcher and role-based labels. **AC:** auth/host-only cookies preserved, no horizontal overflow in compact layout, staff-only roles do not inherit Owner nav.

**DS-05.2 Operational dashboard:** Readiness, event list, pending tasks; server-backed stats only (no fake data). **AC:** real API or explicit state; asOf/stale/refresh; pagination & filters server-backed.

**DS-05.3 Guests & tickets:** Import wizard, approval, sending/resend and CS states. **AC:** partial errors and jobs represented, masked PII, no new endpoints invented.

**DS-05.4 Reports:** Gate activity report read-only with `report.read`, bounded freshness, data export when authorized. **AC:** no camera/manual Gate action; `gate.confirm` ≠ `report.read`.

**DS-05.5 A11y/responsive:** AntD inputs/tables/modal/drawers, keyboard support; narrow screens use summary cards/drawers rather than squeezed tables. **AC:** role matrix + 320/390/768/1024/1440 visual QA; no detached auth or onboarding.

## Engineering prompts (English; copy into Cursor/Orca coordinator)

### Planning-first prompt

```text
Read AGENTS.md, docs/PRD.md, docs/ROADMAP.md, docs/design/PORTAL-IMPLEMENTATION-HANDOFF.md, and this handoff's README.md, DESIGN-SYSTEM.md, FLOWS-AND-STATES.md, IMPLEMENTATION-BACKLOG.md and tokens.json.
Create a proposed GitHub Project plan (Epics, Stories, Tasks) for all four product surfaces. Before coding, reconcile current main with design scope and record capability/route migrations.
Hard requirement: Gate scan, manual admission and in-person check-in MUST be performed only in the authorized iOS Staff app. Attendee Web and Portal have no Gate scan surface. Portal may display read-only Gate reporting with report.read. Identify legacy /gate routes, migrations, tests and owner approvals.
Do not assume the new design is implemented. Plan vertical slices, API/authorization proof, test matrix, dependency order, ownership boundaries, and acceptance criteria. Flag contradictions with old roadmap for explicit resolution. No feature coding until the plan is reviewed.
```

### Implementation prompt (after plan approval)

```text
Implement exactly one approved vertical slice from the Vemoki product design handoff.
Respect current Next.js/Expo/Ant Design versions, existing Live Pulse v2 source tokens, tenant branding, auth/OIDC boundaries and backend contracts. Make the smallest maintainable diff. Do not add unnecessary dependencies.
Preserve all Gate admission invariants, idempotency, offline conflict recovery, deny-by-default permissions and security tests. Never introduce browser Gate scan or manual admission. Any Gate operational control belongs to native iOS Staff.
Use production Vietnamese copy, accurate real data, no fabricated social proof or fake live metrics. Add relevant tests and screenshots. Run lint, typecheck, tests/build for the touched workspace, report exact commands and results. Request independent review and update documentation; do not mark complete without evidence.
```

## Suggested conventional commits

- `docs(design): define unified Vemoki product design system`
- `refactor(web): retire legacy web gate entry surfaces`
- `feat(mobile): refine attendee tickets and redeem experience`
- `feat(mobile): clarify staff gate scan outcomes`
- `feat(web): refresh attendee event and ticket surfaces`
- `feat(portal): align operations UI with Vemoki product theme`

**Definition of Done:** approved scope + review; all AC satisfied; relevant CI, security and a11y checks pass; real-device gate verification evidence when required; docs reflect reality; meaningful commit exists. No PR or deploy is created by these design files.
