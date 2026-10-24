# Vemoki Product Design System — Design Specification

## 1. Design philosophy

**One recognizable Vemoki brand, four products with different cognitive loads.** The B2B marketing page can be expressive and cinematic; the products must make tasks obvious and states trustworthy. Carry the neon DNA through brand identity, selected hero/art moments and primary actions — not through every table cell, error message, or camera overlay.

| Surface | Appearance | Visual intensity | UX priority |
|---|---|---|---|
| Attendee mobile | Deep navy surroundings, colorful event art, white QR ticket | Medium | Joy and zero-friction ticket access |
| Staff mobile | Calm dark chrome, bright camera viewport, flat semantic outcome panels | Minimal during scan | Accuracy, speed, sunlight legibility, recovery |
| Attendee web | Light content/ticket, branded event header, restrained neon action | Low | Accessible redemption and recovery on any browser |
| Portal | White workspace, navy sidebar, brand gradient only on limited actions | Very low | Data density, clear hierarchy, permissions, operations |

Do not blindly port marketing aesthetics into scanner/portal. App users are attendees and field staff, not marketing conversion leads.

## 2. Identity & component governance

- Existing repo-wide identity source remains `brand/vemoki/tokens.json` (Live Pulse v2). New tokens are **design proposals**; coordinate migrations rather than overwriting identity globally.
- Typefaces: Sora for hero/header display, Be Vietnam Pro for Vietnamese body, tables and actions; use bundled/self-hosted font files in the project. Never ship fonts from this package.
- Core palette: dark navy `#060817`, navy surface `#0E1229`, violet `#9B4DFF`, magenta `#F23CB3`, coral `#FF835F`, blue `#397DFF`, text `#FAF9FF`.
- Quiet enterprise palette: light canvas `#F6F8FC`, white cards `#FFFFFF`, ink `#172039`, muted `#53607B`, separator `#DFE5F0`.
- Gate semantics *override brand*: admitted = dark green `#127349`, duplicate/rejected = red `#B3213A`, queued/pending = amber `#8A5800`, unknown = violet-gray `#6753A0`. **No neon gradients or celebration on admission decisions.**
- Typography scale: mobile H1 30–34/1.18, mobile H2 24–28/1.2, web H1 44–56/1.12, portal page H1 26–30/1.2; body 14–16/1.55, compact metadata 12/1.5 (never use 10px for critical labels).
- 4px spacing scale; standard gaps 8/12/16/24/32/48; sections 40–64; minimum touch target 44×44 on mobile/web; camera controls aim ≥52.
- Radius: inputs 12, cards 16, feature tiles 20, QR paper 24, mobile sheets 24, chips 999; use hairlines, not heavy card shadows, in Portal.
- Responsive widths: 320/360/390/430 phone, 768 tablet, 1024 desktop, 1440 wide. Portal sider collapses; never shrink 10-column tables to illegibility: responsive summary/card or horizontal scroll with labeled affordance.

## 3. Surface component catalog

### 3.1 Global components

| Component | Variants | Required states |
|---|---|---|
| `BrandMark` | standard, mono-on-event | Event white-label scope never silently changes platform login identity |
| `PrimaryAction` | gradient (marketing/attendee), solid blue or violet (portal), flat high-contrast (Gate controls) | loading, disabled, pressed, focus, success/error outcomes separate |
| `SecondaryAction` | outlined, quiet text | default, hover, pressed, disabled |
| `ContextBanner` | current event, tenant, session | loading, expired, missing, inaccessible, switched |
| `SurfaceState` | loading, empty, error, offline, forbidden, unknown, stale | icon + label + recovery action, no spinner-only timeout |
| `StatusBadge` | issued, used, cancelled, expired, pending, queued, duplicate, failed | color + written copy + icon, never color alone |
| `EventCard` | featured, compact/list | image/alt, title, event time/timezone, source brand, destination |
| `Toast/Alert` | info, success, warning, error | polite/assertive live region and nonblocking/critical behavior |
| `ConfirmDialog` | destructive, cancel, revoke | operation impact, affected scope, safe default focus |

### 3.2 Attendee iOS

**IA:** Events → Tickets → Redeem → Account. Labels adapt to current `expo-router` navigation rather than introducing a second duplicated tab bar. Event cards should have one primary link, and already-owned tickets point to wallet without unnecessary login loops.

**Screen inventory:** Events feed, event detail, invitation redeem, OTP/email verification where required, claim state, wallet list grouped by event, ticket detail with QR, account/profile, notifications and account-deletion request.

**Ticket detail contract:** Event title and local timezone first; clear status, single scannable QR on solid white, enough quiet-zone margin, attendee identity only as permitted, and `Offline display` provenance if cached. Never equate QR display cache with a confirmed admission. Ticket QR content should come from the actual signed credential contract at implementation, not prototype content.

**Tenant branding:** Org/event colors and banner are allowed on public event surfaces. System states, scan semantics, verification and privacy controls keep platform-defined affordances. Changing tenant must not leak previous tenant's brand/assets/data. If no tenant is known, display neutral Vemoki identity.

### 3.3 Staff iOS — Gate only

**IA:** Staff workspace requires authorized event assignment → select event/gate/active session → `Quét vé` (camera) / `Nhập tay` (fallback with same authorization and outcome contract) / `Lịch sử` (scoped records). Can show queue sync/health and supervisor escalation. These are native app routes, **never** links to a browser scanner.

**Scan viewport:** Large camera area, high-contrast corners, persistent event and gate labels, connectivity and queue count. One clear outcome visible at a time. Don't place animated gradients behind text/camera recognition area. Outcome order: state title → permission to admit/deny/hold → actionable next step. Avoid automatic success from local queue write.

**Color/meaning rules:**

| Internal outcome | Color & icon | User-facing instruction | May admit? |
|---|---|---|---|
| Confirmed admission (`APPLIED`/verified server result) | Green + check | "Cho phép vào cổng" | **Yes, only with authoritative confirmation** |
| Duplicate/already used | Red + barred | "Dừng và kiểm tra lịch sử" | **No** |
| Rejected/invalid/revoked | Red + cross | "Không cho vào cổng" | **No** |
| Queued offline | Amber + clock | "Chờ đồng bộ; chưa xác nhận vào cổng" | **No** |
| Pending/in-flight | Amber + spinner | "Đang xác nhận; không quét lại liên tục" | **No** |
| Conflict | Red/amber + escalation | "Chuyển giám sát" | **No** |
| Unknown/unreachable | Neutral-purple + question | "Chưa xác định; kiểm tra kết nối" | **No** |

Follow authoritative backend `gate-outcome-copy` semantics; `APPLIED` in offline history is not sufficient to infer a new physical admission unless the workflow specifically confirms it. Queue processing, idempotency, pending-operation recovery and server ownership guards remain unchanged.

### 3.4 Attendee Web — `app.vemoki.com`

**IA:** Public events → event details → redeem/verify → wallet/ticket → account/support. **Absolutely no camera Gate scanning UI, staff Gate links, manual admission or check-in API controls.** Public event catalog is not a paid-ticket marketplace; copy does not offer unsupported payments/refunds/seat maps.

For browser QR detail, center a large white canvas and test against common scanner lighting and zoom. Link/accessibility include recovery, copy ticket number (where permitted) and help. Show expiry/cancel/revoked states. On narrow screens make CTA and ticket QR prominent without horizontal overflow.

### 3.5 Portal — `portal.vemoki.com`

**Stack:** Next App Router, Ant Design v6 with `ConfigProvider`, `@ant-design/nextjs-registry`, existing ProComponents already installed. Use existing nav/capabilities, not a parallel role model. Proposal is a theme/layout adaptation and must be validated against exact installed packages.

**Roles:** Owner/Manager can manage organization/events/members as permissions permit; Event Ops can manage event guests, codes, invitations and readiness; CS can look up/resend within allowed scope; Scanner-only staff should *not* be granted portal management dashboards; Operator uses separate `/platform` audience and authorization.

**Portal IA:** Organization → Events → Event Overview → Event setup (details, types, sources/quota, brand/publish) → Guests/Approvals → Tickets/Support → Reports → Team/Settings. Group menu by organization, event operations and settings. Nav only shows authorized capabilities; backend remains authority. Never expose scanner icon as actionable route.

**Gate information in Portal:** read-only Gate activity/reports/health when user has `report.read`, with `asOf` last-updated timestamp and explicit freshness. For `gate.confirm` staff, show "Quét vé bằng ứng dụng Vemoki trên iPhone" instructional hint only; not a web scanner or any link to `/gate`.

**Enterprise tables:** 44px row height min, sticky column headers where helpful, server pagination, always-visible filter summary, safe selection model; status labels textual, sensitive guest/email masked as policy requires. Forms have inline validation; risky actions include previews and reasons; loading/empty/error/forbidden/stale require distinct states.

## 4. UX writing rules

- Vietnamese across user-facing product surfaces, with short verbs, one next action. Technical documentation stays in English.
- Never show raw JWT, Gate JWS, tenant UUID, API endpoint or Keycloak internals to ordinary users. Show diagnostic IDs only in expandable support context.
- Avoid false real-time assertions: reports have `asOf` and refresh state; "Đang cập nhật" is not "đã đồng bộ".
- Do not claim attendees admitted for offline queued scans. No fake customer trust/social proof; illustrative UI uses "Dữ liệu minh họa".
- Conversion lead CTAs belong to marketing, not attendee/staff workflows.

## 5. Motion, feedback and a11y

- Mobile attendee: visual energy in event art and short transitions 160–220ms; never animate QR itself.
- Staff Gate: no flashing celebration or glow; haptic/audio outcome feedback must complement visual/text, be testable, and respect accessibility settings. No color-only admission states.
- Portal: restrained transitions; table/filter interactions favor zero distraction.
- Support `prefers-reduced-motion` and iOS Reduce Motion; focus order and escape handling in modal/drawer.
- Contrast AA target (4.5:1 normal text, 3:1 large/meaningful UI), verify combinations with actual compositing, especially gradients.
- Large Dynamic Type on iOS, Vietnamese accents, VoiceOver labels; keyboard tab/Enter/Escape on web; WCAG touch targets.
- Provide offline/slow-network notices, errors with recovery, screen reader status announcements, and retry mechanisms safe under idempotency.

## 6. Security/product guardrails

- Gate only mobile staff: no scan, no browser camera, no manual Gate admission, and no hidden web Gate fallback.
- `gate.confirm` does not imply `report.read`; `report.read` does not imply `gate.confirm`.
- Staff event assignment and session checks are backend decisions; UI cannot assume privilege based on tabs.
- Do not change signed QR payload, authorization, or deduplication logic in a visual redesign.
- Keep ticket QR screen protected against user/session leakage; logout clears display caches and tenant brand per current policy.
- No cross-tenant fetching in Portal (filters and nav cannot authorize data). No PII in analytics demos and web traces.
- Public web and Portal must keep host-only session cookies and separate security boundaries.
- Confirm latest PRD scope before marketing paid-ticket claims, Android availability, offline reliability, or published performance metrics.

## 7. Art direction by surface

- Attendee: hero event imagery, selectively iridescent ticket edge, tiny glow accents behind decorative imagery; contrast-safe white ticket itself.
- Staff: navy utility shell, quiet visual hierarchy, bright camera viewfinder, flat non-glossy status panel. No decorative orbs obscuring operators or statuses.
- Web attendee: white content; event-specific hero photo; restrained accent line; ticket display uses black QR on white and robust margins.
- Portal: dark brand nav shell + calm paper main surface; dense summary cards, clean aligned tables; never use glassmorphism beneath text/data.

## 8. Implementation status

This package is a design handoff. HTML previews are illustrative; screenshots are render tests for layout only. No GitHub modifications, no native simulator/device UAT, no scanner correctness test, no claims of backend integration or design acceptance.
