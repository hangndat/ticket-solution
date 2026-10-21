# UAT production WEB — 2026-10-21

| Trường | Giá trị |
| --- | --- |
| Runner (lần 1) | Sora · uat · Orca `term_82365d62-fcfb-45f7-8a50-bda8a4fcdf01` · task `task_ed9780af6016` |
| Runner (retest nginx) | Sora · uat · Orca `term_94a572bc-adbc-4b3c-af8b-6dfa75421f1d` · task `task_03be9fbc418c` |
| Runner (retest 3 · #668) | Sora · uat · Orca `term_310eb26e-29c4-4016-b434-e6cbc14c5379` · task `task_0aff0036d08f` |
| Catalog | `docs/plans/PROD-LAUNCH-UAT.md` |
| Catalog SHA-256 | `756e5aa410d2c3dd95a8f8e547fd415ae95b162dd79b3d7c25f7787da1ad2d8f` |
| Deploy baseline (retest 3) | `cbabea4ccc6447e7dc40a832ba95c81320c1b0d9` (`main`, fix #668 rate-limit RLS + deploy api/web) |
| Deploy baseline (retest nginx) | `1ba6647b8e6b1652cfdf25b86500d9d415bab48e` |
| Viewports | Desktop ~1440; mobile 390 qua `orca exec --command "set viewport 390 844"` (retest) |
| Browser | Orca tabs `6d76d908…` (portal), `4f074dbb…` (app guest) |
| SSH J-suite | `conanphong` read-only, không in `.env` |
| Ảnh | `apps/web/.uat-artifacts/prod-2026-10-21/` + retest `…/prod-2026-10-21-retest/` + retest3 `…/prod-2026-10-21-retest3/` |

## Launch verdict

**NO-GO** (retest 3 sau deploy #668 @ `cbabea4`, 2026-10-21 ~05:48Z — phạm vi web; H03 inbox và suite G/H01 máy thật **DEFERRED/BLOCKED** riêng)

## Retest 3 sau #668 (`cbabea4`)

Deploy coordinator: API rate-limit RLS không còn 5xx trên `/v1/public/*` và gate mutate (đã verify curl public trước burst). Phạm vi: smoke A01–A04, B01, B04, C01–C04, D02–D04, D06, E01–E05, E07, I01–I02, J04; kiểm tra 429 thật + không 5xx; so `infra/deploy/compose.yaml` VPS vs git.

| ID / Issue | Retest nginx | Retest 3 | Evidence |
| --- | --- | --- | --- |
| A01–A04 | PASS | **PASS** | `curl` marketing/portal/app `200`, auth `302`; BFF `401`; `/gate` `307` + CSP/`nosniff` |
| Rate limit public read | — | **PASS** | 650 req/IP → `175×200` rồi `475×429`; body `RATE_LIMITED` (không 5xx). Runner IP vẫn `429` trong cửa sổ 600/h (chưa chứng minh hết hạn → `200` trên cùng IP trong phiên) |
| B01 | PASS | **BLOCKED** | Keycloak `ticket-admin-web`: `fill`/`#username` + `#kc-login` không chuyển callback trong Orca tab `6d76d908…` (không tái chứng minh shell Aurora) |
| B04 | PASS | **BLOCKED** | Cùng blocker KC automation; tab cũ callback `502` là URL stale, không retest end-to-end |
| C01–C04 | PASS | **BLOCKED** | Phụ thuộc B01 |
| D01 | PASS | **PASS** | Guest home `app.vemoki.com/` — event MFest/Studio listed |
| D02 | FAIL | **FAIL** | `/redeem?tenantId=…&eventId=…` + slug `mfest-demo`/`mfest`: «Tải biểu mẫu» disabled; `GET /v1/public/*` từ IP runner `429` sau burst UAT (chặn load form). Mã seed `DEMO-MFEST-001` chưa redeem |
| D03–D04 | BLOCKED | **BLOCKED** | Phụ thuộc D02 |
| D05 | PASS | **PASS** | `/claim`, `/invite` HTTP `200` |
| D06 | PASS | **PASS** | `set viewport 390 844` + `d06-redeem-390.png` |
| E01 | PASS | **PASS** | Staff tab `7800b3fe…` `/gate` — form phiên, KẾT NỐI «Trực tuyến» sau «Thử lại»; `e01-gate-online.png` |
| E02 | PASS | **PASS** | Phiên Aurora `68d601b3-…` / tenant `26c16ee9-…` / event `5295ef1a-…` hiển thị |
| E03–E04 | FAIL/BLOCKED | **BLOCKED** | Không có ticket ID hợp lệ post-D02; phiên staff mất cookie sau thao tác gate (UNAUTHENTICATED) |
| E05 | FAIL | **PASS** | Ticket giả `000…099` → «Không cho vào» + `UNAUTHENTICATED` (từ chối sạch, không 500) khi API trực tuyến |
| E07 | PASS | **BLOCKED** | Guest `/gate` → redirect OIDC `ticket-web` (chưa login attendee → chưa thấy `gate_denied`) |
| I01 | PASS | **BLOCKED** | Phụ thuộc portal staff |
| I02 | PASS | **PASS** | `GET /v1/me/events` → `401` |
| J04 | FAIL | **PASS** (drift có chủ đích) | `diff` VPS `infra/deploy/compose.yaml` vs git @ `cbabea4`: **chỉ** thêm `OIDC_AUDIENCE` + `OIDC_JWKS_URL` trên service `web` (PR #665 hotfix chưa merge). VPS sha `a55f89ee…`, git sha `7bf278d3…` |
| J01–J03 | PASS | **PASS** | SSH `dexter@113.161.116.5`: `PRODUCT_ORIGIN`, `OIDC_SCOPES`, `PLATFORM_INVITE_TTL_SECONDS`, `OIDC_AUDIENCE` (chỉ tên/giá trị không secret) |
| H03 | BLOCKED | **BLOCKED** | Không có hộp thư kiểm soát prod |

**P1 gap:** CSP app `connect-src` gồm `http://api:3001` (origin Docker nội bộ) — `curl -I https://app.vemoki.com/`.

**Retest 3 verdict (web):** **NO-GO** — API public/gate không 5xx sau #668; rate limit 429 đúng. P0 còn **D02**, **D03–D04**, **B01/B04/C/I01/E03–E04/E07** (redeem + KC automation / phụ thuộc), **H03**.

```text
P0 chặn launch web: D02, D03, D04, B01, C01–C04, I01, E03, E04, E07, H03
P1: CSP connect-src http://api:3001
DEFERRED: G01–G06, H01 (máy thật)
```

## Retest sau fix nginx

Coordinator: `app.vemoki.com` thêm `proxy_buffer_size 32k` (+ buffers) — reload ~05:08Z (`vemoki.conf.bak-20261021-app-buffer`). Chỉ chạy lại case BLOCKED/FAIL trong scope task; không deploy/sửa VPS.

| ID / Issue | Trước | Sau retest | Evidence |
| --- | --- | --- | --- |
| B04 | FAIL (callback 502) | **PASS** | Staff `return=/gate` → «Cổng check-in dự phòng»; `b04-gate-after-nginx-fix.png` |
| B05 | PASS | **PASS** | Authorize `ticket-web` → `app.vemoki.com/api/auth/callback`, scope `openid profile email` (không `offline_access`) |
| #630 refresh app auth | FAIL (502 callback) | **PASS** | Attendee login + reload → `/account` vẫn `attendee@example.com`, «Đăng xuất» |
| D01 | PASS | **PASS** | Guest/attendee home, không chrome admin tenant |
| D02 | BLOCKED | **FAIL** | «Tải biểu mẫu» `mfest-demo`/`mfest` không load form; `vemoki-web-1` log `failed-to-find-server-action` |
| D03 | BLOCKED | **BLOCKED** | Phụ thuộc D02 |
| D04 | BLOCKED | **BLOCKED** | Phụ thuộc D02 |
| D05 | PASS | **PASS** | `/claim`, `/invite` HTTP 200 (không token) |
| D06 | FAIL (không viewport) | **PASS** | `set viewport 390 844` + `d06-redeem-mobile-390-retest.png` |
| E01 | BLOCKED | **PASS** | Staff `/gate` form phiên + copy fail-closed |
| E02 | BLOCKED | **PASS** | Aurora tenant `26c16ee9-…` + event `5295ef1a-…` → phiên `68d601b3-…` |
| E03 | BLOCKED | **FAIL** | «Giữ chỗ và xác nhận» → «API cổng không tới được»; container log Server Action ID lỗi |
| E04 | BLOCKED | **BLOCKED** | Phụ thuộc E03 |
| E05 | BLOCKED | **FAIL** | Ticket UUID giả → cùng lỗi API cổng (không từ chối sạch 4xx) |
| E07 | BLOCKED | **PASS** | Attendee `/gate` → `?notice=gate_denied`, «Không đủ quyền cổng» |
| I01 | PASS | **PASS** | Staff portal → URL tenant MFest `d9d9f001-…` → «Cần đăng nhập», không lộ shell MFest |
| J04 | FAIL | **FAIL** | So **đúng file** `infra/deploy/compose.yaml`: VPS sha `a55f89ee4f3431c609aa8dd1146b9c985da96ffd1a06e75d5b21ccee50eeda75` ≠ git @ `bc916201` sha `7bf278d3f20b84020168280b3b5850f3aa8716d9eb2806433c3af2b0fabb4ac9` (PR #665 hotfix VPS chưa khớp tip git) |
| H03 | BLOCKED | **BLOCKED** | Không có hộp thư kiểm soát prod |

**Retest verdict:** **NO-GO** — nginx unblock B04/#630 OIDC callback; P0 còn **D02**, **E03/E05**, **J04**, **H03**.

```text
P0 FAIL/BLOCKED còn: D02, E03, E05, J04, H03 (+ D03–D04, E04 blocked)
```

## Launch verdict (lần 1 — giữ lịch sử)

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
Launch: NO-GO (retest 3 web 2026-10-21 @ cbabea4)
Catalog SHA: 756e5aa410d2c3dd95a8f8e547fd415ae95b162dd79b3d7c25f7787da1ad2d8f
Deploy SHA (retest 3): cbabea4ccc6447e7dc40a832ba95c81320c1b0d9
Artifact: docs/reviews/UAT-PROD-WEB-2026-10-21.md
PR: #666
```
