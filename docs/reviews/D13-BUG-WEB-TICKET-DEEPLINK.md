# D13 — Bug web ticket deeplink (owner email link)

**Slice:** `apps/web` only  
**Role:** `web`  
**Architecture impact:** Có — route owner ticket view trên product host khớp `buildOwnerTicketLink`  
**Branch:** `hangndat/d13-bug-web-ticket-deeplink`

## Vấn đề

Email CS / ticket-issued dùng `buildOwnerTicketLink` →  
`https://app.vemoki.com/t/{tenantSlug}/tickets/{ticketId}`.  
Web chỉ có `/t/[tenantSlug]/events/[eventSlug]` → Next `not-found` với copy «Không tìm thấy tổ hợp tenant và sự kiện».

## Việc đã làm

| Hạng mục | Chi tiết |
| --- | --- |
| Route | `apps/web/app/t/[tenantSlug]/tickets/[ticketId]/page.tsx` |
| BFF | `GET /api/bff/tickets/[ticketId]?tenantSlug=` → `GET /v1/me/tickets/{id}?tenantSlug=` |
| Auth gate | Proxy soft-redirect anonymous → `/auth?next=…`; page `redirect` nếu thiếu session; `sanitizePostLoginPath` allow pattern; AuthSession wire `next`→`return` |
| Fail-closed UX | Missing/forbidden/invalid → «Không tìm thấy vé» (không lộ PII; không dùng copy event 404) |
| Loader | `apps/web/src/owner-ticket/*` — Nest owner detail, slug match khi BE echo `tenantSlug` |

## Checks

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web exec tsx --test tests/owner-ticket.test.ts
pnpm --filter @ticket/web build
pnpm --filter @ticket/web test:routes
```

- Unit `owner-ticket.test.ts`: PASS (7)
- `next build`: PASS — route `/t/[tenantSlug]/tickets/[ticketId]` + BFF listed
- `test:routes`: PASS — anonymous deeplink HTTP **307** → `/auth?next=…/tickets/…` (≠ HTML not-found cho path)

## Known gap (BE song song)

TD §10: `GET /me/tickets/{id}` Owner. Nest **chưa** có endpoint trên `main` lúc web PR; coordinator spawn BE (`ctx_7e750c2d8025`).

- Web đã wire contract `GET /v1/me/tickets/{ticketId}?tenantSlug=`
- Authenticated resolve (owner đã login thấy vé) **chờ BE merge** rồi revalidate exact SHA
- Không mock auth / không fake ticket body

## SHA

Tip branch (web PR): `730e9dfc557b04a4a400ce3261f1dc67739bd578`

Issue: [#398](https://github.com/hangndat/ticket-solution/issues/398)
