# Ticket iOS foundation (W0 + D1 Keycloak POC)

`@ticket/mobile` is an iOS-only Expo SDK 58 / React Native 0.88 shell. D1 adds a
self-hosted Keycloak Authorization Code + PKCE flow bridged into the existing
`SessionBoundary` / SecureStore identity cache.

**Never use Expo/EAS Cloud Build.** Local Expo CLI / prebuild / Xcode only.

## Environment

See `apps/mobile/.env.example`:

- `EXPO_PUBLIC_OIDC_ISSUER` — Keycloak realm issuer. **Empty → fail-closed UI.**
- `EXPO_PUBLIC_OIDC_CLIENT_ID` — public client `ticket-mobile`.
- `EXPO_PUBLIC_API_BASE_URL` — Nest API base for `GET /v1/me`.

## Auth flow

1. **Sign in** — `expo-auth-session` + PKCE against Keycloak (`ticketsolution://oauth/callback`).
2. **Session** — short-lived bearer passed to `SessionBoundary.establish`; becomes
   `verified` only when `GET /v1/me` returns `MeResponse.userId`.
3. **Log out** — `session.logout()` clears SecureStore; best-effort Keycloak end-session.

## Local

```bash
docker compose up -d keycloak
pnpm --filter @ticket/mobile dev
```

Versioned references: [SDK 58](https://docs.expo.dev/versions/v58.0.0/),
[SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/),
[AuthSession](https://docs.expo.dev/versions/v58.0.0/sdk/auth-session/).
