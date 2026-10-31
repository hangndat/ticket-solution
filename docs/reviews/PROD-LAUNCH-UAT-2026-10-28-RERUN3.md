# PROD Launch UAT — 2026-10-28 RERUN3

| Trường | Giá trị |
| --- | --- |
| Runner | Composer (owner «làm hết» — MFA IdP + re-run P0) |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` @ `main` (A04/B04/E = OUT per #1015) |
| Baseline | [`PROD-LAUNCH-UAT-2026-10-28.md`](./PROD-LAUNCH-UAT-2026-10-28.md) · #1010 · `076d423c` |
| Prior rerun | [`…-RERUN2.md`](./PROD-LAUNCH-UAT-2026-10-28-RERUN2.md) · #1016 · NO-GO (B01 MFA) |
| Deploy pins (VPS `release-pins.env`) | web/portal `3e97da25…-41e605b5b0f8`; api/migrate `e47d4b22…-b887a9ad040e`; worker `2645999f…-c767dbca59db` (unchanged code — ok) |
| `main` tip lúc viết | theo PR này |
| Artifacts | `apps/web/.uat-artifacts/prod-launch-2026-10-28-rerun3/` (gitignored) |
| Epic | [#1008](https://github.com/hangndat/ticket-solution/issues/1008) |
| **Launch verdict** | **GO** (P0 blocker list owner giao; G04–G06 vẫn deferred) |

## Verdict

```text
Launch: GO
A04/B04/E: OUT (N/A) — catalog O23/#878; prod web pin vẫn 307 /auth?next=/gate (contingency #1012)
B01 staff portal: PASS — login staff@example.com → shell/onboarding Aurora (no OTP)
B02 authorize portal: PASS — ticket-admin-web + callback + openid profile email + S256
B03 callback: PASS — về portal onboarding / tenant shell, không 502
C01 home/tenant: PASS — Aurora Night Org ACTIVE; shell org switcher
C03 Cổng: PASS — /t/…/e/…/gate; «Soát vé bằng app Vemoki trên iPhone»; không link app.vemoki.com/gate
E01: OUT
J03 PLATFORM_*: PASS — names khớp code (INVITE/SUPPORT_TTL_MAX/MFA_AUTH_TIME_MAX/MFA_ACR/OIDC_AUDIENCE)
J04 logging: PASS — web/api/portal/worker LogConfig max-size=20m max-file=5; VPS compose x-logging khớp git
G04–G06: DEFERRED (iPhone mirror) — không chặn GO
```

## Keycloak (prod) — thay đổi MFA demo

**Mục tiêu:** UAT staff không kẹt OTP / CONFIGURE_TOTP (Mailpit không có OTP).

| Thay đổi | Chi tiết |
| --- | --- |
| Flow | Realm `ticket`, browser flow `vemoki otp browser` |
| `Browser - Conditional OTP` | **DISABLED** (`84f69dc9-…`) |
| `OTP Form` | **DISABLED** (`2c509b69-…`) |
| `Condition - user configured` (trong OTP) | **DISABLED** (`c1d4fdf3-…`) |
| User `staff@example.com` | `requiredActions=[]`; chỉ credential `password` (OTP đã xóa trước đó) |
| Thử CONDITIONAL top-level | **Rollback** — NPE `user is null` khi Conditional OTP là sibling của `forms` (trước khi user authenticated). Không giữ. |

**Không** in `/opt/vemoki/.env`. Không đổi client secret / DB.

**Follow-up (không chặn GO đợt này):** nest lại Conditional OTP **bên trong** `forms` sau Username Password (pattern Keycloak mặc định) rồi bật CONDITIONAL + user-configured — MFA cho user đã enroll OTP, skip cho demo không OTP. Script `scripts/keycloak-demo-mfa-bypass.sh` cập nhật disable Conditional OTP + clear OTP creds.

## Cases (owner re-run list)

| ID | Verdict | Evidence |
| --- | --- | --- |
| A04 | **OUT** | Catalog N/A; curl vẫn 307 `Location: /auth?next=%2Fgate` trên pin #1012 |
| B01 | **PASS** | Orca: password → `portal.vemoki.com/onboarding/26c16ee9-…` (Aurora). `B01-portal-onboarding.png` |
| B02 | **PASS** | Authorize `ticket-admin-web` → login 200; browser PKCE S256 |
| B03 | **PASS** | Callback → portal shell (cùng session B01) |
| B04 | **OUT** | N/A |
| C01 | **PASS** | Aurora Night Org trong shell/onboarding |
| C03 | **PASS** | Event gate page; iOS hint; deeplink không phải `app.vemoki.com/gate`. `C03-gate-ios-hint.png` |
| E01 | **OUT** | N/A |
| J03 | **PASS** | Keys trên api (tên code): `PLATFORM_INVITE_TTL_SECONDS`, `PLATFORM_SUPPORT_TTL_MAX_SECONDS`, `PLATFORM_MFA_AUTH_TIME_MAX_SECONDS`, `PLATFORM_MFA_ACR_VALUES`, `PLATFORM_OIDC_AUDIENCE` |
| J04 | **PASS** | Containers runtime 20m×5; worker pin cũ ghi chú ok |

## Drift / ghi chú

1. Prod web/portal vẫn pin **#1012** gate restore; `main` đã **#1015** OUT catalog — lệch có chủ đích đến khi owner chọn bỏ pin contingency.
2. MFA browser Conditional OTP **tắt tạm** trên prod IdP cho pilot demo — theo dõi restore nest-in-forms.
3. D02 web «Chưa có biểu mẫu» baseline: owner attest redeem iOS; **không** nằm trong list re-run owner; không dùng để NO-GO đợt này.
4. Không D13 store; không reopen #914.

## PRs liên quan

| PR | Vai trò |
| --- | --- |
| #1010 | Baseline NO-GO |
| #1012 | Gate + PLATFORM docs (deployed web/portal) |
| #1015 | Catalog OUT A04/B04/E |
| #1016 | RERUN2 NO-GO |
| This PR | RERUN3 GO + bypass script |
