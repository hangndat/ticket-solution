# PROD Launch UAT — 2026-10-28 RERUN2

| Trường | Giá trị |
| --- | --- |
| Runner | Composer (owner «làm hết» — merge #1012 + deploy + re-run P0) |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` @ `main` tip (sau #1015: A04/B04/E = OUT) |
| Deploy source SHA | `3e97da2501b8e24646536fdfaf13f4cfe9f28718` (#1012 squash) |
| Web/Portal pin | `3e97da2501b8e24646536fdfaf13f4cfe9f28718-41e605b5b0f8` |
| API pin (unchanged) | `e47d4b229166616f4767584c5665512630546cb3-b887a9ad040e` |
| Worker pin (unchanged) | `2645999f0ad535276b63a95c6c96bace9cff025e-c767dbca59db` |
| `main` tip lúc viết | `e9fa49c2` — **#1015 revert #1012** (docs O23 OUT) |
| Artifacts | `apps/web/.uat-artifacts/prod-launch-2026-10-28-rerun2/` (gitignored) |
| Epic | [#1008](https://github.com/hangndat/ticket-solution/issues/1008) |
| **Launch verdict** | **NO-GO** |

## Verdict

```text
Launch: NO-GO
A04 gate redirect: PASS trên pin đã deploy (307 → /auth?next=/gate → IdP)
B01 staff portal: BLOCKED — CONFIGURE_TOTP / «credential setup required» sau bypass OTP
B03/B04/C01/C03/E01: BLOCKED (phụ thuộc B01)
J03 PLATFORM_* (tên code): PASS trên api container
J04 web LogConfig 20m×5: PASS sau recreate web
Drift: prod vẫn mount #1012 gate build; main tip đã revert (#1015)
```

`GO` **không** đạt: staff MFA vẫn chặn portal Owner; các P0 phụ thuộc session staff chưa chạy xong.

## Gate / deploy (done)

1. Merged [#1012](https://github.com/hangndat/ticket-solution/pull/1012) → `3e97da25` (CI green sau proxy 307 + Tailwind gate / ui-budget).
2. Built immutable release `…-41e605b5b0f8`; pinned **web** + **portal**; recreate `--no-deps`.
3. `GET https://app.vemoki.com/gate` → **307** `Location: /auth?next=%2Fgate` (không còn 308→`/`).
4. Follow chain → `ticket-web` authorize + PKCE S256, không `offline_access`.

Api **không** rebuild: PR #1012 chỉ docs/template `PLATFORM_*`; container đã có đủ tên khớp `readPlatformSecurityConfig`.

## Staff MFA — đã đổi trên prod Keycloak

| Thay đổi | Chi tiết |
| --- | --- |
| Xóa OTP credential | `staff@example.com` otp id `870fa5b0-…` (script bypass ban đầu `otp_creds_removed=0` do parse JSON) |
| Clear `requiredActions` | `[]` |
| Browser flow | `Browser - Conditional OTP` + `OTP Form` → **DISABLED** (tạm UAT) |
| `CONFIGURE_TOTP` action | bật/tắt thử; khi **disabled** → «Cannot login, credential setup required»; khi **enabled** → màn Mobile Authenticator Setup |

**Kết luận MFA:** bypass script trong #1012 **không đủ** (thiếu delete OTP + disable conditional OTP). Sau chỉnh tay vẫn bị ép setup TOTP → **B01 BLOCKED**.

## Cases RERUN2

| ID | Verdict | Evidence |
| --- | --- | --- |
| A04 | **PASS** | curl: 307 `/auth?next=%2Fgate`; follow → IdP `ticket-web` |
| B01 | **BLOCKED** | Orca portal: password OK rồi CONFIGURE_TOTP / sorry credential setup |
| B02 | PASS | authorize URL: `ticket-admin-web`, callback portal, `openid profile email`, S256 |
| B03 | BLOCKED | phụ thuộc B01 callback |
| B04 | BLOCKED | cần staff session; anonymous A04 đã PASS riêng |
| C01/C03 | BLOCKED | phụ thuộc B01 |
| E01 | BLOCKED | phụ thuộc staff `/gate` session |
| J03 | PASS* | Có `PLATFORM_INVITE_TTL_SECONDS`, `PLATFORM_SUPPORT_TTL_MAX_SECONDS`, `PLATFORM_MFA_AUTH_TIME_MAX_SECONDS`, `PLATFORM_MFA_ACR_VALUES`, `PLATFORM_OIDC_AUDIENCE` (*catalog tên cũ lệch) |
| J04 | PASS (web) | `LogConfig max-size=20m max-file=5` sau recreate web; compose VPS tree vẫn có thể lệch git |

## Drift git ↔ VPS

1. **Prod web/portal** = #1012 gate restore pin.
2. **`main` @ `e9fa49c2`** = #1015 revert restore + catalog OUT A04/B04/E (O23).
3. Keycloak browser OTP tạm DISABLED; demo staff không còn OTP credential.
4. Worker pin vẫn cũ hơn api.

## Việc còn lại trước GO

1. Hoàn tất đường staff login không OTP (hoặc cấp TOTP thật + secret trong UAT) → re-run B01/B03/C*/E*.
2. Quyết định sản phẩm: giữ contingency web `/gate` (#1012 pin) **hay** O23 OUT (#1015) — đừng để main tip và prod lệch.
3. Sửa `scripts/keycloak-demo-mfa-bypass.sh` (delete OTP JSON + optional disable Conditional OTP) nếu tiếp tục demo bypass.
4. Không tuyên bố pilot ready khi B01 BLOCKED.

## Không làm / hạn chế đợt này

Không store submit; không restore Conditional OTP trong phiên này (để owner quyết định); không overwrite `PROD-LAUNCH-UAT-2026-10-28-RERUN.md`.
