# B-PORTAL-THEME + B-PORTAL-FORMS — finding status

| ID | Status | Notes |
| --- | --- | --- |
| DS-PORTAL-01 | Fixed | `colorPrimary` → `#7C4DED` in `vemoki.ts` |
| DS-PORTAL-02 | Fixed | ink/paper/muted/line → portal-antd-theme enterprise values + root vars |
| DS-PORTAL-03 | Fixed | `Button.borderRadius` → 12 |
| DS-PORTAL-04 | Fixed | `PortalAuthTemplate` + `.portal-auth-page` (no inline card margin) |
| DS-PORTAL-05 | Kept | `PortalDualRunBanner` Alert unchanged |
| DS-PORTAL-06 | Fixed | ops panels + platform filters use `portalFieldMin` density classes |
| DS-PORTAL-07 | Fixed | config defaults → `DEFAULT_TENANT_PRIMARY_COLOR` (`#E11D48`) |
| DS-PORTAL-08 | Fixed | onboarding/settings placeholders → `#E11D48` |
| DS-PORTAL-09 | Fixed | `readiness.test.ts` uses `DEFAULT_TENANT_PRIMARY_COLOR` |

Danger buttons: `colorError` `#B3213A` on theme token; `Button danger` unchanged (semantic red).

## VD10-R chrome/a11y (batch 1/2)

| ID | Status | Notes |
| --- | --- | --- |
| VD10-R-01 | Fixed | Light alert tokens + `PortalContentTheme` (undo ProLayout darkAlgorithm on ops surfaces) |
| VD10-R-02 | Fixed | Global header brand lockup ink (`--vemoki-ink`) |
| VD10-R-03 | Fixed | Auth primary shadow/border artifact removed |
| VD10-R-04 | Fixed | Full page title @ 1440; ellipsis+tooltip on narrow via `PortalPageTitle` |
