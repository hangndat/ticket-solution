# #254 — BA: Nguồn sự kiện từ server (bỏ fixture hardcode client)

| Trường | Giá trị |
| --- | --- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../agents/roles/product-ba.md) |
| Ownership | **Chỉ** file này (+ Decision Log **đề xuất** nếu kèm) — không sửa `apps/**` |
| Ngày soạn | 2026-10-18 |
| Epic | [#254](https://github.com/hangndat/ticket-solution/issues/254) · Run `run_86f42281f748` |
| HEAD quan sát | `e8512d0055e0e9d6585007e8363b6224a7138b12` (worktree `hangndat/epic254-ba`) |
| Ngôn ngữ | Tiếng Việt (giữ ID, API, path, SHA nguyên bản) |
| Trạng thái | **Đề xuất cho PD / Architect / Epic planner** — không tự chốt ADR, không claim Hoàn thành Epic |

### Ranh giới tuyên bố

| Được | Không được |
| --- | --- |
| Inventory surface fixture vs API từ source/docs | Sửa `apps/**`, Nest, contract |
| AC Given/When/Then + non-goals + ưu tiên MVP | Tự merge / deploy / store submit |
| Gaps field Admin vs UI public hardcode | Hồi sinh Android / payment / seat / Wallet |
| Phân biệt **quan sát** / **suy luận** / **giả thuyết** | Claim Nest public route đã có HTTP 200 nếu evidence nói 404 |

---

## 1. Vấn đề / outcome

**Vấn đề (quan sát):** Nhiều surface khách (web home + trang `/t/.../events/...`, iOS tab Events mặc định + route fixture) vẫn lấy **nội dung sự kiện hư cấu hardcode trên client** làm nguồn hiển thị chính, dù Admin đã có CRUD/lifecycle event + publish config (M04) và client iOS/web đã có đường gọi published projection cho redeem/claim.

**Outcome mong muốn:** Toàn bộ thông tin sự kiện trên public/attendee surfaces lấy từ **server projection published** (quản lý/nhập từ Admin). Fixture client không còn là nguồn hiển thị chính; empty/error fail-closed khi server không có / lỗi — không bịa demo thay published.

**Khớp PRD:** M04 (branding + section cố định, draft/publish), ma trận §5 «Thông tin event, FAQ, điều khoản»; TD §10 Public `GET /public/tenants/{slug}/events/{slug}` — chỉ projection published.

---

## 2. Phương pháp & hạn chế

| Nguồn | Loại |
| --- | --- |
| Issue #254 body + comment điều phối | Quan sát |
| `apps/web/src/events.ts`, `app/page.tsx`, `app/t/.../page.tsx`, `demo-media.ts` | Quan sát source |
| `apps/mobile/src/data/demo-events.ts`, `screens/events.tsx`, `event-detail.tsx`, `published/*` | Quan sát source |
| `@ticket/contracts` `PublicEvent`, `EventDetail`, `EventConfigPayload` | Quan sát |
| Admin `event-admin` + `config-schema` (section kinds) | Quan sát |
| `docs/reviews/D9-E2E-WEB-IOS-TICKET*.md` (Nest public 404) | Quan sát evidence lịch sử D9 |
| TD §10 public endpoint | Quan sát thiết kế |

**Không có trong phiên này:** curl runtime Nest live; UAT headless mới; phỏng vấn user.

---

## 3. Inventory surfaces

### 3.1 Còn fixture / hardcode làm nguồn hiển thị (P0 — trong scope Epic)

| Surface | Path | Nguồn hiện tại | Ghi chú |
| --- | --- | --- | --- |
| Web home listing | `apps/web/app/page.tsx` | `demoEventRoutes()` / `findDemoEvent` từ `apps/web/src/events.ts` | Copy «Demo»; không gọi published list |
| Web event detail SSG | `apps/web/app/t/[tenantSlug]/events/[eventSlug]/page.tsx` | Cùng catalog; `dynamicParams=false` + `generateStaticParams` từ fixture | FAQ JSX hardcode (không đọc catalog); `category` / `description` / `highlights` / `theme` chỉ trên client |
| Web demo media | `apps/web/src/demo-media.ts` + `apps/web/src/ui/event-media.tsx` | Pack `/demo/logo.png`·`banner.png` theo fixture id / tenant slug demo | Prefer URL rồi fallback pack demo |
| iOS Events tab | `apps/mobile/src/screens/events.tsx` | `listDemoEvents` là `FlatList` chính; published list chỉ sau nút «Tải danh sách đã xuất bản» | Fail-closed khi published lỗi (đúng) nhưng **default UX vẫn demo** |
| iOS fixture detail | `apps/mobile/src/screens/event-detail.tsx` (`fixture`), `app/events/fixture/[eventId].tsx` | `findDemoEvent` / `findDemoEventById` | Route/deep link fixture tường minh |
| iOS demo catalog / media | `demo-events.ts`, `demo-media.ts`, `demo-media-assets.ts` | Hardcode + bundled raster | Comment: không fallback cho published fail |
| iOS ticket chrome media | `my-tickets.tsx`, `ticket-detail.tsx`, `components/event-media.tsx` | `hasDemoMediaForEventId` → bundled pack | Chỉ ảnh demo khi id khớp catalog; không phải listing text |
| Web/iOS unit tests gắn fixture | `apps/web/tests/events.test.ts`, `demo-media.test.ts`; `apps/mobile/src/data/demo-events.test.ts`, `demo-media.test.ts` | Khóa hành vi catalog | Cần đổi khi bỏ nguồn client |

### 3.2 Đã gọi / proxy published·admin API (giữ; không phá fail-closed)

| Surface | Path | API / hành vi |
| --- | --- | --- |
| Web redeem form/terms | `apps/web/src/redeem/published-schema.ts` → BFF `GET /api/bff/public/tenants/.../events/...` | Fail-closed; không invent form demo |
| Web BFF public event detail | `apps/web/app/api/bff/public/tenants/[tenantSlug]/events/[eventSlug]/route.ts` | Proxy upstream Nest |
| Web Admin events + config publish | `apps/web/app/admin/*`, BFF `admin/events`, `admin/publish`, config-versions | CRUD lifecycle C-E + publish C-B |
| iOS published client | `apps/mobile/src/published/published-event-api.ts` + `types.ts` | `GET /v1/public/tenants/{tenantSlug}/events` và `.../{eventSlug}` |
| iOS redeem / claim / push resolve | `screens/redeem.tsx`, `claim.tsx`, `push/notification-resolve.ts` | Published detail; không fallback fixture |
| iOS published detail UI | `event-detail.tsx` (`PublishedEventDetailView`) | Sections / FAQ / terms từ server DTO |
| Server demo seed | `packages/backend/src/demo-seed.ts` (+ script) | **Seed DB** có nhãn Demo — nguồn server, không phải catalog client |

### 3.3 Gap hạ tầng quan trọng (quan sát evidence D9 + source Nest)

| Mục | Evidence | Hệ quả sản phẩm |
| --- | --- | --- |
| Nest **thiếu** route `GET /v1/public/tenants/...` (list + detail theo TD) | `docs/reviews/D9-E2E-WEB-IOS-TICKET.md` / `*-DOD.md`: local + prod → Nest **404** `Cannot GET /v1/public/...` | Client iOS/web đã wire path nhưng **không có HTTP 200** → listing/detail server không usable cho guest |
| `rg` `apps/api/src` không thấy controller `public/tenants` | Quan sát worktree HEAD trên | Khớp known gap D9; **Architect/BE** phải đóng trước khi web/iOS cắt fixture display |
| Web **không** có BFF list `.../events` (chỉ detail) | Cây `apps/web/app/api/bff/public/...` | Home listing server cần BFF list (+ Nest) |

> **Suy luận:** “Đã có published API path trên client” ≠ “server đã phục vụ projection”. Epic này phải coi **BE public projection** là dependency cứng cho consumer web/iOS.

---

## 4. Actors / jobs

| Actor | Job liên quan Epic | Hệ thống đụng |
| --- | --- | --- |
| **Event Manager / Admin** | Tạo·sửa metadata event; soạn section (hero/info/faq/…); upload brand assets; **publish** atomic | Admin API C-E + C-B; UI admin |
| **Guest (public)** | Xem danh sách sự kiện PUBLIC; mở trang chi tiết; đọc FAQ/hướng dẫn | Public GET published list/detail; web home + `/t/...`; iOS Events |
| **Attendee** | Đổi mã / claim (đã published form·terms); xem vé | Redeem/claim (đã server); ticket media nên ưu tiên brand URL published, không demo pack ngầm |
| **Staff (Scanner/Supervisor)** | Gate theo event được gán — **không** phụ thuộc marketing listing | Gate APIs; listing public **không** là job P0 của staff trong Epic này |

---

## 5. Field map — Admin quản lý được vs UI hardcode

### 5.1 Metadata Admin (`EventDetail` / create·patch)

Quản lý được: `name`, `slug`, `timezone`, `startsAt`/`endsAt`, `venue` (name+address), `contact`, `visibility` (`PUBLIC`|`UNLISTED`), windows redeem/check-in, lifecycle content/business status, revision.

**Không có** trên metadata: `category`, `highlights[]`, `theme`, marketing `description` tự do kiểu fixture web.

### 5.2 Config published (`EventConfigPayload` — section kinds)

Allowlist: `hero`, `info`, `redeem`, `guide`, `faq`, `terms` (+ brand snapshot / assets logo·banner). FAQ items `q`/`a` có limit server (`config-schema`).

Projection client (`PublishedEventDetail`): sections + `faq` + `terms` + brand URLs — **không** có `category` / `highlights` / `theme`.

### 5.3 Gaps sản phẩm (public đang hardcode / thiếu Admin)

| Field / UX web fixture | Admin hôm nay | Đề xuất MVP |
| --- | --- | --- |
| `category` (eyebrow) | Không có field | **Defer** — dùng `brand.organizationName` hoặc `hero.title`; không mở schema category trừ khi Architect/user chốt |
| `description` (intro) | `hero`/`info` body text | Map → section `hero`/`info` sau publish |
| `highlights[]` | Không có list riêng | **Defer** hoặc dùng bullets trong `info` markdown/text; không hardcode client |
| `theme` (`festival`\|`studio`) | Không có | **Defer** — presentation từ brand color; bỏ dual theme CSS phụ thuộc fixture |
| FAQ | Section `faq` Admin **có** | Thay FAQ JSX hardcode bằng `faq` published |
| Logo/banner | Assets + brand snapshot | Ưu tiên `logoUrl`/`bannerUrl` published; demo pack chỉ khi seed demo **tường minh** (local), không fallback khi URL thiếu trên event thật |

---

## 6. In / out of scope (MVP Epic #254)

### In scope

1. Nguồn chuẩn: **published projection server** cho guest listing + event detail (web + iOS).
2. Đóng gap Nest (+ BFF web list nếu cần) theo TD / DTO đã freeze phía mobile types — **Architect chốt contract**.
3. Cắt / hạ cấp fixture client khỏi đường khách chính; empty/error/not-found rõ.
4. Admin giữ là nơi nhập liệu + publish; guest chỉ đọc published.
5. Seed D9 trên server vẫn được phép cho môi trường demo — **không** đồng nghĩa client hardcode là SoT.

### Out of scope / non-goals

- Android native; payment / refund / transfer; seat map; Apple/Google Wallet (O10).
- Đổi auth/OIDC/RLS/membership model.
- Deploy prod / store submit trừ ủy quyền riêng.
- Platform-wide discovery “mọi tenant trên một home” nếu chưa có product rule — **giả thuyết:** MVP listing theo `tenantSlug` (deep link / subdomain) hoặc danh sách tenant đã biết; Architect/PD chốt IA.
- Arbitrary HTML/CSS/JS trên nội dung event (giữ M04).
- Staff Gate UX redesign (ngoài phạm vi listing).

---

## 7. Acceptance criteria (Given / When / Then)

### AC1 — Guest listing từ server

**Given** tenant `T` có ≥1 event `contentStatus=PUBLISHED`, `visibility=PUBLIC`, business ACTIVE  
**When** Guest mở web home (theo IA đã chốt) hoặc iOS Events (đường chính, không nút “demo”)  
**Then** danh sách chỉ gồm projection server; không render catalog `events.ts` / `demo-events.ts` như nguồn chính; mỗi row khớp field summary published (id, slug, name, startsAt, location, brand…).

### AC2 — Guest detail từ server

**Given** event published với sections/faq/brand  
**When** Guest mở URL `/t/{tenantSlug}/events/{eventSlug}` hoặc deep link published tương đương trên iOS  
**Then** UI hiển thị name/time/location/brand/sections/faq/terms từ server; không dùng `findDemoEvent` cho path này.

### AC3 — Empty / not published / UNLISTED

**Given** không có event PUBLIC published thỏa filter, hoặc slug draft/UNLISTED  
**When** Guest gọi list/detail  
**Then** empty hoặc not-found rõ; **không** thay bằng fixture hư cấu; draft không lộ qua public GET.

### AC4 — Lỗi mạng / upstream

**Given** Nest/BFF lỗi hoặc misconfigured  
**When** Guest tải listing/detail  
**Then** error state fail-closed; **không** fallback demo-as-published (giữ invariant D9/M04).

### AC5 — Admin là nguồn nhập

**Given** Event Manager cập nhật hero/faq/brand và publish thành công  
**When** Guest tải lại public surface  
**Then** nội dung mới (theo `publishedConfigVersion`) xuất hiện; sửa draft chưa publish không đổi trang public.

### AC6 — Redeem/claim không hồi quy

**Given** published form/terms  
**When** Attendee đổi mã / claim  
**Then** vẫn load schema published fail-closed như hiện tại; Epic không phá C-F.

### AC7 — Fixture còn thì phải nhãn + ngoài đường chính

**Given** còn route/tooling demo (seed, `/events/fixture/*`, local pack)  
**When** user chạm surface đó  
**Then** nhãn Demo tường minh; không được là default home/listing production path.

### AC8 — Non-goals giữ vững

**Given** scope Epic  
**When** review DoD  
**Then** không có diff mở payment/seat/Android/Wallet; không đổi RLS/auth invariants.

---

## 8. Stories gợi ý cho planner (ownership)

| # | Story (VI) | Ownership | Dep |
| --- | --- | --- | --- |
| S0 | Chốt contract public list+detail (+ visibility filter, cache headers) | Architect → BE | — |
| S1 | Nest implement `GET /v1/public/tenants/{slug}/events` và `.../{eventSlug}` | `backend` | S0 |
| S2 | Web BFF list (+ dùng detail có sẵn); home + `/t/...` đọc server; empty/error | `web` | S1 |
| S3 | iOS Events default = published list; demote fixture routes | `ios` | S1 |
| S4 | PD: IA empty/error/loading; copy bỏ “fixture demo” trên đường khách | `product-design` | song song S0–S1 |
| S5 | Tests: bỏ/đổi tests khóa catalog; thêm contract/UAT headless evidence | BE/web/iOS | sau S1–S3 |
| S6 | (Tuỳ chọn) thu hẹp demo-media fallback trên ticket chrome | web/iOS | sau S2–S3 |

**Wave đề xuất:** S0∥S4 → S1 → S2∥S3 → S5 (reviewers theo PR).

---

## 9. Success evidence (không chỉ `worker_done`)

| Gate | Evidence gợi ý |
| --- | --- |
| Contract | OpenAPI / `@ticket/contracts` (+ mirror mobile types) khớp; Architect note |
| BE | Test publish → public 200; draft/UNLISTED → 404; RLS/tenant isolation |
| Web | Headless UAT: home/detail không còn text fixture; empty/error screenshot `apps/web/.uat-artifacts/` |
| iOS | Sim UAT: Events load published; fixture không phải tab mặc định |
| DoD | `docs/reviews/*` + exact SHA; reviewer ≠ implementer |

---

## 10. Quyết định đề xuất (chưa chốt)

Xem thêm mục **O12 đề xuất** trong [`docs/DECISION-LOG.md`](../DECISION-LOG.md).

| ID tạm | Câu hỏi | Đề xuất BA | Cần ai chốt |
| --- | --- | --- | --- |
| O12-a | SoT nội dung public event? | Chỉ published server projection; cấm client catalog làm nguồn hiển thị chính | User / product |
| O12-b | Fixture client sau Epic? | Chỉ route/tooling demo có nhãn hoặc xóa khỏi path khách; seed DB D9 giữ | Architect + PD |
| O12-c | `category` / `highlights` / `theme`? | **Không** mở field mới trong MVP Epic — map sang section/brand có sẵn | User nếu muốn giữ UX eyebrow |
| O12-d | Home web list theo đâu? | Theo tenant context (slug/subdomain) hoặc entry đã chốt IA — không tự invent global marketplace | PD + Architect |

---

## 11. Handoff

| Vai trò | Dùng artifact này để |
| --- | --- |
| **product-design** | Flow guest listing/detail + empty/error; bỏ dual “demo catalog + published button” làm default |
| **Architect** | Contract Nest public; mapping EventDetail+config → PublishedEventDetail/Summary; migration bỏ client SoT |
| **Epic planner** | Tách Story/Task theo §8; deps S0→S1→S2∥S3 |
| **backend / web / ios** | Implement theo AC; không mở non-goals |

**Còn lại sau BA:** PD prototype/IA; Architect ADR/contract; coding workers — **không** thuộc task docs này.
