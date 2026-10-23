# PR #844 — Platform Operator mutate (portal)

| Field | Value |
| --- | --- |
| Issue | [#844](https://github.com/hangndat/ticket-solution/issues/844) |
| Branch | `hangndat/portal-844-platform-mutate` |
| Evidence SHA (code at UAT attempt) | `6f700d9e278bd346cdb56326304d6385c6701f41` |
| UAT run | 2026-10-23 — worker `task_d93a9ab9dd18` |

## Parity (G-791-2/3) — `apps/web` → `apps/portal`

| Action | Web BFF | Portal BFF (this PR) | Portal UI |
| --- | --- | --- | --- |
| POST tenant provision | `POST /api/bff/platform/tenants` | `POST /api/bff/platform/tenants` | Tab **Provision** |
| GET tenant detail | `GET …/tenants/[tenantId]` | `GET …/tenants/[tenantId]` | Tab **Manage** |
| POST suspend/activate | `POST …/status` | `POST …/status` | **Manage** + `Modal.confirm` |
| PUT limits/flags | `PUT …/limits` | `PUT …/limits` | **Manage** form |
| POST support grant create | `POST /api/bff/platform/support-grants` | `POST /api/bff/platform/support-grants` | Tab **Grant create** |
| GET tenants list (existing) | GET | GET | Tab **Tenants** |
| Revoke grant (portal-only) | — | POST `…/revoke` | Tab **Revoke** |

## Automated checks (portal)

```bash
cd apps/portal && pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## UAT (local Operator / headless)

**Stack (worker run):**

```bash
COMPOSE_PROJECT_NAME=pr844-uat docker compose up -d   # :55432 PG, :8080 Keycloak
./scripts/platform-keycloak-apply-realm.sh            # PLATFORM_KEYCLOAK_APPLY_PASS
./scripts/fe-uat-stack.sh bootstrap                   # after clearing staff CONFIGURE_TOTP once
# API :3001, portal :3013 (next start), WEB_UAT_CHANNEL=chrome
node apps/portal/scripts/pr844-platform-uat.mjs
```

**Keycloak / MFA progress**

| Step | Result |
| --- | --- |
| `platform-keycloak-apply-realm.sh` | **PASS** — `ticket-platform-web` bound `vemoki otp browser` |
| `platform-keycloak-assurance-smoke.sh` | **FAIL** — `acr want 2 got 1` (same as prior) |
| CONFIGURE_TOTP enroll (Auth Code + `totpSecret` form) | **PASS** — completes redirect to `/api/auth/platform/callback` |
| Second login OTP (`name=otp"`) after enroll | **FAIL** — `Invalid authenticator code` (automated TOTP; enroll uses UTF-8 HMAC of `totpSecret` field per `platform-keycloak-mfa-live-proof.mjs`, login OTP does not accept same helper) |
| Token after enroll-only | `acr=1`, `aud=ticket-platform-api` — portal rejects when `PLATFORM_OIDC_REQUIRED_ACR=2` |
| `bootstrap_platform_operator(staff user id)` | **PASS** (SQL, admin DB) |
| Full `pr844-platform-uat.mjs` screenshots + axe | **BLOCKED** — login does not reach `/platform` tabs |

**Logs (representative)**

```text
./scripts/platform-keycloak-assurance-smoke.sh → acr want 2 got 1
node apps/portal/scripts/pr844-platform-uat.mjs → platform login stuck at Keycloak OTP or getByRole('tab', { name: 'Tenants' }) timeout
Keycloak OTP page: One-time code → Invalid authenticator code (fetch + Playwright, staff@example.com)
```

**Partial artifact:** `docs/reviews/assets/PR844/00-platform-unsigned.png`

**Script change (tip):** `pr844-platform-uat.mjs` — Playwright login via `WEB_UAT_CHANNEL=chrome` (fetch cookie path retained for enroll helper).

**Follow-up:** Fix automated OTP after CONFIGURE_TOTP (RFC6238 / Keycloak login OTP vs enroll) or document coordinator-approved UAT path; re-bind flow; re-run UAT with distinct PNGs @390/@1280 + axe serious/critical = 0.
