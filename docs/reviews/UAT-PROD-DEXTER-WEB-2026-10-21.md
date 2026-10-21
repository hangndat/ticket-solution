# UAT prod WEB — Safari trên iPhone Dexter (21/10/2026)

## Verdict launch (physical-browser)

**NO-GO** — không chạy được lớp `physical-browser` trên Safari thật do **WebDriverAgent/XCUITest không lên cổng 8100** sau 2 vòng retry + 1 vòng kill runner / `devicectl` launch (chi tiết log). **Không** dùng simulator hay curl để thay PASS browser.

## Bản kiểm tra

| Trường | Giá trị |
| --- | --- |
| Prod SHA (catalog) | `1ba6647b8e6b1652cfdf25b86500d9d415bab48e` |
| Deploy | PR #665 / `main` đồng bộ prod (theo handoff coordinator) |
| Thiết bị | D Dexter's iPhone 16 Pro · UDID `00008140-000605803C01801C` |
| iOS | 26.6.1 (build 23G83) |
| Trình duyệt | Safari `com.apple.mobilesafari` (mục tiêu) |
| Automation | WDA runner `com.hangndat.WebDriverAgentRunner.xctrunner` · pymobiledevice3 11.36.0 · venv `/tmp/pymobile-venv` |
| Script | `/tmp/dexter-prod-web-uat.py` (chưa chạy case — WDA gate) |
| Chính sách | READ-ONLY: không redeem, admit, mở phiên gate |
| Persona | Catalog §2 — `staff@example.com` / `attendee@example.com` (seed demo) |

## WDA / flake (BLOCKED)

| Vòng | Hành động | Kết quả |
| --- | --- | --- |
| 1–2 | `userspace_tunnel` + `XCUITestService.run` (script prod web) | `DTX capability handshake timed out`; usbmux `:8100` → `ConnectionFailedError` Number **3** |
| 3 | `pkill` runner cũ; `devicectl device process launch` WDA bundle | Launch OK nhưng **vẫn không** mở `:8100` / `start_session` fail |
| — | Coordinator: **không** `sudo tunneld`; không rebuild signing mới | Không có `.ipa`/`.app` WDA local để `devicectl install` |

Log: `apps/web/.uat-artifacts/prod-dexter-2026-10-21/wda-failure.log` · `/tmp/dexter-prod-web-uat.log`

**Cần user (ngoài worker):** mở khóa máy, giữ cáp USB, chạy `sudo python3 -m pymobiledevice3 remote tunneld` (hoặc rebuild WDA cho iOS 26.6) rồi chạy lại suite.

## Kết quả case (physical-browser / http)

| ID | P | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| A01 | P0 | **PASS** (http only) | `curl -L` → 200: `vemoki.com`, `portal.vemoki.com`, `app.vemoki.com`, `auth.vemoki.com`. Safari: **BLOCKED** (WDA). |
| B01 | P0 | **BLOCKED** | Portal staff login — cần Safari |
| B04 | P0 | **BLOCKED** | App staff `return=/gate` |
| B06 | P0 | **BLOCKED** | Attendee portal |
| B07 | P0 | **BLOCKED** | Sai mật khẩu Keycloak |
| B08 | P0 | **BLOCKED** | Logout portal |
| B10 | P0 | **BLOCKED** | Portal EN + login |
| C01 | P0 | **BLOCKED** | Portal home (phụ thuộc B01) |
| C02 | P0 | **BLOCKED** | Event Aurora |
| C03 | P0 | **BLOCKED** | Link cổng app |
| C04 | P0 | **BLOCKED** | Members |
| C08 | P0 | **BLOCKED** | Locale EN shell |
| D01 | P0 | **BLOCKED** | App khách `/` |
| D05 | P1 | **BLOCKED** | `/claim`, `/invite` không token |
| D06 | P1 | **BLOCKED** | Layout redeem ~390px |
| E01 | P0 | **BLOCKED** | Staff `/gate` (chỉ xem form; không mở phiên) |
| E07 | P0 | **BLOCKED** | Attendee `/gate` |
| I03 | P1 | **BLOCKED** | `/platform` staff thường |

### FAIL / BLOCKED tóm tắt (GO/NO-GO)

| Trạng thái | Case |
| --- | --- |
| **BLOCKED** | B01, B04, B06, B07, B08, B10, C01, C02, C03, C04, C08, D01, D05, D06, E01, E07, I03 (+ Safari phần A01) |
| **FAIL** | — (không có evidence UI để kết luận FAIL hành vi) |

## Evidence paths

- Ảnh/XML Safari: `apps/web/.uat-artifacts/prod-dexter-2026-10-21/` (trống — WDA chưa chụp)
- `results.json` — chỉ `_WDA` BLOCKED

## Viewport / quan sát chưa có

Do BLOCKED WDA: chưa ghi viewport thật iPhone 16 Pro, safe-area, bàn phím, ITP/cookie, redirect OIDC trong Safari, CSP console.

## Handoff

1. User/coordinator khôi phục WDA trên Dexter iOS 26.6.1.
2. Chạy lại `/tmp/dexter-prod-web-uat.py` (hoặc bản copy trong repo nếu đã commit).
3. Cập nhật bảng case + verdict khi có screenshot `*-01-loaded.png`.
