# Vemoki — thiết kế thống nhất v1

This folder is the canonical Vemoki design handoff approved for implementation planning on 2026-10-24. It contains the Neon Event Experience visual direction and cross-surface product system. See [DESIGN-ACCEPTANCE.md](DESIGN-ACCEPTANCE.md) for the decision, verified checks and remaining runtime gates.

## Contents

- `design-system/marketing/`: responsive marketing prototype, assets, styles, design tokens, desktop and mobile renders.
- `design-system/product/`: attendee iOS, staff iOS, attendee web, organizer portal, compact web layouts, UI states, semantics, implementation components, preview renders.
- `reference/approved-neon-desktop.png`: approved creative direction.
- `MANIFEST.json`: complete inventory including bytes and SHA-256 hashes.

## Important product boundary

**Gate scanning, manual admission and offline gate sync run ONLY in the iOS Mobile Staff experience.**
Attendee iOS and attendee web present tickets/QR but never scan them.
The organizer portal can show authorized Gate reporting and operations data, but NOT issue admissions or perform scanning.

## Integration guidance

Use the HTML, CSS, tokens and documents in this folder as the current design source. Earlier export patches are outside this canonical package. This is a design handoff, not production UI code.

Implementation still requires owned Task Specs, independent review and app-level acceptance checks.
**Reference screens and metrics are illustrative; never present them as real customer proof or production test evidence.**

## Repository context

- Marketing: `apps/web` marketing routes + `apps/web/src/marketing`
- Attendee web: `apps/web`
- Attendee and staff iOS: `apps/mobile`
- Portal: `apps/portal` (Ant Design)
- Shared theme: `brand/vemoki/tokens.json`, `packages/ui`

Existing product auth, access control, tenant branding and operational outcome semantics remain authoritative. Marketing gradients should not override admission/denial statuses.
