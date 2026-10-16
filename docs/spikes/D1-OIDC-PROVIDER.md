# Spike D1 — Managed OIDC provider (P4)

Ngày: 2026-10-16  
Issue: [#11](https://github.com/hangndat/ticket-solution/issues/11)  
Decision log: [DECISION-LOG.md](../DECISION-LOG.md)  
Tiêu chí: TECHNICAL-DESIGN §5.1 và bảng P4 (§17)

## 1. Yêu cầu bắt buộc (acceptance)

| # | Yêu cầu | Ghi chú |
| --- | --- | --- |
| R1 | Managed OIDC (không tự xây protocol) | ADR-09 |
| R2 | Authorization Code + **PKCE** trên iOS | Expo / ASWebAuthenticationSession hoặc SDK tương đương |
| R3 | **Verified email** (OTP hoặc magic link) trước issue vé | PRD M02 |
| R4 | **MFA** cho staff/admin | PRD M02 |
| R5 | Refresh token **rotation**; lưu iOS trong SecureStore | W0 boundary đã có |
| R6 | Backend NestJS tự verify session/JWT; BFF không tự cấp tenant/permission | TD §3.2 |
| R7 | Map user nội bộ `(issuer, subject)`; không dùng email làm khóa duy nhất | TD §5.1 |
| R8 | Thu hồi / logout / account switch không để stale cache | P4 + mobile W0 |
| R9 | Xuất / xóa identity theo policy (GDPR-ish) | PRD account deletion |
| R10 | **Cấm** Expo/EAS Cloud Build — SDK auth phải chạy local / Expo Go hoặc local dev client | AGENTS |

## 2. Ứng viên và đánh giá

| Tiêu chí | **Clerk** | Auth0 | WorkOS AuthKit | Cognito | Supabase Auth |
| --- | --- | --- | --- | --- | --- |
| OIDC / JWT verify backend | Có (JWKS) | Rất mạnh | Có | Có | Có (GoTrue) |
| Next.js App Router / BFF cookie | SDK chín | Có, nặng hơn | Có | DIY nhiều | Gắn stack Supabase |
| Expo / RN + PKCE + SecureStore | **SDK / token-cache tốt** | Browser-based / SDK riêng | WebBrowser + PKCE | Amplify, cấu hình nhiều | Hạn chế hơn Expo |
| Email OTP / magic link attendee | Có | Có | Có (Magic Auth) | Có | Có |
| MFA staff | Có (Pro) | Có (Essentials+) | Có | Có | TOTP |
| Enterprise SSO/SCIM sau này | Có (metered / Enterprise) | Mạnh | **Thế mạnh** | DIY | Yếu |
| Phù hợp monorepo Nest riêng DB | Tốt (chỉ identity) | Tốt | Tốt | Tốt | Dễ “kéo” cả Supabase |
| Độ phức tạp vận hành MVP | **Thấp** | Cao | Trung bình (B2B-first) | Trung bình–cao | Trung bình |
| Rủi ro chính | Vendor API surface; MFA/SSO pricing | Chi phí & DX | Attendee UX kém “consumer” hơn | Config & Expo DX | Khóa hệ sinh thái |

Nguồn tham chiếu công khai (2026): Expo auth guide; Clerk Expo/Next so sánh; WorkOS vs Clerk; không lấy pricing làm cam kết — kiểm tra lại lúc ký hợp đồng.

## 3. Kết luận đề xuất

**Clerk đã được user chốt (ADR-09, 2026-10-16).** POC P4 vẫn bắt buộc trước khi mở business endpoints.

Lý do ngắn:

1. Khớp stack đã chốt (Next.js + Expo iOS) với đường auth native ngắn hơn Auth0/Cognito.
2. Attendee cần OTP/magic link + staff MFA — Clerk cover cả hai mà không bắt WorkOS-style enterprise-first.
3. NestJS vẫn là nguồn quyền: chỉ verify JWT/session claims tối thiểu (`iss`, `sub`, email verified); **membership/RBAC nằm PostgreSQL của ta** (O08/ADR-02).
4. Enterprise SSO/SCIM (nếu bán B2B lớn) có thể bổ sung Clerk Enterprise hoặc WorkOS sau — không chặn pilot.

**Không chọn** cho MVP: Auth0 (nặng hơn mức cần), WorkOS (ưu tiên SSO hơn attendee), Cognito (DX Expo kém), Supabase Auth (kéo stack DB/auth lệch Nest/Prisma).

## 4. Kiến trúc tích hợp mục tiêu

```text
Attendee/Staff (Web)     Attendee/Staff (iOS)
        │                        │
        ▼                        ▼
 Next.js BFF (HttpOnly cookie)   Expo + Clerk/SecureStore
        │                        │  (short-lived bearer)
        └────────────┬───────────┘
                     ▼
              NestJS API
         verify JWT via JWKS
         load users(issuer,sub)
         check membership/session DB
                     ▼
              PostgreSQL + RLS
```

- Web admin: cookie session cùng origin; CSRF/Origin trên mutation.
- iOS: bearer ngắn hạn; refresh trong SecureStore; logout xóa credential + cache (W0).
- Không tin org/role claim của provider cho mutation tenant — chỉ dùng làm identity; permission đọc từ DB.

## 5. Checklist POC (còn lại trên Issue #11)

POC **chưa chạy** trong lượt docs này — cần tạo Clerk application (dev) và secrets local (không commit).

| Bước | Web | iOS | Backend |
| --- | --- | --- | --- |
| Tạo Clerk app + instances | ☐ | ☐ | JWKS URL / issuer |
| Email OTP hoặc magic link | ☐ verified email | ☐ | claim `email_verified` |
| PKCE / session | cookie BFF | Auth session + SecureStore | — |
| MFA bật cho user staff demo | ☐ | ☐ | — |
| Nest verify JWT (JWKS) | ☐ | ☐ | unit + một route `/v1/me` |
| Logout + account switch | ☐ | ☐ không stale | revoke / phiên DB |
| Không stub 200 khi thiếu token | ☐ | ☐ | fail closed |

Sau POC: cập nhật DECISION-LOG ADR-09 → `Đã chốt`, đánh dấu Issue #11 Hoàn thành.

## 6. Biến môi trường (documentation only)

Thêm vào `.env.example` (giá trị trống / placeholder). **Không** commit secret thật.

```bash
OIDC_PROVIDER=clerk
OIDC_ISSUER=
OIDC_AUDIENCE=
OIDC_JWKS_URL=
# Web Clerk publishable/secret chỉ trong apps/web local env — không vào git
# Mobile publishable key chỉ trong apps/mobile local env — không vào git
```

## 7. Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Clerk lock-in UI/SDK | Giữ verifier JWKS generic; domain `users(issuer,sub)` |
| MFA chỉ trên Pro | Chấp nhận cost Pro trước pilot staff; ghi vào O06/ops |
| Stale session sau revoke membership | Mutation Gate/issue lock membership (TD §5.2); test D1 tiếp |
| Agent/CI lộ secret | Chỉ `.env.local`; CI dùng fake JWKS fixture |
