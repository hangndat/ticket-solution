# VCX-975 O26-PR2 — Owner shell UAT (Noah · fixture)

**Ngày:** 26/10/2026 · **Issue:** [#975](https://github.com/hangndat/ticket-solution/issues/975) · **PR:** [#980](https://github.com/hangndat/ticket-solution/pull/980) · **Epic:** [#914](https://github.com/hangndat/ticket-solution/issues/914)  
**Branch:** `hangndat/vcx-975-antd-shell` @ **`af6374bd06b19469cd3e2454819b28f9a6785404`** (không UAT trên `2f233667`)  
**Shell matrix SHA:** `c8130ba7d966f7b3565365f7c73996ea79281e83` · **F01 SHA:** `af6374bd…` · **Build ID (F01):** `nCGzARPt2xhorwFPh1kKh`  
**Runner:** Noah (fixture/runtime) — không sửa `apps/portal` product code.

## Verdict

| Phạm vi | Kết luận |
| --- | --- |
| **Shell Owner sau OIDC (blocker PR #980)** | **PASS** @ `c8130ba` — matrix 390 / 1024 / 1440 (`uat-results.json`) |
| **F01 mobile Drawer** | **PASS** @ `af6374bd` — [`f01-drawer-mobile.json`](evidence/vcx-975/o26-pr2-noah/f01-drawer-mobile.json) |
| Locale / unsaved / logout (interactive) | **Inconclusive** — không đủ trigger hợp lệ; **không** claim regression sản phẩm |

**Verdict Noah:** `PASS` shell + F01; interactive gaps **inconclusive** (harness/Orca delivery).

## F01 — mobile Drawer (@ 390×844)

| Kiểm tra | Kết quả |
| --- | --- |
| `innerWidth` 390, trigger `portal-nav-trigger` | **PASS** — width ≈ 44.3px, height 32px (không zero-width overlap) |
| Desktop sider ẩn @ narrow | **PASS** — `siderVisible: false` |
| Drawer mở + menu | **PASS** — 5 items (Tổng quan tổ chức … Cấu hình), `aria-expanded=true` |
| PNG IHDR | **PASS** — `390×844` (`f01-drawer-open-390x844.png`) |
| Orca `click` trên trigger | **Không mở drawer** (`orcaClickOpensDrawer: false`) — chỉ ghi nhận automation; **không** fail F01 sản phẩm |

## Exact gaps (interactive — inconclusive)

Artifact: [`gap-probe-manual.json`](evidence/vcx-975/o26-pr2-noah/gap-probe-manual.json).

| ID | Kết luận |
| --- | --- |
| **G-975-LOCALE** | **Inconclusive** — menu/EN chưa chứng minh qua Orca AX; không assume product |
| **G-975-UNSAVED** | **Inconclusive** — `link_click` với `links=[]`, `confirmLog=[]` **không** chứng minh regression; cần dirty + tenant/event/sider nav thật |
| **G-975-LOGOUT** | **Inconclusive** — không dùng làm signal sản phẩm trong scope cuối |

## Stack

| Thành phần | Giá trị |
| --- | --- |
| Portal fixture | `http://uat975shell.localhost:3019` |
| API | `http://127.0.0.1:3542` (read-only reuse vcx932-noah) |
| OIDC client | `ticket-admin-web-vcx975-uat975shell` (riêng; không #928) |

Fixture gitignored: `.local-dev/.uat-artifacts/vcx975-noah-shell/` — **không commit**.

## Evidence packet

- [`uat-results.json`](evidence/vcx-975/o26-pr2-noah/uat-results.json) + `owner-shell-*.png`
- [`f01-drawer-mobile.json`](evidence/vcx-975/o26-pr2-noah/f01-drawer-mobile.json) + `f01-drawer-open-390x844.png`
- [`gap-probe-manual.json`](evidence/vcx-975/o26-pr2-noah/gap-probe-manual.json)
- [`ports-orca.json`](evidence/vcx-975/o26-pr2-noah/ports-orca.json)

## Coordinator

- **Blocker PR2 shell:** không.
- **Không** retest / evidence trên `2f233667` trong phiên Noah.
