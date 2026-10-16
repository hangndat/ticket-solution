# P4 smoke — Keycloak self-host (local)

Ngày: 2026-10-16  
ADR: ADR-09 / ADR-11  
Spike: [D1-OIDC-PROVIDER.md](../spikes/D1-OIDC-PROVIDER.md)  
Script: [`scripts/uat-d1-p4-keycloak.py`](../../scripts/uat-d1-p4-keycloak.py)

## Prerequisite

```bash
docker compose up -d keycloak mailpit postgres redis
# API + DB runtime role (dev UAT) — see script comments / coordinator notes
curl -sf http://127.0.0.1:8080/realms/ticket/.well-known/openid-configuration | head
pnpm --filter @ticket/api... build
# Start API with OIDC_* + DATABASE_URL pointing at local Postgres
python3 scripts/uat-d1-p4-keycloak.py
```

Demo users (realm import): `attendee@example.com` / `attendee-demo`,
`staff@example.com` / `staff-demo` (`emailVerified=true`).

## Evidence 2026-10-16 (automated)

### A. Script `uat-d1-p4-keycloak.py` — **12/12 PASS**

| Check | Result |
| --- | --- |
| discovery | PASS — issuer `http://127.0.0.1:8080/realms/ticket` |
| pkce_attendee_claims | PASS — `aud=ticket-api`, `email_verified=True` |
| me_attendee | PASS — Nest `/v1/me` upsert + `emailVerified: true` |
| account_switch_staff | PASS — different `subject` / `userId` than attendee |
| prior_access_token_until_ttl | PASS — bearer still valid until exp |
| admin_logout_all_staff | PASS |
| refresh_after_logout_all | PASS — `400 invalid_grant` |
| staff_required_action_configure_totp | PASS |
| mfa_configure_totp_blocks_silent_login | PASS — Auth Code interrupted (no silent tokens) |
| staff_required_actions_cleared | PASS |
| staff_login_after_clear_mfa_flag | PASS |
| web_bff_parity | PASS — same PKCE code→token as BFF |

### B. Web BFF cookie path (Next `:3010`) — **ALL PASS**

Port `3000` occupied by unrelated process on this machine; UAT used `3010`
(+ Keycloak redirect URI allowlist).

| Check | Result |
| --- | --- |
| `/auth` dynamic + configured | PASS — shows Sign in (Keycloak), not fail-closed |
| `GET /api/bff/me` no cookie | PASS — `401 UNAUTHENTICATED` |
| `GET /api/auth/login` | PASS — 307 to Keycloak + PKCE cookies |
| KC password → callback | PASS — sets `oidc_access_token` HttpOnly |
| `GET /api/bff/me` with cookie | PASS — `200` attendee `emailVerified: true` |
| `GET /api/auth/logout` | PASS — then BFF `401` |

### C. Unit / typecheck (regression)

- `@ticket/backend` / `@ticket/api` / `@ticket/web` / `@ticket/mobile` tests + lint/typecheck green earlier in session.

## Manual checklist (remaining optional UX)

| # | Criterion | Status |
| --- | --- | --- |
| 1 | Auth Code + PKCE web (BFF cookies) | ✅ automated |
| 2 | Auth Code + PKCE iOS | ✅ **Simulator** iPhone 17 Pro: Account → Sign in → Keycloak `attendee@example.com` → `SessionBoundary: verified` (`059207a8-…`) via `/v1/me`. ✅ **Device** native install+launch on Dexter’s iPhone 16 Pro (local Xcode; LAN `192.168.86.8`); gesture Sign in còn thủ công trên máy nếu cần xác nhận thêm |
| 3 | Verified email claim | ✅ JWT + `/v1/me` |
| 4 | MFA TOTP staff gate | ✅ `CONFIGURE_TOTP` blocks silent login; ☐ full TOTP enroll UX |
| 5 | Logout | ✅ web BFF |
| 6 | Account switch | ✅ attendee↔staff subjects |
| 7 | Revocation | ✅ logout-all → refresh `invalid_grant` |
| 8 | Fail closed | ✅ missing cookie / missing env |

### D. iOS Simulator + device (2026-10-16)

- **Simulator PASS:** iPhone 17 Pro (`F191CF59-…`), Metro `:8081` (LAN `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.86.8`), Account → Sign in → Keycloak → `Local bearer: present`, `SessionBoundary: verified (059207a8-7aa1-4d5b-bd4a-41f1ccbdc9d6)`.
- **Device:** **D Dexter’s iPhone 16 Pro** (`00008140-000605803C01801C`) — local `expo run:ios --device` / Xcode (**không** EAS Cloud); bundle `com.example.ticket.foundation` install + launch; cùng LAN Keycloak `:8080` + API `:3001`.
- Lưu ý: không chạy Metro project khác trên `:8081` (tránh bundle nhầm).

## Notes

- Production Keycloak must use Postgres (not `start-dev` embedded store).
- Do **not** request `offline_access` unless offline client scope is intentionally enabled.
- `/auth` is `force-dynamic` so OIDC configured/unconfigured is evaluated at runtime.
