# O02 — Permission-driven chrome / nav (Architect handoff)

| Trường | Giá trị |
| --- | --- |
| Mode | **Thiết kế** (docs-only) — Role `architect` · `docs/agents/roles/architect.md` |
| Issue | [#368](https://github.com/hangndat/ticket-solution/issues/368) |
| Parent | Epic [#293](https://github.com/hangndat/ticket-solution/issues/293) · Gap **GAP-O02-CONTRACT** |
| Source SHA read | **`a507b36a722f34ee65f19f6388254b44966568cb`** |
| Architecture impact | **Có** — shared contract tín hiệu nav permission (BE → web ∥ iOS) |
| Quyết định O02 / ADR-07 | Staff **không** app riêng; cùng app, nav theo permission server ([DECISION-LOG O02](../../DECISION-LOG.md), ADR-07 / TECHNICAL-DESIGN § navigation) |
| Kết luận | **Đủ để triển khai trong scope** — chọn **MeEvents**, không mở rộng `/v1/me` |
| Related coding | BE [#369](https://github.com/hangndat/ticket-solution/issues/369) · iOS [#370](https://github.com/hangndat/ticket-solution/issues/370) · Web [#371](https://github.com/hangndat/ticket-solution/issues/371) |

## Artifact trong thư mục

| File | Nội dung |
| --- | --- |
| [contract.md](./contract.md) | Shape JSON, authz, failure/revoke, chrome mapping |
| [be-handoff.md](./be-handoff.md) | OpenAPI / `packages/contracts` + Nest ownership cho #369 |

## Quyết định (chọn một)

### Chọn: **MeEvents** — `GET /v1/me/events`

**Không** thêm capabilities / `staffEligible` vào `GET /v1/me` (`MeResponse`).

| | **A — MeEvents (chốt)** | **B — Mở rộng `/v1/me`** |
| --- | --- | --- |
| Endpoint | `GET /v1/me/events` (+ giữ `GET /v1/me/tenants`) | Additive fields trên `MeResponse` |
| Types sẵn có | `MeEventItem` / `MeEventsResponse` đã khai báo trong `packages/contracts` — **thiếu route** | `MeResponse` chỉ identity (userId/issuer/sub/email) |
| Trust / probe | `/v1/me` giữ probe identity (iOS `SessionBoundary`, web BFF) — lean, ổn định | Probe auth kéo membership/assignment joins mỗi verify |
| Scope quyền | Gate/Scanner = **event assignment**; Admin tenant = `/v1/me/tenants` đã có | Gộp mọi projection vào một payload → cache/revoke khó |
| Compatibility | Additive route; client cũ bỏ qua | Đụng mọi consumer `/v1/me` |

**Lý do ngắn:** O02/ADR-07 đòi tín hiệu **server-granted** theo tenant/event; model hiện có đã tách `list_my_tenants` + `event_assignments` / `eventPermissionsForRole`. Hoàn thiện discovery MeEvents khớp SoT; giữ `/v1/me` là identity-only.

## Hiện trạng @ source SHA (facts)

| Fact | Evidence |
| --- | --- |
| `MeResponse` identity-only | `packages/contracts` · OpenAPI `MeDto` |
| `GET /v1/me/tenants` live | `PlatformController.myTenants` · `listMyTenants` / `list_my_tenants()` |
| `MeEventsResponse` typed, **không** có path | contracts có; OpenAPI paths **không** `/v1/me/events` |
| Web chrome | `SiteNav` variant `guest|staff|admin|platform` — **không** bind capabilities server |
| iOS chrome | Tab **Nhân viên** luôn mount trong `(tabs)/_layout` |
| Permission allowlist | `role-map.ts` `tenantPermissionsForRole` / `eventPermissionsForRole` |

## Ownership / dependencies

```text
#368 (architect, this) ──contract──► #369 (backend)
                                      ├──► #370 (ios)  ∥
                                      └──► #371 (web)  ∥
```

- Hard dep: web/iOS **không** ship chrome binding trước tip BE có `GET /v1/me/events` + contract regenerated (hoặc mock fixture chỉ trong test, không production path).
- Soft: BA/PD không bắt buộc — mapping nav neo permission string đã chốt ở BE.

## Non-goals

- Không implement Nest / OpenAPI regen / UI trong Task này.
- Không đổi bảng role, không thêm permission string mới ngoài allowlist `role-map`.
- Không platform-operator chrome (`GET /v1/platform/me`) — ngoài O02 staff/tenant.
- Không merge / EAS / deploy.

## Kết luận

**Đề xuất / Đủ để triển khai trong scope:** BE #369 ship `GET /v1/me/events` theo [contract.md](./contract.md) + [be-handoff.md](./be-handoff.md); consumers #370/#371 ẩn/hiện nav theo `staffEligible` + permission arrays — **không** suy quyền từ route hay tab local.
