---
name: deploy-prod
description: >-
  Deploy one Vemoki (ticket-solution) production service, or the whole VPS
  stack, to conanphong. Use when the user asks to deploy prod, update
  vemoki.com, ship web, api, worker, keycloak, or nginx, or restart a compose
  service on the VPS.
---

# Deploy Vemoki production

SSH: `ssh dexter@113.161.116.5`. The zsh alias `conanphong` does not exist in non-interactive SSH. Tree: `/opt/vemoki/src`. Secrets: `/opt/vemoki/.env` (mode 600). Never print that file or realm client secrets.

Compose directory: `/opt/vemoki/src/infra/deploy`. Always pass `--env-file /opt/vemoki/.env`. Deploy **one service** unless the user asked for the whole stack. `docker compose up -d <service>` without `--no-deps` restarts dependencies. After a bind-mount rebuild, `docker compose restart <service>` is enough. Use `up -d --no-deps --force-recreate <service>` only when the compose file for that service changed.

Layout: [infra/deploy/README.md](../../../infra/deploy/README.md). Do not build the fat `Dockerfile` on this host. Do not `du /var/lib/docker` or `docker commit` the app tree.

## Shared rules

- Do not touch `/media/anphong/nginx-letencrypt` except `data/nginx/vemoki.conf`. Leave vhosts `ancafe` and `dath` alone.
- Do not publish 80, 443, 8080, 1883, 27017, or 9001. Network `edge` is external `nginx-letencrypt_nginx_network`.
- Rsync must exclude `node_modules`, `.git`, `.next`, `dist`, `.turbo`, `apps/mobile/ios`, `apps/mobile/android`, `.uat-artifacts`. Never delete `/opt/vemoki/src/.pnpm-store` or `/opt/vemoki/src/node_modules`.
- pnpm runs in `vemoki-runtime:local` with a single mount `-v /opt/vemoki/src:/app`, store `/app/.pnpm-store`, `package-import-method=hardlink`. Do not install `@ticket/mobile`.
- Rebuild `vemoki-runtime:local` from `Dockerfile.runtime` only when that file changes or the image is missing.
- Run `pnpm install --frozen-lockfile --filter @ticket/api... --filter @ticket/web... --filter @ticket/worker...` only when a lockfile or `package.json` changed.

Compile contracts, when api, web, or worker need them:

```bash
pnpm --filter @ticket/api exec tsc -p ../../packages/contracts/tsconfig.json
```

## web

Sync `apps/web` and, if imported types changed, `packages/contracts`. Build `@ticket/web`. `docker compose restart web`.

Verify: `https://vemoki.com/` is 200. If auth code changed, run the login check below. Do not set `HOSTNAME=0.0.0.0`. Listen only via `next start --hostname 0.0.0.0 --port 3000`.

## api

Sync `apps/api`, `packages/backend`, and `packages/contracts` as needed. Build `@ticket/backend` then `@ticket/api`. `docker compose restart api`.

Verify: `https://api.vemoki.com/v1/health` is 200 and the body contains `"status":"ok"`.

## worker

Sync `apps/worker` and `packages/backend` as needed. Build `@ticket/backend` then `@ticket/worker`. `docker compose restart worker`.

Verify: container stays up and the log shows the outbox relay. SMTP is still Mailpit. Do not point it at a public SMTP server in this step.

## migrate

Sync `packages/backend/prisma` and `prisma.config.ts`. Do not rebuild the app. `docker compose up -d migrate` and wait for exit 0. Then restart `api` and `worker` only if they must load the new schema.

Verify: migrate logs say the migrations applied. Do not recreate `postgres`.

## keycloak

Sync the realm file to `/opt/vemoki/realm-ticket.json` without printing secrets. The container user must be able to read it. Mode `600` owned by `dexter` makes import fail and the process exit. `docker compose up -d --no-deps --force-recreate keycloak`.

Verify: health becomes healthy, and `https://auth.vemoki.com/realms/ticket/.well-known/openid-configuration` is 200 with issuer `https://auth.vemoki.com/realms/ticket`.

## nginx

Edit only `data/nginx/vemoki.conf`. `nginx -t` then reload inside `nginx-letencrypt-nginx-1`. Do not compose-up that stack.

Targets: `vemoki.com` → `vemoki-web:3000`, `api.vemoki.com` → `vemoki-api:3001`, `auth.vemoki.com` → `vemoki-keycloak:8080`. Send `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`. Rewrite `Location` values `http://0.0.0.0:3000/` and `https://0.0.0.0:3000/` to `https://vemoki.com/`.

Verify the three hosts above plus `https://ancafe.anphong.vn/` still 200.

## postgres

Do not recreate it to deploy app code. `init-db.sh` runs only on an empty data volume. A compose change uses `docker compose up -d --no-deps postgres` and must leave volume `postgres_data` in place.

## mailpit

No source sync. `docker compose up -d --no-deps mailpit` only if that service is down. It is the dev SMTP catcher, not production mail.

## Whole stack

Run the services in this order only when the user asked for a full deploy: runtime image if needed, install if the lockfile changed, migrate, keycloak, mailpit, api, worker, web, nginx if its file changed. Then run every verify line that applies.

## Login check

Use this when web, api, keycloak, or nginx auth changed. Headless HTTP or Playwright only. Do not drive the desktop mouse.

`https://vemoki.com/api/bff/me` with no session is 401. Demo users are named in `docs/reviews/D1-P4-KEYCLOAK-SMOKE.md`. Each login must land on `https://vemoki.com/auth` with no hop through `0.0.0.0`, and `/api/bff/me` must return that email.

Curl from the VPS with `--resolve <host>:443:127.0.0.1`.

Do not commit `.env`, the patched realm file, or UAT screenshots. Do not start Expo or EAS.
