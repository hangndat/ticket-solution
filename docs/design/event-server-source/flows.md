# Epic #254 — Flow public/attendee event (nguồn server)

| Trường | Giá trị |
| --- | --- |
| Role | `product-design` — [`docs/agents/roles/product-design.md`](../../agents/roles/product-design.md) |
| Epic | [#254](https://github.com/hangndat/ticket-solution/issues/254) |
| Ownership | `docs/design/event-server-source/**` only — không sửa `apps/*` |
| Ngày | 2026-10-18 |
| Trạng thái | Handoff PD — unblock web/iOS sau Architect/BA; **không** pilot ready |

**Baseline quan sát:** web home + `/t/…/events/…` đang SSG từ fixture (`apps/web/src/events.ts`); iOS Events đã có nhánh published API + fixture riêng (`/events/fixture/*`). Nguồn chuẩn sau Epic: **published projection** (`GET /v1/public/tenants/{tenantSlug}/events[/{eventSlug}]`), không fallback fixture khi API lỗi/trống.

Liên quan: [`ui-states.md`](./ui-states.md) · [`implementation-notes.md`](./implementation-notes.md) · D11 redeem [`docs/design/D11-PRODUCTION-UX-UI.md`](../D11-PRODUCTION-UX-UI.md) §1.1.

---

## 1. Persona & mục tiêu

| Persona | Mục tiêu trên surface này |
| --- | --- |
| **Attendee (khách)** | Tìm sự kiện đã xuất bản của tổ chức → đọc thông tin → **Đổi mã** (primary) hoặc **Nhận lời mời** (claim, secondary) |
| **Operator (Event Manager)** | Không dùng surface public để soạn nội dung — nhập/publish ở Admin (xem §5) |

**Nguyên tắc:** Public chỉ hiện projection đã publish. Draft / unpublished / archived → không lộ nội dung soạn thảo; attendee thấy empty / not-found / archived theo state matrix (không “đoán” fixture).

---

## 2. Flow chính — list → detail → CTA

```text
[Entry]
  Web:  /  (catalog tenant đang resolve)  hoặc  deep link /t/{tenantSlug}/events/{eventSlug}
  iOS:  tab Events  hoặc  deep link vemoki://… / published path

        │
        ▼
[A] Resolve tenant context
  · Có tenantSlug (path / query / session org) → tiếp
  · Thiếu / tenant không tồn tại → state empty-tenant (không list fixture)
        │
        ▼
[B] List published events
  GET …/tenants/{tenantSlug}/events
  · loading → empty | ready | unreachable | invalid
  · Tap/click row → [C]
  · CTA chrome: «Đổi mã» (web /redeem, iOS /redeem) luôn reachable từ list
        │
        ▼
[C] Detail published event
  GET …/tenants/{tenantSlug}/events/{eventSlug}
  · loading → ready | not-found | unreachable | invalid
  · Render: brand · name · time · location · media · sections (visible, order) · FAQ · terms
  · Không render draft; 404 = unpublished hoặc slug sai (cùng UI not-found trừ khi Architect tách code)
        │
        ▼
[D] Primary CTA — Đổi mã (redeem)
  · Từ section kind=redeem (nếu visible) hoặc sticky CTA «Đổi mã lấy vé»
  · Web: /redeem?tenantSlug&eventSlug (hoặc scope đã chọn) → form published + terms
  · iOS: /redeem với cùng scope
  · Auth: theo D11 — cần phiên + email verified; chưa login → CTA «Cần đăng nhập» (không invent OTP trong Epic này)
        │
        ▼
[E] Secondary CTA — Nhận lời mời (claim) — khi có token
  · Entry: /claim (+ fragment token) — khác redeem
  · Không thay list/detail; từ email/deep link invite
  · Sau claim thành công → ví / ticket surface (ngoài scope PD page event)
```

### 2.1 Web vs iOS (cùng nghiệp vụ, khác shell)

| Bước | Web | iOS |
| --- | --- | --- |
| List | Home (hoặc `/t/{tenant}/events`) — **dynamic** từ API; bỏ SSG fixture làm catalog chính | Tab Events — auto-load published (bỏ nút “Tải danh sách” làm primary; giữ retry) |
| Detail | `/t/{tenantSlug}/events/{eventSlug}` — SSR/CSR từ projection | `/events/[tenantSlug]/[slug]` — published only |
| Fixture | Chỉ nhãn rõ / route demo tách (nếu còn phục vụ UAT) — **không** là fallback | `/events/fixture/[eventId]` — explicit demo only |
| Redeem | `/redeem` primary | `/redeem` |
| Claim | `/claim` | tương đương deep link claim nếu đã có |

---

## 3. Nhánh lỗi / biên

```text
List/Detail fetch
  ├─ loading ……………………… skeleton / LoadingState (chưa tuyên bố trống)
  ├─ 200 + items=[] …………… empty-tenant-events
  ├─ 200 + detail ……………… ready
  ├─ 404 detail ………………… not-found (= unpublished / sai slug / không public)
  ├─ 5xx / network …………… unreachable + Thử lại
  ├─ 200 body invalid ……… invalid (fail-closed; không fixture)
  └─ thiếu API base URL …… misconfigured (dev) — copy VI, không silent demo

Archived (nếu API trả code/status riêng — gap Architect)
  └─ archived ………………… Empty/Error riêng; không CTA redeem active

Unpublished / draft
  └─ Public luôn 404/not-found — không preview guest
```

**Hủy / back:** Detail → List; Redeem hủy → Detail hoặc List (giữ tenant/event scope nếu đã có).

---

## 4. Deep link & entry map

| Entry | Hành vi mong muốn |
| --- | --- |
| Share link detail đã publish | Mở detail; nếu unpublish sau share → not-found |
| Home không có tenant | Chọn tổ chức / deep link có slug — không list cross-tenant demo |
| Fixture deep link cũ (`demo-*`, `/events/fixture/*`) | Vẫn mở demo **có nhãn**; không claim là published |
| Redeem không có event scope | Form yêu cầu chọn / nhập scope — hoặc deep link từ detail CTA |

---

## 5. Admin touchpoints (UX mô tả — không code admin)

Operator **không** sửa nội dung trên trang public. Chuỗi soạn → xuất bản:

```text
[Admin · đăng nhập staff]
  → Chọn tổ chức + sự kiện (sticky context: tên/slug > UUID)
  → Chuẩn bị nội dung
       · Thông tin sự kiện: name, slug, timezone, startsAt, location
       · Brand snapshot: primaryColor, organizationName, logo/banner assets
       · Sections (allowlist): hero | info | redeem | guide | faq | terms
       · Form đổi mã + termsVersion (C-F)
       · Upload asset → quarantine → READY rồi gắn brand
  → Preview (authenticated) — không phải URL public guest
  → Xuất bản (publish version) → projection public cập nhật
  → Archive / cancel → public hết hiện (not-found hoặc archived)
```

| Việc operator | Surface gợi ý (đã có hướng D11 workbench) | Ảnh hưởng attendee |
| --- | --- | --- |
| Tạo sự kiện | Admin events create | Chưa hiện public đến khi publish |
| Sửa config / sections | Config versions + editor | Chỉ sau publish mới đổi trang khách |
| Upload logo/banner | Assets init/finalize | Media trên list/detail |
| Publish | Nút Xuất bản + checklist readiness | List/detail hiện |
| Rollback semantic | Rollback → publish version mới | Nội dung đổi theo version mới |
| Archive | Archive event | Public không còn CTA redeem |

Chi tiết field mapping & gap contract: [`implementation-notes.md`](./implementation-notes.md).

---

## 6. UI AC (quan sát được — headless)

| # | Given / When / Then |
| --- | --- |
| AC-1 | Given tenant có ≥1 event published, When mở list, Then hiện tên + brand từ API, không nhãn «Demo» trừ route fixture |
| AC-2 | Given list trống, When API 200 items=[], Then empty VI + CTA Đổi mã vẫn có; **không** chèn fixture |
| AC-3 | Given event published, When mở detail, Then name/time/location/sections theo projection; CTA Đổi mã dẫn redeem đúng scope |
| AC-4 | Given slug chưa publish / sai, When mở detail, Then not-found VI; không fallback fixture |
| AC-5 | Given API down, When list hoặc detail, Then unreachable + Thử lại; không thay bằng demo catalog |
| AC-6 | Given section redeem visible, When ready detail, Then CTA primary rõ ràng (web + iOS) |

**UAT headless:** web → `scripts/web-uat.sh` / Playwright trên list+detail+redeem entry; iOS → `scripts/sim-uat.sh` — không computer-use chuột desktop.

---

## 7. DoD role PD (Epic slice này)

- [x] User flow attendee list → detail → redeem/claim (+ admin touchpoints mô tả)
- [x] State matrix + copy VI — [`ui-states.md`](./ui-states.md)
- [x] A11y + implementation notes + field gap — [`implementation-notes.md`](./implementation-notes.md)
- [ ] Coding web/iOS — **sau** handoff (ownership workers)
- [ ] Architect chốt gap contract (highlights/category/archived code) — flagged trong notes
