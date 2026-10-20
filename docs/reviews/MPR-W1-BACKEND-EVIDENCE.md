# MPR-W1 Backend — owner wallet aggregate evidence

| Field | Value |
| --- | --- |
| Issue | [#580](https://github.com/hangndat/ticket-solution/issues/580) / W1 `WS-BE-ME-TICKETS-AGGREGATE` |
| Branch | `hangndat/mpr-w1-owner-wallet` |
| Scope | `apps/api/**`, `packages/backend/**` |
| Reviewer | _(pending — independent session)_ |

## Contract handoff (API consumers)

- **`GET /v1/me/tickets`** — Bearer required. **`tenantId` query optional** (valid UUID when present).
- **Omit `tenantId`:** returns all `TicketSummary` rows for the authenticated owner (`owner_user_id` from OIDC mapping), **any tenant**. Each row includes its real `tenantId`.
- **`?tenantId=<uuid>`:** unchanged per-tenant listing (web compat).
- **Errors:** `401` unauthenticated; `422` `INVALID_TENANT` for malformed/non-empty invalid UUID; `503` when DB/issue deps missing.
- **Shape:** `MeTicketsResponse` / `TicketSummary` unchanged (no new paging fields).
- **Mobile:** may call `GET /v1/me/tickets` without `tenantId` after W1 deploy; no `EXPO_PUBLIC_TENANT_ID` required for wallet fetch.

## Implementation

- API: optional `tenantId` on `TicketIssueController.meTickets`; aggregate path uses `listOwnerTicketsAggregated`.
- Backend: `listAllTicketsForOwner` + `withActor` (`app.actor_id` GUC); parameterized `owner_user_id` filter.
- Migration `202610201200_mpr_w1_owner_tickets_aggregate`: `tickets_owner_actor_select` **FOR SELECT** on `ticket_runtime` only (mutations still `tickets_isolation` + `withTenant`).

## Deploy prerequisite

- Run migration **`202610201200_mpr_w1_owner_tickets_aggregate`** before enabling mobile aggregate calls in prod.

## Tests run (local)

```text
packages/backend: node --test test/me-tickets-aggregate.test.cjs  (PASS)
packages/backend: node --test test/rls-catalog.test.cjs  (PASS — tickets_owner_actor_select SELECT-only + tickets_isolation tenant)
apps/api: pnpm test  (PASS, incl. test/me-tickets.test.cjs)
```

## Exact SHA

`435d00a557e78808daa01dd4c2044366e5c3adbc`

## CI

_(coordinator: `./scripts/gh-dod-evidence.sh <pr>` after PR open)_

## Security notes

- No `BYPASSRLS`; cross-tenant read only when `app.actor_id` matches `owner_user_id` (set from verified bearer, not query).
- RLS isolation test: user B cannot list user A tickets via aggregate path.

## ADR

No new trust boundary beyond existing `withActor` + OIDC mapping (TD §5.3 / ARCHITECTURE §6). No ADR draft required unless coordinator wants explicit W1 amendment entry.
