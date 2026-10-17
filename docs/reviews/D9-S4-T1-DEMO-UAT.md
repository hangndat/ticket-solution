# D9-S4-T1 — Demo UAT headless (web + sim) trên seed

**Issue:** [#147](https://github.com/hangndat/ticket-solution/issues/147) · Story [#146](https://github.com/hangndat/ticket-solution/issues/146) · Epic [#134](https://github.com/hangndat/ticket-solution/issues/134)  
**Ownership:** web (+ sim-uat iOS) · **không** EAS Cloud Build · **không** computer-use chuột desktop  
**Base tip (main tại lúc chạy):** `7b1aee6331a1b2132d26e0fc5a97e0e19a473ced`  
**Evidence commit:** branch `hangndat/d9-s4-t1-uat-roles` — exact tip SHA in Issue #147 / PR (self-referential pin avoided).

## Seed fixture

- DB throwaway: `ticket_d9_demo` (Compose Postgres `:55432`) + runtime role `d9_demo_rt` (NOBYPASSRLS)
- Issuer: `http://192.168.86.8:8080/realms/ticket`
- Tenants: `demo-fun`, `demo-studio` · Events: `fun-fest`, `studio-night`
- Codes: `DEMO-FUN-*` / `DEMO-STUDIO-*` (fixture)

```bash
# bootstrap + seed (idempotent 2nd run codesInserted=0)
node scripts/lib/d9-demo-bootstrap-db.mjs
DATABASE_URL=postgresql://ticket_dev:local_dev_only@127.0.0.1:55432/ticket_d9_demo \
  OIDC_ISSUER=http://192.168.86.8:8080/realms/ticket \
  CODE_HMAC_PEPPER=local-dev-code-pepper-change-me \
  node packages/backend/scripts/demo-seed.cjs
```

## API smoke trên seed

API local (ephemeral port) + Keycloak password grant (fixture):

| Check | Result |
| --- | --- |
| `GET /v1/health` | 200 |
| `GET /v1/me/tenants` (staff) | 200 · slugs `demo-fun`, `demo-studio` |
| `POST …/redemptions` code `DEMO-FUN-003` | 201 |
| `GET /v1/me/tickets?tenantId=…` | 200 · count ≥ 1 |

## Web — Playwright headless (`scripts/web-uat.sh`)

```bash
WEB_BASE_URL=http://127.0.0.1:3010 bash scripts/web-uat.sh screenshot http://127.0.0.1:3010/ …
WEB_BASE_URL=http://127.0.0.1:3010 bash scripts/web-uat.sh auth-smoke http://127.0.0.1:3010
WEB_BASE_URL=http://127.0.0.1:3010 bash scripts/web-uat.sh bff-login http://127.0.0.1:3010 attendee@example.com attendee-demo
```

- Launcher: cached `chrome-headless-shell` (không mở Chrome.app)
- Originals (gitignored): `apps/web/.uat-artifacts/d9-s4-t1/`
- Curated: [`d9-uat/s4-t1/web/`](./d9-uat/s4-t1/web/)

| Surface | File |
| --- | --- |
| `/` | ![home](./d9-uat/s4-t1/web/d9-seed-home.png) |
| `/redeem` | ![redeem](./d9-uat/s4-t1/web/d9-seed-redeem.png) |
| `/claim` | ![claim](./d9-uat/s4-t1/web/d9-seed-claim.png) |
| `/invite` | ![invite](./d9-uat/s4-t1/web/d9-seed-invite.png) |
| `/account` | ![account](./d9-uat/s4-t1/web/d9-seed-account.png) |
| `/admin` | ![admin](./d9-uat/s4-t1/web/d9-seed-admin.png) |
| auth-smoke | `auth-smoke-*.png` (sign-in visible, BFF `/me` 401) |
| bff-login attendee | `bff-login-*.png` · `HTTP 200` emailVerified |

## iOS Simulator — `scripts/sim-uat.sh` (AXe HID + simctl)

```bash
scripts/sim-uat.sh boot "iPhone 17"   # không open -a Simulator
scripts/sim-uat.sh launch com.hangndat.ticket
scripts/sim-uat.sh screenshot …       # → apps/mobile/.uat-artifacts/d9-s4-t1/
scripts/sim-uat.sh tap --label "Sự kiện"|"Vé của tôi"|"Nhân viên"
```

- Device: iPhone 17 · UDID `F191CF59-4B73-44E5-BFA8-4CE439EB31AD`
- App đã cài local: `com.hangndat.ticket` (Vemoki) — **không** EAS Cloud Build
- UI seed: label `Tenant: demo-fun`, `FUN FEST · Demo`, `Demo FUN Collective`
- Curated: [`d9-uat/s4-t1/ios/`](./d9-uat/s4-t1/ios/)

| Surface | File |
| --- | --- |
| Events (seed) | ![events](./d9-uat/s4-t1/ios/d9-sim-events.png) |
| Events + load CTA | ![events-loaded](./d9-uat/s4-t1/ios/d9-sim-events-loaded.png) |
| Vé của tôi | ![tickets](./d9-uat/s4-t1/ios/d9-sim-my-tickets.png) |
| Nhân viên / Quét | ![staff](./d9-uat/s4-t1/ios/d9-sim-staff.png) · ![scan](./d9-uat/s4-t1/ios/d9-sim-scan-idle.png) |

## Limitations

- Web admin/account anonymous empty/error chrome khi chưa session; bff-login chứng minh attendee session + BFF `/api/bff/me` 200.
- iOS “Tải danh sách sự kiện đã xuất bản” phụ thuộc API public URL trong app (`api.vemoki.com` trên staff screen) — seed demo catalog fixture vẫn hiện (`demo-fun` / FUN FEST).
- Không deploy prod (#149); không archive iOS đầy đủ (#148); không store submit.
- Không chứng minh pilot ready / device vật lý camera.

## Verdict (implementer handoff)

UAT headless web + sim trên seed **PASS** cho gate milestone (a). Chờ DoD reviewer độc lập (exact SHA evidence commit).
