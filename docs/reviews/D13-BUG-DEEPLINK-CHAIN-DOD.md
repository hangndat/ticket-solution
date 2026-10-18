# D13 — Deeplink chain DoD (`/t/{slug}/tickets/{id}` ↔ `#400`)

Tracking artifact cho chuỗi web deeplink Issue [#398](https://github.com/hangndat/ticket-solution/issues/398) + BE owner-read [#400](https://github.com/hangndat/ticket-solution/pull/400).

| Trường | Giá trị |
| ------ | ------- |
| Scope | Web owner-ticket deeplink + Nest `GET /v1/me/tickets/{ticketId}?tenantId=` |
| Prior FAIL (superseded PRs) | [#399](https://github.com/hangndat/ticket-solution/pull/399) / [#402](https://github.com/hangndat/ticket-solution/pull/402) wire BFF/`load` với **`tenantSlug`** (hoặc thiếu resolve UUID) — **không** khớp OpenAPI `#400` (`tenantId` UUID bắt buộc) |
| Revalidation PR | [#405](https://github.com/hangndat/ticket-solution/pull/405) tip `11510520595c05b921f48eda3814007daa71bfd4` |
| BE sibling | [#400](https://github.com/hangndat/ticket-solution/pull/400) **merged** → `main` (`821ae07`) |

---

## Checklist chain

| # | Gate | PASS khi | Status trên tip #405 |
| --- | --- | --- | --- |
| C1 | Slug→`tenantId` | Resolve qua `GET /v1/me/tenants` slug match **hoặc** `?tenantId=` UUID; **không** bịa public slug map | **PASS** — `resolveOwnerTenantId` + `loadOwnerTicket` |
| C2 | Nest/BFF query | `GET /v1/me/tickets/{id}?tenantId=<UUID>`; **không** gửi `tenantSlug=` upstream | **PASS** — BFF 422 nếu thiếu UUID; unit assert `!tenantSlug=` |
| C3 | Khớp OpenAPI #400 | Path + required `tenantId` query | **PASS** — `openapi.json` `/v1/me/tickets/{ticketId}` + `tenantId` required (đã trên `main` sau merge #400) |
| C4 | Anonymous ≠ event 404 | Soft-redirect `/auth?next=` (proxy 307); không HTML public «tenant và sự kiện» | **PASS** — `proxy.ts` + `routes.integration.mjs` + CI `web` |
| C5 | Fail-closed UX | Miss / forbidden / invalid → empty «Không tìm thấy vé»; unresolved membership → `tenant-unresolved` | **PASS** — page + unit |
| C6 | Authenticated owner resolve (runtime) | Owner đã login thấy detail thật chống Nest trên tip | **GAP** — unit mock + CI; **chưa** headless authenticated UAT trên tip |

---

## Prior FAIL (ghi nhận)

PR #399 evidence: BFF `GET /api/bff/tickets/{id}?tenantSlug=` → Nest without `tenantId` UUID. Đó là **blocker contract** so với `#400` / TD §10 Self — **không** được merge làm consumer.

PR #405 supersede #399+#402 và đóng C1–C5 trên exact SHA dưới đây.

---

## Cross-link

- DoD tip #405: [`D13-PR405-DOD.md`](./D13-PR405-DOD.md)
- Issue: [#398](https://github.com/hangndat/ticket-solution/issues/398)
