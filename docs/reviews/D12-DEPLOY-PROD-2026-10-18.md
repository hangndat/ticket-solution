# D12 production deploy — 2026-10-18

## Authorization
User: **"deploy đi"** (session sau D12 coding + O06 chốt). Follow-up **"tiếp tục đi"**: ops verify + fix credential env.

## Deployed tip
- Git SHA: `0a65f3c2f2d51357ee1a6270151d279758188fb7` (`[D12] Backend: O06 anonymize… (#297)`)
- Host: `VEMoki_SSH_HOST=dexter@…` (alias `conanphong` không có trong `~/.ssh/config` máy này)
- Tree: `/opt/vemoki/src`; env: `--env-file /opt/vemoki/.env`
- Marker: `/opt/vemoki/deployed-sha.txt`

## What ran
1. **Rsync** tip → `/opt/vemoki/src` với excludes skill; **giữ** remote `infra/deploy/compose.yaml` (PLATFORM_* / WEB_PUBLIC_ORIGIN).
2. Chown/rm stale `packages/backend/src/generated/prisma` (root-owned) qua `vemoki-runtime:local`.
3. **Runtime / pnpm install**: skipped (Dockerfile.runtime + lockfile SHA khớp).
4. **Realm**: sync `infra/keycloak/realm-ticket.json` → `/opt/vemoki/realm-ticket.json` mode `644`; **keycloak** `up -d --no-deps --force-recreate` → healthy.
5. **migrate**: applied `202610180001_d12_o06_account_anonymize` (19 migrations); exit 0.
6. **mailpit**: already Running (SMTP prod vẫn Mailpit — không đổi).
7. **Build**: contracts tsc → backend → api → web → worker; log `/opt/vemoki/deploy-d12-build.log`.
8. **Restart**: `api` `worker` `web`.
9. **nginx**: không đụng `vemoki.conf`.
10. **Follow-up ops (tiếp tục):** phát hiện `TICKET_CREDENTIAL_KEY` trong `.env` nhưng **không** vào container (render len 0) → email TicketIssued `DEAD` / `TICKET_CREDENTIAL_KEY misconfigured`. Fix: `set -a; . /opt/vemoki/.env; set +a` rồi `docker compose --env-file /opt/vemoki/.env up -d --no-deps --force-recreate api worker` → worker/api key len **64**. APNs: `APNS_ENABLED=true`, `APNS_PRODUCTION=true`, AuthKey.p8 mounted.

## Verify
| Check | Result |
| --- | --- |
| `https://vemoki.com/` | 200 |
| `https://api.vemoki.com/v1/health` | 200 `{"status":"ok","service":"api","version":"0.1.0"}` |
| OIDC discovery | 200, issuer `https://auth.vemoki.com/realms/ticket` |
| `https://vemoki.com/privacy` | 200 (copy O06) |
| `https://vemoki.com/api/bff/me` (no session) | **302** → `https://app.vemoki.com/api/bff/me` (O13) |
| `https://app.vemoki.com/api/bff/me` | **401** `UNAUTHENTICATED` |
| `https://app.vemoki.com/` | 200 |
| worker | Up; outbox relay; APNs key readable |
| MinIO container | Up (healthy) |
| `https://ancafe.anphong.vn/` | 200 |

## Limitations / còn mở
- SMTP vẫn **Mailpit** (`smtp://mailpit:1025`) — chưa MTA internet / SPF/DKIM.
- Email lịch sử `DEAD` (2) do credential key trống trước recreate — **không** auto-retry; cần resend CS sau khi key đã nạp.
- APNs prod gateway **đã bật** trên worker; chưa device UAT `DELIVERED` trên binary signed trong session này (1 `device_tokens`).
- On-call RUNBOOK §6.1 template người còn trống.
- Store submit chưa ủy quyền.
- Compose remote patches retained (drift vs git main).
- Demo login attendee/staff không re-run full trong session này.
