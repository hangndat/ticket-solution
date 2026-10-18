# O02 — BE handoff (#369): OpenAPI + packages/contracts

| Trường | Giá trị |
| --- | --- |
| Consumer Issue | [#369](https://github.com/hangndat/ticket-solution/issues/369) |
| Architect handoff | [#368](https://github.com/hangndat/ticket-solution/issues/368) · [contract.md](./contract.md) |
| Ownership | `backend` — `apps/api`, `packages/backend`, `packages/contracts` (+ OpenAPI regen theo quy trình repo) |
| Architecture impact | **Có** — shared discovery contract |
| OUT | Không sửa `apps/web` / `apps/mobile` trong #369 |

## 1. Quyết định nhận từ architect

Ship **`GET /v1/me/events`** (MeEvents). **Không** mở rộng `MeResponse` / `GET /v1/me`.

## 2. `packages/contracts` — thay đổi cần làm

File chính: `packages/contracts/src/index.ts` (và re-export nếu có).

### 2.1 Cập nhật types (additive)

**Hiện có @ tip `a507b36…`:**

```ts
export interface MeEventItem {
  eventId: string;
  name: string;
  permissions: string[];
}

export interface MeEventsResponse {
  items: MeEventItem[];
}
```

**Đổi thành:**

```ts
export interface MeEventItem {
  tenantId: string;
  eventId: string;
  name: string;
  permissions: string[];
}

export interface MeEventsResponse {
  /** true iff active tenant membership OR active event assignment */
  staffEligible: boolean;
  items: MeEventItem[];
}
```

- `MeResponse` / `MeTenantsResponse` / `MeTenantItem`: **không đổi** trong MVP O02.
- Không thêm permission constants mới trừ khi mirror string đã có trong `role-map` (optional `as const` list cho docs/tests — không bắt buộc).

### 2.2 Error codes

Tái sử dụng `IDENTITY_ERROR_CODES` / `PLATFORM_ERROR_CODES` hiện có (`UNAUTHENTICATED`, `MEMBERSHIP_REVOKED`, `PERMISSION_DENIED`). **Không** invent code riêng cho empty MeEvents.

## 3. OpenAPI (`apps/api`)

| Hạng mục | Việc |
| --- | --- |
| Path | Thêm `GET /v1/me/events` (tag `platform` hoặc `me` — khớp style `/v1/me/tenants`) |
| Security | `bearer` bắt buộc |
| Response 200 | Schema `MeEventsResponse` / DTO tương đương (`staffEligible`, `items[]` với `tenantId`, `eventId`, `name`, `permissions`) |
| Response 401 | Giống `/v1/me/tenants` |
| Regen | Chạy pipeline OpenAPI hiện có của repo; cập nhật `apps/api/openapi.json`; health/contract test path list phải include `/v1/me/events` (xem `apps/api/test/health.test.cjs` path allowlist) |

DTO Nest: mirror contracts; tránh response không typed.

## 4. Nest / packages/backend — impl sketch (ownership BE)

Không implement trong Task architect; sketch để #369 không đoán:

1. `PlatformService.myEvents(authorization)` — `selfActor` → query helper.
2. SQL function (khuyến nghị) `list_my_events()` parallel `list_my_tenants()`:
   - `set_config('app.actor_id', …, true)`
   - Join `event_assignments` active + `events` (+ tenant) cho `user_id` của membership active
   - Trả `tenant_id`, `event_id`, `name`, `permissions`
3. `staffEligible`:
   - `EXISTS` active membership cho user **OR** `EXISTS` active assignment (hoặc `list_my_tenants` non-empty OR events non-empty — cùng semantics [contract.md](./contract.md) §2.1).
4. Controller: `@Get('me/events')` cạnh `me/tenants`.
5. Tests: `platform.test.cjs` (hoặc tương đương) — matrix §8 contract.md; revoke assignment/membership.
6. **Không** weaken `requireTenantPermission` / gate locks.

## 5. BFF note (không thuộc #369)

Web #371 sẽ thêm `GET /api/bff/me/events` forward — ngoài scope BE; BE chỉ cần upstream `/v1/me/events` ổn định.

## 6. Acceptance checklist (#369)

- [ ] Contracts: `MeEventItem.tenantId` + `MeEventsResponse.staffEligible`
- [ ] `GET /v1/me/events` live + OpenAPI + health path list
- [ ] Tests membership/assignment revoke → discovery
- [ ] Deny-by-default: attendee-only → `staffEligible: false`
- [ ] PR + CI + DoD exact-SHA; không đụng web/mobile

## 7. Handoff consumers (sau tip BE)

| Issue | Dùng |
| --- | --- |
| [#370](https://github.com/hangndat/ticket-solution/issues/370) iOS | Fetch MeEvents sau verify; ẩn tab Nhân viên khi `!staffEligible` |
| [#371](https://github.com/hangndat/ticket-solution/issues/371) web | `SiteNav` bind capabilities; soft-redirect `/admin` `/gate` |
