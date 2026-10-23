# PR #844 — Platform Operator mutate (portal)

| Field | Value |
| --- | --- |
| Issue | [#844](https://github.com/hangndat/ticket-solution/issues/844) |
| Branch | `hangndat/portal-844-platform-mutate` |
| Evidence SHA | _(filled after commit — `git rev-parse HEAD` on tip)_ |

## Parity (G-791-2/3) — `apps/web` → `apps/portal`

| Action | Web BFF | Portal BFF (this PR) | Portal UI |
| --- | --- | --- | --- |
| POST tenant provision | `POST /api/bff/platform/tenants` | `POST /api/bff/platform/tenants` | Tab **Provision** |
| GET tenant detail | `GET …/tenants/[tenantId]` | `GET …/tenants/[tenantId]` | Tab **Manage** |
| POST suspend/activate | `POST …/status` | `POST …/status` | **Manage** + `Modal.confirm` |
| PUT limits/flags | `PUT …/limits` | `PUT …/limits` | **Manage** form |
| POST support grant create | `POST /api/bff/platform/support-grants` | `POST /api/bff/platform/support-grants` | Tab **Grant create** |
| GET tenants list (existing) | GET | GET | Tab **Tenants** |
| Revoke grant (portal-only) | — | POST `…/revoke` | Tab **Revoke** |

## Automated checks (portal)

```bash
cd apps/portal && pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

## UAT (local Operator / headless)

**Script:** `node apps/portal/scripts/pr844-platform-uat.mjs` (after `./scripts/fe-uat-stack.sh bootstrap`, API `:3001`, portal `:3013`).

**Blocked (2026-10-23):** Keycloak `ticket-platform-web` browser flow fails before login form (`AuthenticationFlowException` / `LOGIN_ERROR` `invalid_user_credentials` on authorize GET). `ticket-admin-web` authorize shows login form; platform operator DB bootstrap for `staff@example.com` succeeded (`bootstrap_ok`). **Cannot complete Operator MFA session** without coordinator Keycloak flow fix or realm re-apply.

**Partial artifact:** `docs/reviews/assets/PR844/00-platform-unsigned.png` (unsigned `/platform` shell).

**Follow-up:** Re-run UAT after platform browser flow healthy; capture distinct PNG per mutate action + axe serious/critical = 0 (`reducedMotion`).
