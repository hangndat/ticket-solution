# W0 database foundation

Prisma 7.10.1 generates the CommonJS TypeScript client into ignored
src/generated/prisma. Run `pnpm --filter @ticket/backend generate` after installation
or schema changes; never edit generated files. Build includes generation.
PostgreSQL is the business source of truth. There is no Redis business state.

The sample migration creates tenants/events, a composite event primary key and
tenant-scoped slug uniqueness, tenant foreign key and FORCE ROW LEVEL SECURITY
policies for SELECT/INSERT/UPDATE/DELETE. Missing context returns no rows and
denies writes. It is representative foundation, not the full ticketing schema.

Provision a separate non-login group before migration:
`CREATE ROLE ticket_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;`
Use a migration login which owns these tables and can create in the target schema.
Use a separate runtime LOGIN with NOSUPERUSER NOBYPASSRLS INHERIT, grant it
ticket_runtime only, and do not grant schema CREATE, role administration, table
ownership, owner membership or privileged function execution. Passwords come from
a secret store; this repository provisions no production credentials.
Provision roles once with a privileged operator, then run
`MIGRATION_DATABASE_URL=... pnpm --filter @ticket/backend migrate`.
The runtime URL must never be the migration URL. Environment files are examples,
not automatically loaded. No real database is contacted by health or idle worker.

createDatabase uses Prisma's pg adapter. withTenant runs an interactive transaction
and parameterized set_config(..., true), with bounded transaction and statement
timeouts. Use only the callback transaction, never the outer client in the callback;
do not retain it. PostgreSQL rolls back/resets local context on commit or error.
Do not set tenant context at session level. The caller must first authenticate and
authorize current membership/event scope; this helper does not authorize tenant IDs.
A compromised runtime with arbitrary SQL can choose another context; RLS is defense
against query omission, not an identity boundary.

Verification: `pnpm --filter @ticket/backend test` runs unit validation without Docker. `test:db` runs real PostgreSQL integration. CI needs Node 24+, pnpm 10.32.1,
a running Docker daemon and permission to pull postgres:18.1-alpine; no shared
service container or database URL is needed. Docker must be running;
unavailable Docker fails rather than skipping. Tests create a uniquely named,
task-labeled postgres:18.1-alpine container with an OS-assigned localhost port and
random ephemeral password, no shared volume, and remove only that container/volume
in finally. Privileged connection only provisions roles and migration; every
isolation assertion uses a separate login that is checked non-superuser,
non-BYPASSRLS and non-owner. A pool of one proves same-connection reuse across
tenants, absent context and rollback. These tests do not prove quota/check-in,
worker job isolation or production authentication, which are unimplemented.

References used for the implementation:

- https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/generating-prisma-client
