# O26-PR2 — Portal app shell composition (#975)

**Worker:** Higo (web) · **Slice:** O26-PR2 · **Epic:** #914 · **PR1:** #977 merged  
**Base:** `0fcda837765a049f01ae28d362eaa9f33a091980`

## Thay đổi

- Gỡ `portal-pro-layout.tsx` (ProLayout); không còn import ProLayout trong shell.
- `portal-shell.tsx` = composition root: antd `Layout` / `Header` / `Sider` / `Menu` / `Content`, account `Dropdown` (VI/EN, logout), context strip (tenant/event + unsaved guard), dual-run `Alert`, trạng thái tenant SUSPENDED/PENDING.
- Xóa wrapper hết caller: `portal-context-strip.tsx`, `dual-run-banner.tsx`.
- `portal-menu-keys.ts`: type menu antd (`PortalMenuGroup` / `PortalMenuLeaf`), bỏ `MenuDataItem` Pro.

**Không đụng:** BFF/OIDC/API, permissions business, theme/token mới, PR3+ / #928.

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
| **codeSha** | `0b49115e5aea17a6e8df95ae554d5d401d1fa961` |
| **evidenceSha** | `0b49115e5aea17a6e8df95ae554d5d401d1fa961` |

## Verdict worker

**Code complete** cho O26-PR2; **acceptance** chờ reviewer + shell DOM sau session OIDC đầy đủ (hoặc persona fixture không MFA).
