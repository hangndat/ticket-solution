# DoD review — Issue #11 (Clerk OIDC POC)

| Trường | Giá trị |
| --- | --- |
| Issue | [#11](https://github.com/hangndat/ticket-solution/issues/11) |
| Reviewer | Cursor DoD reviewer (không phải agent implement) |
| Commits | `4d6753c` (BE), `bda8d28` (web), `b13dfa7` (mobile) |
| Base | `main` @ `1f5909c` (sau tích hợp) |
| Ngày | 2026-10-16 |
| **Khuyến nghị Project Status** | **PASS with known gap** → có thể đặt **Hoàn thành** cho DoD *code* của #11; **không** coi P4 live smoke đã xong |

## Tóm tắt điều hành

Ba commit tích hợp trên `main` giao đủ khung fail-closed cho Clerk: Nest JWKS + `GET /v1/me`, Next BFF cookie → upstream, Expo SecureStore + `SessionBoundary` chỉ verify sau `/v1/me`. Contract `MeResponse` / `IDENTITY_ERROR_CODES`, `.env.example` rỗng, migration `users` có ENABLE+FORCE RLS, và không có EAS Cloud Build. **Thiếu bắt buộc theo P4:** smoke live Clerk (OTP/magic link, MFA staff, revocation/session revoke) với instance thật — chưa chạy trong repo; đây là khoảng trống đã biết, không phải lỗi code stub.

## Checklist DoD

| # | Tiêu chí | Kết quả | Ghi chú ngắn |
| --- | --- | --- | --- |
| 1 | Fail-closed auth (không stub 200) | **PASS** | BE/web/iOS đều 401/503 hoặc UI unconfigured; không mock user verified |
| 2 | Contract `MeResponse` / error codes | **PASS** | Shape + `UNAUTHENTICATED` / `OIDC_MISCONFIGURED` khớp; xem finding F2 |
| 3 | Secrets không commit; `.env.example` docs | **PASS** | Placeholder trống; gitignore `.env`; chỉ fixture test `pk_test_x` / `sk_test_x` |
| 4 | RLS / migration `users` an toàn | **PASS** | FORCE RLS; owner migration; upsert ngoài `withTenant`; xem F3 |
| 5 | iOS SecureStore / account-switch | **PASS** | `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; bridge logout + generation guard; verify qua `/v1/me` |
| 6 | Không EAS Cloud Build | **PASS** | Không `eas.json`; README + `D1-REPORT.md` khẳng định local/Expo Go |
| 7 | Gaps vs P4 (live OTP/MFA/revocation) | **GAP (đã gọi rõ)** | Checklist spike §5 vẫn cần Clerk app + smoke thật |
| 8 | Khuyến nghị Hoàn thành | **PASS with known gap** | Code DoD #11 đạt; P4 live smoke còn mở trước business endpoints |

## Chi tiết theo tiêu chí

### 1. Fail-closed auth

- **Backend** (`packages/backend/src/oidc.ts`, `apps/api/src/app.ts`): thiếu/invalid Bearer → `IdentityError` `UNAUTHENTICATED` → HTTP 401; OIDC env thiếu → `OIDC_MISCONFIGURED` → 503; `createApp()` không inject/`fromEnv` → boot error fail-closed. Test `apps/api/test/me.test.cjs` cover missing/bad token và misconfig.
- **Web** (`apps/web/app/api/bff/me/route.ts`, `src/clerk/config.ts`): thiếu key → 503; chưa sign-in / không token → 401; `resolveWebAuthState` không bao giờ `authenticated: true` khi unconfigured. Layout chỉ mount `ClerkProvider` khi đã cấu hình.
- **Mobile** (`_layout.tsx`, `fetch-me.ts`, Account): thiếu publishable key → không `ClerkProvider`, clear credential qua `session.restore`; `fetchMe` trả `null` khi lỗi — không invent identity.

### 2. Contract `MeResponse` / error codes

- `MeResponse`: `userId`, `issuer`, `subject`, `email`, `emailVerified` — OpenAPI `MeDto` + test assert required `emailVerified`.
- Error codes ổn định: `UNAUTHENTICATED`, `OIDC_MISCONFIGURED` dùng đúng. BFF thêm `UPSTREAM_UNAVAILABLE` (502) cho lỗi transport — ngoài enum identity, chấp nhận được cho POC.
- `EMAIL_NOT_VERIFIED` có trong contract và map HTTP 403, nhưng **API hiện không throw** khi `email_verified=false`; README ghi chủ đích (`/me` vẫn 200, gate phát hành sau). Khớp POC identity mapping, chưa phải enforcement P4 “verified email”.

### 3. Secrets

- `apps/api/.env.example`, `apps/web/.env.example`, `apps/mobile/.env.example`, root `.env.example`: giá trị OIDC/Clerk trống hoặc comment.
- Không thấy `sk_live_` / secret production trong tree commit; test dùng chuỗi giả ngắn.
- `.gitignore` loại `.env` / `.env.*`, giữ `!.env.example`.

### 4. RLS / migration `users`

- Migration `202610160002_d1_users`: `ENABLE` + `FORCE ROW LEVEL SECURITY`; `REVOKE` PUBLIC; grant runtime có giới hạn; bảng **không** tenant-scoped (đúng ADR identity toàn cục).
- Policy `users_runtime … USING (true) WITH CHECK (true)`: trust boundary là JWT verify ở API, không phải `app.tenant_id` — có chủ đích; runtime compromised vẫn đọc/ghi mọi hàng `users` (giới hạn đã biết của design D1).
- `rls.test.cjs` assert FORCE RLS trên `users` + upsert ngoài `withTenant`; tenant isolation events/tenants vẫn giữ.

### 5. iOS SecureStore / account-switch

- `clerk-token-cache.ts`: cùng posture `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, Keychain service riêng `ticket-foundation.clerk` (tách `ticket-foundation.identity`).
- `SessionBridge`: signed-out → `session.logout()`; signed-in chỉ `establish` sau `verifyViaMe` (`GET /v1/me`); generation ref chống race khi đổi account nhanh.
- Logout UI: `session.logout()` rồi Clerk `signOut()`. Verified UI không tin claim JWT local.

### 6. EAS Cloud Build

- Không có `eas.json` / script `eas build` trong scope mobile.
- `apps/mobile/README.md`, `D1-REPORT.md`, PRD: cấm EAS Cloud Build; POC chạy Expo Go / local.

### 7. Gaps vs P4 (bắt buộc gọi rõ)

Theo `docs/spikes/D1-OIDC-PROVIDER.md` §5 và `DECISION-LOG` điều kiện mở business endpoints, **chưa có bằng chứng trong repo** cho:

| Hạng mục P4 | Trạng thái code | Smoke live Clerk |
| --- | --- | --- |
| Nest JWKS + `/v1/me` | Có (unit/local JWKS) | Chưa chứng minh với JWKS Clerk thật |
| Web cookie BFF + PKCE-capable session | Có đường code | Chưa OTP/magic link end-to-end |
| iOS hosted auth + SecureStore | Có đường code | Chưa sign-in thật trên device/sim |
| Email verified (OTP) | Claim được map; không fail-closed 403 | Chưa |
| MFA staff demo | Không cấu hình/test trong repo | Chưa |
| Logout + account switch (không stale) | Code path + generation guard | Chưa revoke session/membership live |
| Revocation / phiên DB sau revoke | Ngoài scope 3 commit | Chưa |

**Kết luận gap:** ADR-09 đã chốt Clerk; **P4 live POC vẫn mở**. Không được mở redemption/Gate/admin tenant chỉ vì #11 code đã merge.

## Findings (severity độ)

| ID | Severity | Mô tả | Khuyến nghị |
| --- | --- | --- | --- |
| F1 | **High (process / P4)** | Thiếu smoke live Clerk: OTP/magic link, MFA staff, JWKS production-like, revocation/account-switch trên instance thật | Giữ tracker riêng hoặc checklist spike §5; chặn business endpoints đến khi có evidence |
| F2 | Low / by design | `EMAIL_NOT_VERIFIED` chưa enforce trên `/v1/me` | OK cho D1 identity; enforce ở issuance/Gate sau; cập nhật spike khi chốt |
| F3 | Low / by design | Policy `users` permissive cho `ticket_runtime` | Giữ JWT làm trust boundary; hạn chế quyền DB/ops; xem lại nếu threat model siết hơn |
| F4 | Nit | `account.tsx` gọi `setBusy(true)` hai lần trong `onSignIn` | Sửa cosmetic khi đụng file |
| F5 | Docs lag | Spike §5 vẫn ☐ nhiều bước đã có *code* (Nest `/v1/me`, fail-closed) | Cập nhật checklist: tách “code land” vs “live smoke” |

Không có finding **Critical** về stub auth 200 hoặc secret bị commit.

## Bằng chứng đã xem (không chạy Clerk cloud)

- Diffs: `4d6753c`, `bda8d28`, `b13dfa7` trên paths api/backend/web/mobile/contracts/docs.
- Nguồn: `oidc.ts`, `app.ts` MeController, BFF `route.ts`, mobile identity + Account, migration SQL, `.env.example`, ADR-09 / spike P4, `D1-REPORT.md`.
- Reviewer **không** tạo Clerk application / không chạy OTP live (đúng constraint task).

## Khuyến nghị cuối

**PASS with known gap** cho Definition of Done *mã nguồn* Issue #11:

- Đủ để Project Status → **Hoàn thành** nếu board hiểu “POC code + fail-closed landed; P4 live smoke tracked as known gap”.
- **FAIL** nếu tiêu chí Issue #11 được diễn giải là “P4 live đầy đủ (OTP/MFA/revocation đã smoke)” — khi đó giữ **Chờ duyệt** / không Hoàn thành đến khi có evidence live.

Reviewer khuyến nghị coordinator: **Hoàn thành #11 với comment VI nêu rõ gap P4**, và giữ điều kiện DECISION-LOG “chỉ mở business endpoints sau P4 live” nguyên hiệu lực.
