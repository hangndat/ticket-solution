# Ticket Solution

Multi-tenant event ticketing platform: Next.js web, Expo iOS, NestJS API/worker, PostgreSQL and Redis. Android is deferred.

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

## Documentation

- [PRD](docs/PRD.md)
- [Technical design](docs/TECHNICAL-DESIGN.md)
- [Agent development plan](docs/AGENT-DEVELOPMENT-PLAN.md)

W0 is foundation work. Identity provider, transactional issuance, and Gate correctness require dedicated implementation and validation before pilot.
