# D1 iOS Keycloak session POC — worker report

## Delivered

- `expo-auth-session` Authorization Code + PKCE against self-hosted Keycloak.
- `SessionBoundary` + SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- Fail-closed when `EXPO_PUBLIC_OIDC_ISSUER` / `EXPO_PUBLIC_OIDC_CLIENT_ID` missing.
- Account screen: sign-in, session status, refresh `/v1/me`, logout.
- **Removed** `@clerk/expo` and Clerk plugins (ADR-11: no SaaS IdP).

## Limits

- Live Keycloak Compose + Nest `/v1/me` JWKS must be running for end-to-end sign-in.
- MFA TOTP / email-verify smoke is manual against Keycloak admin + Mailpit (see
  `docs/spikes/D1-OIDC-PROVIDER.md` §5 and `docs/reviews/D1-P4-KEYCLOAK-SMOKE.md`).
