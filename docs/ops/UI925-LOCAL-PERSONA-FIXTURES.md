# VCX-925 — persona OIDC theo role (local UI869)

Issue: [#925](https://github.com/hangndat/ticket-solution/issues/925) · Epic [#914](https://github.com/hangndat/ticket-solution/issues/914)

Fixture **chỉ** stack UI869 (`ticket_ui869_dev`, compose project `ui869dev`, loopback). Script từ chối target khác (shared `ticket_d9_demo`, host không phải localhost, DB name lệch).

## Lệnh

```sh
# Idempotent: Keycloak users + membership/assignment + volume data + (nếu API sống) verify API
./scripts/dev-local-stack.sh persona-fixtures

# Hoặc sau khi stack đã bootstrap:
./scripts/dev-local-persona-fixtures.sh

# Gộp trong seed/reset UI869:
./scripts/dev-local-stack.sh seed --reset && ./scripts/dev-local-stack.sh up

# Cleanup namespace test (chỉ user/code VCX-925, tenant D9 UUID đã xác minh):
source .local-dev/ui869/env.sh
export DATABASE_URL="$UI869_ADMIN_DATABASE_URL" OIDC_ISSUER="$UI869_OIDC_ISSUER"
node scripts/dev-local-persona-cleanup.cjs
```

Chạy verify độc lập:

```sh
source .local-dev/ui869/env.sh
export DATABASE_URL="$UI869_ADMIN_DATABASE_URL" OIDC_ISSUER="$UI869_OIDC_ISSUER"
export UI869_API_URL="http://127.0.0.1:3498"
export CODE_HMAC_PEPPER="$UI869_CODE_HMAC_PEPPER" CODE_HMAC_VERSION="$UI869_CODE_HMAC_VERSION"
node scripts/dev-local-persona-verify.mjs
```

## Persona (OIDC password grant — local demo, không secret thật)

| Persona | Email | Mật khẩu fixture | Tenant / event | Role DB |
| --- | --- | --- | --- | --- |
| Owner | `owner.fixture@example.com` | `owner-fixture-demo` | mfest / mfest | Owner |
| Manager | `manager.fixture@example.com` | `manager-fixture-demo` | mfest / mfest | Manager |
| CS | `cs.fixture@example.com` | `cs-fixture-demo` | mfest / mfest | CS |
| Supervisor | `supervisor.fixture@example.com` | `supervisor-fixture-demo` | mfest / mfest | Supervisor |
| Scanner | `scanner.fixture@example.com` | `scanner-fixture-demo` | mfest / mfest | Scanner |
| report-only | `report.fixture@example.com` | `report-fixture-demo` | mfest / mfest | Manager + assignment chỉ `report.read` |
| Attendee | `attendee@example.com` | `attendee-demo` | (không staff) | — |
| Legacy owner (UI869) | `staff@example.com` | `staff-demo` | cả 2 tenant D9 | Owner (từ `d9-demo-seed.sh`) |

≥2 tenant, ≥2 event: dữ liệu gốc D9 (`mfest-demo`, `demo-studio`) + `dev-local-fixtures.cjs` (past event). Volume VCX-925: 40 code bulk, 30 ticket, 20 pending review trên mfest (vượt một trang list).

## Nghiệm thu API (không phụ thuộc portal UI #926)

`dev-local-persona-verify.mjs` kiểm:

- Positive: `me/tenants`, `me/events` theo role (permissions kỳ vọng); Supervisor có `gate.confirm`, `gate.undo`, `ticket.revoke` trên event, không có `event.config`.
- Negative: CS/Supervisor/Scanner `GET .../members` → 403; CS `POST .../config-versions` → 403; Manager truy cập tenant studio → 403/404; report-only không có `event.config`.

## Tái sử dụng script

- `scripts/d9-demo-seed.sh` — base multi-tenant + `staff`/`attendee` Owner path.
- `scripts/dev-local-fixtures.cjs` — routing, tickets, invitation.
- `scripts/lib/ui869-keycloak-personas.mjs` — upsert user realm `ticket` qua Admin API (volume Keycloak đã tồn tại).
- `scripts/release-oidc-fixture.cjs` — **không** dùng cho UI869 (JWKS giả cho release rehearsal); UI869 dùng Keycloak thật trên `:8080`.

## Blocker / stack chưa chạy

1. `docker compose -p ui869dev` + `./scripts/dev-local-stack.sh up`
2. Nếu `persona-fixtures` báo token/password: chạy `node scripts/lib/ui869-keycloak-personas.mjs` (admin `admin`/`admin` mặc định compose).
3. Public catalog `500` do AR891-INT-F01: ghi route + SHA, không sửa trong task #925.
