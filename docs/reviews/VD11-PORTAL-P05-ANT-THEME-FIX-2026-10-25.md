# VD11 Portal P-F05 — Ant native theme fix (user decision 2026-10-25)

## Scope

- Issue: P-F05 shell dropdowns (tenant/event Select, account Menu) inherited ProLayout `realDark` elevated tokens (`--ant-color-bg-elevated` `#1f1f1f`, ink on dark popup).
- Change: Ant `ConfigProvider` light boundary with `inherit: false`, dedicated `cssVar.key`, explicit `colorBgElevated`; ProLayout `navTheme="light"` with `menuProps.theme: 'dark'` and existing `token.sider` brand overrides.
- Paths: `apps/portal/src/components/portal-content-theme.tsx`, `portal-pro-layout.tsx`, `apps/portal/src/theme/vemoki.ts`, `apps/portal/tests/portal-content-theme.test.ts`.

## Exact SHA

`376306abd77142819405545b03ad9fb6a313ea8e` (`git rev-parse HEAD` @ `hangndat/vd11-integration`)

## Checks (worker)

| Check | Result |
| ----- | ------ |
| `pnpm --filter portal test` | 192 pass (incl. `portal-content-theme.test.ts`) |
| `pnpm --filter portal typecheck` | pass |
| `pnpm --filter portal build` | pass |
| `pnpm --filter portal lint` (changed src only) | pass; repo-wide lint has pre-existing `portal-pro-layout` react-hooks warnings |

## Browser UAT (Orca, OIDC profile `b520d43d-9c3a-4fd6-8251-84726661a16c`, `:3334` prod build)

- Page: `26ad1f33-cc98-456d-bf81-6cd22bbb5700` @ `http://127.0.0.1:3334/t/d9d9f001-0001-4000-8000-000000000001`
- **Viewport limitation:** `innerWidth=731`, `dpr=2` (Orca pane); coordinator `setviewport` did not change `innerWidth` — 390/1440 width AC not re-measured on this dispatch.
- Tenant Select popup (computed): `backgroundColor rgb(255, 255, 255)`, `color rgb(23, 32, 57)`, selected `rgb(246, 240, 255)`, `--ant-color-bg-elevated` `#ffffff`.
- Event Select popup: same light elevated/ink/selected pattern.
- Account Menu: `menuBg rgb(255, 255, 255)`, item text `rgb(23, 32, 57)`.
- Sider: `.ant-layout-sider` `backgroundColor rgb(11, 16, 39)` (`#0B1027`).
- Screenshots: [p05-tenant-dropdown.png](./p05-uat-2026-10-25/p05-tenant-dropdown.png), [p05-event-dropdown.png](./p05-uat-2026-10-25/p05-event-dropdown.png).

## Worker self-check vs prior FAIL

Prior coordinator DOM: popup `rgb(31,31,31)`, elevated `#1f1f1f`. Post-fix DOM on same fixture: **light elevated** — worker self-check **not FAIL** on popup darkness.

## Limitations

- Independent reviewer ≠ implementer still required for DoD.
- No push/PR (per task).
- Full-width 390/1440 `innerWidth` not achieved in Orca embedded pane this run.
- Local `:3334` start required `OIDC_CLIENT_SECRET=dev-admin-web-secret-change-me` + `API_BASE_URL=http://127.0.0.1:3498` (fixture); not committed.

## Verdict (worker)

Implementation complete pending commit SHA; **recommend independent review** with screenshots + computed colors above.
