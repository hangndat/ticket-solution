# D6 production deploy — 2026-10-17

## Deployed tip
- Git SHA: `2250191fe2f594ff83f3a963f6a5938d70d6987a` (`docs(reviews): attach D6 headless UAT screenshots for Issue #81 (#99)`)
- Host: SSH alias `conanphong` → `dexter@…` (VEMoki_SSH_HOST unset locally; alias used)
- Tree: `/opt/vemoki/src`; env: `--env-file /opt/vemoki/.env`

## What ran
1. **Rsync** main tip → `/opt/vemoki/src` with skill excludes; **excluded** `infra/deploy/compose.yaml` after coordinator chose `preserve_remote_compose` (keeps PLATFORM_* + WEB_PUBLIC_ORIGIN on VPS).
2. **Runtime image**: skipped (Dockerfile.runtime SHA match; `vemoki-runtime:local` present).
3. **pnpm install**: skipped (pnpm-lock.yaml + package.json SHA match).
4. **migrate**: `docker compose up -d migrate` → Exited (0); “No pending migrations to apply.” (16 migrations).
5. **keycloak**: `up -d --no-deps` only (realm SHA match; no force-recreate).
6. **mailpit**: already Running.
7. **Build** in `vemoki-runtime:local`: contracts tsc → `@ticket/backend` (after `rm -rf` stale `src/generated/prisma`) → api → web → worker. Log: `/opt/vemoki/deploy-d6-build.log`.
8. **Restart**: `docker compose restart api worker web`.
9. **nginx**: not touched (`vemoki.conf` unchanged / not in repo sync).

## Verify (VPS `--resolve …:443:127.0.0.1` + public DNS)
| Check | Result |
| --- | --- |
| `https://vemoki.com/` | 200 |
| `https://api.vemoki.com/v1/health` | 200 `{"status":"ok","service":"api","version":"0.1.0"}` |
| OIDC discovery `auth.vemoki.com/.../openid-configuration` | 200, issuer `https://auth.vemoki.com/realms/ticket` |
| `https://vemoki.com/api/bff/me` (no session) | 401 `UNAUTHENTICATED` |
| `https://ancafe.anphong.vn/` | 200 (spot; nginx untouched) |
| worker | Up; log: outbox email relay |

## Limitations
- Full demo login (attendee/staff) not re-run; AuthSession rename is web naming — BFF unauth 401 done.
- Remote compose PLATFORM_* patches intentionally retained (drift vs git main compose).
- First rsync `--delete` hit root-owned Prisma generated files; ownership fixed via container `chown`, stale generate dir removed before rebuild.
