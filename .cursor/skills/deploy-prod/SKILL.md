---
name: deploy-prod
description: >-
  Deploy one Vemoki (ticket-solution) production service, or the whole VPS
  stack, to conanphong. Use when the user asks to deploy prod, update
  vemoki.com, ship web, api, worker, keycloak, or nginx, or restart a compose
  service on the VPS.
---

# Deploy Vemoki production

SSH: use the local shell alias / SSH config host `conanphong` (or `VEMoki_SSH_HOST` if set). Do **not** embed production IP/user in this skill. Source checkout: `/opt/vemoki/src`; immutable artifacts: `/opt/vemoki/releases`; state and secrets live outside both. Secrets: `/opt/vemoki/.env` (mode 600). Never print that file or realm client secrets.

Compose directory: `/opt/vemoki/src/infra/deploy`. For **every** Compose command pass both `--env-file /opt/vemoki/.env --env-file /opt/vemoki/release-pins.env`, because Compose interpolates all service pins. Deploy **one service** unless the user asked for the whole stack. Recreate a pinned service with `up -d --no-deps --force-recreate <service>`; `restart` does not replace its mount. Never run `up` without `--no-deps` during a one-service rollout.

Authoritative app/migrate procedure: [docs/ops/IMMUTABLE-RELEASE.md](../../../docs/ops/IMMUTABLE-RELEASE.md), [infra/deploy/README.md](../../../infra/deploy/README.md), and `scripts/release-artifact.py`. Do not build the fat `Dockerfile` on this host. Do not `du /var/lib/docker` or `docker commit` the app tree.

## Shared rules

- Do not touch `/media/anphong/nginx-letencrypt` except `data/nginx/vemoki.conf`. Leave vhosts `ancafe` and `dath` alone.
- Do not publish 80, 443, 8080, 1883, 27017, or 9001. Network `edge` is external `nginx-letencrypt_nginx_network`.
- App and migrate rollout requires explicit authorization for this production change, an exact reviewed source SHA, a verified Linux/Node 24 artifact for the host architecture, current schema evidence, and reviewed schema ranges and service pins. If any is missing, stop before changing the VPS.
- Build only in a staging directory from the clean exact SHA; check build exit status, native Prisma/sharp, manifest and checksums, then atomically publish a read-only release. Never install, build, rsync, or swap source under a running app mount. Keep `.env`, APNs keys, `.data`, and Next cache outside the release.
- Back up database and persistent state as required by the release plan before migration. Do not put secrets or user data in an artifact, manifest, or log. Do not install `@ticket/mobile` for this server release.
- Before the first Compose invocation with release pins, verify and pin **all five** services (`api`, `worker`, `web`, `portal`, `migrate`); subsequently change only the requested service pin. Preserve the last-good release through the rollback window.

## App and migrate rollout (`api`, `worker`, `web`, `portal`, `migrate`)

Follow the immutable release runbook in order: expand/backfill compatibility review, build and `verify`, pin one service with `--schema <CURRENT>` and external pin file, Compose `config --quiet`, `up -d --no-deps --force-recreate <service>`, then check health, manifest and the container's actual mount via `docker inspect`. Do not infer compatibility solely from a passing `pin`: its schema range was supplied by an operator and must match migration tests. For `migrate`, pin the verified migration artifact, run once, and wait for exit 0 before proceeding. A failed migration stops rollout; recover forward without a destructive down migration.

Roll worker only after additive schema, legacy row repair and F02 semantics have been checked. If old and new workers disagree on outbox states, stop old claims and let leases expire before switching; do not run both against the same outbox. Roll API independently only while its contract and schema range permit the version skew. Rollback is a new pin plus recreate and smoke against the **current** schema; a schema-incompatible release or pre-F02 worker must stay blocked. Cleanup requires the runbook's dry run, rollback-window check, pin check and live mount check.

Service checks after recreate:

- `web`: `https://vemoki.com/` 200; if auth changed, use the login check below. Do not set `HOSTNAME=0.0.0.0`; use `next start --hostname 0.0.0.0 --port 3000`.
- `portal`: `https://portal.vemoki.com/` 200/307; unauthenticated `/api/bff/me/tenants` and `/api/bff/platform/me` 401. Dual-run and nginx: `docs/ops/PORTAL-PROD-CUTOVER.md`.
- `api`: `https://api.vemoki.com/v1/health` 200 with `"status":"ok"`.
- `worker`: process stays up; inspect outbox relay and pending delivery state. SMTP remains Mailpit in this setup; do not redirect it to public SMTP as part of an app rollout.
- `migrate`: exit 0 and expected `_prisma_migrations` rows; do not recreate postgres.


## keycloak

Sync the realm file to `/opt/vemoki/realm-ticket.json` without printing secrets. The container user must be able to read it. Mode `600` owned by `dexter` makes import fail and the process exit. `docker compose up -d --no-deps --force-recreate keycloak`.

Verify: health becomes healthy, and `https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration` is 200 with issuer `https://auth.vemoki.com/realms/ticket`.

## nginx

Edit only `data/nginx/vemoki.conf`. `nginx -t` then reload inside `nginx-letencrypt-nginx-1`. Do not compose-up that stack.

Targets: `vemoki.com` → `vemoki-web:3000`, `app.vemoki.com` → `vemoki-web:3000`, `portal.vemoki.com` → `vemoki-portal:3013`, `api.vemoki.com` → `vemoki-api:3001`, `auth.vemoki.com` → `vemoki-keycloak:8080`. Set `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and **overwrite** `X-Forwarded-Host $host` (strip client-supplied value). Prefer app `PUBLIC_WEB_ORIGIN=https://vemoki.com` over trusting raw forwarded headers. Rewrite `Location` values `http://0.0.0.0:3000/` and `https://0.0.0.0:3000/` to `https://vemoki.com/`.

Verify apex/app/portal/api/auth plus `https://ancafe.anphong.vn/` still 200.

## postgres

Do not recreate it to deploy app code. `init-db.sh` runs only on an empty data volume. A compose change uses `docker compose up -d --no-deps postgres` and must leave volume `postgres_data` in place.

## mailpit

No source sync. `docker compose up -d --no-deps mailpit` only if that service is down. It is the dev SMTP catcher, not production mail.

## Whole stack

Only with explicit whole-stack production authorization, verify the exact source/build SHA, platform, five release pins, schema compatibility and backup first. Follow the immutable runbook for build, expand/backfill and one-shot migrate, then recreate and verify `api`, `worker`, `web`, `portal` one at a time. Apply `keycloak`, `mailpit`, and `nginx` procedures below only if their own configuration changed; verify every service touched. Do not rebuild or sync a mutable app tree during the rollout.

## Login check

Use this when web, api, keycloak, or nginx auth changed. Headless HTTP or Playwright only. Do not drive the desktop mouse.

`https://vemoki.com/api/bff/me` with no session is 401. Demo users are named in `docs/reviews/D1-P4-KEYCLOAK-SMOKE.md`. Each login must land on `https://vemoki.com/auth` with no hop through `0.0.0.0`, and `/api/bff/me` must return that email.

Curl from the VPS with `--resolve <host>:443:127.0.0.1`.

Do not commit `.env`, the patched realm file, or UAT screenshots. Do not start Expo or EAS.
