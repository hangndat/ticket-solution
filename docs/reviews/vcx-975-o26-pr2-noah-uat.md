# VCX-975 O26-PR2 — Owner shell UAT (Noah · fixture)

**Ngày:** 26/10/2026 · **Issue:** [#975](https://github.com/hangndat/ticket-solution/issues/975) · **PR:** [#980](https://github.com/hangndat/ticket-solution/pull/980) · **Epic:** [#914](https://github.com/hangndat/ticket-solution/issues/914)  
**testedSHA:** `c8130ba7d966f7b3565365f7c73996ea79281e83`  
**Build ID:** `aRGMLKpF5oaN7wyhoDjSO`  
**Runner:** Noah (fixture/runtime) — không sửa `apps/portal` product code.

## Verdict

| Phạm vi | Kết luận |
| --- | --- |
| **Shell Owner sau OIDC đầy đủ (PR #980 blocker)** | **PASS** — `#portal-main`, sider, context strip, tenant/event switchers @ 390 / 1024 / 1440; không `Không có quyền`; không còn ProLayout |
| **PNG / viewport** | **PASS** — IHDR khớp suffix (`390×844`, `1024×900`, `1440×900`); `pngPixelPassAll: true` |
| VI/EN, logout, unsaved cancel | **GAP (harness)** — xem bảng dưới; **không** coi là fail shell composition |
| **Phân loại lỗi Higo** | **Fixture** — stack `:3013` + persona Staff/TOTP; không phải regression shell PR2 khi Owner + host/client riêng |

**Verdict Noah:** `PASS with known gap` (shell + viewport đủ acceptance PR2; gap chỉ interactive harness).

## Stack (isolated cookie / read-only API)

| Thành phần | Giá trị |
| --- | --- |
| Worktree | `/Users/admin/SideProject/ticket-solution/vcx-975-antd-shell` |
| Portal | `http://uat975shell.localhost:3019` — `next start` @ `127.0.0.1:3019` |
| API | `http://127.0.0.1:3542` — **reuse** vcx932-noah listener; chỉ đọc BFF qua session |
| OIDC client **mới** | `ticket-admin-web-vcx975-uat975shell` — **không** sửa `ticket-admin-web` / client #928 |
| DB | `ticket_vcx932_leader_20261026` (verify membership Owner); **không** bootstrap/drop `ticket_d9_demo` |
| Actor | `owner.fixture@example.com` + TOTP fixture (private, không commit) |

Orca ports: [`docs/reviews/evidence/vcx-975/o26-pr2-noah/ports-orca.json`](evidence/vcx-975/o26-pr2-noah/ports-orca.json).

Fixture gitignored: `.local-dev/.uat-artifacts/vcx975-noah-shell/` (`env.sh`, `start-portal.sh`, `run-shell-uat.mjs`).

## Kết quả kiểm tra

| Case | Viewport | Kết quả | Ghi chú |
| --- | --- | --- | --- |
| OIDC + Owner login | 1024 | **PASS** | BFF `/api/bff/me/tenants` → 200 sau callback |
| Shell DOM (brand, sider, context, switchers) | 390 / 1024 / 1440 | **PASS** | `shellMatrixPass: true`; `innerWidth` khớp sau `goto` events |
| Screenshot IHDR | 390 / 1024 / 1440 | **PASS** | `owner-shell-*.png` trong evidence packet |
| Locale EN | 1024 | **GAP** | Submenu antd — `enActive: false`; VI restore `viBack: true` |
| Unsaved cancel (config) | 1024 | **GAP** | `cancelOk: false` — chưa ghi `window.confirm`; có thể chưa register dirty (harness, tham chiếu #932 leader eval) |
| Logout menu | 1024 | **GAP** | `clicked: false`; session BFF vẫn 200 — cần click item «Đăng xuất» / `assign /api/auth/logout` trong probe follow-up |

Packet: [`docs/reviews/evidence/vcx-975/o26-pr2-noah/uat-results.json`](evidence/vcx-975/o26-pr2-noah/uat-results.json) + PNG cùng thư mục.  
Metrics (gitignored): `.orca-metrics/vcx975-pr2-uat-result.json`.

## An toàn dữ liệu #928

- `verify-fixture-readonly.sh`: API health 200, Owner membership = 1; chỉ `SELECT` trên DB isolated.
- `ticket_d9_demo` chỉ kiểm tra tồn tại — **không** drop/mutate.
- Keycloak: client **mới**; không enroll TOTP Owner realm #928.

## Lệnh tái hiện

```bash
# API :3542 phải đang chạy (vcx932-noah stack)
bash .local-dev/.uat-artifacts/vcx975-noah-shell/verify-fixture-readonly.sh
bash .local-dev/.uat-artifacts/vcx975-noah-shell/start-portal.sh
node .local-dev/.uat-artifacts/vcx975-noah-shell/run-shell-uat.mjs
```

## Blocker cho coordinator

- **Không** — shell UAT PR2 đóng blocker «thiếu shell sau OIDC».
- **Follow-up tùy chọn:** một lượt Orca bổ sung locale/logout/unsaved (submenu + `assign` logout) nếu gate Epic yêu cầu 100% interactive AC; không chặn merge PR2 shell.

## Giới hạn phiên

- Không commit/push product code; tab Orca do Noah đã đóng; portal `:3019` + API `:3542` **giữ** cho review.
- James/reviewer độc lập vẫn cần trên cùng SHA nếu DoD yêu cầu.
