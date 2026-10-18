# ADR-19 — Nguồn chuẩn sự kiện public = server published projection

Ngày: 2026-10-18  
Trạng thái: **Đã chốt (MVP)** — user duyệt O15 / Epic [#254](https://github.com/hangndat/ticket-solution/issues/254)  
Epic: [#254](https://github.com/hangndat/ticket-solution/issues/254) · Task [#255](https://github.com/hangndat/ticket-solution/issues/255)  
Chi tiết thiết kế: [architecture/event-server-source.md](../architecture/event-server-source.md)  
Đối chiếu: [TECHNICAL-DESIGN.md](../TECHNICAL-DESIGN.md) §10 (Public GET), iOS M04 published-event-api, D9 demo seed

> Draft trước Accept: `ADR-DRAFT-event-server-source` (architect handoff) → file này.

## Quyết định

1. **Nguồn chuẩn** cho mọi bề mặt public/attendee hiển thị sự kiện là PostgreSQL: hàng `events` + bản **published** của `event_config_versions` (và brand snapshot đã publish).  
2. **Client fixtures** (`apps/web/src/events.ts`, `apps/mobile/src/data/demo-events.ts`) **không** phải SoT và **không** được dùng làm fallback khi API lỗi trên đường published.  
3. **Contract public** thống nhất quanh projection list/detail trong `@ticket/contracts` (`PublishedEventDetail` / `Summary` / `ListResponse`) + OpenAPI Nest `GET /v1/public/tenants/{tenantSlug}/events` và `.../events/{eventSlug}`.  
4. Nội dung marketing (`category`, `description`, `highlights`) sống trong **published sections** (hero/info/faq), không duy trì schema fixture riêng trên client.  
5. Web bỏ SSG gắn fixture; dùng **SSR hoặc ISR** đọc BFF/API (consumer ownership: web).  
6. **D9 demo-seed** mở rộng để **publish config** marketing demo trên server; hardcode client không thay thế seed.

## Fail-closed

- Chỉ trả event khi `visibility=PUBLIC`, `content_status=PUBLISHED`, `business_status=ACTIVE`, và có `published_config_version` khớp bản đã `published_at`.  
- Draft / unpublished / wrong tenant slug / unknown → **404** (không lộ tồn tại nội bộ).  
- Không trả admin fields (`revision`, lifecycle internals, …).

## Hậu quả

- BE ship Nest public routes + seed publish (Issue #255).  
- Web/iOS consumer phụ thuộc API thật; empty/error UI bắt buộc.  
- Catalog demo thống nhất quanh slug seed (`demo-fun` / `demo-studio`).

## Phương án đã xét và không chọn (MVP)

| Phương án | Lý do loại |
| --- | --- |
| Fixture web giữ SoT, published chỉ redeem/attendee | Vi phạm mục tiêu Epic #254; drift slug đã xảy ra |
| Snapshot tĩnh MinIO/file lúc publish | Thêm pipeline + public read vs ADR-14 private bucket; không cần cho MVP |

## Ngoài phạm vi ADR này

- Auth/RLS model  
- Branding public endpoint hoàn chỉnh (D8)  
- Deploy prod / store submit  
- CDN SaaS
