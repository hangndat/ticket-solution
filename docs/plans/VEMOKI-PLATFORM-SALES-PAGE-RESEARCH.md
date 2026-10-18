# Vemoki — Nghiên cứu trang bán hàng nền tảng (platform sales / GTM site)

| Trường | Giá trị |
| ------ | ------- |
| Ngày | 2026-10-18 |
| Vai trò | `product-ba` (research) — chưa ủy quyền coding |
| Nguồn sản phẩm | [PRD](../PRD.md), [O09 brand](../DECISION-LOG.md), ASC listing, `brand/vemoki/tokens.json` |
| Nguồn thị trường | Web Anatomy event-tech homepage benchmark (10/2026); Eventbrite / Ticket Tailor / Splash / Humanitix positioning; tổng hợp Dashboard [DASHBOARD-MARKET-SYNTHESIS](./DASHBOARD-MARKET-SYNTHESIS.md) |
| Source đối chiếu | Homepage hiện tại `apps/web/app/page.tsx` |
| Trạng thái | **Đã chốt O13** (2026-10-18) — xem §8 và [DECISION-LOG O13](../DECISION-LOG.md#o13--trang-bán-platform-gtm--tách-subdomain-18102026). Chưa tự ủy quyền coding |

---

## 1. Kết luận ngắn

1. **Vemoki chưa có trang bán nền tảng.** `/` trên app hiện là surface **khách** (đổi mã + demo event), không phải trang thuyết phục Tenant Owner / Agency.
2. **Định vị:** ops platform in-person (invite-code → QR → Gate) — không marketplace, không CRM/pipeline.
3. **MVP không hứa** thanh toán / seat / Wallet / Android. Demo hiện có = **giả lập** — không dùng làm social proof khách thật.
4. **Ba surface brand** giữ nguyên: marketing Vemoki · tenant/org · event guest.
5. **Đã chốt (O13):** buyer = Owner + Agency; `vemoki.com` = sales; `app.vemoki.com` = product; CTA = Xem demo **và** Đăng ký quan tâm. Wave tiếp: architect handoff subdomain → PD → web/coordinator — **chưa** spawn từ file này trừ khi user ủy quyền.

---

## 2. Problem / outcome

### Pain

| Persona (PRD §3) | Pain khi không có trang bán platform |
| ---------------- | ------------------------------------ |
| Prospect Tenant Owner / Agency | Không hiểu Vemoki khác Eventbrite/cổng tự dựng ở đâu; không biết bước tiếp theo (demo / liên hệ / đăng ký) |
| Platform Operator | Không có funnel GTM; mọi giới thiệu phụ thuộc demo thủ công / word-of-mouth |
| App Store / ASC | Marketing URL = `vemoki.com` nhưng root không kể câu chuyện nền tảng; privacy còn 404 |
| Attendee (không phải buyer) | Không phải buyer của trang này — giữ họ trên redeem / event slug |

### Outcome mong muốn

Prospect organizer/agency trong **≤30 giây** biết: (a) Vemoki dành cho event **in-person + Gate**, (b) multi-tenant / white-label cho org & agency, (c) CTA rõ (xem demo / đăng ký quan tâm / đăng nhập admin). Attendee không bị nhầm trang bán với trang đổi vé.

---

## 3. Hiện trạng trong repo

| Surface | Path | Vai trò thực tế | Gap GTM |
| ------- | ---- | --------------- | ------- |
| Home | `apps/web/app/page.tsx` | Hero Vemoki + CTA **Đổi mã** + list demo event | Thiếu value prop B2B, workflow ops, trust, CTA bán |
| Platform admin login | `/platform` | OIDC Platform Operator | Không phải marketing |
| Admin / auth / redeem / gate | `/admin`, `/auth`, `/redeem`, `/gate` | Product app | Đúng — không thay bằng landing |
| Event guest | `/t/[tenant]/events/[event]` | Brand **event/org** | Không được lẫn chrome bán Vemoki |
| Privacy | `https://vemoki.com/privacy` | ASC bắt buộc | **404** (privacy-nutrition) — blocker store & trust |
| Brand tokens | `brand/vemoki/tokens.json` | ink `#22241f`, paper `#f7f6f1`, signal `#9b3a18`, focus `#235fd0` | Đủ cho marketing; tránh palette AI tím/cream mặc định |

ASC subtitle đã có câu đúng hướng: *free/invite issuance; paid checkout out of scope* — trang bán phải **giữ** tone này, không “pitch” bán vé trả phí.

---

## 4. Positioning đề xuất

### Một câu (working)

> **Vemoki** là nền tảng multi-tenant để tổ chức và agency tự dựng sự kiện, phát vé mời/mã, và kiểm soát cổng — thương hiệu của bạn phía khách, vận hành chung một platform.

### Category

| Chọn | Không chọn |
| ---- | ---------- |
| Event **ops / admission** platform (in-person) | Event marketplace / discovery |
| Invite · redeem · QR · Gate · audit | Paid checkout · refund · seat map (MVP) |
| White-label / multi-tenant cho org + agency | Single-brand box-office SaaS only |
| Web admin + iOS (khách + scanner) | Android native (hủy MVP) |

### Đối thủ gần (học pattern, không copy claim)

| Đối thủ | Họ bán gì trên homepage | Vemoki khác |
| ------- | ----------------------- | ----------- |
| Eventbrite | Marketplace + bán vé nhanh + audience | Không marketplace; không pitch phí bán vé |
| Ticket Tailor | Self-serve ticketing + white-label buyer UX | Gần hơn về brand-first; Vemoki nhấn **Gate/offline + invite/quota** hơn “flat fee bán vé” |
| Splash | Event marketing pages + pipeline/ROI | Không CRM/pipeline; Vemoki = phát hành + cổng |
| Cvent / Bizzabo | Enterprise suite | Quá rộng; Vemoki giữ SMB/agency ops hẹp (đã reject BI suite ở Dashboard research) |
| Humanitix | Charity / impact fees | Khác mô hình giá & mission |

**Bài học Dashboard research vẫn đúng cho marketing:** học pattern ops, reject revenue/UTM/CRM messaging trên surface bán MVP.

### Pattern convert (Web Anatomy, event-tech 10/2026)

Trang mạnh làm 4 việc sớm:

1. **Format rõ** trong first viewport — với Vemoki: **sự kiện trực tiếp + vào cổng**.
2. **Workflow sản phẩm thật** (không chỉ slogan).
3. **Trust sớm** (logo khách / quy mô / pilot có tên khi được phép).
4. **CTA ma sát thấp** (demo / đăng ký quan tâm / product tour) — chưa cần self-serve billing.

---

## 5. IA trang bán (đề xuất 1 page + phụ)

### First viewport (một composition — brand-first)

Theo rule design landing của dự án: một composition, brand hero-level, không dashboard, không card cluster, không overlay badge trên hero.

| Phần tử | Nội dung gợi ý (VI) |
| ------- | ------------------- |
| Brand | Wordmark **vemoki** + mark (tokens) — hero-level |
| Headline | Một câu outcome organizer (vd. “Từ mã mời đến cổng — trên một nền tảng”) |
| Support | 1 câu: multi-tenant · white-label khách · Gate có audit |
| CTA group | **Cả hai primary:** `Xem demo` → `app.vemoki.com` (fixture, nhãn giả lập) · `Đăng ký quan tâm` (form/email trên marketing) · Secondary: `Đăng nhập` → `app.vemoki.com/auth` |
| Visual | Một plane full-bleed: product UI (Gate / redeem / admin) — không collage card |

**Không** nhồi first viewport: pricing table, danh sách event công khai, stats giả, schedule, địa chỉ.

### Sections sau fold (một job / section)

1. **Ai dùng** — Tenant Owner · Agency (buyer) · Gate staff · Attendee (không bắt buộc app; không phải buyer trang này).
2. **Luồng vận hành** — Tạo event → loại vé/nguồn mã → đổi mã/email → QR → Gate → dashboard ops.
3. **White-label** — khách thấy brand org/event; platform chỉ ở marketing / account / IdP.
4. **An toàn vận hành** — tenant isolation, deny-by-default, retry-safe (ngôn ngữ người mua).
5. **Demo giả lập** — section/CTA demo **phải** ghi rõ fixture/hư cấu; **không** logo “khách hàng” từ demo seed.
6. **CTA lặp** + Privacy · Support · App Store (khi có).

### Bản đồ host (đã chốt O13 — phương án A)

| Host | Vai trò | Nội dung chính |
| ---- | ------- | -------------- |
| `vemoki.com` (www) | **Marketing / sales** | `/` sales Owner+Agency; `/privacy`; `/support`; form quan tâm; liên kết demo → app |
| `app.vemoki.com` | **Product** | Auth, admin, redeem, gate, event guest `/t/…`, home attendee/demo hiện tại chuyển sang đây |

ASC: Marketing URL + Support → `vemoki.com` (sales + privacy 200). Organizer/attendee deep link / listing notes trỏ `app.vemoki.com` khi tách xong.

**Repo:** có thể giữ monorepo `apps/web` với host-aware routing hoặc tách package marketing sau — architect chốt trong handoff; O13 chỉ khóa **DNS/host boundary**, không bắt buộc tách git repo ngay.

---

## 6. Messaging — được nói / không được nói (MVP)

### Được nhấn

- Multi-tenant, org tự chạy nhiều event
- Agency: membership nhiều tenant (không cần fork code)
- Vé mời / mã / import khách; QR; email giao vé
- Check-in Gate; chống trùng; audit; offline Gate (khi đã ship)
- White-label cấu hình (D8)
- Web + iOS; khách Android dùng web
- Ops-honest (asOf, không “real-time ảo”)
- Demo **có nhãn giả lập** — trải nghiệm sản phẩm, không bằng chứng khách hàng

### Cấm hoặc trì hoãn trên trang bán

| Claim | Lý do |
| ----- | ----- |
| Bán vé / thanh toán / refund / chuyển nhượng | Ngoài MVP có chủ đích |
| Seat map, Apple/Google Wallet | Ngoài MVP |
| Android app native | Hủy khỏi kế hoạch MVP |
| Marketplace “tìm sự kiện gần bạn” | Sai category |
| “Real-time dashboard tuyệt đối” | Đã chốt O12: asOf + honest latency |
| Logo / case study từ demo seed như khách thật | O13: mọi demo hiện nay = giả lập |
| Số liệu khách / uptime bịa | Trust killer |

### Giá

PRD: *Không bàn ngân sách hoặc giá trong PRD.* P0–P1: CTA **Đăng ký quan tâm** + **Xem demo**; chưa self-serve pricing.

---

## 7. Tech / ownership gợi ý (sau khi duyệt)

| Việc | Ownership | Ghi chú |
| ---- | --------- | ------- |
| O13 đã chốt | product-ba + user | Xong 2026-10-18 |
| Handoff subdomain (DNS, cookie, CORS, `PUBLIC_WEB_ORIGIN`, Keycloak redirect) | **architect** | Architecture impact: **Có** — blocker consumer web/coordinator |
| Visual / prototype marketing | product-design | Tokens Vemoki; CTA cả hai; nhãn demo giả lập |
| Sales site trên `vemoki.com` + privacy | web | Host-aware hoặc package marketing |
| Product host `app.vemoki.com` + redirect cũ | web + coordinator | nginx/DNS; không đụng contract API trừ redirect URI |
| ASC Marketing/Support URL | asc docs | `vemoki.com` (+ privacy 200) |
| DoD | reviewer-dod | Exact SHA; headless UAT |

**Architecture impact: Có** — tách subdomain + cookie/OIDC redirect; bắt buộc Task architect trước (hoặc song song sớm) coding deploy.

---

## 8. Quyết định đã chốt (O13 — 2026-10-18)

| # | Chốt | Chi tiết |
| - | ---- | -------- |
| 1 | Primary buyer | **Tenant Owner + Agency** (B2B). Attendee không phải buyer trang bán. |
| 2 | Root marketing vs product | Khớp buyer (#1) + tách host (#5): **`vemoki.com/` = sales**; product/attendee/demo/redeem/admin/gate trên **`app.vemoki.com`**. |
| 3 | CTA P1 | **Cả hai:** `Xem demo` (→ app, fixture) **và** `Đăng ký quan tâm` (form/email trên marketing). |
| 4 | Proof / demo | **Mọi demo hiện nay = giả lập.** Không logo/case study demo như khách thật; UI phải nhãn rõ “Demo giả lập” / fixture. |
| 5 | Host model | **Tách subdomain** ngay trong phạm vi GTM: marketing `vemoki.com`, app `app.vemoki.com`. |

### Bổ sung chốt (cùng ngày)

| # | Chốt | Chi tiết |
| - | ---- | -------- |
| 6 | Locale | Marketing **VI và EN** trên `vemoki.com` (switch hoặc path `/en`). Product app mặc định VI (O04). |
| 7 | Ủy quyền coding | **Sau PD handoff → web code ngay**, không hỏi lại user. Feature branch/PR + DoD; không tự deploy prod / store. |

### Còn mở (không chặn O13)

| # | Câu hỏi | Gợi ý mặc định |
| - | ------- | -------------- |
| A | Privacy + Support host khi nào? | P0 cùng wave sales — **trước** submit store |
| C | Tách git repo marketing? | Không bắt buộc; architect có thể giữ monorepo + host routing |

---

## 9. Roadmap đề xuất (không tự dispatch)

```text
Wave 0  O13 đã chốt (xong) — gồm VI+EN + ủy quyền code sau PD
Wave 1  architect: ADR/handoff app.vemoki.com + cookie/OIDC/CORS/origin
Wave 1∥ PD: wireframe/handoff sales 1 page VI+EN (CTA cả hai, nhãn demo giả lập)
Wave 2  web coding ngay khi PD handoff sẵn (không hỏi lại): sales+privacy+i18n trên vemoki.com;
        product origin → app. (theo architect); form quan tâm + demo link
Wave 2∥ coordinator: DNS/TLS/nginx khi được ủy quyền deploy (không tự prod từ research)
Wave 3  ASC URL verify + headless UAT + reviewer-dod
Wave 4+ CMS / pricing — chỉ khi user mở
```

Không deploy prod / store submit từ research này. Không đổi Project Status sang Hoàn thành chỉ vì có artifact.

---

## 10. Success evidence (khi làm)

- [ ] Prospect đọc first viewport biết format = in-person + Gate; buyer = Owner/Agency
- [ ] Không claim payment/Android/Wallet/seat; không logo demo như khách thật
- [ ] CTA Xem demo **và** Đăng ký quan tâm; demo có nhãn giả lập
- [ ] `vemoki.com` = sales; product links → `app.vemoki.com`
- [ ] Brand test: marketing = Vemoki; event page = org brand (AC D11-S-P0-C)
- [ ] `GET https://vemoki.com/privacy` → 200
- [ ] Headless UAT + exact SHA trong `docs/reviews/*`
- [ ] ASC Marketing/Support URL = marketing host

---

## 11. Giới hạn research

- Không đăng nhập competitor admin; chỉ marketing/KB công khai.
- Web Anatomy scores mang tính benchmark bên thứ ba — dùng pattern, không copy layout.
- Proposed ≠ approved coding; không mở rộng MVP.
- Homepage copy hiện tại (“Điều tốt đẹp…”) có thể giữ tone brand nhưng **không** thay value prop B2B nếu `/` chuyển thành sales.

---

## 12. Artifact liên quan

| Artifact | Path |
| -------- | ---- |
| Nghiên cứu này | `docs/plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md` |
| Brand tokens | `brand/vemoki/tokens.json` |
| Brand-test AC | `docs/tasks/d11/D11-S-P0-C-brand-test-ac.md` |
| ASC listing | `docs/asc/listing-metadata.md` |
| Dashboard market (ops, không GTM) | `docs/plans/DASHBOARD-MARKET-SYNTHESIS.md` |
