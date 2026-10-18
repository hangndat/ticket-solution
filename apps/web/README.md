# @ticket/web — Keycloak OIDC identity + redeem

Next.js App Router shell for public demo events, admin placeholder,
self-hosted OIDC identity session (Authorization Code + PKCE BFF), and
redemption against Nest (real API, no mock proof).

## Environment (Keycloak OIDC)

Copy `apps/web/.env.example` → `.env.local` (never commit secrets).

| Variable | Role |
| --- | --- |
| `OIDC_ISSUER` | Keycloak realm issuer URL |
| `OIDC_CLIENT_ID` | Confidential client `ticket-web` |
| `OIDC_CLIENT_SECRET` | Client secret (server only) |
| `OIDC_REDIRECT_URI` | `http://127.0.0.1:3000/api/auth/callback` |
| `API_BASE_URL` | Nest upstream for BFF (`http://127.0.0.1:3001`) |

If any required OIDC env is missing, `/auth` and `/redeem` show **OIDC chưa cấu hình** and
treat the user as **not authenticated** (fail closed). No mock logged-in user.

Session tokens stay in **HttpOnly** cookies set by `/api/auth/callback`. The
browser calls same-origin BFF routes; handlers read the cookie and forward
`Authorization: Bearer` to Nest. Access tokens are not stored in `localStorage`.
No Clerk / SaaS IdP.

## Routes

- `/` — demo event directory
- `/auth` — Keycloak identity session (sign-in, BFF `/v1/me`, sign-out)
- `/redeem` — form đổi mã → verify → success/ticket (Nest redeem)
- `/admin` — shell placeholder

## BFF (redeem / tickets)

| Browser | Nest |
| --- | --- |
| `POST /api/bff/redeem` | `POST /v1/tenants/{tenantId}/events/{eventId}/redemptions` + `idempotency-key` |
| `GET /api/bff/tickets?tenantId=` | `GET /v1/me/tickets?tenantId=` |
| `GET /api/bff/tickets/{ticketId}?tenantId=` | `GET /v1/me/tickets/{ticketId}?tenantId=` (owner deeplink; UUID) |
| `/t/{tenantSlug}/tickets/{ticketId}` | Owner-auth ticket view (email `buildOwnerTicketLink`; slug→tenantId via me/tenants) |
| `GET /api/bff/operations/{key}?tenantId=&eventId=` | `GET /v1/operations/{clientOperationId}` |
| `GET /api/bff/me` | `GET /v1/me` |

UX maps API codes: `QUOTA_EXHAUSTED` (exhausted), `CODE_CONSUMED` (used),
client/upstream timeout → poll operation with the same idempotency key.

## Local

```bash
docker compose up -d keycloak mailpit
pnpm --filter @ticket/web dev
```

Demo users (realm import): `attendee@example.com` / `attendee-demo`,
`staff@example.com` / `staff-demo`.

Redeem needs real tenant/event UUIDs and a seeded redemption code from the API
inventory (not the fictional demo event fixture IDs). Optional query prefills:
`/redeem?tenantId=<uuid>&eventId=<uuid>`.

## Web UAT (headless — no macOS mouse)

Do **not** drive Chrome/Safari with `cliclick`, AppleScript, or Orca computer-use clicks.
Use Playwright headless (or HTTP scripts when enough):

```bash
pnpm exec playwright install chromium

./scripts/web-uat.sh auth-smoke http://127.0.0.1:3000
./scripts/web-uat.sh bff-login http://127.0.0.1:3000
./scripts/web-uat.sh screenshot http://127.0.0.1:3000/auth
```

Also: `pnpm uat:p4-oidc` (OIDC/BFF parity over HTTP, no browser).
Screenshots: `apps/web/.uat-artifacts/` (gitignored). Uses cached `chrome-headless-shell` (no Chrome window). `WEB_UAT_HEADED=1` only if you ask to watch.
