# Ticket iOS (W0 + D1 Keycloak + D2 My Tickets)

`@ticket/mobile` is an iOS-only Expo SDK 58 / React Native 0.88 app. D1 adds
self-hosted Keycloak Authorization Code + PKCE into `SessionBoundary` /
SecureStore. D2 adds My Tickets from real `GET /v1/me/tickets`, ticket detail +
display QR, and a minimal offline display cache.

**Never use Expo/EAS Cloud Build.** Local Expo CLI / prebuild / Xcode only.

## Environment

See `apps/mobile/.env.example`:

- `EXPO_PUBLIC_OIDC_ISSUER` — Keycloak realm issuer. **Empty → fail-closed UI.**
- `EXPO_PUBLIC_OIDC_CLIENT_ID` — public client `ticket-mobile`.
- `EXPO_PUBLIC_API_BASE_URL` — Nest API base for `/v1/me` and `/v1/me/tickets`.
- `EXPO_PUBLIC_TENANT_ID` — tenant UUID required by `GET /v1/me/tickets?tenantId=`.

## Auth + wallet

1. **Sign in** — PKCE against Keycloak (`ticketsolution://oauth/callback`).
2. **Session** — bearer → `SessionBoundary.establish`; verified only when
   `GET /v1/me` returns `MeResponse.userId` (same identity path as web).
3. **My Tickets** — `GET /v1/me/tickets?tenantId=` with the verified bearer;
   durable SecureStore display cache for offline open (not offline check-in).
4. **Display QR** — encodes `TicketSummary` fields (`kind: ticket.display`).
   Contracts do not yet expose a signed Gate JWS credential.
5. **Log out** — `session.logout()` clears SecureStore; best-effort Keycloak end-session.

## Local

```bash
docker compose up -d keycloak
pnpm --filter @ticket/mobile typecheck
pnpm --filter @ticket/mobile test
pnpm --filter @ticket/mobile dev
```

Versioned references: [SDK 58](https://docs.expo.dev/versions/v58.0.0/),
[SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/),
[AuthSession](https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/).
