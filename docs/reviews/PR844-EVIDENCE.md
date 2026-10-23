# PR #844 — Platform Operator mutate (portal)

| Field | Value |
| --- | --- |
| Issue | [#844](https://github.com/hangndat/ticket-solution/issues/844) |
| Branch | `hangndat/portal-844-platform-mutate` |
| Evidence SHA (code under test) | `8ae3dc0b2329ad352456bd89d0c567b6fefd2077` |
| UAT run | 2026-10-23 — worker `task_dfb2fde50e1f` |

## Parity (G-791-2/3) — `apps/web` → `apps/portal`

| Action | Web BFF | Portal BFF (this PR) | Portal UI |
| --- | --- | --- | --- |
| POST tenant provision | `POST /api/bff/platform/tenants` | `POST /api/bff/platform/tenants` | Tab **Provision** |
| GET tenant detail | `GET …/tenants/[tenantId]` | `GET …/tenants/[tenantId]` | Tab **Manage** |
| POST suspend/activate | `POST …/status` | `POST …/status` | **Manage** + `Modal.confirm` |
| PUT limits/flags | `PUT …/limits` | `PUT …/limits` | **Manage** form |
| POST support grant create | `POST /api/bff/platform/support-grants` | `POST …/support-grants` | Tab **Grant create** + `Modal.confirm` (F01) |
| GET tenants list (existing) | GET | GET | Tab **Tenants** |
| Revoke grant (portal-only) | — | POST `…/revoke` | Tab **Revoke** |

## Automated checks (portal)

```bash
cd apps/portal && pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## UAT (local Operator / headless)

**Stack (worker run):**

```bash
COMPOSE_PROJECT_NAME=pr844-uat docker compose up -d
./scripts/platform-keycloak-apply-realm.sh
./scripts/fe-uat-stack.sh bootstrap
# bootstrap_platform_operator(staff user id) — SQL
# API :3001, portal :3013 (next start), WEB_UAT_CHANNEL=chrome
node apps/portal/scripts/pr844-platform-uat.mjs
```

### Lượt sửa 1/2 — script OTP (F01–F03 code)

| Hạng mục | Kết quả |
| --- | --- |
| F01 `Modal.confirm` trước tạo grant + i18n | **Done** (code) |
| F02 CTA/placeholder `t()` | **Done** (code) |
| F03 test BFF mutate routes (CSRF/422/proxy mock) | **Done** — `tests/platform-mutate-bff-routes.test.ts` |
| `pr844-platform-uat.mjs` — `enrolledTotpSecret` từ enroll + cache `/tmp/pr844-platform-totp.secret` + `waitForNextTotpWindow` | **Done** (code) |
| Login Playwright sau reset `CONFIGURE_TOTP` | OTP nộp OK (không còn `Invalid authenticator code`) |
| Portal session | Redirect `/platform?error=acr` — `PLATFORM_OIDC_REQUIRED_ACR=2` từ chối token |
| `platform-keycloak-mfa-live-proof.mjs` trên `:8080` | **FAIL** — `acr want 2 got 1` (cùng stack) |
| Screenshots mutate @390/@1280 + axe | **BLOCKED** — không vào tabs Operator |

**Log (không secret):**

```text
pr844-platform-uat.mjs → timeout getByRole('tab', { name: 'Tenants' }) (session không đạt acr=2)
Debug login: final URL http://127.0.0.1:3013/platform?error=acr sau bước OTP (enrolled secret length 20, cache file mode 0600)
D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket node scripts/lib/platform-keycloak-mfa-live-proof.mjs → acr want 2 got 1
```

**Chặn còn lại:** Keycloak stack `pr844-uat` chưa phát `acr=2` sau MFA (không chỉ lỗi đọc `totpSecret` trên form OTP). Cần coordinator/infra chốt realm hoặc task-stack KC đã verify acr trước khi re-run UAT evidence.
