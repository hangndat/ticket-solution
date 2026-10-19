# Portal Pro — local UAT (openKeys + locale VI fix)

| Field | Value |
| --- | --- |
| **Runner / session** | Sora · launch-uat · `task_da2ec22cf770` |
| **Issue** | [#583](https://github.com/hangndat/ticket-solution/issues/583) · [#584](https://github.com/hangndat/ticket-solution/issues/584) |
| **Target** | `http://127.0.0.1:3013` (portal dev); API `http://127.0.0.1:3100` (unchanged, alive) |
| **Branch / SHA** | `hangndat/d1-portal-pro` · `c3adcbde4e87f82e271b6319f198914d9661d899` |
| **Browser** | Orca embedded (`orca goto` / `orca eval` / `orca snapshot` / `orca fill`); `--page` `134ff125-76e1-42ba-bf08-4f059c1eafc2` |
| **Account** | `staff@example.com` / `staff-demo` (credentials not logged) |
| **Locale** | `localStorage.vemoki_portal_locale=vi` before login |

## Preconditions

- Portal restarted on `:3013` after tip SHA (`orca terminal create` · title `portal-3013-uat`) so dev server is not killed by agent shell timeout.
- API `:3100` left running (Nest responding).
- Logout via `/api/auth/logout` before login; no `.env` changes; no tokens printed.
- Sider: Orca pane ~991px (`breakpoint=lg`); expanded via `ant-pro-sider-collapsed-button` PointerEvent before menu assertions.

## Case results

| # | Scenario | Verdict | Evidence |
| --- | --- | --- | --- |
| **1** | Tổng quan tổ chức: nhóm «Tổ chức này» expanded, không chỉ chữ «T» | **PASS** | `/t/d9d9f001-0001-4000-8000-000000000001`. After sider expand: `eval` → `title: "Tổ chức này"`, `expanded: true`, children `Tổng quan tổ chức`, `Sự kiện`, … `snapshot`: `menuitem "Tổ chức này" [expanded=true]`. |
| **2** | Mở sự kiện → guests: nhóm chứa «Khách & mã» expanded, item được chọn (không bấm mở nhóm) | **PASS** | Direct `/t/…/e/…/guests` (MFest · Demo). `eval` → `Thiết lập sự kiện` `expanded: true`, `selected: ["Khách & mã"]`, `pass: true`. `nav-event-run` («MFest · Demo») collapsed by design when route is setup (`portal-menu-keys.test.ts`). |
| **3** | Không còn chuỗi lỗi i18n/legacy (MeEvents, «quyền server», Quota allocated, Guest invitations, dispatch, CODES, ACCEPTED, DELIVERED) trên các trang kiểm | **PASS** | `eval` body scan on org overview, event overview, guests, gate → `found: []` each. |

## Notes

- First portal restart via background agent shell exited at ~120s (SIGKILL); durable `orca terminal` used for UAT remainder.
- Keycloak login: `fill` + `form.requestSubmit()` (Sign In click quirk documented in prior portal UAT).
- Collapsed sider (64px) can show a11y label «T» until expand control is activated; post-expand assertions use full «Tổ chức này».

## Verdict (this run)

| Scope | Verdict |
| --- | --- |
| Cases 1–3 (#583 #584 local) | **PASS** |
| Launch GO/NO-GO | **N/A** — local verification only |
