# O02 Web #371 — SiteNav capabilities + soft-redirect (UAT)

| Trường | Giá trị |
| --- | --- |
| Issue | [#371](https://github.com/hangndat/ticket-solution/issues/371) |
| Scope | `apps/web` only |
| Handoff | `docs/design/o02-permission-nav/` · consume MeEvents `staffEligible` (#377) |
| Checks | `pnpm --filter @ticket/web test` · `typecheck` · `lint` · `test:routes` · `node apps/web/tests/nav-o02-uat.mjs` |

## AC map

| AC | Evidence |
| --- | --- |
| SiteNav từ permissions/capabilities | `src/nav/capabilities.ts` + client load `GET /api/bff/me/events` + `/me/tenants` + `/platform/me`; deny-by-default guest links |
| Guest không thấy Admin/Cổng/Platform | Unit matrix + headless UAT home/redeem screenshots |
| Anonymous `/admin`\|`/gate` → `/auth` | Proxy HTTP 307 + `?next=` · routes.integration · UAT soft-redirect shots |
| Headless UAT | `apps/web/.uat-artifacts/o02-*.png` (gitignored) |

## Commands

```bash
pnpm --filter @ticket/web test
pnpm --filter @ticket/web run typecheck
pnpm --filter @ticket/web lint
pnpm --filter @ticket/web build && pnpm --filter @ticket/web test:routes
# with next start on :3462
node apps/web/tests/nav-o02-uat.mjs http://127.0.0.1:3462
# or: ./scripts/web-uat.sh nav-o02 http://127.0.0.1:3462
```

## Artifacts (local)

- `apps/web/.uat-artifacts/o02-nav-home-guest.png`
- `apps/web/.uat-artifacts/o02-nav-redeem-guest.png`
- `apps/web/.uat-artifacts/o02-soft-redirect-admin.png`
- `apps/web/.uat-artifacts/o02-soft-redirect-gate.png`

## Limitations

- Capability chrome for signed-in staff requires live Nest `GET /v1/me/events` (+ tenants); UAT here covers anonymous/guest deny-by-default + soft-redirect.
- Authenticated-without-capability soft-redirect to `/?notice=admin_denied|gate_denied` is implemented in RSC guards; not exercised in this anonymous UAT run.

## Tip SHA

`8f32333dc12001159e3cdc384808d7710b191236` (feat impl)

Branch tip tại PR: xem `git rev-parse HEAD` / PR tip SHA.
