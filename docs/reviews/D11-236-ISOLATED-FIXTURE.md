# D11 #236 — Isolated backend fixture (ADR-19 public events)

**Verdict:** READY for UAT worker `ctx_56c85aea2624` — API live `http://127.0.0.1:4112` → DB :56443.  
**Source SHA (worktree):** `7fb6449703680e87b614b46fc0b6fdefbbb4107a` (includes tip `6f7995e` mfest rename).  
**Role:** backend fixture-only (no tracked feature/contract/lockfile edits; no commit/push/PR/cloud).  
**Architecture impact:** Không — runtime fixture local theo ADR-19 đã merge.  
**Parent:** UAT #236 blocked on fixture #237 (`d11_uat_rt` @ :56442 thiếu `GRANT ticket_platform_runtime` → `SET LOCAL ROLE` fail cho public events).  
**OIDC membership handoff:** `/tmp/d11-236-membership-handoff.json` — staff/attendee userIds+subjects provisioned on DB :56443 (Owner + event assignments). Tenant slug seed = **`mfest-demo`** (not `demo-fun`); stable D9 UUIDs unchanged.

## Root cause (237) → fix (236 isolated)

| Item | 237 (`ticket-d11-uat`) | 236 isolated (`ticket-remaining-236`) |
| --- | --- | --- |
| Compose project | `ticket-d11-uat` | `ticket-remaining-236` |
| Postgres | :56442 / `ticket_d11_uat` | :56443 / `ticket_remaining_236` |
| Redis | :56489 | :56381 |
| Runtime LOGIN | `d11_uat_rt` (NOBYPASSRLS) | `remaining_236_rt` (NOBYPASSRLS) |
| Role grants | `ticket_runtime` only | `ticket_runtime` **+** `ticket_platform_runtime` |
| OIDC | owns :18091 | **Reuse** :18091 via HTTP only (no realm/client/secret edits) |
| API | :4111 (owner khác — không đụng) | Verified on :4112 then **released port** for UAT to start from `api.env` |

Post-bootstrap grant (fixture DB only — **không** sửa 56442):

```sql
GRANT ticket_platform_runtime TO remaining_236_rt;
```

Verified: `remaining_236_rt` → `rolsuper=f`, `rolbypassrls=f`, `rolcanlogin=t`, member_of `{ticket_runtime,ticket_platform_runtime}`.  
`SET LOCAL ROLE ticket_platform_runtime` PASS under runtime session.

## Private env + live API

| File / resource | Purpose |
| --- | --- |
| `/tmp/ticket-remaining-236/api.env` | Absolute path — `DATABASE_URL` → `remaining_236_rt@127.0.0.1:56443/ticket_remaining_236`, `PORT=4112`, OIDC JWKS :18091, MinIO :19120, SMTP :11045, Redis :56381 |
| `/tmp/ticket-remaining-236/run-api.sh` | Supervisor PID files under `/tmp/ticket-remaining-236/` |
| `/tmp/ticket-remaining-236/consumer-web.env` | Web consumer pointers (safe) |
| `/tmp/ticket-remaining-236/consumer-ios.env` | iOS consumer pointers (safe) |
| `/tmp/ticket-remaining-236/OWNERSHIP.md` | Cleanup ownership |
| `/tmp/d11-236-membership-handoff.json` | UAT-provided staff/attendee IDs (no tokens) — applied |

**Ready for UAT start:** `API_BASE=http://127.0.0.1:4112` (port freed; load `/tmp/ticket-remaining-236/api.env`) · DB :56443 · Redis :56381.  
Staff `GET /v1/me/tenants` → 2 Owner tenants (`mfest-demo`, `demo-studio`). Public `GET /v1/public/tenants/mfest-demo/events` → 200. Report → 200.

Credentials / passwords: chỉ trong private `/tmp/ticket-remaining-236/*` và docs demo — **không** in trong artifact này.

## Loopback URLs

| Service | URL |
| --- | --- |
| Target API (UAT) | http://127.0.0.1:4112 |
| Health (after UAT starts API) | http://127.0.0.1:4112/v1/health |
| Public events | http://127.0.0.1:4112/v1/public/tenants/mfest-demo/events |
| OIDC issuer (shared) | http://127.0.0.1:18091/realms/ticket |
| Postgres | 127.0.0.1:56443 |
| Redis | 127.0.0.1:56381 |
| MinIO | http://127.0.0.1:19120 (console :19121) |
| Mailpit | SMTP :11045 / UI http://127.0.0.1:18045 |

Left alone: API :4111, DB :56442, Keycloak :18091 (HTTP client only).

## Fixture IDs (D9 · Demo / mfest)

| Entity | Slug | UUID |
| --- | --- | --- |
| Tenant A | `mfest-demo` | `d9d9f001-0001-4000-8000-000000000001` |
| Tenant B | `demo-studio` | `d9d9f001-0001-4000-8000-000000000002` |
| Event A | `mfest` PUBLISHED | `d9d9f001-0002-4000-8000-000000000001` |
| Event B | `studio-night` | `d9d9f001-0002-4000-8000-000000000002` |

Codes: `DEMO-MFEST-001…010`, `DEMO-STUDIO-001…010` (HMAC in DB).  
Seed: `demo-seed.cjs` ×2 → 20 codes inserted then 0/20 skipped (idempotent).  
Issuer used: `http://127.0.0.1:18091/realms/ticket`.  
Staff userId `131716ca-61c3-47d1-8e00-de8530763995` / subject `68bcc705-…` · Attendee userId `fb87c83c-e619-4a15-98a2-11e37b7b49c5` / subject `3bb3d036-…` (exact IDs from UAT membership handoff).

## Smoke evidence (ephemeral API :4113, then stopped)

Source SHA under test: `7fb6449703680e87b614b46fc0b6fdefbbb4107a`  
Artifact: `/tmp/ticket-remaining-236/smoke-final.json`

```json
{
  "ok": true,
  "results": [
    { "check": "health", "status": 200, "pass": true },
    { "check": "public_events", "status": 200, "pass": true },
    { "check": "public_detail", "status": 200, "pass": true },
    { "check": "me_staff", "status": 200, "pass": true },
    { "check": "me_tenants", "status": 200, "pass": true },
    { "check": "list_events", "status": 200, "pass": true },
    { "check": "branding", "status": 200, "pass": true },
    { "check": "report", "status": 200, "pass": true },
    { "check": "staff_tickets", "status": 200, "pass": true },
    { "check": "gate_session", "status": 201, "pass": true },
    { "check": "me_attendee", "status": 200, "pass": true },
    { "check": "attendee_tickets", "status": 200, "pass": true }
  ]
}
```

**PASS:** roles / health / public events / auth CS (staff tickets) / report / online gate session.

## Controls

- Ports 56443 / 56381 checked free before bind.
- Compose: `postgres redis minio mailpit` only (Keycloak profile-disabled).
- No grant/reset/migration on DB :56442; no stop of API :4111.
- No feature code / OpenAPI / root lockfile changes.
- No cloud / prod / store / EAS.
- Fixture DB+Redis+MinIO+Mailpit **left running**; API :4112 port freed for UAT start.
- Do not stop :4111 / :56442 / Keycloak :18091 from this project.

## Shutdown (coordinator cleanup only — after UAT)

```bash
docker compose --env-file /tmp/ticket-remaining-236/compose.env \
  -f compose.yaml -f /tmp/ticket-remaining-236/compose.override.yaml \
  stop postgres redis minio mailpit
# optional: docker volume rm ticket-remaining-236_postgres_data \
#   ticket-remaining-236_redis_data ticket-remaining-236_minio_data
```

Do **not** stop Keycloak :18091 from this project (owned by `ticket-d11-uat`).
