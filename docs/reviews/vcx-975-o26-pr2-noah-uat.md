# VCX-975 O26-PR2 — Final UAT (Noah · fixture)

**Ngày:** 26/10/2026 · **Issue:** [#975](https://github.com/hangndat/ticket-solution/issues/975) · **PR:** [#980](https://github.com/hangndat/ticket-solution/pull/980)  
**Code SHA (canonical):** `af6374bd06b19469cd3e2454819b28f9a6785404` · **Build ID:** `5xdXYoXU-ia30CkqQ01hM`  
**Branch:** `hangndat/vcx-975-antd-shell` · **Higo product edits:** done (Drawer header trigger + CSS zero-width overlay hide).

**Supersedes:** pre-F01 shell matrix @ `c8130ba` và evidence PNG `owner-shell-*` — verdict cuối lấy từ [`final-uat-af6374.json`](evidence/vcx-975/o26-pr2-noah/final-uat-af6374.json).

## Final verdict

**`PASS with known gap`** @ `af6374bd`

| Phạm vi | Kết quả |
| --- | --- |
| Authenticated shell @ 390 / 1024 / 1440 | **PASS** — `#portal-main`, context strip, tenant/event switchers; PNG IHDR khớp |
| F01 mobile @ 390 — Drawer + context | **PASS** — header trigger; `zeroWidthTriggerVisible: false`; drawer mở (native click) |
| Drawer → nav (analytics) | **Inconclusive** — eval `link.click()` trong drawer không đổi route (harness); mở drawer + menu items OK |
| Unsaved + **tenant switch** | **Inconclusive** — fixture **1** tenant selectable; không đổi giá trị tenant → `confirm` không quan sát được |
| Orca automation | **Giới hạn** — xem § Selector limits |

## Viewport matrix (final)

| Viewport | Mode | Pass | Ghi chú |
| --- | --- | --- | --- |
| 390×844 | Drawer | ✅ | `portal-nav-trigger`; không desktop sider; không zero-width overlay |
| 1024×900 | Sider | ✅ | `desktopSider`; không drawer trigger |
| 1440×900 | Sider | ✅ | Cùng 1024 |

Screenshots: `final-shell-390x844.png`, `final-shell-1024x900.png`, `final-shell-1440x900.png`.

## Selector limits (ghi thật)

1. **`orca click [data-testid=portal-nav-trigger]`** — `orcaClickOpensDrawer: false` dù `ok: true`; **native** `HTMLElement.click()` mở drawer (`nativeClickOpensDrawer: true`).
2. **`orca click` tenant `.ant-select-selector`** — mở dropdown (`orcaOpenTenant.ok`); fixture chỉ 1 tenant → không test đổi tenant.
3. **Account dropdown / locale** — không retest trong lượt final; gap trước vẫn **inconclusive**, không assume product.

## Stack

`http://uat975shell.localhost:3019` + API `127.0.0.1:3542` (read-only vcx932-noah) · OIDC `ticket-admin-web-vcx975-uat975shell` · Owner fixture (TOTP private, không commit).

Fixture: `.local-dev/.uat-artifacts/vcx975-noah-shell/` (gitignored).

## Artifacts

| File | Mô tả |
| --- | --- |
| [`final-uat-af6374.json`](evidence/vcx-975/o26-pr2-noah/final-uat-af6374.json) | Packet canonical |
| [`uat-results.json`](evidence/vcx-975/o26-pr2-noah/uat-results.json) | Bản sao packet final |
| [`gap-probe-manual.json`](evidence/vcx-975/o26-pr2-noah/gap-probe-manual.json) | Interactive gaps — inconclusive |
| `f01-drawer-mobile.json` | Lịch sử F01 sớm (tham chiếu); superseded bởi final matrix |

## Coordinator

- **Blocker PR #980 shell/F01:** không.
- **Gap biết:** unsaved tenant-switch cần fixture ≥2 tenant hoặc event/sider nav probe riêng nếu Epic bắt buộc; drawer in-menu nav cần Orca ref/text click follow-up nếu cần automation proof.
