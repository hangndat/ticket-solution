# @ticket/web — W0 foundation + D1 Clerk POC

Next.js App Router / TypeScript, manually configured using the official installation guide:
https://nextjs.org/docs/app/getting-started/installation#manual-installation

From the repository root, use `pnpm --filter @ticket/web dev` (port 3000).
After `build`, run `pnpm --filter @ticket/web test:routes` to verify production
HTTP responses, cross-tenant 404s and content isolation on an ephemeral local port.
Other package scripts: `build`, `start`, `lint`, `typecheck`, `test`.
Use the root workspace install and coordinator-maintained lockfile in CI.
The shared contracts package must be built before web typechecking/building:
`pnpm --filter @ticket/contracts build` (root Turbo build orders dependencies).

## Environment (Clerk / OIDC POC)

Copy `apps/web/.env.example` to `apps/web/.env.local` for local work. **Do not commit real keys.**

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (browser-safe) |
| `CLERK_SECRET_KEY` | Clerk secret — server only, never `NEXT_PUBLIC_` |
| `API_BASE_URL` | Nest API origin for BFF proxy (default `http://127.0.0.1:3001`) |

If either Clerk key is missing or blank, `/auth` shows **OIDC chưa cấu hình** and treats the user as **not authenticated** (fail closed). No mock logged-in user.

Session tokens stay in Clerk **HttpOnly** cookies (App Router + `proxy.ts` / `clerkMiddleware`). The browser calls same-origin `GET /api/bff/me`; the route handler reads the server session and forwards `Authorization: Bearer` to `GET /v1/me`. Access tokens are not stored in `localStorage`.

## Routes

- `/`: explicitly fictional demo directory.
- `/auth`: D1 Clerk identity POC (sign-in, session status, BFF `/v1/me`, sign-out).
- `/api/bff/me`: same-origin BFF proxy to Nest `GET /v1/me`.
- `/t/sunburst/events/fun-fest-2026`: warm festival branding.
- `/t/northline/events/form-forum-2026`: green studio branding.
- Unknown tenant/event pairs: 404, including swapped event slugs.
- `/admin`: public placeholder, explicitly unauthenticated and unimplemented; no private data.

Pages and fixture lookup stay on the server; only the error recovery boundary and auth POC controls are client components. Static route generation includes the full tenant/event pair;
unknown dynamic parameters are rejected. Fixtures implement `PublicEvent` from
`@ticket/contracts`, extended locally with presentation-only demo copy.
Do not replace fixture lookup with live data without backend authorization,
tenant-scoped caching and public/private lifecycle checks.

Tests exercise tenant/event pairing, unknown inputs, interleaved fixture isolation,
timezone formatting, and Clerk unconfigured → not authenticated. These are web
fixture/POC tests, not backend security, concurrency or browser accessibility certification.
