# Kiến trúc — Nguồn sự kiện server-side (Epic #254)

| Trường | Giá trị |
| --- | --- |
| Epic | [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| Run | `run_86f42281f748` |
| Vai trò | architect (Task Spec; catalog `docs/agents/roles/` chưa có file `architect.md` — áp dụng bảng bắt buộc dưới đây) |
| Ngày | 2026-10-18 |
| ADR liên quan | [ADR-19](../ops/ADR-19-EVENT-SERVER-SOURCE.md) (**Đã chốt**, O15) |
| Kết luận | **Đủ để triển khai** |

## 1. Mục tiêu / non-goals

**Mục tiêu:** Mọi bề mặt public + attendee lấy thông tin sự kiện từ **server** (PostgreSQL event + published config/content). Admin/CMS là đường nhập liệu. Client fixture **không** còn là nguồn hiển thị chính.

**Non-goals:** Không mở rộng MVP CMS; không đổi auth/RLS; không deploy prod/store trong Epic trừ ủy quyền riêng; không yêu cầu CDN SaaS (ADR-11/14).

## 2. Hiện trạng (đã xác minh trong tree)

| Surface | Nguồn hiện tại | Ghi chú |
| --- | --- | --- |
| Web marketing `/t/{tenant}/events/{slug}` | `apps/web/src/events.ts` (`findDemoEvent`, `DemoEvent`) | `generateStaticParams` + `dynamicParams = false` → **SSG chỉ fixture** |
| Web home `/` | Cùng fixture catalog | Tenant demo marketing: `sunburst` / `northline` |
| Web redeem schema | BFF `GET /api/bff/public/tenants/.../events/{slug}` → Nest public | Proxy đã có; Nest public **thiếu** → upstream 404 |
| iOS published list/detail | `published-event-api.ts` → `GET /v1/public/tenants/...` | Fail-closed; **không** fallback fixture-as-published |
| iOS fixture | `demo-events.ts` + `/events/fixture/[eventId]` | Demo-only; slug `demo-fun` / `demo-studio` |
| D9 demo seed | `packages/backend/src/demo-seed.ts` | PG event PUBLISHED + brand snapshot; **chưa** publish `event_config_versions` đủ marketing sections |
| Nest public routes | **Không có** controller `/v1/public/tenants/...` | Evidence: DoD #200 known gap; `apps/api/src` không match path |
| TD contract | `GET /public/tenants/{slug}/events/{slug}` | [TECHNICAL-DESIGN.md](../TECHNICAL-DESIGN.md) §10 — đã ghi, chưa ship Nest |

**Mâu thuẫn catalog:** Web fixture (`sunburst`/`northline`) ≠ D9/iOS demo (`demo-fun`/`demo-studio`). Hai SoT client đã lệch nhau.

## 3. Quyết định cần giải (bảng bắt buộc)

| # | Câu hỏi | Kết luận kiến trúc |
| --- | --- | --- |
| 1 | Nguồn chuẩn? | **PostgreSQL** `events` (metadata + `visibility`/`content_status`/`business_status`) + **published** `event_config_versions` (+ `published_brand_snapshot`). Client fixtures **không** SoT. |
| 2 | Gap contract vs DemoEvent? | `PublicEvent` / iOS `PublishedEventDetail` **đủ lõi** (id, slug, name, startsAt\|null, location\|null, brand, sections, faq, terms, form, versions). Thiếu so với DemoEvent: `category`, `description`, `highlights`, `theme` — **map vào published sections** (hero/info + list trong body), không fork schema marketing riêng trên client. `theme` = presentation web-only (CSS từ brand), không SoT. |
| 3 | Vai trò D9 seed? | Seed **server** OK và **bắt buộc mở rộng**: sau upsert event → tạo + publish config version có sections/faq marketing (nhãn `· Demo` / fixture). Client hardcode catalog **không OK** làm SoT; được giữ tạm dưới route/label demo rồi gỡ. |
| 4 | iOS vs web? | iOS path published là đúng hướng; web rewrite theo cùng contract/BFF. Fixture iOS chỉ còn route demo tường minh hoặc xóa sau khi seed+API xanh. |
| 5 | SSG khi bỏ fixture? | Bỏ `dynamicParams=false` gắn fixture. **SSR hoặc ISR** (`revalidate` / on-demand sau publish). Không phụ thuộc `generateStaticParams` từ file client. Build-time static params **tuỳ chọn** nếu API có lúc build — không bắt buộc MVP. |

## 4. So sánh phương án (≥2)

| Tiêu chí | **A — Published API SoT + SSR/ISR** (đề xuất) | **B — Giữ fixture web + published chỉ attendee** | **C — Snapshot tĩnh lúc publish (MinIO/file)** |
| --- | --- | --- | --- |
| Khớp Epic #254 | Có | Không (web vẫn SoT client) | Có (gián tiếp) |
| Khớp TD §10 / iOS M04 | Có | Một phần | Có + thêm pipeline |
| Effort MVP | BE public GET + seed publish + web rewrite | Thấp nhưng sai mục tiêu | Cao (write path, invalidation, public read) |
| Drift tenant/slug | Một catalog server | Tiếp tục lệch sunburst vs demo-fun | Thấp nếu publish đúng |
| Failure mode | 404/502 fail-closed; empty list | Fixture “luôn có” che lỗi API | Stale snapshot nếu miss invalidate |
| ADR-11/14 | Ổn (self-host Nest) | Ổn | MinIO private → cần signed URL hoặc bucket public — phức tạp |
| **Chọn** | **Có** | Không | Không cho MVP; cân nhắc sau nếu CDN tĩnh cần |

### Phương án A — hình dạng kỹ thuật

```text
Admin CMS ──publish──► PG events + event_config_versions (published_at)
                              │
                              ▼
                    Nest GET /v1/public/tenants/{tenantSlug}/events
                         GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Web BFF proxy   iOS published-api   (redeem schema đã dùng BFF)
              │
              ▼
     Web RSC page /t/.../events/...  (SSR/ISR, không findDemoEvent)
```

**Quy tắc projection (fail-closed):**

- Catalog chỉ trả `visibility=PUBLIC`; detail theo link nhận `PUBLIC` hoặc `UNLISTED` theo PRD M03. Cả hai yêu cầu tenant ACTIVE, content PUBLISHED, business ACTIVE và published config khớp bản đã publish; không fallback metadata-only hoặc dữ liệu draft.
- Draft / unpublished / wrong tenant slug → **404** (không lộ tồn tại nội bộ).
- Payload không hợp schema → client `invalid` / web error state — **không** thay bằng fixture.
- Branding chrome (D8) có thể fallback Vemoki; **nội dung sự kiện không** fallback fixture.

## 5. Contract — map field & gap

| DemoEvent (web fixture) | Published SoT | Hành động |
| --- | --- | --- |
| `id`, `tenantSlug`, `slug`, `name` | Event row + projection | Giữ |
| `startsAt`, `timezone`, `location` | Event metadata (`starts_at`, `timezone`, `venue_name`); null OK nếu thiếu | Giữ; web format khi non-null |
| `brand.*` | `published_brand_snapshot` (+ asset URLs nếu READY) | Giữ |
| `category` | Convention: section `hero` eyebrow / `title` hoặc `info` metadata trong `body` | Không thêm cột DB bắt buộc |
| `description` | Section `hero` hoặc `info` `bodyMarkdown` / `body` | Seed + Admin publish |
| `highlights[]` | List trong section `info` body (allowlisted structure) hoặc FAQ ngắn | Seed + Admin |
| `theme` | Không SoT — CSS local từ `primaryColor` | Bỏ khỏi contract public |

**Contracts ownership:** Đưa `PublishedEventDetail` / `PublishedEventSummary` / list response từ mirror iOS (`apps/mobile/src/published/types.ts`) vào `@ticket/contracts` + OpenAPI Nest. `PublicEvent` giữ như summary nhẹ hoặc deprecate dần thành alias Summary (coordinator/BE quyết định trong PR contract — không fork schema thứ ba).

**List endpoint:** Cần cho home web + iOS list. BFF list route (hiện chỉ có detail) thêm song song web.

## 6. Migration bỏ hardcode client

| Bước | Owner | Việc |
| --- | --- | --- |
| M1 | backend (+ contracts) | Implement Nest public list/detail; OpenAPI; DB tests projection; mở rộng D9 seed → publish config marketing cho `demo-fun`/`demo-studio` |
| M2 | web | Page + home đọc BFF/API; bỏ `findDemoEvent` khỏi đường chính; SSR/ISR; empty/error theo PD; gỡ hoặc archive `events.ts` fixture SoT |
| M3 | ios | Xác nhận list/detail xanh trên Nest; thu hẹp `/events/fixture/*` (label demo hoặc xóa); types import từ `@ticket/contracts` khi đã land |
| M4 | coordinator | Align deep links UAT với slug seed; cập nhật ROADMAP/demo docs; không merge web còn SoT fixture |

**Cho phép tạm:** Fixture file tồn tại trong test/UAT harness với nhãn rõ — **cấm** dùng làm fallback khi API lỗi trên surface “published”.

## 7. Failure modes

| Mode | Hành vi bắt buộc |
| --- | --- |
| Nest down / timeout | Web: error/unavailable surface (PD); iOS: `unreachable` — không fixture |
| 404 unknown slug | `notFound()` / not-found UI |
| 200 nhưng schema lệch | `invalid` — không render nửa payload |
| Event PUBLISHED metadata nhưng chưa publish config | 404 hoặc empty-published ổn định (chọn một; khuyến nghị **404** public đến khi có published version) |
| Tenant A yêu cầu event tenant B | 404 |
| Build web không gọi được API | Không fail cả CI build vì thiếu fixture — dùng dynamic rendering; UAT cần API+seed |

## 8. SSG / ISR (web)

| Trước | Sau (A) |
| --- | --- |
| `generateStaticParams` ← `demoEventRoutes()` | Không phụ thuộc fixture |
| `dynamicParams = false` | Bỏ hoặc `true` + fetch server |
| Metadata từ fixture | `generateMetadata` async fetch cùng projection |

Khuyến nghị MVP: **ISR** `revalidate` (ví dụ 60s) hoặc on-demand revalidate hook sau `CONFIG_PUBLISH` (phase sau nếu cần SEO tức thì). Home: fetch list theo tenant demo đã seed **hoặc** danh sách cố định tenant slug từ env/config server — không hardcode nội dung event.

## 9. Handoff ownership + deps thật

| Task (gợi ý Story) | Ownership | Paths chính | Depends on |
| --- | --- | --- | --- |
| T-BE public projection + OpenAPI + tests | `backend` | `apps/api`, `packages/backend`, `packages/contracts` | — (unblocks consumers) |
| T-BE D9 seed publish config marketing | `backend` | `packages/backend/src/demo-seed.ts`, docs/demo | Có thể cùng PR với T-BE hoặc ngay sau |
| T-web marketing + home rewrite | `web` | `apps/web/app/t/**`, `app/page.tsx`, BFF list, bỏ SoT `src/events.ts` | **Hard:** Nest public detail+list (hoặc contract freeze + mock chỉ trong unit test) |
| T-web BFF list proxy | `web` | `app/api/bff/public/.../events/route.ts` | Cùng wave với T-web sau BE path ổn định |
| T-ios align + gỡ fixture SoT | `ios` | `published/*`, `data/demo-events.ts`, fixture routes | Soft: BE list xanh; hard nếu Task yêu cầu HTTP 200 list |
| T-PD empty/error/loading | `product-design` | docs design | Song song; web implement theo handoff |
| T-BA AC inventory | `product-ba` | Issue comments | Song song |

**Không** serialize BA → PD → BE → web → iOS nếu AC/PD không chặn contract. Wave tối đa: BA ∥ PD ∥ BE; sau BE green → web ∥ iOS.

## 10. Test matrix

| Layer | Case | Evidence |
| --- | --- | --- |
| BE unit/db | Detail PUBLIC/UNLISTED+published; catalog PUBLIC-only; draft/suspended tenant 404; cross-tenant 404 | `packages/backend` + `apps/api` tests |
| BE list | Cursor/limit; chỉ published; empty items `[]` | API test |
| Contracts | OpenAPI paths `/v1/public/tenants/...`; DTO khớp iOS guard | `apps/api/openapi.json` + contract build |
| Seed | Second seed idempotent; GET public 200 cho `demo-fun/fun-fest` | `d9-demo-seed` + curl |
| Web unit | Page không import SoT fixture; metadata từ fetch mock | `apps/web/tests` |
| Web UAT headless | Home + detail từ seed; 404 slug lạ; API down → error (không fixture) | `scripts/web-uat.sh` |
| iOS unit | `isPublishedEventDetail` + fetch mapping (đã có); tích hợp Nest 200 | `published-event-api.test.ts` + smoke |
| Regression | Redeem BFF schema vẫn forwardPublic | web redeem tests |

## 11. Rủi ro / giới hạn đã biết

- Nest public **chưa tồn tại** — đây là dependency cứng, không phải “nice to have”.
- D9 seed chưa publish config → dù Nest xong, marketing sections có thể trống nếu quên M1 seed.
- Branding public path cũng được client gọi nhưng Nest hiện chủ yếu `/v1/tenants/{uuid}/branding` (auth) — ngoài scope chính #254; không block event SoT nếu event projection tự chứa brand snapshot.
- Role file `docs/agents/roles/architect.md` chưa có trong catalog — Task vẫn giao; artifact này đóng vai trò handoff architect.

## 12. Kết luận

| Hạng mục | Giá trị |
| --- | --- |
| Phương án chọn | **A — Published API SoT + SSR/ISR** |
| ADR | **ADR-19** — Đã chốt (O15) |
| Ready coding? | **Đủ để triển khai** |
| Blocker trước web/iOS feature | BE public GET + (khuyến nghị) seed publish config |

## Phụ lục — Draft comment Issue #254 (Tiếng Việt)

> **Architect handoff (#254)**  
> Kết luận: **Đủ để triển khai** — chọn **Published projection (PG event + published config) làm SoT**; bỏ fixture client làm nguồn hiển thị chính.  
> Gap đã xác minh: Nest **chưa** có `GET /v1/public/tenants/...` (iOS/BFF đã gọi; web marketing vẫn SSG từ `apps/web/src/events.ts`). DemoEvent fields marketing map vào **sections** published, không fork schema. D9 seed mở rộng publish config; SSG → SSR/ISR.  
> Chi tiết: `docs/architecture/event-server-source.md` · ADR draft `docs/ops/ADR-DRAFT-event-server-source.md` (Đề xuất).  
> Handoff: BE public+seed → web rewrite ∥ iOS align; BA/PD song song.

*(Worker không post GitHub theo preamble Orca — coordinator paste comment trên.)*
