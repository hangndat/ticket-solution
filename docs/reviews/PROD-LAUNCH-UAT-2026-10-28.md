# PROD Launch UAT — 2026-10-28

| Trường | Giá trị |
| --- | --- |
| Runner | Composer (session UAT #1008) |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` blob `ea2ef2a1860dbadf97ec58db18353d45914c4733` |
| Repo HEAD | `61f36f2368a65db58069d74cbf577c31d4559d0c` (`main`) |
| Prod API pin | `e47d4b229166616f4767584c5665512630546cb3-b887a9ad040e` |
| Artifacts | `apps/web/.uat-artifacts/prod-launch-2026-10-28/` (gitignored) |
| Epic | [#1008](https://github.com/hangndat/ticket-solution/issues/1008) |
| **Launch verdict** | **NO-GO** |

## Verdict

```text
Launch: NO-GO
P0: pass 12 / fail 2 / blocked 6+ / not-run nhiều
P1 gaps: J03 env thiếu một phần PLATFORM_*; J04 compose drift (x-logging chưa recreate); A05 dath.vn DNS fail (dath.com 200)
Deferred catalog: G04–G06 (máy thật còn thiếu); G01–G03 / H01 / H03 kế thừa evidence cũ 2026-10-21 — không nâng thành GO đợt này
Drift git↔VPS: có (compose logging; worker pin cũ; /gate redirect)
```

`GO` chỉ khi mọi P0 ngoài hoãn = PASS và không còn P0 BLOCKED. Đợt này **không** đạt.

## Cases đã chạy

| ID | Verdict | Evidence |
| --- | --- | --- |
| A01 | PASS | marketing/portal/app/auth → 200 |
| A02 | PASS | portal `/api/bff/me/subject` → 401 |
| A03 | PASS | app `/api/bff/me` → 401 |
| A04 | **FAIL** | `GET /gate` → **308** `Location: /` (catalog: 307 `/auth?next=/gate`). File `suite-A-followup.txt` |
| A05 | PASS* | ancafe 200; `dath.vn` DNS fail; `dath.com`/`www.dath.com` 200 — ghi gap host |
| A06 | PASS | cert hết hạn 2027-01-19 (>14 ngày) |
| B01 | **BLOCKED** | Staff portal → Keycloak OTP («One-time code»). Mailpit không có OTP. Screenshot `B01-after-login.png` |
| B02 | PASS | authorize portal: `ticket-admin-web`, callback portal, scope `openid profile email`, PKCE S256, không `offline_access` |
| B03 | BLOCKED | Phụ thuộc B01 (callback sau OTP) |
| B04 | **FAIL** | `https://app.vemoki.com/gate` (không cookie / sau mở tab) về home khách, không trang cổng |
| B05 | PASS | authorize app: `ticket-web`, callback app, PKCE, không `offline_access` |
| B06–B10 | not-run / partial | B07 không hoàn tất (login URL redirect home khi đã có session attendee) |
| C* | BLOCKED | Phụ thuộc B01 MFA |
| D01 | PASS | Attendee login → `/wallet` / home có session `attendee@example.com`; có «Bạn có 2 vé» trên card demo |
| D02 | BLOCKED | Lookup `VEM-HOIAN-FEST-010` OK (sự kiện/loại vé hiện) nhưng UI «Chưa có biểu mẫu» — nút «Đổi mã lấy vé» không hoàn tất cấp vé trong session này. Owner đã attest PASS redeem trên iOS USB 45 (ngoài catalog web) |
| D03 | PASS | Mã sai → «Mã không hợp lệ» / không tìm thấy |
| D04–D07 | not-run | — |
| E* | BLOCKED | `/gate` không mở được (A04/B04) |
| F* | not-run | Không boot Simulator đợt này |
| G01–G03 | N/A đợt này | Kế thừa PASS 2026-10-21 (TF 26) — không re-run |
| G04–G06 | not-run | iPhone Mirroring thấy home / OpenVPN; không điều khiển được vào Vemoki (companion không raise; AX tree chỉ AXWindow) |
| H* | N/A / kế thừa | H01/H03 PASS lịch sử; không re-run |
| I02 | PASS | `GET /v1/me/events` không token → 401 |
| I01,I03,I04 | not-run | Cần portal staff |
| J01 | PASS | `PRODUCT_ORIGIN=https://app.vemoki.com` |
| J02 | PASS | portal+web `OIDC_SCOPES=openid profile email` |
| J03 | **FAIL** (partial) | Có `PLATFORM_INVITE_TTL_SECONDS`; **MISSING**: `PLATFORM_SUPPORT_TTL_SECONDS`, `PLATFORM_MFA_AUTH_TIME_MAX_AGE`, `PLATFORM_ACR_VALUES`, `PLATFORM_AUDIENCE` |
| J04 | FAIL (drift) | git `compose.yaml` có `x-logging` 20m×5; VPS compose chưa có (chưa recreate từ SHA logging). Worker vẫn pin `2645999f…` |
| J05 | PASS (P1) | Có dump prod `pre-o31-gates-…` + `pre-prod-seed-…` trong `/opt/vemoki/backups` |
| J06 | PASS | nginx `proxy_buffer_size 32k` / `proxy_buffers 8 32k` |

## Drift git ↔ VPS

1. **`/gate` web** không còn redirect auth — về `/` (FAIL A04/B04/E).
2. **Staff MFA** bật trên realm — catalog demo không có đường OTP → BLOCKED cả portal Owner/Cổng web.
3. **Compose logging** trên git chưa áp VPS.
4. **Worker** pin cũ hơn api/web/portal.
5. **J03** thiếu phần lớn `PLATFORM_*` env trên api container.

## Việc owner có thể làm để mở lại GO

1. Cung cấp OTP staff (hoặc tắt MFA tạm cho user demo UAT) → chạy lại B/C/E.
2. Sửa routing `/gate` → auth (hoặc document breaking change + cập nhật catalog).
3. Bổ sung `PLATFORM_*` trên api prod + recreate để khớp J03.
4. Recreate containers để nhận `x-logging` (J04).
5. Ủy quyền lại sóng G04–G06 trên mirror (mở sẵn Vemoki + tab Quét) nếu muốn bỏ deferred.

## Không làm trong đợt

Deploy, sửa realm, sửa `.env`, store submit (D13), tuyên bố pilot ready.
