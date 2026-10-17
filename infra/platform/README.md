# Platform root config (M01 / M02 / M12)

Ownership: root tooling / infra / docs / CI. Backend migrations và API do BE.

## Security freeze (không phải O06)

Nguồn sự thật: [`security-config.json`](./security-config.json)

| Khóa | Giá trị | Ý nghĩa |
| --- | --- | --- |
| Invite TTL | **48h** | Hết hạn invite membership |
| Support grant max TTL | **1h** | `cs.read` event-scoped; thiếu config → fail closed |
| MFA `auth_time` step-up | **≤15 phút** | ACR bắt buộc `2` sau flow OTP |
| O06 | **UNRESOLVED** | Retention/region/SLA vẫn mở |

Production: thiếu file này hoặc thiếu khóa bắt buộc → process **fail closed** (BE đọc qua env path `PLATFORM_SECURITY_CONFIG`).

## Keycloak

Realm: `infra/keycloak/realm-ticket.json`

- `ticket-platform-api` — audience platform (không cấp cho `ticket-mobile`)
- `ticket-platform-web` — BFF platform, Auth Code + PKCE, browser flow OTP bắt buộc
- `ticket-admin-web` — BFF tenant Owner/admin MFA (audience vẫn `ticket-api`); attendee dùng `ticket-web` không ép OTP
- ACR claim cố định deployment `2` trên client MFA (chứng minh bằng token live)

Smoke assurance (task-local Keycloak — không đụng compose shared):

```bash
./scripts/platform-security-config-smoke.sh
./scripts/platform-keycloak-task-stack.sh up
D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:18089/realms/ticket \
  ./scripts/platform-keycloak-apply-realm.sh
D5_PLATFORM_OIDC_ISSUER=http://127.0.0.1:18089/realms/ticket \
  ./scripts/platform-keycloak-assurance-smoke.sh
./scripts/platform-keycloak-task-stack.sh down
```

OTP browser flow được copy từ `browser` rồi bind bằng **flow UUID** (Keycloak Admin API không nhận alias). Attendee `ticket-web` không bind flow OTP.

## DB roles (hook trước migration BE)

`infra/deploy/init-db.sh` và `infra/platform/sql/01-platform-roles.sql` tạo:

- `ticket_platform_runtime` — NOLOGIN NOSUPERUSER **NOBYPASSRLS**
- `ticket_platform_app` — LOGIN inherit platform runtime

Pool/credential **tách** tenant `ticket_app`. BE migration cấp SELECT/INSERT hẹp trên metadata/platform tables; **không** GRANT tickets/PII/credentials.

## Bootstrap operator (offline)

```bash
# Token platform (audience ticket-platform-api, acr=2) qua file mode 600 — không CLI/log
chmod 600 /tmp/platform-bootstrap.token
./scripts/platform-operator-bootstrap.sh --token-file /tmp/platform-bootstrap.token
# hoặc: ./scripts/platform-operator-bootstrap.sh --token-stdin < tokenfile
```

Script không nhận password/token trên argv; không in token. Gọi module BE khi có; `--verify-only` chỉ chứng minh JWT assurance.
