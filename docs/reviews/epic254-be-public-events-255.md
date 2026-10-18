# Evidence — #255 BE public published events (ADR-19 / O15)

| Trường | Giá trị |
| --- | --- |
| Issue | [#255](https://github.com/hangndat/ticket-solution/issues/255) · Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| Branch | `hangndat/d254-backend-public-events` |
| Role | `backend` |
| Agent / session | Orca worker cursor · `task_5fc3edb85224` / `ctx_c56b54d0285c` |
| Tip SHA | `ef488742847a11d4823793cf0249a50a23f3414b` |

## Scope đã ship

- `GET /v1/public/tenants/{tenantSlug}/events` (cursor/limit)
- `GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}`
- `@ticket/contracts` `PublishedEventDetail` / `Summary` / `ListResponse`
- D9 `demo-seed` publish marketing config (hero/info/faq) — idempotent
- OpenAPI regenerated (`apps/api/openapi.json`)
- Docs: ADR-19, architecture, BA/Epic plan, Decision Log O15

## Checks

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/backend build
pnpm --filter @ticket/api build
pnpm --filter @ticket/api openapi
pnpm --filter @ticket/api exec node --test test/health.test.cjs
pnpm --filter @ticket/backend exec node --test test/published-events.test.cjs
pnpm --filter @ticket/backend exec node --test test/demo-seed-unit.test.cjs
```

Kết quả: **PASS** (health OpenAPI paths gồm public; DB test: seed 200 list/detail + 404 unpublished/unknown).

## Fail-closed

- Unknown tenant / draft unpublished / wrong slug → `null` → Nest **404**
- Không lộ `contentStatus` / `revision` trên projection

## Non-goals còn lại

- Consumer web/iOS rewrite, deploy prod, CDN
