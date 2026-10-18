# Epic #254 — Implementation notes (PD → web / iOS / Architect)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` |
| Epic | [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| Ngày | 2026-10-18 |
| Ownership coding | `apps/web` · `apps/mobile` — **không** trong Task PD này |
| Contract | PD **không** quyết định API; căn theo projection hiện có + ghi gap |

Liên quan: [`flows.md`](./flows.md) · [`ui-states.md`](./ui-states.md).

---

## 1. Nguồn dữ liệu chuẩn (quan sát)

| Lớp | Path / type | Ghi chú |
| --- | --- | --- |
| Public detail | `GET /v1/public/tenants/{tenantSlug}/events/{eventSlug}` | iOS mirror: `PublishedEventDetail`; web BFF: `/api/bff/public/tenants/…/events/…` (đã dùng cho redeem schema) |
| Public list | `GET /v1/public/tenants/{tenantSlug}/events?cursor&limit` | iOS: `PublishedEventSummary` + `nextCursor` |
| Config typed | `EventConfigPayload` (`packages/contracts/src/config.ts`) | Sections allowlist: hero, info, redeem, guide, faq, terms |
| Lightweight catalog | `PublicEvent` (`packages/contracts`) | id, slug, name, startsAt, timezone, location, brand tối thiểu — **thiếu** sections/media URLs |
| Web fixture (cũ) | `apps/web/src/events.ts` + `demo-media` | Marketing SSG — **không** còn nguồn chính |
| iOS fixture (cũ) | `apps/mobile/src/data/demo-events.ts` | Chỉ `/events/fixture/*` |

**Nguyên tắc implement:** fail-closed như iOS published path hiện tại — lỗi/trống ≠ demo.

---

## 2. Mapping nội dung: demo page → published projection

Cột «Demo web» = trang `/t/…/events/…` hiện tại. Cột «Published» = `PublishedEventDetail` / payload publish.

| UI / nội dung demo | Field published | Status |
| --- | --- | --- |
| Tên sự kiện (H1) | `name` | ✅ Có |
| Tổ chức | `brand.organizationName` | ✅ Có |
| Màu accent | `brand.primaryColor` | ✅ Có |
| Logo | `brand.logoUrl` (từ asset READY) | ✅ Có trên projection iOS; demo dùng `EventLogo` theo fixture id |
| Banner / poster | `brand.bannerUrl` | ✅ Có; demo dùng `EventBanner` / poster CSS giả |
| Liên hệ | `brand.contact` | ✅ Published; ❌ demo không có |
| Ngày giờ | `startsAt` + `timezone` | ⚠️ Demo: `startsAt` bắt buộc; Published: **nullable** — UI «Chưa có giờ bắt đầu» |
| Địa điểm | `location` | ⚠️ Demo bắt buộc; Published **nullable** — ẩn nếu null |
| Eyebrow category | — | ❌ **Gap** — demo có `category`; projection không có. **Không invent.** Ẩn eyebrow hoặc map tạm từ section `info` title nếu operator nhập — cần Architect/BA |
| Intro / description | section `hero` → `title` / `bodyMarkdown` (hoặc body record) | ⚠️ Demo: `description` string; Published: section hero. Map: hero body = intro |
| Highlights (list 01/02/03) | — | ❌ **Gap** — không field `highlights[]`. Options: (a) markdown list trong section `info`/`guide`; (b) mở rộng contract (Architect). PD khuyến nghị **(a)** MVP — không chờ schema mới |
| Theme `festival` \| `studio` | — | ❌ Chỉ skin demo — **không** port; dùng brand color + tokens Vemoki/tenant |
| FAQ hardcoded | `faq[]` + section `kind=faq` | ✅ Published; render từ API |
| Notice «chỉ demo» | — | Gỡ trên surface published; giữ trên fixture route |
| CTA «Xem chi tiết ngày» | scroll `#event-details` | Giữ pattern; details từ startsAt/location/org |
| Version badge | `publishedConfigVersion`, `schemaVersion` | Dev/secondary optional — **không** bắt buộc trên chrome khách |
| Form đổi mã | `form` / terms | ✅ Qua redeem; section `redeem` = copy CTA |

### 2.1 List row mapping

| UI list | `PublishedEventSummary` |
| --- | --- |
| Title | `name` |
| Org | `brand.organizationName` |
| Date | `startsAt` + `timezone` (nullable) |
| Media | `brand.bannerUrl` / `logoUrl` |
| Accent | `brand.primaryColor` |
| Href | `/t/{tenantSlug}/events/{slug}` · iOS `/events/[tenantSlug]/[slug]` |

**Không map:** `category`, `highlights`, `theme`, demo media ids.

---

## 3. Gaps ghi cho Architect / BA (không tự mở contract trong PD)

| ID | Gap | Impact UI | Đề xuất PD |
| --- | --- | --- | --- |
| G1 | `category` / `highlights` chỉ có trên fixture | Mất eyebrow + list gợi ý marketing | MVP: dùng sections markdown; P1: field optional nếu product muốn |
| G2 | Public 404 gộp unpublished / not found / wrong tenant | Không tách copy «chưa xuất bản» | Giữ một copy not-found (bảo mật) |
| G3 | `archived` trên public API? | State archived trong ui-states | Nếu chưa có code riêng → treat 404; nếu có → map archived |
| G4 | Web home chưa gọi list public | Catalog vẫn fixture | Web worker: dynamic list theo tenant resolve |
| G5 | `PublicEvent.startsAt` required vs published null | Type drift | Align contracts khi chạm packages/contracts |
| G6 | Section `body` (Record) vs client `bodyMarkdown` | Parser khác nhau | Confirm projection wire format (iOS đã expect title/bodyMarkdown) |
| G7 | List BFF web cho `GET …/events` (collection) | Web có thể cần route BFF list | Coordinator: thêm BFF list nếu web không gọi API trực tiếp |

---

## 4. Admin touchpoints → field trên trang khách

| Operator nhập / hành động | Field / effect public |
| --- | --- |
| Tạo event: name, slug, timezone | `name`, `slug`, `timezone` |
| Metadata: startsAt, location | `startsAt`, `location` |
| Brand color + org name | `brand.primaryColor`, `organizationName` |
| Upload logo/banner → READY + gắn | `brand.logoUrl`, `bannerUrl` |
| Sections editor (visible, order, title, body) | `sections[]` |
| FAQ items / terms markdown + version | `faq[]`, `terms` |
| Form definition + publish | `form`, redeem schema |
| **Publish** | `publishedConfigVersion` tăng; list/detail hiện |
| Archive / cancel | Public hết (404 hoặc archived) |
| Preview version (staff) | **Không** đổi URL guest |

UX admin chi tiết hơn: D11 §1.2 workbench «Chuẩn bị» + readiness trước publish.

---

## 5. Accessibility (WCAG 2.2 AA / HIG)

| Hạng mục | Yêu cầu |
| --- | --- |
| Contrast | Text trên brand color / banner: kiểm contrast; overlay gradient nếu ảnh sáng |
| Focus (web) | Skip link `#main`; focus H1 khi detail ready; Retry nhận focus sau lỗi |
| Keyboard | List rows = link/button; FAQ `<details>` hoặc accordion có focus |
| Hit target (iOS) | CTA ≥ 44pt; list row tap area đủ |
| Labels | Media: `alt` có ý (logo org, banner tên sự kiện); decorative `alt=""` |
| Errors | `role="alert"` / LiveRegion cho unreachable/empty sau fetch |
| Reduced motion | Tắt orbit/poster motion demo; skeleton pulse tôn trọng `prefers-reduced-motion` |
| Language | `lang="vi"` (web); `Intl` date `vi` (iOS list đã vi — detail nên đồng bộ, hiện còn `en` ở một chỗ) |

**Automated:** axe/Playwright labels + headings. **Manual:** VoiceOver list→detail→CTA; keyboard-only redeem entry.

---

## 6. Hướng dẫn triển khai theo ownership

### 6.1 Web (`apps/web`) — thứ tự MVP

1. Thêm data loader list/detail từ BFF/public (dynamic) — **bỏ** `generateStaticParams` từ `demoEventRoutes` làm primary.
2. Map projection → UI theo §2; sections theo `visible` + `order`.
3. State components: reuse `SurfaceState` + copy từ ui-states.
4. CTA detail → `/redeem` với tenant/event scope.
5. Fixture: route/label tách hoặc feature-flag UAT — không fallback.
6. UAT headless: list empty, detail 404, detail ready + CTA.

### 6.2 iOS (`apps/mobile`) — thứ tự MVP

1. Events tab: **auto-fetch** published list khi có API base (published là primary; demo section thu hẹp/nhãn rõ).
2. Detail: đã có `PublishedEventDetailView` — bổ sung CTA redeem; đồng bộ copy VI + date `vi`.
3. Render markdown sections (hiện raw trong `Notice`) — good-enough: plain text; P1: markdown safe subset.
4. Giữ fixture route explicit.
5. sim-uat: loading → ready → redeem link; airplane → unreachable + retry.

### 6.3 Good enough vs polish

| MVP | Sau / ngoài Epic |
| --- | --- |
| List + detail từ server + states VI | Marketing highlights schema |
| CTA redeem đúng scope | Motion poster theo theme cũ |
| Fail-closed no fixture fallback | Full markdown/CMS preview parity |
| Archived = 404 nếu chưa có code | Archived-specific illustration |

---

## 7. Kiểm thử / evidence gợi ý

```text
Web:  scripts/web-uat.sh  (hoặc Playwright) — home list published, detail, 404, redeem entry
iOS:  scripts/sim-uat.sh — Events load, detail, retry
Unit: giữ published-event-api tests fail-closed; web bỏ phụ thuộc SSG fixture cho catalog chính
```

Artifact review: `docs/reviews/*` + exact SHA khi coding Task `Chờ duyệt`.

---

## 8. Tóm tắt quyết định PD

1. **Catalog khách = published API only**; fixture chỉ explicit/UAT.
2. **Thiếu category/highlights** → không hardcode marketing; dùng sections.
3. **Unpublished = not-found** trên public (một copy).
4. **Admin** là nơi duy nhất nhập/publish; public read-only.
5. **Claim** song song redeem, không thay list/detail.
