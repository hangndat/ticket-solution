# Portal Pro — production UAT (post Enton deploy)

| Field | Value |
| --- | --- |
| **Runner / session** | Sora · launch-uat · `task_104800db8e55` |
| **Issue** | [#581](https://github.com/hangndat/ticket-solution/issues/581) |
| **Target** | `https://portal.vemoki.com` (production, post Enton deploy) |
| **Branch / SHA (worktree)** | `hangndat/d1-portal-pro` · `661a4979394598982caff892e05f1933b0d26263` |
| **Handoff** | `docs/design/PORTAL-PRO-REVAMP.md` |
| **Browser** | Orca embedded (`orca tab` / `orca exec`); `--page` `78f2af1a-527d-4b4b-b0b8-294f105f62ee` |
| **Account** | `staff@example.com` / staff-demo password (credentials not logged) |

## Preconditions

- No app or realm changes during UAT.
- No cookies, tokens, or `.env` contents recorded.
- Gate camera flow **out of scope** (not exercised).

## HTTP smoke (no session)

| URL | Result |
| --- | --- |
| `https://portal.vemoki.com/` | `200` (nginx); unauthenticated flow redirects to Keycloak `auth.vemoki.com` |
| `https://ancafe.anphong.vn/` | `200` (no login required) |

## Case results

| # | Scenario | Verdict | Evidence |
| --- | --- | --- | --- |
| **1** | Staff demo login on prod Keycloak → portal shell | **PASS** | `orca tab create --url https://portal.vemoki.com/` → Keycloak sign-in. Fill staff demo user; submit → `https://portal.vemoki.com/t/26c16ee9-1472-440e-98f2-de50d23aa938` (Aurora Night Org). Shell: `Vemoki Portal`, org/event switchers, `Account ▾`. No «Không kết nối được máy chủ» observed. |
| **2** | ProLayout shell + grouped sider (org / event / setup) | **PASS** | `goto` MFest event URL (case 3). `eval`: `.ant-pro-layout` **true**. Sider groups T / M / E; expand shows three menus: org nav (Organization overview, Events, …), event nav (**Overview**, Gate, Audit & codes, Support), setup nav (Setup, Ticket types, …). Matches grouped Pro nav intent (prod EN labels; cf. local VI UAT). |
| **3** | Open event → PageContainer + report metrics | **PASS** | `https://portal.vemoki.com/t/d9d9f001-0001-4000-8000-000000000001/e/d9d9f001-0002-4000-8000-000000000001` — title `Vemoki Portal`, header `MFest (mfest-demo)` / `MFest · Demo`. `eval`: `.ant-pro-page-container` **true**. **Quick report (O12)** visible: Quota allocated `11`, Capacity `50`, Pending approval `0`, Check-in OK `11`; publish readiness list (Ticket types: ok, …). Screenshot: `apps/portal/.uat-artifacts/prod-pro-2026-10-20/event-overview.png` (gitignored). |
| **4** | Legacy ancafe site reachable | **PASS** | `curl -sI -L https://ancafe.anphong.vn/` → HTTP `200`. |

## Notes

- MeEvents **Open** link on Aurora org home did not navigate in embedded browser during this run; MFest · Demo deep link used for event overview (same staff session, prod data).
- Collapsed ProLayout sider shows group initials until expand — same automation quirk as local UAT.

## Verdict (this run)

| Scope | Verdict |
| --- | --- |
| Portal Pro prod UAT (#581) | **PASS** — `https://portal.vemoki.com` |
| Launch GO/NO-GO (full catalog) | **N/A** — scoped Portal Pro smoke only |
