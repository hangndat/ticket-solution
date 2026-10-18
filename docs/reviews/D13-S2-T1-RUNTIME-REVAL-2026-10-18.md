# D13-S2-T1 — Runtime prod reval (GAP-OPS-REVAL)

| Field | Value |
| --- | --- |
| Issue | [#319](https://github.com/hangndat/ticket-solution/issues/319) · Story [#305](https://github.com/hangndat/ticket-solution/issues/305) · Epic [#301](https://github.com/hangndat/ticket-solution/issues/301) |
| Tip deploy marker | `9910173dc1c4f016448e2bc230ab6843c419b315` (`/opt/vemoki/deployed-sha.txt`) |
| Prior marker | `63535b48…` (pre Wave C) → redeployed tip Wave C + O02 |
| Date | 2026-10-18 |
| Agent | coordinator Cursor (session leader) |
| Architecture impact | Không — verify/deploy tip |

## Authorization

User: **«làm luôn đi»** (tiếp GAP-OPS-REVAL / D13 runtime sau gap-audit Wave A–C). Deploy tip theo skill `deploy-prod` (SSH `dexter@…`; alias shell `conanphong`).

## What ran

1. Rsync ownership trees (`apps/{api,web,worker}`, `packages/{backend,contracts}`, lockfile) — giữ remote `infra/deploy/compose.yaml`.
2. Cleared root-owned `packages/backend/src/generated/prisma` via `vemoki-runtime:local`.
3. Build in runtime: contracts tsc → backend generate/build → api → web → worker.
4. `migrate` applied: `…002`…`…006_d12_o02_me_events` (24 migrations total; no pending).
5. `api`/`worker` force-recreate with env; `web` restart.

## Verify (public HTTP)

| Check | Result |
| --- | --- |
| `https://vemoki.com/` | **200** |
| `https://vemoki.com/privacy` | **200** |
| `https://vemoki.com/marketing` | **200** |
| `https://api.vemoki.com/v1/health` | **200** `{"status":"ok","service":"api"}` |
| OIDC discovery | **200** |
| `https://app.vemoki.com/api/bff/me` (anon) | **401** |
| `https://app.vemoki.com/api/bff/me/events` (anon) | **401** |
| `https://ancafe.anphong.vn/` | **200** (không đụng) |
| Containers | api/web/worker Up; postgres/keycloak/minio/mailpit healthy |

## SMTP / email (vẫn blocker S6)

| Fact | Value |
| --- | --- |
| Worker `SMTP_URL` host | **`smtp://mailpit`** (không MTA internet) |
| Mailpit container | Up (healthy) |
| Internet SMTP / SPF/DKIM | **Chưa** — giữ **Bị chặn** cho submit App Review nếu luồng email bắt buộc |

APNs env present (`APNS_ENABLED`, production flag) — không gửi push test trong reval này.

## Limitations

- Không claim pilot/production-ready / Ready for Sale.
- Không physical TestFlight smoke (#327 vẫn chờ operator).
- Không Submit for Review (#332).
- Không đổi SMTP sang MTA công cộng trong bước này (cần credential + DNS user).

## Board recommendation

| Issue | Action |
| --- | --- |
| #319 | Giữ **Bị chặn** (SMTP mailpit) + comment link artifact này + tip SHA |
| #305 | **Đang làm** — runtime tip đã cập nhật; SMTP còn mở |
| #320 | Sync **Hoàn thành** nếu DoD PR #342 đã đủ (verify artifact đã merge) |
| #327 / S6–S8 | Vẫn **Bị chặn** deps cứng |

## Verdict

**PASS partial / ops reval** — tip `9910173…` live trên prod HTTP/OIDC/migrate/O02 MeEvents path. **FAIL gate SMTP internet** → không mở S6.
