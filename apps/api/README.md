# W0 API

From the repository root, install with pnpm, then build @ticket/contracts and
@ticket/backend before @ticket/api. Run `pnpm --filter @ticket/api dev`.
Environment variables are validated before binding; defaults bind 127.0.0.1:3001.
No dotenv auto-loading: supply environment explicitly (see .env.example).

GET /v1/health returns the shared HealthResponse and reports process liveness,
not database readiness. There are no business routes or authentication stubs.
`pnpm --filter @ticket/api openapi` regenerates apps/api/openapi.json without
opening a port. Nest signal hooks drain Fastify requests and close the context.

Identity boundary: a future OIDC verifier must validate signature, issuer, audience,
expiry and allowed algorithms against trusted configuration; never trust tenant
headers as identity. Resolve active membership and event permissions from PostgreSQL
on each operation, deny by default, then call withTenant for the authorized tenant.
RLS constrains tenant access; it does not implement staff/attendee authorization.

Managed OIDC selection is still open. Acceptance requires web and iOS authorization
code + PKCE, safe redirect/universal-link handling, verified email OTP/magic link,
staff invitations and admin MFA, secure refresh rotation/revocation and logout/account
switch tests. Link issuer + subject to internal identity; demonstrate account claiming,
membership revocation on the next request, provider outage behavior and P4 security
tests before enabling tenant routes. No provider credentials or fake users are wired.
