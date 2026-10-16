# @ticket/api

NestJS (Fastify) HTTP entry. `GET /health` is process liveness only — not database
readiness. `GET /v1/me` verifies a Bearer OIDC JWT via JWKS (Keycloak self-host),
upserts `users(issuer, subject)`, and returns `MeResponse`.

## OIDC env

See `.env.example`. Required: `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`.
Audience must match Keycloak audience mapper (`ticket-api`).

CI uses a local JWKS fixture — no cloud IdP keys required.
