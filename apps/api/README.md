# W0 API

From the repository root, install with pnpm, then build @ticket/contracts and
@ticket/backend before @ticket/api. Run `pnpm --filter @ticket/api dev`.
Environment variables are validated before binding; defaults bind 127.0.0.1:3001.
No dotenv auto-loading: supply environment explicitly (see .env.example).

GET /v1/health returns the shared HealthResponse and reports process liveness,
not database readiness. GET /v1/me verifies a Bearer OIDC JWT via JWKS (Clerk),
upserts `users` by `(issuer, subject)`, and returns `MeResponse`. Missing OIDC
env fails closed with `OIDC_MISCONFIGURED`; missing/invalid token returns
`UNAUTHENTICATED`. `emailVerified=false` still returns `/me` (issuance gates later).
`pnpm --filter @ticket/api openapi` regenerates apps/api/openapi.json without
opening a port. Nest signal hooks drain Fastify requests and close the context.

Identity boundary: the OIDC verifier validates signature, issuer, audience,
expiry and allowed algorithms against trusted configuration; never trust tenant
headers as identity. Resolve active membership and event permissions from PostgreSQL
on each operation, deny by default, then call withTenant for the authorized tenant.
RLS constrains tenant access; it does not implement staff/attendee authorization.
CI uses a local JWKS fixture — no Clerk cloud keys required.
