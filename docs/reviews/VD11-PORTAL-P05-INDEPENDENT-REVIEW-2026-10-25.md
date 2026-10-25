# VD11 Portal P-F05 — Independent review (DoD + UX)

**Ngày:** 2026-10-25 · **Reviewer:** James (`dod+ux` · `reviewer-merged`) · **Employee:** james  
**Independence:** reviewer session ≠ implementer `hangndat <hangndat@gmail.com>` (commit `569243ed`)  
**Exact SHA (implementation):** `569243ed803bfe18f6bb56ef4f50731ea244c5b0` (`git rev-parse HEAD` @ `hangndat/vd11-portal-theme-release`)  
**Scope:** P-F05 Ant shell theme — `apps/portal/src/components/portal-content-theme.tsx`, `portal-pro-layout.tsx`, `apps/portal/src/theme/vemoki.ts` only. Cache tổ chức/sự kiện **không** có trong RC (user đã hủy).  
**Architecture impact:** Không · **Fix round:** initial review `0/2`

## Verdict (tách gate)

| Gate | Verdict | Ghi chú |
| --- | --- | --- |
| **DoD** | **PASS** | Scoped theme AC; checks xanh trên SHA; UAT OIDC độc lập + DOM computed colors (không chỉ worker self-check). |
| **UI/UX** | **PASS** | Popup tenant/event/account đọc được trên nền sáng; sider navy giữ; 390/1440 đo bằng Orca `set viewport`. |
| **Security** | **n/a** | Diff không đụng auth/BFF/secrets. |

## AC / regression (P-F05)

| AC | Kết quả | Proof |
| --- | --- | --- |
| Tenant/event Select popup readable (hover/selected/focus) | **PASS** | Popup `rgb(255,255,255)` + ink `rgb(23,32,57)`; selected/hover item `rgb(246,240,255)`; `--ant-color-bg-elevated` `#ffffff` trên event popup. Regression trước: `rgb(31,31,31)` / `#1f1f1f` — **không tái hiện**. |
| Account menu popup readable | **PASS** | Menu `rgb(255,255,255)`, item text `rgb(23,32,57)`; nút header account ink `rgb(23,32,57)`. |
| Sidebar giữ mẫu tối (navy) | **PASS** | `.ant-layout-sider` `rgb(11,16,39)` (`#0B1027`); menu item `rgb(255,255,255)` @ 1440; `navTheme="light"` + `menuProps.theme: 'dark'` + `token.sider` overrides. |
| Responsive 390 / 1440 | **PASS** (reviewer) | `set viewport 390 844` → `scrollWidth=390`, popup vẫn light; `1440×900` sider width 240px. |
| Reduced motion | **PASS** (code + partial runtime) | `providers.tsx` zero motion token khi `prefers-reduced-motion: reduce`; sider `motion: { motionName: undefined }`. Orca profile: `prefers-reduced-motion` = false (chưa emulate reduce trong tab). |

## Checks (exact SHA)

| Check | Kết quả |
| --- | --- |
| `pnpm --filter portal typecheck` | **PASS** |
| `pnpm --filter portal test` | **169/169 PASS** |
| `pnpm --filter portal build` | **PASS** (reviewer re-run) |
| `ui-evidence-check.sh` `docs/reviews/p05-uat-2026-10-25/` | **OK** (6 ảnh, không trùng nội dung) |

## Independent runtime (Orca)

- **Build served:** existing prod on `http://127.0.0.1:3334` (OIDC fixture API `3498`)
- **Profile:** `b520d43d-9c3a-4fd6-8251-84726661a16c`
- **Page:** `9a4ef8f7-d988-4404-b6e3-0d6bce46b10e` (đã đóng sau review)
- **Route:** `/t/d9d9f001-0001-4000-8000-000000000001` (Owner MFest)

### DOM computed colors (reviewer, không copy worker)

| Surface | Computed |
| --- | --- |
| Tenant Select popup | bg `rgb(255,255,255)`, color `rgb(23,32,57)`, item selected `rgb(246,240,255)` |
| Event Select popup | bg `rgb(255,255,255)`, elevated `#ffffff`, item `rgb(246,240,255)` / ink `rgb(23,32,57)` |
| Account menu | menu bg `rgb(255,255,255)`, items `rgb(23,32,57)` |
| Sider | bg `rgb(11,16,39)` |

### Evidence ảnh

| File | SHA256 (đầu) |
| --- | --- |
| Worker `p05-tenant-dropdown.png` | `520017db…` |
| Worker `p05-event-dropdown.png` | `86b6cf39…` |
| Reviewer `p05-reviewer-tenant-390.png` | (folder check OK) |
| Reviewer `p05-reviewer-event-dropdown.png` | |
| Reviewer `p05-reviewer-account-menu.png` | |
| Reviewer `p05-reviewer-shell-1440.png` | |

Ảnh worker khớp claim (popup sáng, chữ đọc được); reviewer tái đo DOM và chụp lại @ 390/1440.

## Code notes (569243ed)

- `PortalContentTheme`: `inherit: false`, `defaultAlgorithm`, `cssVar.key: portal-light-chrome`, spread `vemokiTheme` — đúng hướng Ant để không merge `realDark`/dark elevated từ ProLayout.
- `ProLayout`: `navTheme="light"` + `menuProps.theme: 'dark'` — tách popup sáng và sider tối qua token sider thay vì `realDark` toàn shell.
- `vemoki.ts`: thêm explicit `colorBgElevated: '#ffffff'`.

## Findings

| ID | Sev | Block merge | Vấn đề | Proof | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| *(none blocking)* | — | — | — | — | — |

### Non-blocking / follow-up

| ID | Sev | Block | Vấn đề | Proof | Đóng khi |
| --- | --- | --- | --- | --- | --- |
| **P05-R-F01** | nit | No | `getComputedStyle(.ant-layout-header).backgroundColor` trả `rgba(0,0,0,0)` dù token `colorBgHeader: #ffffff` — chỉ quan sát DOM API, UI screenshot vẫn nền sáng. | Eval @ 1440; `p05-reviewer-shell-1440.png` | Chỉ khi product muốn header bg explicit trên element (không bắt buộc P-F05). |
| **P05-R-F02** | low | No | Chưa emulate `prefers-reduced-motion: reduce` trong Orca tab (runtime flag false). | `providers.tsx` L19–40; eval `reducedMotion: false` | Probe với media emulate hoặc OS setting trong UAT follow-up. |

## Limitations

- Không push/PR/deploy (theo task).
- Lint repo-wide `portal-pro-layout` `react-hooks/set-state-in-effect` — pre-existing, không phát sinh từ diff theme `569243ed`.
- Worker pane ~731px trước reviewer; gap đã đóng bằng reviewer `set viewport` 390/1440.

## Tái hiện

```bash
cd /Users/admin/SideProject/ticket-solution/vd11-portal-theme-release
git checkout 569243ed803bfe18f6bb56ef4f50731ea244c5b0
pnpm --filter portal test && pnpm --filter portal build
# Portal prod :3334 + vd08 API + OIDC profile Owner (xem VD11-PORTAL-OIDC-UAT-2026-10-25.md)
orca tab create --url 'http://127.0.0.1:3334/t/d9d9f001-0001-4000-8000-000000000001' --profile <owner-profile> ...
```

**Kết luận reviewer:** **PASS** DoD + UX cho P-F05 trên SHA `569243ed` trong scope ba file theme; sẵn sàng coordinator tích hợp/deploy theo gate Epic (không tự merge từ task review-only).
