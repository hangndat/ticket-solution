# PR #852 — D-7 cutover UAT evidence (Issue #846)

| Field | Value |
| --- | --- |
| Issue | [#846](https://github.com/hangndat/ticket-solution/issues/846) |
| PR | [#852](https://github.com/hangndat/ticket-solution/pull/852) |
| Branch | `hangndat/web-846-d7-cutover` |
| Evidence SHA (code under test) | `ec54f0d3047c227b9cfd86a15938f6e541bba64b` |
| UAT run | 2026-10-23 — worker `task_9a1ea38775dd` |
| Compose | `COMPOSE_PROJECT_NAME=pr846-uat docker compose up -d postgres redis keycloak` |

## Keycloak / stack prep

```bash
D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket ./scripts/platform-keycloak-apply-realm.sh
D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket node scripts/lib/platform-keycloak-mfa-live-proof.mjs
FE_UAT_STATE_DIR=.fe-uat-stack-pr846 ./scripts/fe-uat-stack.sh bootstrap
# staff@example.com: clear CONFIGURE_TOTP required action (fixture) before password grant / portal login
# bootstrap_platform_operator(<staff user id>); INSERT tenant_limits for D9 demo tenant
```

| Check | Kết quả |
| --- | --- |
| `PLATFORM_KEYCLOAK_APPLY_PASS` | **PASS** |
| `PLATFORM_MFA_LIVE_PROOF_PASS` | **PASS** `acr=2` |
| `fe-uat-stack bootstrap` | **PASS** (`.fe-uat-stack-pr846/env.sh`) |

## Harness

```bash
./apps/web/scripts/pr846-cutover-uat-stack.sh          # API + web + portal → (a)(b)(c) + portal scripts
./apps/web/scripts/pr846-portal-uat-stack.sh           # API + portal only → (d)
node apps/web/scripts/pr846-cutover-uat.mjs            # HTTP + attendee only (services already up)
```

## (a) Redirect `apps/web` → portal (`PORTAL_ORIGIN=http://127.0.0.1:3013`)

| Case | Status | Location |
| --- | --- | --- |
| `GET /admin?tenantId=d9d9f001-0001-4000-8000-000000000001` | 302 | `http://127.0.0.1:3013/t/d9d9f001-0001-4000-8000-000000000001` |
| `GET /admin?…&job=setup` | 302 | `…/e/d9d9f001-0002-4000-8000-000000000001/setup` |
| `GET /admin?…&job=guests&tab=notifications` | 302 | `…/guests#notifications` |
| `GET /admin?…&job=gate` | 302 | `…/gate` |
| `GET /platform` | 302 | `http://127.0.0.1:3013/platform` |
| Open redirect (`return=https://evil.example`, bad `tenantId`) | — | **PASS** (no evil in `Location`) |

## (b) Legacy BFF / platform auth → 410

| Method | Path | Status | `code` |
| --- | --- | --- | --- |
| POST | `/api/bff/admin/notification-templates/preview` | 410 | `LEGACY_GONE` |
| PUT | `/api/bff/admin/events/x` | 410 | `LEGACY_GONE` |
| PATCH | `/api/bff/admin/foo` | 410 | `LEGACY_GONE` |
| DELETE | `/api/bff/admin/bar` | 410 | `LEGACY_GONE` |
| POST | `/api/bff/platform/tenants` | 410 | `LEGACY_GONE` |
| POST | `/api/auth/platform/login` | 410 | `LEGACY_GONE` |

## (c) Attendee spot-check @390 (`axe-run.mjs`, serious/critical = 0)

Prefix SHA `ec54f0d3047c` — assets under `docs/reviews/assets/PR846/`.

| Route | File | md5 | axe |
| --- | --- | --- | --- |
| `/` (hero `h1#home-title` scope) | `ec54f0d3047c-attendee-home-390.png` | `462fba883a99b34261a0bb7a24c4c58f` | 0 |
| `/t/mfest-demo/events/mfest` | `ec54f0d3047c-attendee-event-detail-390.png` | `628168aa746544cfb6c7cf0ff6066dd1` | 0 |
| `/wallet` (login) | `ec54f0d3047c-attendee-wallet-390.png` | `a18a2c99496b69bd341eafbbbbf03a1c` | 0 |
| `/redeem` | `ec54f0d3047c-attendee-redeem-390.png` | `95010d3fd0dca411391e390c48940437` | 0 |
| `/account` (login) | `ec54f0d3047c-attendee-account-390.png` | `6596aec62cec4759bb985f24d76cb90f` | 0 |

All five md5 **distinct**.

## (d) G-791-5 portal Notify + Operator (post-cutover)

| Hạng mục | Trạng thái |
| --- | --- |
| `portal-843-notify-uat.mjs` + `pr844-platform-uat.mjs` on stack `:3013` | **BLOCKED** this run |
| Lỗi | `pr844-uat: platform login stuck at chrome-error://chromewebdata/` sau Keycloak password (OTP/MFA + callback); manual `goto` tới KC OK khi portal/API ổn định lâu hơn |
| Script fixes landed | `portal-843` ROOT `../../..`, MFA login + `pr844` headless-shell + tab wait + goto retry; `pr846-portal-uat-stack.sh` sequential API→portal |

**Follow-up (coordinator):** re-run `./apps/web/scripts/pr846-portal-uat-stack.sh` sau PR843/844 harness; copy PNG vào `docs/reviews/assets/PR846/` với prefix `ec54f0d3047c-operator-*` / `notify-*`; cập nhật bảng (d).

## Teardown

```bash
COMPOSE_PROJECT_NAME=pr846-uat docker compose down -v
```
