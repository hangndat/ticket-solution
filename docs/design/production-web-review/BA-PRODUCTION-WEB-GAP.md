# BA — Gap “public web chưa giống production”

| Trường | Giá trị |
| --- | --- |
| Role | `product-ba` — [`docs/agents/roles/product-ba.md`](../../agents/roles/product-ba.md) |
| Ownership | **Chỉ** `docs/design/production-web-review/**` (docs-only; không sửa `apps/**`) |
| Ngày quan sát live | 2026-10-18 |
| Live product | `https://app.vemoki.com` |
| Apex marketing | `https://vemoki.com` → rewrite `/marketing` |
| Tip code đối chiếu | `origin/main` @ `d16ee368c68b2a6de12a6461e94acd8208dda192` (sau UI realism #391/#392/#393) |
| Architecture impact | Không (discovery/docs) |
| Trạng thái | Đề xuất AC cho đợt polish kế tiếp — **không** claim pilot/production ready |

---

## 1. Problem / outcome

### Persona (PRD §3)

| Persona | Việc trên public web | Kết quả mong muốn |
| --- | --- | --- |
| **Attendee (guest)** | Mở link sự kiện / trang chủ, hiểu “đây là sự kiện thật”, đổi mã hoặc nhận lời mời khi có | Cảm giác brand sự kiện / nền tảng tin cậy; biết bước tiếp theo mà không thấy tool nội bộ |
| **Attendee (đã đăng nhập)** | Đăng nhập → đổi mã / claim → xem vé | Luồng tài khoản rõ, không panel “phiên / unconfigured”; vẫn brand-first |
| (Ngoài phạm vi đợt này) Event Manager / Scanner / CS | Admin / Gate | Không mở rộng IA admin trong đợt polish guest này |

### Vấn đề (lời user)

> «Tạm ổn về mặt câu chữ nhưng đây không giống 1 trang web production»

Sau đợt UI realism (auth/demo chrome/seed), copy tiếng Việt đã sạch hơn, nhưng **cảm giác tổng thể** trên `app.vemoki.com` vẫn gần **staging / catalog demo / admin tool** hơn là **trang sự kiện production + brand**.

### Outcome mong muốn

Khách guest (và khách vừa đăng nhập) khi mở home / event / auth / redeem / claim cảm nhận:

1. Đây là **sản phẩm sự kiện đang vận hành**, không phải môi trường thử với label Demo và asset dùng chung.
2. **Một composition brand** (Vemoki hoặc brand event), CTA rõ, không lộ jargon vận hành/máy chủ.
3. Trust tối thiểu: chia sẻ/OG đúng domain, footer/privacy đủ, không `noindex` toàn product nếu đã public intentional.

---

## 2. Quan sát từ live + code

**Phương pháp:** HTTP `curl` HTML tươi trên live (2026-10-18); đối chiếu source `apps/web` trên tip `d16ee368c68b…`. Playwright headless (`scripts/web-uat.mjs screenshot`) **không chạy được** trong worktree này (`playwright` module thiếu) — evidence chính = HTML/headers; checklist mắt thường + UAT headless là bước nghiệm thu sau khi PD/web ship.

**Phân loại:** Q = quan sát · S = suy luận BA · G = giả thuyết (cần PD/user).

### 2.1 Home — `https://app.vemoki.com/`

| # | Quan sát | Loại | Vì sao “không production” |
| --- | --- | --- | --- |
| H1 | Hai sự kiện: **«MFest · Demo»**, **«Studio Night · Demo»**; slug tenant `mfest-demo` / `demo-studio` | Q | Label Demo trên bề mặt khách = staging seed, không phải catalog production |
| H2 | Cả hai card dùng chung `/demo/banner.png` và `/demo/logo.png` (preload + `src`) | Q | Media không phân biệt brand → collage demo / leftover crop path |
| H3 | Aside: **«Danh sách từ máy chủ.»** + nhắc đổi mã/đăng nhập | Q (source `app/page.tsx`) | Copy vận hành/BFF — đúng cho nội bộ, sai cho guest |
| H4 | Danh sách dạng `event-row` (logo + banner + eyebrow org + tên + địa điểm + «Xem sự kiện») — không ngày giờ nổi, không atmosphere riêng | Q+S | Đọc như **list admin/catalog** hơn discovery sự kiện |
| H5 | Hero: wordmark + headline + intro + 1 CTA «Đổi mã lấy vé» — câu chữ ổn, brand có mặt | Q | Copy gần production; bị kéo xuống bởi H1–H4 |
| H6 | `robots: noindex, nofollow` (root `layout.tsx` + HTML live) | Q | Tín hiệu “chưa public SEO” — staging mindset |
| H7 | `og:image` / Twitter image = `http://localhost:3000/opengraph-image.png?...` | Q | Share/preview vỡ trust; thiếu `metadataBase` production |
| H8 | Footer chỉ «vemoki↗ · Đổi mã lấy vé · Cổng kiểm soát vé» — không link Privacy/Support trên chrome product | Q | Trust/legal mỏng so với apex marketing (privacy/support đã 200) |

### 2.2 Event detail — `/t/mfest-demo/events/mfest` (và Studio Night)

| # | Quan sát | Loại | Gap |
| --- | --- | --- | --- |
| E1 | Title/H1 vẫn **«MFest · Demo»**; media `/demo/*` | Q | Demo residue |
| E2 | CTA hero duy nhất: **«Xem chi tiết ngày ↓»** — không «Đổi mã» / «Nhận lời mời» | Q | Thiếu CTA attendee chính trên trang sự kiện |
| E3 | Eyebrow section: **«Nội dung đã xuất bản»** / «Chi tiết từ ban tổ chức» | Q | Ngôn ngữ CMS/publish pipeline, không phải guest |
| E4 | Body/FAQ tiếng Anh; chrome VI | Q | Lệch locale — cảm giác seed nội dung chưa polish |
| E5 | Hero 2 cột (copy + poster), không full-bleed atmosphere | Q+G | PD cần chốt composition; hiện tại gần “tool page có poster” hơn landing sự kiện |
| E6 | Nav event: wordmark + tên org — mỏng; không redeem shortcut | Q | |

### 2.3 Auth — `/auth`

| # | Quan sát | Loại | Gap |
| --- | --- | --- | --- |
| A1 | Copy hướng guest («Đăng nhập để đổi mã… Đây không phải cổng…») ổn hơn trước | Q | Tiến bộ realism |
| A2 | Trạng thái: **«Chưa đăng nhập»** / **«Không có phiên hợp lệ»** + khối thao tác | Q+S | Đọc như **panel phiên / admin tool**, không phải auth marketing nhẹ của brand |
| A3 | Cùng `noindex` + OG localhost | Q | Trust/share |

### 2.4 Redeem — `/redeem`

| # | Quan sát | Loại | Gap |
| --- | --- | --- | --- |
| R1 | Form lộ **Mã tổ chức · Mã sự kiện · Đường dẫn tổ chức · Đường dẫn sự kiện · Mã đổi vé** (`tenantId`, `eventId`, `tenantSlug`, `eventSlug`, `code`) | Q | Classic **ops/admin form**; khách có mã email không cần 4 trường kỹ thuật |
| R2 | Copy hướng dẫn «Tải biểu mẫu…» khá rõ trạng thái chờ duyệt | Q | Câu chữ tạm ổn; chrome form kéo cảm giác tool |
| R3 | Không deep-link context sự kiện trên UI (guest phải tự biết slug/UUID hoặc preload) | S | Production thường: mở từ trang event → redeem prefilled, ẩn ID |

### 2.5 Claim — `/claim`

| # | Quan sát | Loại | Gap |
| --- | --- | --- | --- |
| C1 | Tương tự redeem: đường dẫn org/event + UUID + mã lời mời; empty state «Chưa có mã lời mời» | Q | Tool page; thiếu “bạn được mời tới [Event]” atmosphere |
| C2 | Copy phân biệt lời mời khách vs thành viên — tốt | Q | Giữ; polish visual/IA |

### 2.6 Apex vs product

| # | Quan sát | Loại | Gap |
| --- | --- | --- | --- |
| M1 | `vemoki.com` marketing: brand-first, disclaimer «Demo giả lập», CTA bán platform | Q | Marketing đã “web hơn”; product app vẫn catalog demo |
| M2 | `/privacy`, `/support` apex → 200 (rewrite marketing) | Q | Trust có trên apex; **product footer không dẫn** |

### 2.7 Tổng hợp cảm giác

```text
Staging/demo admin tool          ← live app.vemoki.com (hiện tại)
  · Demo titles + shared /demo media
  · “Danh sách từ máy chủ” / “Nội dung đã xuất bản”
  · Redeem/claim = form UUID/slug
  · Auth = session panel
  · List-as-admin + noindex + OG localhost

Sự kiện / production brand       ← outcome đợt polish
  · Tên & media thật theo event
  · Guest copy only; technical meta ẩn
  · Redeem/claim contextual, 1–2 field khách
  · Auth brand-light; event page CTA attendee
  · Trust: OG domain, footer legal, atmosphere
```

---

## 3. In / out of scope (đợt polish kế tiếp)

### IN

- Public guest surfaces: home, event detail `/t/...`, `/auth`, `/redeem`, `/claim`, nav/footer product.
- Copy VI guest-facing; ẩn/gỡ demo residue trên chrome khách.
- Content/seed production-like (tên, media riêng, locale) — BE/seed khi thiếu asset API.
- Metadata trust: `metadataBase`/OG tuyệt đối trên domain prod; chính sách robots product (chốt với PD/ops).
- CTA hierarchy attendee trên event; redeem/claim contextual (prefill, progressive disclosure ID).
- Visual polish theo **PD handoff** (không invent pixel trong BA).

### OUT (giữ non-goals MVP)

- Payment / refund / chuyển nhượng vé  
- Android native / Wallet / seat map  
- Mở rộng IA admin / Gate scanner (trừ link thoát rõ khỏi guest)  
- Anonymous redeem (auth pin hiện tại: login + email verified — xem D11 PD)  
- Deploy/store submit trừ khi task riêng ủy quyền  
- Đổi contract API lớn ngoài thiếu field content/media cần thiết  

---

## 4. User stories + AC (kiểm chứng được)

Ownership mặc định: **web**. **BE/seed** chỉ khi thiếu content/API/media. Ưu tiên P0 → P2.

### P0 — Bắt buộc trước khi gọi “giống production hơn”

#### US-P0-1 — Gỡ demo residue trên catalog khách

**Là** attendee guest, **tôi muốn** danh sách/home và trang sự kiện không mang nhãn Demo / asset demo dùng chung, **để** tin đây là sự kiện thật.

| AC | Kiểm chứng |
| --- | --- |
| AC-P0-1a | Trên `app.vemoki.com/`, không còn chuỗi `· Demo` (hoặc tương đương) trong tên sự kiện hiển thị khách — **hoặc** có nhãn guest rõ «Sự kiện mẫu» tách biệt visual + không dùng chung 1 banner cho ≥2 event khác brand |
| AC-P0-1b | Hai event published khác nhau có `bannerUrl`/`logoUrl` **khác nhau** (HTTP HEAD/URL hoặc screenshot) |
| AC-P0-1c | Seed/API: ownership BE nếu chỉ đổi data; web nếu hardcode `/demo/*` fallback trên guest path |

**Owner:** BE (seed/content) + web (fallback UI) · **Deps:** PD chốt naming “mẫu vs production seed”

#### US-P0-2 — Home không nói chuyện “máy chủ”

**Là** guest, **tôi muốn** home không hiển thị meta vận hành, **để** không cảm giác staging.

| AC | Kiểm chứng |
| --- | --- |
| AC-P0-2a | HTML home **không** chứa «Danh sách từ máy chủ» (hoặc tương đương kỹ thuật) |
| AC-P0-2b | Empty/unreachable states vẫn plain VI guest (`PUBLIC_EVENT_COPY`) — không lộ Nest/BFF/fixture |

**Owner:** web

#### US-P0-3 — Trust share & metadata

**Là** người nhận link, **tôi muốn** preview/OG trỏ domain Vemoki thật, **để** không thấy localhost.

| AC | Kiểm chứng |
| --- | --- |
| AC-P0-3a | `curl -sL https://app.vemoki.com/` → `og:image` **không** chứa `localhost` |
| AC-P0-3b | Absolute URL dùng `https://app.vemoki.com` (hoặc CDN prod đã cấu hình) |
| AC-P0-3c | Quyết định robots (index guest event vs noindex app shell) ghi trong PD/ops; implement khớp quyết định |

**Owner:** web (+ coordinator env nếu cần) · **Deps:** chốt robots với PD

#### US-P0-4 — Event page có CTA attendee

**Là** guest trên trang sự kiện, **tôi muốn** CTA chính là đổi mã / nhận vé (khi áp dụng), **để** không chỉ “cuộn chi tiết”.

| AC | Kiểm chứng |
| --- | --- |
| AC-P0-4a | Above-the-fold event có ≥1 CTA primary tới `/redeem` (prefill tenant/event) và/hoặc `/claim` theo PD |
| AC-P0-4b | «Xem chi tiết ngày» không phải CTA duy nhất cạnh hero |
| AC-P0-4c | Không dùng eyebrow «Nội dung đã xuất bản» trên guest — đổi copy guest (PD) |

**Owner:** web · **Deps:** PD handoff CTA/copy

#### US-P0-5 — Redeem/claim không phải form admin

**Là** attendee có mã/link, **tôi muốn** chỉ nhập mã (+ điều khoản), **để** không điền UUID/slug.

| AC | Kiểm chứng |
| --- | --- |
| AC-P0-5a | Happy path từ event → redeem: khách **không** thấy `tenantId`/`eventId` (ẩn hoặc progressive «Chi tiết kỹ thuật») |
| AC-P0-5b | Claim từ magic link: hiển thị tên sự kiện + bước đăng nhập; không empty form 4 field kỹ thuật làm primary |
| AC-P0-5c | Deep-link / query prefill vẫn hoạt động; fail-closed auth giữ nguyên |

**Owner:** web · **Deps:** PD form IA

### P1 — Tăng cảm giác brand / atmosphere

#### US-P1-1 — Auth brand-light

| AC | Kiểm chứng |
| --- | --- |
| AC-P1-1a | Guest chưa login: headline/benefit VI; tránh «Không có phiên hợp lệ» làm tiêu đề chính (chuyển sang detail kỹ thuật nếu cần) |
| AC-P1-1b | Headless screenshot `/auth` vs marketing login CTA: cùng họ brand tokens, không panel debug |

**Owner:** web · **Deps:** PD

#### US-P1-2 — Home discovery, không list-as-admin

| AC | Kiểm chứng |
| --- | --- |
| AC-P1-2a | Mỗi event card: ngày/giờ (hoặc «Sắp diễn ra») nổi; media crop theo PD (không logo+banner chồng như bảng quản trị) |
| AC-P1-2b | Hierarchy: một composition first viewport (brand + 1 CTA) — catalog dưới fold hoặc secondary (PD) |

**Owner:** web · **Deps:** PD visual

#### US-P1-3 — Footer trust trên product

| AC | Kiểm chứng |
| --- | --- |
| AC-P1-3a | Footer product có link Privacy + Support (apex hoặc route tương đương) |
| AC-P1-3b | Không thêm payment/marketplace |

**Owner:** web

#### US-P1-4 — Locale nội dung event

| AC | Kiểm chứng |
| --- | --- |
| AC-P1-4a | Seed pilot (MFest): FAQ/highlights VI **hoặc** UI báo ngôn ngữ; không mix EN body + VI chrome không giải thích |
| AC-P1-4b | Owner BE seed nếu chỉ data |

**Owner:** BE (content) ± web

### P2 — Nice-to-have

| ID | Story (rút) | AC tóm tắt | Owner |
| --- | --- | --- | --- |
| US-P2-1 | Social proof / atmosphere nhẹ (không fake metrics) | PD: 1 block “Không khí sự kiện” từ content published; không bịa số liệu | web + PD |
| US-P2-2 | Signed-in chrome: «Vé của tôi» rõ sau login | Nav capability đã có nền tảng O02 — polish label/empty | web |
| US-P2-3 | Motion tinh tế hero/redeem success | `prefers-reduced-motion` giữ | web + PD |

---

## 5. Dependencies

| Dependency | Ai | Chặn gì |
| --- | --- | --- |
| **PD handoff visual** (composition home/event, form redeem/claim, auth, tokens motion) | `product-design` | P0-4/5, P1-* pixel/IA |
| **Seed/content + media riêng per event** | BE / ops seed | P0-1, P1-4 |
| **Deploy prod** web (+ API nếu seed) sau merge | Coordinator khi ủy quyền | Evidence live trên `app.vemoki.com` |
| **Robots/index policy** | PD + ops | P0-3c |
| Không chờ | payment/Android/Wallet/seat | — |

Song song: BA artifact này **không** chặn PD bắt đầu; coding web chờ PD cho slice visual, có thể làm P0-2/P0-3 sớm nếu PD đồng ý copy/metadata.

---

## 6. Success evidence

### 6.1 Trước ship (CI / local)

- Diff chỉ `apps/web` (± seed BE) theo Story; không trộn mobile.
- Unit/integration web hiện có vẫn xanh; thêm assert copy cấm nếu phù hợp (`Danh sách từ máy chủ`, `localhost` trong og).

### 6.2 Headless UAT (bắt buộc khi đóng đợt polish)

```bash
# Sau khi có playwright trong môi trường CI/dev:
pnpm exec node scripts/web-uat.mjs screenshot https://app.vemoki.com/ \
  apps/web/.uat-artifacts/ba-prod-home.png
pnpm exec node scripts/web-uat.mjs screenshot https://app.vemoki.com/auth \
  apps/web/.uat-artifacts/ba-prod-auth.png
pnpm exec node scripts/web-uat.mjs screenshot https://app.vemoki.com/redeem \
  apps/web/.uat-artifacts/ba-prod-redeem.png
pnpm exec node scripts/web-uat.mjs screenshot https://app.vemoki.com/claim \
  apps/web/.uat-artifacts/ba-prod-claim.png
pnpm exec node scripts/web-uat.mjs screenshot \
  https://app.vemoki.com/t/<tenant>/events/<event> \
  apps/web/.uat-artifacts/ba-prod-event.png
```

Checklist tự động (HTTP) tối thiểu:

```bash
curl -sL https://app.vemoki.com/ | grep -v -e 'Danh sách từ máy chủ' -e 'localhost:3000'
# og:image không localhost; tên sự kiện theo AC-P0-1
```

### 6.3 Checklist mắt thường trên `app.vemoki.com` (guest)

- [ ] First viewport: brand rõ, không disclaimer máy chủ  
- [ ] ≥2 event (nếu còn) khác media; không `· Demo` trừ khi PD chấp nhận badge «Mẫu»  
- [ ] Event: CTA đổi mã/mời nổi; không eyebrow publish pipeline  
- [ ] Redeem/claim: không form UUID primary  
- [ ] Auth: không panel phiên làm hero  
- [ ] Share preview (iMessage/Zalo/Slack) ra ảnh/domain Vemoki  
- [ ] Footer: Privacy/Support  

### 6.4 Evidence phiên BA này (baseline — chưa pass)

| Nguồn | Kết quả |
| --- | --- |
| Live HTML home/auth/redeem/claim/event | Gap H1–H8, A*, R*, C*, E* như §2 |
| Apex marketing | Đã “web hơn”; product lệch |
| `scripts/web-uat.mjs screenshot` | **Chưa chạy** — thiếu module `playwright` trong worktree |
| Tip `origin/main` | `d16ee368c68b2a6de12a6461e94acd8208dda192` |

---

## 7. Handoff

| Người nhận | Việc |
| --- | --- |
| Coordinator / Epic planner | Tách Story/Task web (+ BE seed) theo P0→P1; spawn PD song song |
| `product-design` | Visual/IA handoff cho P0-4/5 + P1; không mở payment/seat/Wallet |
| `web` | Implement theo AC; UAT headless |
| `backend` | Seed/media/locale khi AC-P0-1 / P1-4 cần data |

**Không:** worker BA này sửa `apps/**`, merge feature, hay tuyên bố production ready.
