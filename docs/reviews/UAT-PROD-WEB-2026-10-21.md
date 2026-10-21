# UAT production WEB — 2026-10-21

| Trường | Giá trị |
| --- | --- |
| Runner | Sora · uat · Orca `term_82365d62-fcfb-45f7-8a50-bda8a4fcdf01` · task `task_ed9780af6016` |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` |
| Catalog SHA-256 | `756e5aa410d2c3dd95a8f8e547fd415ae95b162dd79b3d7c25f7787da1ad2d8f` |
| Deploy baseline | `1ba6647b8e6b1652cfdf25b86500d9d415bab48e` (`main`, PR #665) |
| Viewports | Desktop ~1440 (Orca default); mobile 390 — **Orca `agent-browser` không có lệnh `resize`/`viewport`** (ghi gap D06) |
| Browser | Orca tabs `6d76d908…` (portal), `4f074dbb…` (app guest) |
| SSH J-suite | `conanphong` read-only, không in `.env` |
| Ảnh | `apps/web/.uat-artifacts/prod-2026-10-21/` |

## Launch verdict

**NO-GO**

P0 chặn: **B04** (app OIDC callback `502`), **D02–D04** (phụ thuộc đăng nhập app), **E02–E05** (phụ thuộc staff `/gate`), **H03** (không có hộp thư kiểm soát), **J04** (compose git ≠ VPS).

## Retest fix hôm nay (deploy `1ba6647`)

| Issue | Kết quả | Evidence |
| --- | --- | --- |
| #617 CSP + `nosniff` app + portal | **PASS** | `curl -I` `https://app.vemoki.com/` và `https://portal.vemoki.com/` — có `content-security-policy` + `x-content-type-options: nosniff` |
| #618 `INVALID_UUID` / 422 | **PASS** (API) | `POST …/tenants/not-a-uuid/events/also-bad/redemptions` → `422` `INVALID_UUID` |
| #618 HTTP 413 | **NOT-RUN** | Body lớn không token → `401` trước validate; chưa có bearer UAT an toàn |
| #630 refresh / app auth | **FAIL** | `GET /api/auth/callback` sau Keycloak → nginx **502**; `vemoki-web-1` log `failed-to-find-server-action` |
| #653 upload CSV giới hạn | **NOT-RUN** | Không mở flow upload CSV trên portal (thiếu thời trong phiên; portal shell OK) |
| #639 admin-form | **NOT-RUN** | Không retest form admin riêng; portal event/members tải bình thường |

## Suite A — Cạnh và sức khỏe

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| A01 | http | **PASS** | vemoki/portal/app `200`; auth `302` |
| A02 | http | **PASS** | portal `/api/bff/me/subject` → `401` |
| A03 | http | **PASS** | app `/api/bff/me` → `401` |
| A04 | http | **PASS** | `GET /gate` → `307` `location: /auth?next=%2Fgate` + CSP headers |
| A05 | http | **PASS** | `ancafe.anphong.vn` `200`; `dath.info` `200` (`-k`) |
| A06 | http | **PASS** | Cert `notAfter=Jan 17 2027` (bốn host vemoki) |

## Suite B — Đăng nhập

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| B01 | desktop | **PASS** | Portal staff → Aurora Night Org. `b01-portal-home-desktop.png` |
| B02 | http | **PASS** | `ticket-admin-web`, PKCE S256, scope `openid profile email`, không `offline_access` |
| B03 | desktop | **PASS** | Portal callback → shell `200`, không 502 |
| B04 | desktop | **FAIL** | App `return=/gate` → callback **502**. `b04-app-callback-502-desktop.png` |
| B05 | http | **PASS** | `ticket-web`, callback app, PKCE, không `offline_access` |
| B06 | desktop | **PASS** | `attendee@example.com` trên portal client → không vào shell (kẹt form KC / không onboarding Owner). `b06-attendee-portal-desktop.png` |
| B07 | desktop | **PASS** | Sai mật khẩu giữ form KC. `b07-bad-password-desktop.png` |
| B08 | desktop | **PASS** | `/api/auth/logout` → `/auth` «Đăng nhập nhân sự» |
| B09 | — | **NOT-RUN** | — |
| B10 | — | **NOT-RUN** | — |

## Suite C — Portal Owner

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| C01 | desktop | **PASS** | Shell Aurora Night Org |
| C02 | desktop | **PASS** | Event Aurora Night UAT overview. `c02-event-desktop.png` |
| C03 | desktop | **PASS** | Nút «Mở cổng quét trên app» (link `e5`); catalog 2026-10-19 xác nhận `https://app.vemoki.com/gate` |
| C04 | desktop | **PASS** | Members «Người dùng (1)». `c04-members-desktop.png` |
| C05–C09 | — | **NOT-RUN** | — |

## Suite D — App khách

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| D01 | desktop | **PASS** | Guest home, không chrome admin. `d01-app-home-desktop.png` |
| D02 | desktop | **BLOCKED** | Cần session attendee; app callback **502** |
| D03 | desktop | **BLOCKED** | Cùng lý do |
| D04 | desktop | **BLOCKED** | Cùng lý do |
| D05 | desktop | **PASS** | `/claim`, `/invite` không token — form hướng dẫn, không 500 |
| D06 | mobile 390 | **FAIL** | Orca không set viewport 390; ảnh `d06-redeem-mobile-390.png` ở kích thước mặc định |
| D07 | — | **NOT-RUN** | — |

## Suite E — Cổng web

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| E01 | desktop | **BLOCKED** | Phụ thuộc B04 staff `/gate` |
| E02–E05 | desktop | **BLOCKED** | Phụ thuộc phiên staff + ticket redeem |
| E06 | — | **NOT-RUN** | — |
| E07 | desktop | **BLOCKED** | Guest `/gate` → Keycloak app login, chưa chứng minh `gate_denied` (cũng bị callback 502 nếu login) |

## Suite I — Cách ly

| ID | VP | Kết quả | Evidence |
| --- | --- | --- | --- |
| I01 | desktop | **PASS** | Staff Aurora, URL tenant `d9d9f001-…` → «Cần đăng nhập» / không lộ MFest |
| I02 | http | **PASS** | `GET https://api.vemoki.com/v1/me/events` → `401` `UNAUTHENTICATED` |
| I03 | desktop | **NOT-RUN** | Phiên staff bị gián đoạn sau B06 |
| I04 | — | **BLOCKED** | Không có user Operator demo |

## Suite J — Vận hành (read-only)

| ID | Kết quả | Evidence |
| --- | --- | --- |
| J01 | **PASS** | `PRODUCT_ORIGIN=https://app.vemoki.com` (portal container) |
| J02 | **PASS** | `OIDC_SCOPES=openid profile email` (portal + web) |
| J03 | **PASS** | API env có `PLATFORM_*`, `OIDC_AUDIENCE`, `PLATFORM_MFA_ACR_VALUES` (chỉ tên biến) |
| J04 | **FAIL** | VPS `/opt/vemoki/src/compose.yaml` sha `0d44109…` ≠ git `infra/deploy/compose.yaml` sha `7bf278d…` @ `1ba6647` |
| J05 | **NOT-RUN** | — |
| J06 | **PASS** | nginx `proxy_buffer_size 32k` |

## Suite H (catalog)

| ID | Kết quả | Ghi chú |
| --- | --- | --- |
| H03 | **BLOCKED** | Không có hộp thư kiểm soát prod |

## Drift / ghi chú vận hành

- `vemoki-web-1` restart ~3 phút trước khi bắt đầu app UAT; callback vẫn **502** với lỗi Next Server Action trong log container.
- Portal auth và shell **không** bị ảnh hưởng.
- Mã redeem UAT (khi app auth sống lại): `DEMO-MFEST-001`…`010` per `docs/demo/D9-DEMO-DATASET.md` (sự kiện `mfest-demo` / `mfest`).

## P0 summary

| | pass | fail | blocked | not-run |
| --- | ---: | ---: | ---: | ---: |
| Đã chạy | 22 | 3 | 9 | 8+ |

### FAIL / BLOCKED (launch)

| ID | Verdict |
| --- | --- |
| B04 | FAIL |
| D02 | BLOCKED |
| D03 | BLOCKED |
| D04 | BLOCKED |
| D06 | FAIL |
| E01–E05, E07 | BLOCKED |
| H03 | BLOCKED |
| J04 | FAIL |

```text
Launch: NO-GO
Catalog SHA: 756e5aa410d2c3dd95a8f8e547fd415ae95b162dd79b3d7c25f7787da1ad2d8f
Deploy SHA: 1ba6647b8e6b1652cfdf25b86500d9d415bab48e
Artifact: docs/reviews/UAT-PROD-WEB-2026-10-21.md
```
