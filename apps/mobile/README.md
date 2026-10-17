# Vemoki iOS (W0 + D1 Keycloak + D2 My Tickets + D4/D5 push client)

`@ticket/mobile` is an iOS-only Expo SDK 58 / React Native 0.88 app. D1 adds
self-hosted Keycloak Authorization Code + PKCE into `SessionBoundary` /
SecureStore. D2 adds My Tickets from real `GET /v1/me/tickets`, ticket detail +
display QR, and a minimal offline display cache. D4/D5 adds fail-closed APNs
**device-token** registration (no Expo Push SaaS).

**Never use Expo/EAS Cloud Build.** Local Expo CLI / prebuild / Xcode only.

## Environment

See `apps/mobile/.env.example`:

- `EXPO_PUBLIC_OIDC_ISSUER` — Keycloak realm issuer. **Empty → fail-closed UI.**
- `EXPO_PUBLIC_OIDC_CLIENT_ID` — public client `ticket-mobile`.
- `EXPO_PUBLIC_API_BASE_URL` — Nest API base for `/v1/me` and `/v1/me/tickets`.
- `EXPO_PUBLIC_TENANT_ID` — tenant UUID required by `GET /v1/me/tickets?tenantId=`.
- `EXPO_PUBLIC_PUSH_PROVIDER` — empty = not configured; `apns` = native device-token UI only.
- `EXPO_PUBLIC_APS_ENVIRONMENT` / `APS_ENVIRONMENT` / `APP_VARIANT` — set `production` before Release/TestFlight `expo prebuild` so `aps-environment` entitlement is `production` (default `development` / API `sandbox`).

## Auth + wallet

1. **Sign in** — PKCE against Keycloak (`ticketsolution://oauth/callback`; brand scheme `vemoki` is also registered).
2. **Session** — bearer → `SessionBoundary.establish`; verified only when
   `GET /v1/me` returns `MeResponse.userId` (same identity path as web).
3. **My Tickets** — `GET /v1/me/tickets?tenantId=` with the verified bearer;
   durable SecureStore display cache for offline open (not offline check-in).
4. **Display QR** — encodes `TicketSummary` fields (`kind: ticket.display`).
   Contracts do not yet expose a signed Gate JWS credential.
5. **Log out** — detach APNs (`DELETE /v1/me/device-tokens/{id}` + clear local registration) **before** `session.logout()`; then SecureStore clear + best-effort Keycloak end-session. Account switch uses the same detach.
6. **Account deletion request** — Account → “Yêu cầu xóa tài khoản” → confirm →
   `POST /v1/me/account-deletion-requests` `{confirmation:true}` + `Idempotency-Key`
   → **202** `AWAITING_POLICY` / `policyStatus:UNRESOLVED`. ACK ≠ erasure (O06 chưa
   chốt). Timeout retry cùng key; account-switch hủy late status. Không tự xóa
   vé/audit/identity; request-only không đủ store approval.

## Deep links

Installed-app schemes: **`vemoki`** (brand) and **`ticketsolution`** (legacy / OIDC).

- `vemoki://events/demo-mfest` / `ticketsolution://events/demo-mfest` → fixture event
- `…://tickets/<uuid>` → My Tickets detail
- `…://oauth/callback` → left for AuthSession (not rewritten)

Fixture id `demo-mfest` / slug `mfest` stays on main; do not rename to hide test failures.

## Push (APNs client)

- Configured via `app.config.ts` (`expo-notifications` plugin, `UIBackgroundModes`,
  dynamic `aps-environment`: default `development`; set `APS_ENVIRONMENT=production`
  for Archive / TestFlight). Do **not** use EAS Cloud Build.
- Runtime uses `Notifications.getDevicePushTokenAsync()` only — **never**
  `getExpoPushTokenAsync` / Expo Push Service.
- Verified session: `POST /v1/me/device-tokens` `{ token, environment }` → store
  `registrationId`; logout/switch: `DELETE /v1/me/device-tokens/{registrationId}`
  under SessionBoundary epoch + generation cancel guards.
- `sendPush` / `acceptDeliveredClaim` stay fail-closed: a device token is **not**
  a delivery receipt. Worker APNs HTTP/2 + `.p8` keys are outside this app.

## Simulator UAT (headless — no macOS mouse)

Do **not** drive Simulator with `cliclick`, AppleScript, or Orca computer-use clicks.
Use AXe HID via the repo helper (install once: `brew install cameroncooke/axe/axe`):

```bash
export SIM_DEVICE='iPhone 17 Pro'   # or SIM_UDID=…
./scripts/sim-uat.sh boot "$SIM_DEVICE"          # no Simulator.app window
./scripts/sim-uat.sh launch com.hangndat.ticket  # or legacy foundation id
./scripts/sim-uat.sh describe
./scripts/sim-uat.sh tap --label 'Sign in'
./scripts/sim-uat.sh screenshot
```

Screenshots land in `apps/mobile/.uat-artifacts/` (gitignored).

## Local

```bash
docker compose up -d keycloak
pnpm --filter @ticket/mobile typecheck
pnpm --filter @ticket/mobile test
pnpm --filter @ticket/mobile lint
pnpm --filter @ticket/mobile dev
```

## iOS signing (personal Apple Developer)

Uses the owner's **personal** Apple Developer team only — not company Apple IDs on this Mac.

| Field | Value |
| ----- | ----- |
| Apple ID | `hangndat@gmail.com` (Hang Nguyen Dat) |
| Team ID | `BLUA62D52G` |
| Bundle ID | `com.hangndat.ticket` (home-screen / binary: **Vemoki**) |
| Config | `app.config.ts` → `expo.ios.appleTeamId` |

Do **not** use Xcode account `eschmeler5431@icloud.com` / team SCHMELER ERUNG (`3WHS6JDYV2`) for this app.

**App Store Connect metadata (listing / privacy / review notes):** see [`ASC-METADATA.md`](./ASC-METADATA.md) → [`docs/asc/`](../../docs/asc/README.md). Prep only — do not treat docs as store submission.

**TestFlight / device Release:** `0.1.0 (9)` — `APS_ENVIRONMENT=production` bakes public Vemoki defaults into `extra.ticketPublic` + Metro `EXPO_PUBLIC_*` when unset (`https://api.vemoki.com`, `https://auth.vemoki.com/realms/ticket`, `ticket-mobile`, `apns`). Optional `EXPO_PUBLIC_TENANT_ID` / `EVENT_ID` still from local `.env`. Team `BLUA62D52G`. Local Release archive + upload only (never EAS Cloud).

Local binary (no EAS Cloud, no TestFlight upload from this worker unless authorized):

```bash
cd apps/mobile
pnpm exec expo prebuild --platform ios --clean
xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Enable **Push Notifications** on App ID `com.hangndat.ticket` in the Apple Developer
portal before expecting a real-device APNs token. Without that capability / signing,
registration reports `unavailable` — never fake `delivered`.

Versioned references: [SDK 58](https://docs.expo.dev/versions/v58.0.0/),
[SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/),
[AuthSession](https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/),
[Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/).
