# VD11 Portal — org/event context cache (local)

| Field | Value |
| --- | --- |
| Task | `task_85c1efd9ecbd` — remember org/event for return visits |
| Scope | `apps/portal/src/context-cache/**`, `app/page.tsx`, `portal-shell.tsx` |
| Architecture impact | Không — local UI preference only |
| Base | `5f00dc9e` |

## Behavior

- `localStorage` key `portal:context:v1:{userId}` from `/api/bff/me/subject`; stores tenant UUID, per-tenant last event UUID, and `portalUsedTenants` (IDs only).
- Read after shell discovery; `validatePortalContextCache` requires ACTIVE staff membership and event in discovered list. Cache does not grant access.
- Home `/` uses `resolveHomeDestination`: valid cache → `/t/...` (with event when valid); else existing onboarding surfaces. `portalUsedTenants` skips first-run redirect when user already opened `/t/*`.
- Explicit routes: invalid `/t/{id}` stays denied (no cache redirect). Event clear and tenant switch persist via `persistPortalContextFromRoute`.
- `/onboarding` entry unchanged (explicit signup / server gates).

## Checks (worker)

```bash
pnpm --filter @ticket/portal test
pnpm --filter @ticket/portal typecheck
pnpm --filter @ticket/portal lint
```

## Limitations

- Worker unit tests only; no browser UAT on this dispatch. Acceptance requires independent reviewer + coordinator UAT on portal :3334 OIDC fixture.
- P-F05 theme untouched (parallel task).
