# D13 — Bug web ticket deeplink (owner email link)

**Slice:** `apps/web` only  
**Role:** `web` (`docs/agents/roles/web.md`)  
**Architecture impact:** Không — route/BFF đã có trên `main` (không đổi shared contract trong task verify này)  
**Issue:** [#398](https://github.com/hangndat/ticket-solution/issues/398)  
**Run:** `run_34fde1e32ed1` · Dispatch `ctx_bc885656091f`

## Verdict

**PASS (web route/BFF/auth-gate)** — đã tích hợp `main` qua PR [#405](https://github.com/hangndat/ticket-solution/pull/405).  
Task verify (coordinator chọn A): checks xanh trên tip `origin/main`; anonymous ≠ generic event 404.

## Vấn đề gốc

Email CS / ticket-issued dùng `buildOwnerTicketLink` →  
`/t/{tenantSlug}/tickets/{ticketId}`. Web thiếu route → Next not-found «Không tìm thấy tổ hợp tenant và sự kiện».

## Đã có trên main

| Hạng mục | Chi tiết |
| --- | --- |
| Merge | PR #405 → `f6eb2d4e1bd7673e883617cff07009baeb2e212d` |
| Route | `apps/web/app/t/[tenantSlug]/tickets/[ticketId]/page.tsx` |
| BFF | `GET /api/bff/tickets/[ticketId]?tenantId=` → Nest `GET /v1/me/tickets/{id}?tenantId=` (#400) |
| Auth gate | `proxy.ts` soft-redirect anonymous → `/auth?next=…`; page `redirect` nếu thiếu session; `sanitizePostLoginPath` allow owner-ticket path |
| Fail-closed UX | Missing/forbidden/invalid → «Không tìm thấy vé» (không dùng copy event 404) |
| Loader | `apps/web/src/owner-ticket/*` — resolve slug→tenantId qua `me/tenants` (hoặc `?tenantId=`), rồi detail |

## Checks (verify tip)

**Tip SHA:** `cd7f2261b829dc366b3a8e946f33ae092f69a396` (= `origin/main` tại thời điểm verify)

```bash
pnpm --filter @ticket/contracts build
pnpm --filter @ticket/web exec tsx --test tests/owner-ticket.test.ts
pnpm --filter @ticket/web build
pnpm --filter @ticket/web test:routes
```

| Check | Kết quả |
| --- | --- |
| `owner-ticket.test.ts` | PASS (12) |
| `next build` | PASS — route `/t/[tenantSlug]/tickets/[ticketId]` + BFF `/api/bff/tickets/[ticketId]` listed |
| `test:routes` | PASS — anonymous deeplink HTTP **307** → `/auth?next=…/tickets/…` (≠ HTML event not-found) |

## Known gap (ngoài scope web verify)

- Authenticated owner khi `me/tenants` chưa gồm tenant có vé → `tenant-unresolved` — theo dõi PR [#441](https://github.com/hangndat/ticket-solution/pull/441) (BE `list_my_tenants` UNION + web `MeTenantRole` Attendee). Không mở PR web trùng trong task này.
- Không mock auth / không fake ticket body trên production paths.

## Reviewer note

DoD reviewer độc lập nên duyệt exact tip SHA ở trên (hoặc SHA artifact commit nếu có PR docs). Revalidate nếu commit hành vi web mới sau tip này.
