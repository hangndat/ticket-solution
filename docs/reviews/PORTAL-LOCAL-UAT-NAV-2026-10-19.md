# Portal local UAT — nav groups (signed-in)

| Field | Value |
| --- | --- |
| **Runner / session** | Sora · uat · `task_d82300dfe9cc` |
| **Target** | LOCAL only (`http://127.0.0.1:3013`); not production launch go/no-go |
| **Branch** | `hangndat/d1-portal-nav-groups` |
| **Commit SHA** | `52bc54e3fdcb7b757c893507db7917d80cee1f2c` (WIP uncommitted on same tip) |
| **Services** | portal `:3013`, api `:3100`, Keycloak `:8080`, web `:3000` (pre-running) |
| **Browser** | Orca embedded browser (`orca tab` / `snapshot` / `fill` / `click` / `screenshot`) |
| **Accounts** | Demo only: `staff@example.com` / `staff-demo`; L4 attempted `attendee@example.com` / `attendee-demo` |

## Case results

| Case | Verdict | Evidence |
| --- | --- | --- |
| **L1** Unauth `/` — spinner ends; Keycloak or staff login within ~20s | **PASS** | After `orca tab create --url http://127.0.0.1:3013/`, a11y landed on Keycloak `http://127.0.0.1:8080/realms/ticket/protocol/openid-connect/auth` (client `ticket-admin-web`, redirect `http://127.0.0.1:3013/api/auth/callback`). Screenshot: `apps/portal/.uat-artifacts/L1-keycloak-login.png` |
| **L2** Staff login — portal shell, not infinite spinner | **PASS** | Keycloak fill `staff@example.com` + `staff-demo` → `http://127.0.0.1:3013/onboarding/d9d9f001-0001-4000-8000-000000000001` with `Vemoki Portal` shell, onboarding “Thiết lập lần đầu”, org MFest context. Screenshot: `apps/portal/.uat-artifacts/L2-staff-onboarding-shell.png` |
| **L3** Grouped sider on event | **PASS** | Direct event URL `http://127.0.0.1:3013/t/d9d9f001-0001-4000-8000-000000000001/e/d9d9f001-0002-4000-8000-000000000001` (MFest · Demo). Sidebar a11y shows Ant Design groups: **“Tổ chức này”** (Tổng quan tổ chức, Sự kiện, …), **“MFest · Demo”** (Tổng quan, Cổng, Nhật ký & mã, Hỗ trợ), **“Thiết lập sự kiện”** (Chuẩn bị, Loại vé, …). Screenshot: `apps/portal/.uat-artifacts/L3-grouped-sider-mfest-event.png` |
| **L4** Attendee deny (optional) | **BLOCKED** | After `/api/auth/logout` → `/auth` → staff OIDC, `fill`/`click`/`type`+Enter for `attendee@example.com` did not leave Keycloak login (no deny/CTA surface observed in a11y tree within session). No screenshot of expected deny state. |

## Notes

- Closes prior DoD gap: **signed-in grouped sider** on MFest demo event (L3).
- Screenshots under `apps/portal/.uat-artifacts/` (gitignored); paths cited above for review.
- No code changes, commits, deploys, or `.env` contents recorded.

## Local UAT verdict

| Scope | Verdict |
| --- | --- |
| L1–L3 (required) | **PASS** (L3 provides grouped-nav proof) |
| L4 (optional) | **BLOCKED** (attendee OIDC submit not completed in embedded browser) |
