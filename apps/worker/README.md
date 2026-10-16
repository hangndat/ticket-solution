# W0 worker

Build @ticket/backend first, then `pnpm --filter @ticket/worker dev`.
The separate Nest application context stays idle and handles SIGINT/SIGTERM.
It explicitly registers no queue consumers and processes no jobs. No Redis
connection or pretend notification/import success is provided.
Only NODE_ENV is currently consumed; supply environment explicitly.

Future jobs need trusted tenant/actor context, current database authorization,
transaction-local withTenant, idempotent effects, bounded retries and durable
PostgreSQL outbox state before consumers are enabled.
