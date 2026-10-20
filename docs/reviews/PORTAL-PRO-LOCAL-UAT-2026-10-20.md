# Portal Pro — local UAT (ProLayout revamp)

| Field | Value |
| --- | --- |
| **Runner / session** | Sora · launch-uat · `task_66c8b72790bd` |
| **Issue** | [#581](https://github.com/hangndat/ticket-solution/issues/581) |
| **Target** | `http://127.0.0.1:3013` (portal dev); API `http://127.0.0.1:3100` (Nest responding) |
| **Branch / SHA (worktree)** | `hangndat/d1-portal-pro` · `661a4979394598982caff892e05f1933b0d26263` |
| **Handoff** | `docs/design/PORTAL-PRO-REVAMP.md` |
| **Browser** | Orca embedded (`orca tab` / `orca goto` / `orca snapshot` / `orca fill` / `orca click` / `orca eval`); `--page` `134ff125-76e1-42ba-bf08-4f059c1eafc2` |
| **Account** | `staff@example.com` / `staff-demo` (credentials not logged) |

## Preconditions

- Portal HTTP `200` on `:3013`.
- API `:3100` alive (JSON 404 on unknown routes; not treated as dead).
- No `.env` changes; no tokens printed.

## Case results

| # | Scenario | Verdict | Evidence |
| --- | --- | --- | --- |
| **1** | Logout → staff login → shell; no «Không kết nối được máy chủ» | **PASS** | `Đăng xuất portal` from account menu → `/auth`. `goto` `/api/auth/login?return=/` → Keycloak `:8080`. Fill staff demo user; form submit → `http://127.0.0.1:3013/onboarding/d9d9f001-0001-4000-8000-000000000001`. `eval`: `hasServerErr: false`. Shell: `Vemoki Portal`, org/event switchers, `Tài khoản ▾`. |
| **2** | Open MFest tenant + Demo event | **PASS** | `goto` `http://127.0.0.1:3013/t/d9d9f001-0001-4000-8000-000000000001/e/d9d9f001-0002-4000-8000-000000000001` — title `Vemoki Portal`, header `MFest (mfest-demo)` / `MFest · Demo`, overview content loaded (publish readiness + O12 report). |
| **3** | ProLayout nav groups: Tổ chức này · event name · Thiết lập sự kiện | **PASS** | `eval` ProLayout present (`ant-pro-layout`). Sider was collapsed (initials only); expand via `ant-pro-sider-collapsed-button` click. `innerText` includes `Tổ chức này`, `MFest · Demo`, `Thiết lập sự kiện`. |
| **4** | Event overview: PageContainer, StatisticCard or Check-in OK, ProTable/ProForm per handoff | **PASS** | URL as above. `eval`: `ant-pro-page-container` true; StatisticCard class true; `Check-in OK` metric `0`. Handoff §3 maps event overview to **PageContainer + StatisticCard.Group** (not ProTable/ProForm on this route) — no ProTable/ProForm required here. Sample copy: `Báo cáo nhanh (O12)`, `Capacity` `50`, `Quota allocated` `0`, readiness list `Loại vé: ok`, etc. |

## Notes

- Keycloak `orca click` on «Sign In» did not navigate; `eval` form button click completed OIDC callback (automation quirk, not product defect).
- Collapsed ProLayout sider hides group labels until expand — document for future UAT scripts.

## Verdict (this run)

| Scope | Verdict |
| --- | --- |
| Cases 1–4 | **PASS** — local Pro shell + MFest demo event overview after revamp |
| Launch GO/NO-GO | **N/A** — local verification only, not full `PROD-LAUNCH-UAT` catalog |
