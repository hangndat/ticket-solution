# VD11 Portal — fix batch 1/2 (P-F03, P-F04)

**Worker:** Linh (web) · **Dispatch:** `ctx_3cdd8839194f` · **Fix round:** 1/2  
**Base:** `da30da437d9706f4fa713634b7bd1430338d6044` → **Commit SHA:** `40387f9b802918afcd48749826ac368748d3a7cc` (`git rev-parse HEAD`)  
**Scope:** `apps/portal/**` only · Architecture impact: Không

## Findings addressed

| ID | Before (integrated review) | After (Orca @3334 OIDC Owner) |
| --- | --- | --- |
| **VD11-P-F03** | `.ant-input` + affix-wrapper cùng `min-height: 44px` → wrapper **64px** @390 | Wrapper **44px**, inner input **24px** (AntD); `min-height` chỉ outer control + `.ant-btn:not(.ant-btn-sm)` |
| **VD11-P-F04** | Title **55.445px**, «Cấu ...», `scrollWidth−innerWidth=5` @390 config | Title **210px**, full text «Cấu hình / brand / xuất bản», `scrollWidth=innerWidth=390`; 1024/1440 overflow **0** |

## Thay đổi source

- `apps/portal/app/globals.css` — scope touch target; mobile `heading-left` column stack; table scroll containment; bỏ `overflow-x: clip` (theo coordinator).
- `apps/portal/src/components/portal-page.tsx` — bỏ `Typography.Text` ellipsis hẹp @mobile; dùng `.portal-page-title` + CSS wrap.
- `apps/portal/app/t/.../config/page.tsx` — `ProTable` `scroll={{ x: 'max-content' }}` để bảng version không đẩy ngang document @390.

## Checks (local)

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/portal test` | **169/169 PASS** |
| `pnpm --filter @ticket/portal build` | **PASS** |

## Runtime Orca (embedded, không Playwright)

- **URL:** `http://127.0.0.1:3334` · **Profile:** `4459607b-7e26-49f6-af3a-038c4e83176b` (Owner OIDC thật)
- **Routes:** config + types (tenant/event fixture review)
- **Viewport:** `set viewport 390|1024|1440 900` (bundled `/Applications/Orca.app/Contents/Resources/bin/orca`)
- **Ảnh:** `/tmp/vd11-linh-fix-assets/portal-config-390.png`, `portal-types-390.png` · `ui-evidence-check.sh` → **OK, không trùng**
- **Giới hạn:** Không có row rollback `ant-btn-sm` trên config snapshot hiện tại → chưa đo runtime small action height; CSS đã scope `:not(.ant-btn-sm)`.

## Verdict worker

**Code + runtime worker:** P-F03/P-F04 metrics đạt trên build đã restart :3334. **Acceptance độc lập** vẫn do James trên SHA commit mới (fix round 1/2, không tự PASS DoD tích hợp).
