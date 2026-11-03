# Vemoki

Multi-tenant event ticketing platform (**Vemoki**, domain `vemoki.com`): Next.js web, Expo iOS, NestJS API/worker, PostgreSQL and Redis. Android is deferred. The Git repository and npm workspace name remain `ticket-solution`.

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

Default local infrastructure ports (all bind `127.0.0.1` only): PostgreSQL `55432`, Redis `56379`, Keycloak `8080`, MinIO `9000`/`9001`, Mailpit SMTP `1025` / UI `8025`. Use different ports and `COMPOSE_PROJECT_NAME` for each worktree. Identity is **self-hosted Keycloak** (no Clerk/SaaS IdP). Development database credentials are not production credentials. The Compose bootstrap database user is an administrative development account; application runtime must use a separate non-owner, non-BYPASSRLS role. Never use the bootstrap account to claim RLS isolation works.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Pre-push local checks

Optional fail-fast checks before `git push` (CI parity for web/mobile/backend only — **not** `database-isolation` / d5 drills / Docker Postgres).

```sh
pnpm hooks:install   # git config core.hooksPath .githooks
# or: git config core.hooksPath .githooks
```

- Path filters mirror `.github/workflows/ci.yml` scopes; docs/tooling-only diffs skip (exit 0).
- Manual: `pnpm check:prepush` · dry-run: `PREPUSH_DRY_RUN=1 pnpm check:prepush`
- Escape (not recommended): `SKIP_PREPUSH=1` or `TICKET_SKIP_PREPUSH=1`

DoD / CI evidence on a PR (minimize GitHub API rate limit): `gh auth switch --user hangndat` then `./scripts/gh-dod-evidence.sh <pr>`. See `docs/agents/policies/github-api.md`.

## Workspace commands

- `pnpm dev:web`: web on port 3000.
- `pnpm dev:api`: health API on port 3001.
- `pnpm dev:ios`: Metro/iOS development (requires local iOS tooling).
- `pnpm --filter @ticket/backend test:db`: isolated PostgreSQL RLS test; Docker required.
- `pnpm --filter @ticket/web test:routes`: production HTTP routing test after web build.
- `pnpm hooks:install` / `pnpm check:prepush`: local pre-push hook (see above).

Each app has its own README and environment examples. Database runtime role provisioning is documented in `packages/backend/README.md`; root Compose is development infrastructure, not a production provisioning flow.

## Documentation

Start with the [documentation map](docs/README.md).

- Product scope: [PRD](docs/PRD.md), [roadmap and release gates](docs/ROADMAP.md), [decisions](docs/DECISION-LOG.md).
- Architecture: [evidence-backed baseline](docs/architecture/ar891-current-architecture.md); [technical proposal](docs/TECHNICAL-DESIGN.md) for design context.
- Development agents: [AGENTS.md](AGENTS.md), [workflow map](docs/agents/README.md).
- Operations: [runbook](docs/ops/RUNBOOK.md), [immutable release](docs/ops/IMMUTABLE-RELEASE.md), [deploy pipeline](docs/ops/DEPLOY-PIPELINE.md).
- UI: [design sources by surface](docs/design/README.md).
- Verification: [review evidence index](docs/reviews/README.md); current delivery status is tracked in GitHub Project #3.
- Earlier foundation reports and coordination logs: [archive](docs/archive/README.md).

Documentation and historical PASS reports do not establish the current deployed SHA, a fresh regression result, pilot readiness or App Store availability.
