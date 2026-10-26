# O26-PR2 — Portal app shell composition (#975)

**Worker:** Higo (web) · **Slice:** O26-PR2 · **Epic:** #914 · **PR1:** #977 merged  
**Base:** `0fcda837765a049f01ae28d362eaa9f33a091980`

## Thay đổi

- Gỡ `portal-pro-layout.tsx` (ProLayout); không còn import ProLayout trong shell.
- `portal-shell.tsx` = composition root: antd `Layout` / `Header` / `Sider` / `Menu` / `Content`, account `Dropdown` (VI/EN, logout), context strip (tenant/event + unsaved guard), dual-run `Alert`, trạng thái tenant SUSPENDED/PENDING.
- Xóa wrapper hết caller: `portal-context-strip.tsx`, `dual-run-banner.tsx`.
- `portal-menu-keys.ts`: type menu antd (`PortalMenuGroup` / `PortalMenuLeaf`), bỏ `MenuDataItem` Pro.
- **F01 (Mira #980):** viewport ≤1023px → `Drawer` (`getContainer={document.body}`, `size={240}`, `push={false}`, `portal-shell-nav-drawer`) + Header trigger. **Visual @ `e61986a9`:** rc-motion kẹt `translateX(-240)` dù open — CSS scoped `.ant-drawer-open > .ant-drawer-content-wrapper { transform: translate3d(0)!important }` + mask opacity. **Chỉ PASS khi Noah `visibleClickableMenuItems` > 0.**

**Không đụng:** BFF/OIDC/API, permissions business, theme/token mới, PR3+ / #928.

**UAT Noah (trước F01):** `docs/reviews/evidence/vcx-975/o26-pr2-noah/uat-results.json` @ `c8130ba7` — shell matrix PASS; F01 cần re-probe `portal-nav-trigger` + mở drawer tại 390/1024.

## Checks (local)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/portal lint` | PASS |
| `pnpm --filter @ticket/portal typecheck` | PASS (sau `pnpm --filter @ticket/contracts build` + `@ticket/web-session build`) |
| `pnpm --filter @ticket/portal test` | PASS |
| `pnpm --filter @ticket/portal build` | PASS |

## UAT (Orca, fixture read-only)

- Stack: `./scripts/fe-uat-stack.sh bootstrap`; API `127.0.0.1:3001` (đã listen); portal `next start` `127.0.0.1:3013`.
- OIDC: `orca tab` → `/api/auth/login` → Keycloak `ticket-admin-web` **PASS**.
- Browser shell DOM (brand, context strip, sider): **chưa đo** — `staff@example.com` dừng ở Keycloak `CONFIGURE_TOTP` (fixture, không mutate realm).
- Viewport 390 / 1024 / 1440: screenshot OIDC/login flow; PNG IHDR `89 50 4E 47` **PASS** — `apps/portal/.uat-artifacts/vcx975-pr2/`.
- `pnpm uat:p4-oidc`: discovery **PASS**; `me_attendee` **FAIL** (fixture attendee /me — ngoài scope PR2).

## SHA

| Trường | Giá trị |
| --- | --- |
| **codeSha** | `6253e73b34d874ca7a2c1f844c9a68947a727ce2` (gồm F01 drawer) |
| **evidenceSha** | `6253e73b34d874ca7a2c1f844c9a68947a727ce2` |

## Verdict worker

**Code complete** cho O26-PR2; **acceptance** chờ reviewer + shell DOM sau session OIDC đầy đủ (hoặc persona fixture không MFA).
