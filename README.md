# Ticket Solution

Multi-tenant event ticketing platform: Next.js web, Expo iOS, NestJS API/worker, PostgreSQL and Redis. Android is deferred.

## iOS build policy

Expo/EAS Cloud Build is prohibited by project requirement. Native iOS builds use local Expo prebuild and Xcode/xcodebuild (or fastlane) on a Mac or self-managed macOS runner. CI on Linux validates JavaScript exports only; it does not build native iOS binaries.

## Requirements

Node.js 24 LTS (Node 26 also permitted locally), pnpm 10.32.1, Docker Compose. Use a macOS/Xcode environment for iOS simulator/device builds.

## Getting started

```sh
pnpm install
cp .env.example .env
pnpm infra:up
pnpm build
pnpm dev
```

Default local infrastructure ports: PostgreSQL `55432`, Redis `56379`. Both bind only to localhost. Use different ports and COMPOSE_PROJECT_NAME for each worktree. Development database credentials are not production credentials. The Compose bootstrap database user is an administrative development account; application runtime must use a separate non-owner, non-BYPASSRLS role. Never use the bootstrap account to claim RLS isolation works.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Workspace commands

- `pnpm dev:web`: web on port 3000.
- `pnpm dev:api`: health API on port 3001.
- `pnpm dev:ios`: Metro/iOS development (requires local iOS tooling).
- `pnpm --filter @ticket/backend test:db`: isolated PostgreSQL RLS test; Docker required.
- `pnpm --filter @ticket/web test:routes`: production HTTP routing test after web build.

Each app has its own README and environment examples. Database runtime role provisioning is documented in `packages/backend/README.md`; root Compose is development infrastructure, not a production provisioning flow.

## Documentation

- [PRD](docs/PRD.md)
- [Technical design](docs/TECHNICAL-DESIGN.md)
- [Agent development plan](docs/AGENT-DEVELOPMENT-PLAN.md)
- [Roadmap](docs/ROADMAP.md)
- [W0 foundation report](docs/W0-FOUNDATION-REPORT.md)

W0 is foundation work. Identity provider, transactional issuance, and Gate correctness require dedicated implementation and validation before pilot.
