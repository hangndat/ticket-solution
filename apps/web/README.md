# @ticket/web — W0 foundation + D1 Keycloak OIDC POC

Next.js App Router shell for public demo events, admin placeholder, and
self-hosted OIDC identity POC (Authorization Code + PKCE BFF).

## Environment (Keycloak OIDC)

Copy `apps/web/.env.example` → `.env.local` (never commit secrets).

| Variable | Role |
| --- | --- |
| `OIDC_ISSUER` | Keycloak realm issuer URL |
| `OIDC_CLIENT_ID` | Confidential client `ticket-web` |
| `OIDC_CLIENT_SECRET` | Client secret (server only) |
| `OIDC_REDIRECT_URI` | `http://127.0.0.1:3000/api/auth/callback` |
| `API_BASE_URL` | Nest upstream for BFF (`http://127.0.0.1:3001`) |

If any required OIDC env is missing, `/auth` shows **OIDC chưa cấu hình** and
treats the user as **not authenticated** (fail closed). No mock logged-in user.

Session tokens stay in **HttpOnly** cookies set by `/api/auth/callback`. The
browser calls same-origin `GET /api/bff/me`; the route handler reads the cookie
and forwards `Authorization: Bearer` to Nest `GET /v1/me`. Access tokens are not
stored in `localStorage`. No Clerk / SaaS IdP.

## Routes

- `/` — demo event directory
- `/auth` — D1 Keycloak identity POC (sign-in, BFF `/v1/me`, sign-out)
- `/admin` — shell placeholder

## Local

```bash
docker compose up -d keycloak mailpit
pnpm --filter @ticket/web dev
```

Demo users (realm import): `attendee@example.com` / `attendee-demo`,
`staff@example.com` / `staff-demo`.
