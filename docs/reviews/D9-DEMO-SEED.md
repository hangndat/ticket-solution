# D9 Demo seed — evidence (Issues #135–#138 / Epic #134)

**Branch:** `hangndat/d9-be-seed`  
**Fixture:** yes — tenants/events/codes marked `· Demo` / `(fixture)`; no production secrets.

## Dataset (T1 #136)

See [`docs/demo/D9-DEMO-DATASET.md`](../demo/D9-DEMO-DATASET.md).

- Tenants: `demo-fun`, `demo-studio` (stable UUIDs `d9d9f001-…`)
- Events: `fun-fest`, `studio-night` PUBLISHED + brand snapshot
- Staff Owner + event assignment: `staff@example.com`
- Codes: `DEMO-FUN-001…010`, `DEMO-STUDIO-001…010` (HMAC only in DB)

## Seed idempotent (T2 #137)

```bash
DATABASE_URL=… CODE_HMAC_PEPPER=… OIDC_ISSUER=… ./scripts/d9-demo-seed.sh
# second run: codesInserted=0, tenants.created=false
```

CLI: `packages/backend/scripts/demo-seed.cjs` → `seedD9DemoDataset`.

## API smoke (T3 #138)

```bash
./scripts/d9-demo-seed-smoke.sh
# → D9_DEMO_SEED_SMOKE_PASS
```

Automated run (local Compose Postgres + Keycloak):

| Check | Result |
| --- | --- |
| health | 200 |
| me_attendee | 200 emailVerified |
| me_staff | 200 |
| me_tenants_staff | 200 slugs demo-fun + demo-studio |
| redeem_attendee DEMO-FUN-001 | 201 |
| me_tickets_attendee | 200 count≥1 |
| seed 2nd run | codesInserted=0 |

Issuer used: Keycloak discovery (`http://192.168.86.8:8080/realms/ticket` on this machine). DB: throwaway `ticket_d9_demo` + runtime role `d9_demo_rt` (NOBYPASSRLS).

## Unit

```bash
pnpm --filter @ticket/backend exec node --test test/demo-seed-unit.test.cjs
# PASS
```

## Commit SHA

_Filled after commit — see git rev-parse on branch tip._
