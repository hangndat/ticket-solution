# Portal production UAT — nav groups (post-deploy)

| Field | Value |
| --- | --- |
| **Runner / session** | Sora · uat · `task_f699737c3bfb` |
| **Target** | Production only (`https://portal.vemoki.com`); not local |
| **Branch / SHA (worktree)** | `hangndat/d1-portal-nav-groups` · `52bc54e3fdcb7b757c893507db7917d80cee1f2c` |
| **Catalog** | `docs/plans/PROD-LAUNCH-UAT.md` · content hash `65848b8576727bf9b77def036550426e1e73359d` |
| **Browser** | Orca embedded (`orca tab` / `orca exec`); `--page` `7d2892e7-d3fc-44a4-838f-0ab7fda088ad` |
| **Accounts** | Demo only: `staff@example.com` / `staff-demo`; P4 attempted `attendee@example.com` / `attendee-demo` |

## Case results

| Case | Verdict | Evidence |
| --- | --- | --- |
| **P1** Unauth `/` — spinner ends; Keycloak/auth login within ~30s | **PASS** | `orca tab create --url https://portal.vemoki.com/` redirected to `https://auth.vemoki.com/realms/ticket/protocol/openid-connect/auth` (client `ticket-admin-web`, redirect `https://portal.vemoki.com/api/auth/callback`). HTTP root `200` (nginx). Screenshot: `apps/portal/.uat-artifacts/prod-nav-2026-10-19/P1-keycloak-login.png` |
| **P2** Staff login → portal shell without infinite spinner | **PASS** | Keycloak fill staff demo user → `https://portal.vemoki.com/t/26c16ee9-1472-440e-98f2-de50d23aa938` with `Vemoki Portal` shell, org context (Aurora Night Org), sidebar group **“This organization”** with menu items. Screenshot: `apps/portal/.uat-artifacts/prod-nav-2026-10-19/P2-staff-portal-shell.png` |
| **P3** MFest · Demo event — grouped sidebar (not flat nav) | **PASS** | Event URL `https://portal.vemoki.com/t/d9d9f001-0001-4000-8000-000000000001/e/d9d9f001-0002-4000-8000-000000000001`. A11y sidebar shows three Ant Design groups: **“This organization”** (org nav), **“MFest · Demo”** (Overview, Gate, Audit & codes, Support), **“Event setup”** (Setup, Ticket types, …). Equivalent to expected VI labels `Tổ chức này` / event name / `Thiết lập sự kiện` under prod EN locale. Screenshot: `apps/portal/.uat-artifacts/prod-nav-2026-10-19/P3-grouped-sider-mfest-event.png` |
| **P4** Attendee deny on portal (optional) | **BLOCKED** | After `/api/auth/logout` → `/auth`, `goto /` → Keycloak; `fill`/`click`/`press Enter` for `attendee@example.com` did not leave Keycloak login (no portal deny surface observed in a11y within session). |

## Drift

- Prod UI strings for nav groups are **English** (`This organization`, `Event setup`); local UAT used Vietnamese group titles for the same structure. Behavior matches grouped nav deploy intent; not flat legacy sider.

## Notes

- No code changes, deploys, or `.env` contents recorded.
- Screenshots under `apps/portal/.uat-artifacts/prod-nav-2026-10-19/` (gitignored).

## Portal nav UAT verdict (this run)

| Scope | Verdict |
| --- | --- |
| P1–P3 (required) | **PASS** — grouped nav on MFest demo event in production |
| P4 (optional) | **BLOCKED** — attendee OIDC/deny not demonstrated in embedded browser |

This artifact covers **portal nav post-deploy** only; it is not a full production launch `GO`/`NO-GO` across the entire `PROD-LAUNCH-UAT` catalog.
