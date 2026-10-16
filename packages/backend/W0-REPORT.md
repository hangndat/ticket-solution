# W0 backend delivery

Scope: apps/api, apps/worker, packages/backend only, based on 5e4968d.
No production infrastructure, remote push, real identities or secrets were added.

Implemented NestJS 12.1.3 API with Fastify, contract-typed /v1/health,
OpenAPI generation, validated environment and Nest shutdown hooks. Separate
Nest worker stays idle with an explicit no-processors message and signal shutdown.
Shared Prisma 7.10.1 client/pg adapter runs parameterized transaction-local tenant
context. Representative tenants/events migration enforces RLS and composite
event constraints. README defines identity/authz boundary and managed OIDC
acceptance; provider selection remains open.

## Commands and results

Verified locally with Node v26.11.0, pnpm 10.32.1 and Docker Engine 29.4.0:

- `pnpm install --no-frozen-lockfile`: passed; exact package manifests committed.
  Local root lockfile resolution was reverted; coordinator must regenerate the
  root lockfile after integrating manifests. No root configuration is committed.
  Optional @scarf/scarf postinstall was ignored by workspace policy.
- `pnpm --filter @ticket/contracts build`: passed, no contract edits.
- `pnpm --filter @ticket/backend build`: passed, generates ignored Prisma client.
- `pnpm --filter @ticket/backend exec prisma validate`: passed.
- `pnpm --filter @ticket/backend test`: 1 non-DB validation test passed.
- `pnpm --filter @ticket/backend test:db`: 1 real PostgreSQL integration scenario
  passed, including role/owner/FORCE RLS checks, A/B reads and writes, absent
  context, commit/rollback reset, same backend PID reuse, raw SQL primary key
  and foreign key rejection and tenant-scoped slug uniqueness.
- `pnpm --filter @ticket/api test`: 3 passed (Fastify health/contract/OpenAPI,
  environment validation, real localhost listener/close).
- `pnpm --filter @ticket/worker test`: 2 passed (context lifecycle, spawned
  process SIGTERM).
- `pnpm --filter @ticket/api openapi`: passed; generated openapi.json committed.
- `pnpm --filter @ticket/backend lint`, `pnpm --filter @ticket/backend typecheck`,
  `pnpm --filter @ticket/api lint`, `pnpm --filter @ticket/api typecheck`,
  `pnpm --filter @ticket/worker lint`, `pnpm --filter @ticket/worker typecheck`:
  all passed. Lint uses ESLint recommended JavaScript/TypeScript rules,
  separately from the TypeScript checker.
- `docker ps -a --filter label=ticket.task=task_bb55492e627d --format '{{.Names}}'`:
  empty after tests; test-owned containers cleaned up.

## Dependencies, CI and limits

Nest/common/core/platform-fastify 12.1.3, Swagger 12.0.2, reflect-metadata 0.2.2,
rxjs 7.8.2, Prisma/client/adapter-pg 7.10.1, pg and @types/pg 8.23.1,
TypeScript 5.9.3, @types/node 24.19.2, ESLint 10.12.0, @eslint/js 10.0.1
and typescript-eslint 8.71.2 are pinned. Stable Prisma 7 was selected
instead of the registry's Prisma 8 release candidate. Type declarations target
Node 24; execution was local Node 26, so coordinator CI must verify Node 24.

Build contracts and backend before API/worker. CI DB job runs
`pnpm --filter @ticket/backend test:db` with Docker available; it uses its own
postgres:18.1-alpine container and random localhost port, not root infrastructure.
No external DATABASE_URL is accepted by the test harness. The Docker image tag is
versioned but not digest-pinned.

Health is liveness only; no business routes, readiness database connection,
OIDC provider, staff membership implementation, Redis job consumers, outbox,
quota, tickets or check-in are implemented. RLS tests prove this representative
schema and Prisma transaction path; they do not prove future authz, concurrency
business invariants, worker job isolation, capacity or production security.
Migration role/group provisioning remains an explicit operator prerequisite.

## Follow-up: isolated database startup readiness

The original socket-based `docker exec pg_isready` could accept the image's
temporary initialization server before the final TCP listener starts. This is
consistent with the coordinator's early connection termination; that exact
failure was not independently reproduced here. The probe now explicitly uses
`-h 127.0.0.1`, followed by authenticated `pg` connection and `SELECT 1` readiness
through the actual random published host port. Connection/query timeouts are
one second, with at most 30 connection attempts and 500 ms between failures;
failed clients are closed. Only readiness is retried, before any migration or
RLS assertion. The complete scenario still executes once and fails normally.
Existing isolated-container cleanup, non-owner/non-BYPASSRLS assertions and all
other checks are preserved.

Validation on Node v26.11.0, pnpm 10.32.1, Docker Engine 29.4.0:

- `pnpm --filter @ticket/backend test:db`: passed, 1 scenario, 0 skipped;
  scenario duration 5404.76 ms.
- `for run in 1 2 3 4 5; do pnpm --filter @ticket/backend test:db || exit $?; done`:
  exited 0; five consecutive fresh-container scenarios passed, each with
  1 pass, 0 failures and 0 skipped. Scenario durations: 8088.49, 15269.99,
  8443.88, 12415.22 and 11124.76 ms. Each invocation also rebuilt the backend.
- `pnpm --filter @ticket/backend test`: passed, 1 validation test.
- `git diff --check`: passed.
- `docker ps -a --filter label=ticket.task=task_bb55492e627d --format '{{.Names}}'`:
  empty after all runs; no test-owned containers remain.

Six successful local starts provide repeatability evidence, not a guarantee
against every Docker/network failure or proof of production concurrency or
security. Node 24 CI and the coordinator's independent rerun remain external
validation. This follow-up changes only this report and `test/rls.test.cjs`.
