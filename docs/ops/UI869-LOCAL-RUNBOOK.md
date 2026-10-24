# UI #869 — local always-on dev stack (fullflow)

Issue: [#869](https://github.com/hangndat/ticket-solution/issues/869) · PR [#870](https://github.com/hangndat/ticket-solution/pull/870)
Role: backend ([docs/agents/roles/backend.md](../agents/roles/backend.md)) — ownership: `scripts/dev-local*`, this doc, ignored state (`.local-dev/`). No `apps/*`/`packages/*`/`infra/*` committed-file edits.
Architecture impact: Không (isolated local runtime config only; no business backend/contract edits; the committed `infra/keycloak/realm-ticket.json` is never modified — an ignored copy is generated per run).

Fixture only. Local loopback only (`127.0.0.1` / `localhost`). Never commit secrets or state under `.local-dev/`.

**Status at handoff: RUNNING.** Infra + API + web verified live end-to-end (see Evidence below), launchd-supervised, survives a `kill -9` of the API (restart proof included).

## What this gives you

One idempotent script, `scripts/dev-local-stack.sh`, isolated from the shared
root `compose.yaml` project and from `ticket_d9_demo`:

| Component | Isolation | Port |
| --- | --- | --- |
| Postgres, Redis, Keycloak, MinIO, Mailpit | own compose project `ui869dev` (`docker compose -p ui869dev`), own named volumes, own ignored realm copy mounted via compose override | pg 55433 / redis 56380 / **Keycloak 8080** / minio 9002+9003 / mailpit 1026+8026 |
| API (`apps/api`) | `pnpm --filter @ticket/api... build` then `node dist/main.js` | **3498** (`/v1/health`) |
| Web (`apps/web`) | `pnpm exec next dev --port 3417 --hostname 127.0.0.1` | **3417** |
| DB | isolated `ticket_ui869_dev`, runtime user `ui869_dev_rt` (never touches `ticket_d9_demo`) | via isolated Postgres above |

Host split (explicit local-only authorization — see "OIDC redirect" below):

- Marketing surface: `http://marketing.localhost:3417` (`MARKETING_HOSTS=marketing.localhost`, `MARKETING_ORIGIN=http://marketing.localhost:3417`)
- Product surface: `http://localhost:3417` (`PRODUCT_ORIGIN` / `WEB_PUBLIC_ORIGIN=http://localhost:3417`)
- OIDC issuer: `http://127.0.0.1:8080/realms/ticket` (isolated `ui869dev` Keycloak, **not** the shared stack's Keycloak)

Commands:

```sh
./scripts/dev-local-stack.sh up                  # bring up isolated infra + API + web (idempotent)
./scripts/dev-local-stack.sh status               # containers, owned PIDs, ports, health
./scripts/dev-local-stack.sh logs [api|web]       # tail logs
./scripts/dev-local-stack.sh down                 # stop owned API/web PIDs + ui869dev containers (volumes preserved, not destroyed)
./scripts/dev-local-stack.sh seed --reset         # explicit-only: drop/recreate+reseed ticket_ui869_dev
./scripts/dev-local-stack.sh fixtures             # additive scenario seed; preserves existing tickets, never resets DB
./scripts/dev-local-stack.sh supervisor           # foreground ensure/restart loop (this is the launchd Program)
./scripts/dev-local-stack.sh install-autostart    # write + bootstrap launchd agent (user-authorized)
./scripts/dev-local-stack.sh uninstall-autostart  # unload + remove launchd agent
```

State: `.local-dev/ui869/{env.sh,realm-ticket.local.json,docker-compose.override.yml,logs/,pid/}` —
gitignored, directory `chmod 700`, `env.sh`/realm copy `chmod 600`. The script
never prints tokens/secrets to stdout.

## OIDC local redirect config (explicit user authorization, this task)

`ticket-web`'s redirect URIs / webOrigins / post-logout URIs for `:3417`
(`http://localhost:3417` and `http://127.0.0.1:3417`) are added **only** to an
ignored, generated copy of the realm
(`.local-dev/ui869/realm-ticket.local.json`), mounted into the isolated
`ui869dev` Keycloak container via a compose override. `infra/keycloak/realm-ticket.json`
(the committed, shared realm) is **never edited**. The isolated Keycloak also
drops the `CONFIGURE_TOTP` required action for the fixture `staff@example.com`
/ `attendee@example.com` users on its local copy only, so password-grant login
works on a fresh isolated volume (the shared stack's existing Keycloak volume
predates this requirement and is unaffected either way).

## Accounts / codes (LOCAL DEMO ONLY — fixture, not a real secret)

Seeded via `scripts/d9-demo-seed.sh` (reused as-is) into `ticket_ui869_dev`:

- Staff: `staff@example.com` / `staff-demo`
- Attendee: `attendee@example.com` / `attendee-demo`
- 2 tenants (`mfest-demo`, `demo-studio`), 3 events: `mfest`, `studio-night` in the future and `studio-night-past` in the past. `dev-local-fixtures.cjs` extends the original D9 dataset through its existing seed API; it does not change backend sources.
- 25 codes and supported single-code routing backfill. `DEMO-MFEST-002` is available for manual redemption; `DEMO-MFEST-008` is disabled; `DEMO-STUDIO-010` is consumed; `DEMO-PAST-001` belongs to an event whose redemption window is closed; `DEMO-NOT-FOUND` is deliberately unknown.
- Attendee has a future-event ticket and a past-event ticket, issued through the real local OIDC/API using `DEMO-STUDIO-010` / `DEMO-PAST-005`. Re-running fixtures preserves consumed codes and tickets. Root browser UAT may additionally consume `DEMO-MFEST-001`; use `002` onwards for manual tests.
- MinIO media: 11 objects seeded in bucket `vemoki-assets` (brand assets +
  per-event ready assets) via `scripts/d9-seed-media.sh` against the isolated
  MinIO (`:9002`).

`up` applies these additive fixtures once when `.local-dev/ui869/fixtures-v1` is absent. Normal restart/up preserves data and does not reseed. `seed --reset` removes that marker; the next `up` recreates the scenarios. All targets are restricted to loopback and the dedicated `ticket_ui869_dev` database. Fixture summary is also structured in `docs/demo/UI869-LOCAL-FIXTURES.json`.

## Evidence (this task's run, 2026-10-24)

```text
$ ./scripts/dev-local-stack.sh status
== containers (isolated project: ui869dev) ==
ui869dev-keycloak-1   ... Up (healthy)   127.0.0.1:8080->8080/tcp
ui869dev-mailpit-1    ... Up (healthy)   127.0.0.1:1026->1025/tcp, 127.0.0.1:8026->8025/tcp
ui869dev-minio-1      ... Up (healthy)   127.0.0.1:9002->9000/tcp, 127.0.0.1:9003->9001/tcp
ui869dev-postgres-1   ... Up (healthy)   127.0.0.1:55433->5432/tcp
ui869dev-redis-1      ... Up (healthy)   127.0.0.1:56380->6379/tcp

== processes (owned by this script) ==
api: PID 28697 — RUNNING
web: PID 6941 — RUNNING

== ports ==
:3417 -> 7110   :3498 -> 28697   :8080 -> 2022   :55433 -> 2022

== health ==
API /v1/health: OK
Keycloak realm (ui869dev): OK
web :3417: OK

$ curl -sS http://127.0.0.1:3498/v1/health
{"status":"ok","service":"api","version":"0.1.0"}

$ curl -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3498/v1/public/events
200

$ curl -sS http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration | jq .issuer
http://127.0.0.1:8080/realms/ticket

$ curl -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/auth?client_id=ticket-web&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A3417%2Fapi%2Fauth%2Fcallback&scope=openid"
302
```

**launchd active + restart proof:**

```text
$ launchctl print "gui/$(id -u)/com.vemoki.dev.ui869"
state = running
program = .../scripts/dev-local-stack.sh
arguments = { ... supervisor }

$ kill -9 <api pid>   # simulate crash
$ sleep 20 && ./scripts/dev-local-stack.sh status
api: PID <new pid> — RUNNING     # supervisor relaunched API within one 15s tick
$ curl -sS http://127.0.0.1:3498/v1/health
{"status":"ok","service":"api","version":"0.1.0"}
```

Noah's initial handoff covered HTTP/API checks. Root subsequently completed browser OIDC login → resolve `DEMO-MFEST-001` → terms consent → successful ticket issue → wallet with 3 tickets (future/past events). Evidence: `docs/reviews/assets/UI869-ROOT/redeem-success-1440.png` and `wallet-ready-1440.png`. Orca's accessibility snapshot sometimes retains streamed loading nodes while the rendered screenshot and visible DOM show the final page; that tool limitation is not reported as an application failure.

## Port coordination note (resolved mid-task)

Earlier in this task, `:3417` was held by a pre-existing foreign PID (root's
preview process); `up`/`ensure_web` **refused to kill it** and instead logged
a `BLOCKED` status while leaving infra+API running. An escalation was sent to
the coordinator requesting a swap. The port freed up during the session (root
presumably completed the swap) and the next supervisor tick bound web on
`:3417` successfully — see Evidence above. `down` only ever signals PIDs this
script itself recorded in `.local-dev/ui869/pid/`; it never does a global
`pkill`.

## Rollback / stopping

```sh
./scripts/dev-local-stack.sh down                 # stops API/web PIDs + ui869dev containers only
./scripts/dev-local-stack.sh uninstall-autostart   # unload launchd agent
```

`down` never passes `-v` to compose — the `ui869dev_*` volumes (Postgres,
Keycloak, MinIO, Redis data) persist across `down`/`up` cycles. Seeded data is
not reset unless `seed --reset` is run explicitly.

`down` writes a pause marker so launchd does not resurrect services behind the user's back; `up` explicitly clears it. The supervisor keeps running while paused. Processes use private process groups plus PID/start-time records through `dev-local-process.py`; stale/reused PIDs are not signaled. Startup/stop serialize per service. The `stop-proof.json` artifact records both listeners absent and containers stopped after more than one supervisor tick; data remains after the subsequent `up`.

## Known limitations

1. Local URLs are product `http://localhost:3417` and marketing `http://marketing.localhost:3417`. Keep the product on `localhost` for browser cookies/session renewal; do not mix product access with `127.0.0.1`. API/Keycloak stay bound to loopback. The web listener binds explicitly to `127.0.0.1` and accepts both local hostnames.
2. Base D9 fixtures are extended additively by `scripts/dev-local-fixtures.cjs` (past event, tickets, disabled code and routing); backend sources are unchanged. Re-running additive fixtures preserves consumed codes/tickets; normal restarts do not run seed again.
3. `install-autostart` bootstraps the launchd agent immediately (explicit
   user authorization for this task covers local auto-start); `uninstall-autostart`
   reverses it.
4. Nếu leader đã chết trước `stop` nhưng process group còn thành viên, helper trả nonzero `owned_group_identity_unverifiable`, giữ PID/owner record và không gửi signal khi chưa chứng minh ownership. Đây là lỗi cần người vận hành kiểm tra, không phải shutdown thành công. Batch function-first theo quyết định mới của user có regression test riêng cho nhánh này; review độc lập exact SHA vẫn là gate nghiệm thu.

## Lời mời nhận vé qua email local

`node scripts/dev-local-invitation.cjs seed` bổ sung lời mời cho attendee@example.com bằng pipeline import/preview/commit/dispatch hiện có; SMTP chỉ tới Mailpit loopback. Helper được gọi từ additive fixtures cho starter mới. Rerun giữ lời mời đã có, không reset vé/mã và không gửi lại email trùng.

Mở Mailpit tại `http://127.0.0.1:8026` và chọn email “Lời mời tham dự — MFest · Demo”. Với Orca UAT, `node scripts/dev-local-invitation.cjs open` mở tab bằng link thật và chỉ trả browserPageId; caller đóng tab khi xong. Token/URL chỉ ở ignored0600 `.local-dev/ui869/invitation.json` và Mailpit; không in/commit link, không chụp email chứa raw link vào evidence.

TTL48h theo contract; trạng thái expired/revoked/claimed được giữ. `/claim` không phải mục menu để tự nhập UUID; luôn bắt đầu từ email link. Tài khoản thử: attendee@example.com/attendee-demo, real Keycloak. Không submit yêu cầu xóa trên tài khoản attendee/staff dùng chung.

## Tài khoản QA chức năng riêng

`node scripts/dev-local-qa-user.mjs` tạo idempotent identity tổng hợp `qa-functions@example.com` / `qa-functions-demo` trong đúng Keycloak container thuộc project `ui869dev`; không cấp membership hoặc mock session. Receipt ignored0600 `qa-identity.json` bind exact user ID; thiếu/khác receipt thì helper fail, không nhận nhầm hoặc reset user có sẵn. Dùng browser profile riêng cho UAT yêu cầu xóa tài khoản; yêu cầu đã gửi được giữ nguyên khi restart. UAT chỉ xác nhận tiếp nhận/trạng thái yêu cầu, không chạy job xóa hoặc ẩn danh. Mã `DEMO-MFEST-003` dành cho QA single-code (đã consume trong UAT này); `DEMO-MFEST-002` dành người dùng kiểm tra thủ công.
