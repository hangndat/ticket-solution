# Spike D1 — Self-hosted OIDC provider (P4)

Ngày: 2026-10-16 (cập nhật: cấm SaaS → Keycloak)  
Issue: [#11](https://github.com/hangndat/ticket-solution/issues/11)  
Decision log: [DECISION-LOG.md](../DECISION-LOG.md)  
Tiêu chí: TECHNICAL-DESIGN §5.1 và bảng P4 (§17)

## 1. Yêu cầu bắt buộc (acceptance)

| # | Yêu cầu | Ghi chú |
| --- | --- | --- |
| R1 | **Self-hosted OIDC** (không tự xây protocol; không SaaS IdP) | ADR-09 / ADR-11 |
| R2 | Authorization Code + **PKCE** trên iOS | Expo `expo-auth-session` / ASWebAuthenticationSession |
| R3 | **Verified email** (OTP hoặc verify flow Keycloak) trước issue vé | PRD M02 |
| R4 | **MFA** TOTP cho staff/admin | PRD M02 |
| R5 | Refresh token **rotation**; lưu iOS trong SecureStore | W0 boundary đã có |
| R6 | Backend NestJS tự verify session/JWT; BFF không tự cấp tenant/permission | TD §3.2 |
| R7 | Map user nội bộ `(issuer, subject)`; không dùng email làm khóa duy nhất | TD §5.1 |
| R8 | Thu hồi / logout / account switch không để stale cache | P4 + mobile W0 |
| R9 | Xuất / xóa identity theo policy (GDPR-ish) | PRD account deletion |
| R10 | **Cấm** Expo/EAS Cloud Build — SDK auth chạy local / Expo Go hoặc local dev client | AGENTS |
| R11 | **Cấm** Clerk / Auth0 / Cognito / WorkOS và IdP SaaS khác | ADR-11 |

## 2. Ứng viên và đánh giá (self-host)

| Tiêu chí | **Keycloak** | Authentik | Zitadel |
| --- | --- | --- | --- |
| OIDC / JWT verify backend | Có (JWKS) | Có | Có |
| Next.js BFF cookie (Auth Code) | DIY chuẩn OIDC | DIY | DIY |
| Expo + PKCE + SecureStore | `expo-auth-session` | Tương tự | Tương tự |
| Email verify / OTP | Có (+ SMTP Mailpit/Postal) | Có | Có |
| MFA staff TOTP | Có | Có | Có |
| Phù hợp Nest riêng DB | Chỉ identity | Chỉ identity | Chỉ identity |
| Độ phức tạp ops MVP | Trung bình (Compose sẵn) | Trung bình | Trung bình |
| Rủi ro chính | Config realm/client; audience mapper | Ít tài liệu Expo | Surface API riêng |

**Không chọn** SaaS (Clerk/Auth0/WorkOS/Cognito/Supabase hosted) — chính sách ADR-11.

## 3. Kết luận

**Keycloak đã chốt (ADR-09, 2026-10-16)** sau khi user yêu cầu không dùng dịch vụ cloud SaaS. App Store + DNS registrar vẫn được phép.

Lý do ngắn:

1. OIDC chuẩn; Nest giữ verifier JWKS generic (`OIDC_ISSUER` / `OIDC_AUDIENCE` / `OIDC_JWKS_URL`).
2. Chạy trong Compose cạnh Postgres/Redis/MinIO/Mailpit — cùng đường lên VPS.
3. Membership/RBAC vẫn PostgreSQL (O08/ADR-02); không tin role claim Keycloak cho mutation tenant.
4. Authentik/Zitadel giữ làm phương án dự phòng; MVP chỉ Keycloak.

## 4. Kiến trúc tích hợp mục tiêu

```text
Attendee/Staff (Web)     Attendee/Staff (iOS)
        │                        │
        ▼                        ▼
 Next.js BFF (HttpOnly cookie)   Expo auth-session + SecureStore
        │                        │  (short-lived bearer)
        └────────────┬───────────┘
                     ▼
              NestJS API
         verify JWT via JWKS (Keycloak)
         load users(issuer,sub)
         check membership/session DB
                     ▼
              PostgreSQL + RLS
```

- Web admin: cookie session cùng origin; CSRF/Origin trên mutation.
- iOS: bearer ngắn hạn; refresh trong SecureStore; logout xóa credential + cache (W0).
- Không tin org/role claim của provider cho mutation tenant — chỉ dùng làm identity; permission đọc từ DB.

## 5. Checklist POC (Keycloak local)

| Bước | Web | iOS | Backend |
| --- | --- | --- | --- |
| Compose Keycloak + realm import | ✅ | ✅ code | ✅ live JWKS 200 |
| Email verify (SMTP → Mailpit) | ✅ JWT + `/v1/me` | ✅ code | ✅ |
| PKCE / session | ✅ BFF cookie UAT | ✅ auth-session code | — |
| MFA TOTP staff gate | ✅ `CONFIGURE_TOTP` blocks silent login | ☐ device enroll | — |
| Nest verify JWT (JWKS) | ✅ BFF→`/v1/me` | ✅ | ✅ unit + live |
| Logout + account switch | ✅ UAT | ✅ code | ✅ logout-all → refresh invalid |
| Không stub 200 khi thiếu token | ✅ | ✅ | ✅ fail closed |

Chi tiết evidence: [D1-P4-KEYCLOAK-SMOKE.md](../reviews/D1-P4-KEYCLOAK-SMOKE.md).

## 6. Biến môi trường (documentation only)

```bash
OIDC_PROVIDER=keycloak
OIDC_ISSUER=http://127.0.0.1:8080/realms/ticket
OIDC_AUDIENCE=ticket-api
OIDC_JWKS_URL=http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/certs
# Web OIDC client (confidential) — apps/web local env
# OIDC_CLIENT_ID=ticket-web
# OIDC_CLIENT_SECRET=
# OIDC_REDIRECT_URI=http://127.0.0.1:3000/api/auth/callback
# Mobile public client — apps/mobile
# EXPO_PUBLIC_OIDC_ISSUER=...
# EXPO_PUBLIC_OIDC_CLIENT_ID=ticket-mobile
# EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
```

## 7. Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Keycloak audience/`azp` mismatch | Audience mapper → `ticket-api`; Nest verify `aud` |
| SMTP chưa cấu hình → không verify email | Mailpit trong Compose; Postal trên VPS |
| Stale session sau revoke membership | Mutation Gate/issue lock membership (TD §5.2) |
| Agent/CI lộ secret | Chỉ `.env.local`; CI dùng fake JWKS fixture |
