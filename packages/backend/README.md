# W0 database foundation

Prisma 7.10.1 generates the CommonJS TypeScript client into ignored
src/generated/prisma. Run `pnpm --filter @ticket/backend generate` after installation
or schema changes; never edit generated files. Build includes generation.
PostgreSQL is the business source of truth. There is no Redis business state.

The sample migrations create tenants/events plus a global `users` identity table
(`UNIQUE (issuer, subject)`), composite event primary keys and tenant-scoped slug
uniqueness, tenant foreign keys, and FORCE ROW LEVEL SECURITY. Tenant tables deny
missing context; `users` is not tenant-scoped and must not be queried via
`withTenant`. Representative foundation, not the full ticketing schema.

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

## Outbox MVP (N1)

Notification delivery uses the existing PostgreSQL leased transactional outbox
(`claim_outbox_batch` + worker poll). This deliberately keeps ADR-04's durable
intent in Postgres without claiming BullMQ is deployed. Redis is not the source
of truth for notification jobs. Root/coordinator should record the ADR delta
against TECHNICAL-DESIGN ADR-04 when integrating.

### TicketIssued delivery recovery (F02)

The outbox payload now stores `deliverySnapshot` version 1 with the push mode and
device count. The first fenced processing transaction creates one push notification
per active device and writes this marker atomically. Existing leased or pending rows
without the marker are reconciled by the new worker on reclaim. Email and each
device keep separate attempts. `COMPLETE` requires email `ACCEPTED` and every
snapshotted push `ACCEPTED`; an exhausted or revoked device leads to `DEAD` after
other pending devices have been processed. `ACCEPTED` means provider acceptance,
not end-user delivery. A provider accepting before DB ack can still cause a
duplicate on reclaim; this remains at-least-once.

Before switching workers, stop every old worker, wait for its leases to expire,
then start the new binary. The schema is unchanged, but an old worker can still
complete a row on email acceptance alone, so old and new worker binaries must not
claim the same queue. API binaries may continue writing the existing payload.
Rollback the worker only after draining/reconciling rows with pending push under
the new binary; otherwise the old worker can repeat the F02 loss.

For already `COMPLETE` rows, run the tenant-scoped repair script with a runtime
database URL after the old worker is stopped. It defaults to a dry run and reports
candidate count; `--apply` requeues up to 100 rows per invocation and writes an
audit record per row. Run repeatedly until the dry run reports zero, then let the
new worker reclaim. Legacy rows without a marker are deliberately included;
review the dry-run count before applying because their original device set was not
recorded. The new worker uses the currently active owner devices for those rows.

```sh
DATABASE_URL=... node packages/backend/scripts/repair-ticket-issued-outbox.cjs --tenant <uuid>
DATABASE_URL=... node packages/backend/scripts/repair-ticket-issued-outbox.cjs --tenant <uuid> --apply
```
