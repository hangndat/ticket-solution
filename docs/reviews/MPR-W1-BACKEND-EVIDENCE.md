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

`37ab7c6ae1c7bba0b687f11529ebdc175256223d`

## CI

_(coordinator: `./scripts/gh-dod-evidence.sh <pr>` after PR open)_

## Security notes

- No `BYPASSRLS`; cross-tenant read only when `app.actor_id` matches `owner_user_id` (set from verified bearer, not query).
- RLS isolation test: user B cannot list user A tickets via aggregate path.

## ADR

No new trust boundary beyond existing `withActor` + OIDC mapping (TD §5.3 / ARCHITECTURE §6). No ADR draft required unless coordinator wants explicit W1 amendment entry.

## Prod deploy — closes R-API-597

Deployed by coordinator (`gh-dod-evidence` + CI đã xanh trên PR #596 trước khi deploy, không phải trigger riêng cho #597 — xem history trên).

| Field | Value |
| --- | --- |
| Date | 2026-10-20 |
| Prod SHA (main tip) | `c4057c6861a265d3d63e935739d01bdc34f38bb9` |
| Services | `migrate` (áp `202610201200_mpr_w1_owner_tickets_aggregate` + 1 migration tồn đọng `202610200001_mpr_platform_published_catalog`), `api` (rebuild + restart), `worker` (restart — dùng chung `packages/backend` dist) |
| Migrate | `docker logs vemoki-migrate-1` → "All migrations have been successfully applied" (exit 0) |
| Verify | `GET https://api.vemoki.com/v1/health` → `{"status":"ok"}`; `GET /v1/me/tickets` không auth → `401` (không `500`/misconfig) |
| Containers sau deploy | api/worker/web/portal/keycloak/postgres/mailpit/minio đều `Up`/`healthy` |

**Known gap không liên quan #597 (không fix trong lượt này):** worker log lặp `account_deletion_tombstone_keyring_missing` — thiếu keyring env cho tombstone feature khác, tồn tại từ trước, không phải regression của #597.

Sau deploy này: **R-API-597 đóng** — owner wallet aggregate API đã sống trên prod. Pilot-ready tổng thể #596/#597 không còn blocker đã biết từ phía backend; UAT ví owner trên device vẫn cần một lượt riêng nếu muốn claim.
