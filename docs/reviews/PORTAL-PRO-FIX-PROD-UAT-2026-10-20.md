# Portal Pro — production UAT (openKeys + locale VI fix)

| Field | Value |
| --- | --- |
| **Runner / session** | Sora · launch-uat · `task_679d97494120` |
| **Issue** | [#583](https://github.com/hangndat/ticket-solution/issues/583) · [#584](https://github.com/hangndat/ticket-solution/issues/584) |
| **Target** | `https://portal.vemoki.com` (production, post Enton deploy) |
| **Branch / SHA (worktree)** | detached HEAD · `d926669636746f62c599d03c14de3ac28d07bb50` |
| **Browser** | Orca embedded (`orca tab` / `orca exec` / `orca eval` / `orca goto`); `--page` `0ac0746a-5572-4b9f-9f5b-dfd1ab02b8c4` |
| **Account** | `staff@example.com` (staff-demo password; credentials not logged) |
| **Locale** | `localStorage.vemoki_portal_locale=vi` then navigate/reload |

## Preconditions

- No app, realm, or Keycloak changes during UAT.
- No cookies, tokens, or `.env` contents recorded.
- Gate camera flow **out of scope** (not exercised).
- Sider width &lt;992px: expand via `.ant-pro-sider-collapsed-button` `PointerEvent` before menu assertions.

## HTTP smoke (no session)

| URL | Result |
| --- | --- |
| `https://ancafe.anphong.vn/` | `200` (`curl` status only) |

## Case results

| # | Scenario | Verdict | Evidence |
| --- | --- | --- | --- |
| **1** | Tổng quan tổ chức: nhóm «Tổ chức này» expanded (không chỉ «T»); không «Sự kiện (MeEvents)» / «quyền server» | **PASS** | `https://portal.vemoki.com/t/d9d9f001-0001-4000-8000-000000000001` — after sider expand: snapshot `menuitem "Tổ chức này" [expanded=true]` with children `Tổng quan tổ chức`, `Sự kiện`, `Phân tích`, `Thành viên`, `Cấu hình`. `eval` body scan → `found: []` for MeEvents, quyền server, and legacy guest/dispatch tokens. |
| **2** | Sự kiện → guests: nhóm setup expanded, «Khách & mã» selected; không chuỗi Guest invitations / dispatch / CODES / ACCEPTED / DELIVERED lỗi | **PASS** | `https://portal.vemoki.com/t/d9d9f001-0001-4000-8000-000000000001/e/d9d9f001-0002-4000-8000-000000000001/guests` — sider expanded: `Thiết lập sự kiện` `aria-expanded=true`; `selected: ["Khách & mã"]`. Nhóm `MFest · Demo` collapsed on setup route (same as local UAT / `portal-menu-keys` intent). `eval` forbidden-string scan → `found: []`. |
| **3** | Legacy ancafe reachable | **PASS** | `https://ancafe.anphong.vn/` → HTTP `200`. |

## Notes

- Keycloak prod login: `fill` email/password + `click` Sign In → tenant landing OK.
- Collapsed ProLayout sider shows group initial «T» until expand control runs; post-expand labels are full VI strings.
- Page copy may still contain English fragments in staff-only tooling (e.g. «Dispatch preview», «invitations» in button labels); AC targets missing **i18n key** strings (`Guest invitations`, raw `CODES` / `ACCEPTED` / `DELIVERED`), not every English substring.

## Verdict (this run)

| Scope | Verdict |
| --- | --- |
| Cases 1–2 (#583 #584 prod fix) | **PASS** — `https://portal.vemoki.com` |
| Launch GO/NO-GO (full catalog) | **N/A** — scoped Portal Pro nav/locale fix |
