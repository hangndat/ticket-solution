# SCR post-merge — prod deploy + smoke (PR #582 integrated)

| Trường | Giá trị |
| --- | --- |
| **Issue** | SCR post-merge (sau PR [#582](https://github.com/hangndat/ticket-solution/pull/582)) |
| **Runner** | Sora · uat · worker `task_f9294bd63d1e` |
| **Exact SHA (main)** | `8329675599c67e4430e069f2c29095188d33ef25` (`git rev-parse HEAD`) |
| **Prior review** | [`SCR-PR582-REVIEW-2026-10-20.md`](./SCR-PR582-REVIEW-2026-10-20.md) @ `0d5b52a` (pre-merge tip) |
| **Catalog blob SHA** | `0499e6d85067dea79d16edc7998c03e138f2421a` (`PROD-LAUNCH-UAT.md`) |
| **VPS marker** | `/opt/vemoki/deployed-sha.txt` → `8329675599c67e4430e069f2c29095188d33ef25` |
| **SSH** | `dexter@113.161.116.5` (alias `conanphong` không resolve máy agent) |
| **Policy** | **`SINGLE_CODE_RESOLVE_GLOBAL=0`** — không bật global resolve trong session này |

## Deploy (authorized)

| Step | Verdict | Evidence |
| --- | --- | --- |
| SCR-PM-D01 rsync | **PASS** | `apps/api`, `apps/web`, `packages/backend`, `packages/contracts`, lockfile → `/opt/vemoki/src` (exclude `compose.yaml`, `node_modules`, local `generated`) |
| SCR-PM-D02 migrate | **PASS** | Applied `202610200002_single_code_routing_rls`; no further pending migrations |
| SCR-PM-D03 build | **PASS** | `vemoki-runtime:local` — contracts tsc, `@ticket/backend`, `@ticket/api`, `@ticket/web` |
| SCR-PM-D04 restart | **PASS** | `docker compose restart api web` |
| SCR-PM-D05 nginx | **PASS** | `nginx-letencrypt-nginx-1` `nginx -t` + reload (fixed transient **502** sau restart) |

Previous marker `0b42515…` was ancestor of merge; prod now matches integrated `main`.

## Ops / backfill

| Step | Verdict | Evidence |
| --- | --- | --- |
| SCR-PM-O01 flag | **PASS** | `/opt/vemoki/.env`: `SINGLE_CODE_RESOLVE_GLOBAL=0` |
| SCR-PM-O02 backfill | **PASS** | `docker compose exec api node …/backfill-code-routing.cjs` → `{"candidates":0,"ambiguousGroups":0}` |

## Production smoke (flags off)

| ID | Verdict | Evidence |
| --- | --- | --- |
| SCR-PM-S01 health | **PASS** | `GET https://api.vemoki.com/v1/health` → 200 `status:ok` |
| SCR-PM-S02 resolve disabled | **PASS** | `POST /v1/redemptions/resolve` `{"code":"TEST"}` → **503** `RESOLVE_DISABLED` |
| SCR-PM-S03 redeem page | **PASS** | `GET https://app.vemoki.com/redeem` → **200** |
| SCR-PM-S04 BFF resolve | **PASS** | `POST /api/bff/redeem/resolve` (no session) → **403** CSRF (route live) |

## iOS — Dexter phone (physical)

| ID | Verdict | Evidence |
| --- | --- | --- |
| SCR-M01 | **BLOCKED** | `xcrun xctrace list devices` — **Dexter's iPhone 16 Pro (26.6.1)** `00008140-000605803C01801C` under **Devices Offline** |
| SCR-M02 | **NOT RUN** | Global redeem on device — depends on M01 |

## Flag-on pilot verdict

```text
Flag-on pilot (SINGLE_CODE_RESOLVE_GLOBAL=1 + web client flag): NO-GO
Post-merge deploy smoke (flags off, PR #582 on VPS): PASS
```

**NO-GO rationale (unchanged from SCR-PR582 review):** mandatory resolve token on global issue (SCR-SEC-1), AC-6 rate limits (SCR-SEC-2), no E2E SCR-P06–P07 with prod demo codes, physical SCR-M01–M02 blocked, API integration tests gap (SCR-QA-1).

**Not performed:** enable `SINGLE_CODE_RESOLVE_GLOBAL=1` or `NEXT_PUBLIC_SINGLE_CODE_RESOLVE=1`; merge; Project status updates.

## Drift

- VPS `infra/deploy/compose.yaml` retained (not overwritten by rsync).
- Prod catalog still empty for routing backfill (`candidates:0`); E2E resolve→issue remains blocked until demo codes + flag-on wave.

## Next

1. Close SCR-SEC-1/2 (and optional SCR-QA-1) on `main`, then coordinator-flag-on wave with demo redemption codes.
2. Re-run SCR-P06–P07 + SCR-M01–M02 on integrated SHA when device online.
