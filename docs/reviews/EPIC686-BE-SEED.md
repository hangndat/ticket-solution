# Epic #686 — Backend prod seed implementation evidence

| Field | Value |
| --- | --- |
| Issue | [#686](https://github.com/hangndat/ticket-solution/issues/686) |
| Scope | `packages/backend/src/prod-seed.ts`, CLI `prod-seed.cjs`, `scripts/prod-seed.sh` |
| Dataset | [PROD-SEED-DATASET.md](../demo/PROD-SEED-DATASET.md) |
| ADR | [ADR-21](../ops/ADR-21-PROD-DEMO-SEED.md) |

## Implementation summary

- Idempotent seed namespace `686f0001-*`: 4 tenants, 6 published events (1+2+3+0), inventory (types, sources, quota, VEM-* codes), staff membership + per-event assignment by role, ADR-19 marketing publish.
- No `· Demo` marker on prod fixture UI fields; D9 `demo-seed.ts` unchanged.
- Guards: `PROD_SEED_CONFIRM=1` (mutate), `PROD_SEED_DRY_RUN=1` (full path + transaction rollback), `assertProdSeedDatabaseHostAllowed` blocks `*.vemoki.com` hosts.
- Staff: membership grant by plus-address email only (ADR-21 C); optional `PROD_SEED_CREATE_STAFF_USERS=1` for local/tests.
- CLI never logs `CODE_HMAC_PEPPER` or other secrets.

## Tests run

| Command | Result |
| --- | --- |
| `node --test test/prod-seed-unit.test.cjs` | PASS |
| `node --test test/demo-seed-unit.test.cjs` | PASS (D9 regression) |
| `node --test test/prod-seed-idempotent.test.cjs` | PASS (isolated Docker Postgres, 2× seed) |

## Local Compose Postgres (127.0.0.1:55432)

Environment: `DATABASE_URL=postgresql://ticket_dev:***@127.0.0.1:55432/ticket_solution`, `CODE_HMAC_PEPPER` local dev pepper, `PROD_SEED_CONFIRM=1`, `PROD_SEED_CREATE_STAFF_USERS=1`.

| Run | `codesInserted` | `codesSkipped` | `configsPublished` | `configsSkipped` |
| --- | ---: | ---: | ---: | ---: |
| 1 | 60 | 0 | 6 | 0 |
| 2 | 0 | 60 | 0 | 6 |

Second run confirms idempotent codes + marketing skip.

## Prod

**Not executed.** Per task/runbook §9 — no VPS/prod `DATABASE_URL` used in this wave.

## Reviewer notes

- Re-validate exact SHA on PR tip after merge queue.
- Media manifest (`brand/prod/`) is out of scope for this BE PR.
