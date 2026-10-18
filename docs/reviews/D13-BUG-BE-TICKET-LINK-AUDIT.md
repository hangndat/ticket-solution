# D13 — BUG BE ticket link audit (`buildOwnerTicketLink`)

**Verdict:** PASS (audit + contract lock; **no silent URL path change**)  
**Role:** `backend` · Ownership: `packages/backend/**`  
**Architecture impact:** Không — giữ path email hiện tại; không đổi contract URL path.  
**Run / Task:** `run_1d13e6e391a0` / rebase `task_2b0bb2005677`  
**Exact SHA (behavior / under review):** `e5b09a14d16c87dc57cc65befd8574735f132aea`  
**Branch tip at handoff:** `f0e1215484119c0e47ad84dbd40d79aa99c37ebf`

## Trace — BE email ticket link

| Step | Location | Behavior |
| --- | --- | --- |
| Builder | `packages/backend/src/web-links.ts` → `buildOwnerTicketLink` | `{resolveProductWebBaseUrl(base)}/t/{tenantSlug}/tickets/{ticketId}` (encodeURIComponent; O13 apex → `app.vemoki.com`) |
| Re-export | `packages/backend/src/qr-ticket.ts` | Deprecated re-export for existing callers |
| Outbox caller | `packages/backend/src/outbox.ts` → `processClaimedOutbox` | Chỉ khi `row.type === 'TicketIssued'`; gán `vars.ticketLink` |
| Template vars | `TICKET_ISSUED_TEMPLATE_VARS` + `DEFAULT_TICKET_ISSUED_TEMPLATE` | Allowlist gồm `ticketLink`; default body: `{{ticketLink}}` / `<a href="{{ticketLink}}">` |
| Other kinds | `InvitationReady` / `EventReminder` | Allowlist có `ticketLink` trong `notification-templates.ts`, nhưng **outbox chưa render** các kind này với `buildOwnerTicketLink` (chỉ TicketIssued) |
| Export | `packages/backend/src/index.ts` | Re-export `buildOwnerTicketLink` (qr-ticket + web-links) |

**Kết luận BE:** Mọi email TicketIssued (default + custom template dùng `{{ticketLink}}`) đều nhận URL path **`/t/{tenant}/tickets/{id}`**. Không có credential/token query param trên link owner. Origin đi qua `resolveProductWebBaseUrl` (#395).

## Matrix BE ↔ web pages

| Surface | Path / route | Exists today? | Notes |
| --- | --- | --- | --- |
| BE email `ticketLink` (TicketIssued) | `/t/{tenantSlug}/tickets/{ticketId}` | **BE yes / web page yes** | Web route shipped (#405 / fix deeplink contract); path contract unchanged |
| Web owner ticket | `/t/[tenantSlug]/tickets/[ticketId]` | Yes | `apps/web/app/t/[tenantSlug]/tickets/[ticketId]/page.tsx` |
| Web public event | `/t/[tenantSlug]/events/[eventSlug]` | Yes | `apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx` |
| Web claim | `/claim` | Yes | Guest claim flow — không phải owner ticket detail |
| Web redeem | `/redeem` | Yes | Redeem session — không phải owner ticket detail |
| Web gate | `/gate` | Yes | Staff gate — không phải owner view |
| Web account | `/account` | Yes | Account deletion / session — không list vé |
| Web auth | `/auth` | Yes | OIDC login |
| Web BFF tickets list | `GET /api/bff/tickets` → Nest `/v1/me/tickets` | API only | List; detail qua owner page + `GET /v1/me/tickets/{id}` (#400) |
| Admin ticket BFF | `/api/bff/admin/tickets…` | API only | Staff CS — không phải email owner link |
| Mobile deep link (tham chiếu) | `/my-tickets/{ticketId}` / `vemoki://tickets/{id}` | Mobile | Khác path web email; không đổi BE theo mobile |

### Gap summary

1. **Primary gap (closed on main):** Web đã có `app/t/[tenantSlug]/tickets/[ticketId]/page.tsx` (#405) + owner API (#400). BE path contract **không** đổi.
2. **Không silent đổi BE path:** Email đã gửi giữ `/t/.../tickets/...`; chỉ đổi path khi coordinator xác nhận cutover riêng.
3. **O13 origin:** Base URL marketing apex → `https://app.vemoki.com` (#395); path segments vẫn khóa bởi unit test.

## Changes in this Task

| File | Change |
| --- | --- |
| `packages/backend/src/web-links.ts` | Handoff JSDoc trên `buildOwnerTicketLink` (canonical after #395) |
| `packages/backend/test/qr-ticket-link-unit.test.cjs` | Contract lock path + encoding (import `dist/web-links`) |
| `packages/backend/package.json` | Thêm unit test vào script `test` (giữ `web-links-unit`) |

## Checks

```bash
pnpm --filter @ticket/backend exec node --test test/qr-ticket-link-unit.test.cjs
# (sau build) hoặc full: pnpm --filter @ticket/backend test
```

## Acceptance

- [x] Matrix BE↔web documented (bảng trên; cập nhật sau #395/#400/#405)
- [x] Không silent đổi path link làm gãy email đã gửi
- [x] Contract test khóa path hiện tại + comment handoff
