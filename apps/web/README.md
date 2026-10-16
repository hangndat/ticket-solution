# @ticket/web — W0 foundation

Next.js App Router / TypeScript, manually configured using the official installation guide:
https://nextjs.org/docs/app/getting-started/installation#manual-installation

From the repository root, use `pnpm --filter @ticket/web dev` (port 3000).
After `build`, run `pnpm --filter @ticket/web test:routes` to verify production
HTTP responses, cross-tenant 404s and content isolation on an ephemeral local port.
Other package scripts: `build`, `start`, `lint`, `typecheck`, `test`.
Use the root workspace install and coordinator-maintained lockfile in CI.
The shared contracts package must be built before web typechecking/building:
`pnpm --filter @ticket/contracts build` (root Turbo build orders dependencies).
No environment variables are required. No remote fonts, assets, analytics or API calls.

## Routes

- `/`: explicitly fictional demo directory.
- `/t/sunburst/events/fun-fest-2026`: warm festival branding.
- `/t/northline/events/form-forum-2026`: green studio branding.
- Unknown tenant/event pairs: 404, including swapped event slugs.
- `/admin`: public placeholder, explicitly unauthenticated and unimplemented; no private data.

Pages and fixture lookup stay on the server; only the error recovery boundary is a
client component. Static route generation includes the full tenant/event pair;
unknown dynamic parameters are rejected. Fixtures implement `PublicEvent` from
`@ticket/contracts`, extended locally with presentation-only demo copy. There is
no auth, redemption, ticket issuance, backend connection or Gate implementation.
Do not replace fixture lookup with live data without backend authorization,
tenant-scoped caching and public/private lifecycle checks.

Tests exercise tenant/event pairing, unknown inputs, interleaved fixture isolation
and timezone formatting. These are web fixture tests, not backend security,
authentication, concurrency or browser accessibility certification.
