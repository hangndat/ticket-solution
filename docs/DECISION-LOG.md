# Decision log — sản phẩm & kỹ thuật

Ngày cập nhật: 2026-10-18
Nguồn: [PRD](./PRD.md) mục 15, [Technical Design](./TECHNICAL-DESIGN.md) mục 2 & 18, [ROADMAP](./ROADMAP.md)
Tracking: Issues [#10](https://github.com/hangndat/ticket-solution/issues/10), [#11](https://github.com/hangndat/ticket-solution/issues/11)

**Quy ước:** `Đã chốt (MVP)` = áp dụng cho release đầu / pilot. `Giữ mở` = chưa khóa số liệu hoặc chính sách dài hạn. Đổi quyết định phải ghi dòng mới, không sửa im lặng.

## O — Quyết định sản phẩm (PRD)

| ID | Câu hỏi | Quyết định MVP | Trạng thái | Ảnh hưởng |
| --- | --- | --- | --- | --- |
| O01 | App chung hay app riêng từng công ty? | **Một app chung** platform; chế độ khách / nhân viên theo quyền server cấp; white-label qua **cấu hình (D8)** trong MVP mở rộng — không fork per-tenant | Đã chốt (MVP); bổ sung O10 | Bundle ID, store branding, deep link; D8 |
| O02 | App riêng cho staff? | **Không** — staff trong cùng app, navigation theo permission | Đã chốt (MVP) | UX mode switch; không cấp quyền mới chỉ vì đổi tab |
| O03 | Tải / số tenant / cổng thực tế? | Theo PRD §9: **2 event đồng thời**, **20.000 vé/event**, **50 thiết bị scan/event**; API p95 theo bảng PRD; **chưa** claim 50k concurrent | Đã chốt (baseline test) | Capacity S1–S4; không dùng làm SLA khách hàng đến khi benchmark |
| O04 | Form dữ liệu và ngôn ngữ? | **Tiếng Việt** làm mặc định UI/email pilot; schema form **versioned JSON** sẵn sàng mở rộng field/locale | Đã chốt (MVP) | Nội dung, email, privacy copy |
| O05 | Tái nhập cổng / nhiều ngày / nhiều phiên? | **Một vé → một lượt vào** toàn event; không re-entry mặc định | Đã chốt (MVP) | Gate entitlement; đổi sau phải migration + UAT lại |
| O06 | Retention, vùng dữ liệu, SLA hỗ trợ? | Retention/anonymize **bắt buộc có policy trước dữ liệu user thật**; giá trị ngày/region/SLA **chưa chốt số** | Giữ mở (chốt trước production data) | Hạ tầng, DPA, support access |
| O07 | Custom domain / sender ngay release đầu? | **Không** — subdomain platform + sender platform trên DNS user mua; custom domain/sender **sau MVP** | Đã chốt (MVP) | DNS, deliverability |
| O08 | Database riêng theo tổ chức? | **Shared PostgreSQL schema + RLS** (+ authz app); không DB-per-tenant | Đã chốt (MVP) | Deployment, isolation tier |
| O09 | Tên thương hiệu và domain platform? | **Vemoki**, domain `vemoki.com` | Đã chốt (MVP) | Tên hiển thị store/web, sender `noreply@vemoki.com`, deep link `vemoki://`; repo `ticket-solution` và bundle `com.hangndat.ticket` giữ nguyên |
| O10 | Mở rộng MVP / hủy Android·payment·seat·Wallet? | **Có mở rộng** — đưa **D7** Offline Gate multi-device, **D8** White-label, **D9** Demo seed + UX/media, **D10** App Store metadata vào MVP. **Hủy khỏi kế hoạch MVP:** Android native; payment/refund/chuyển nhượng; seat map; Apple/Google Wallet (ngoài phạm vi có chủ đích). Issue [#7](https://github.com/hangndat/ticket-solution/issues/7) rewrite đồng bộ board (worker GitHub). | Đã chốt (MVP mở rộng) 2026-10-17 | [ROADMAP](./ROADMAP.md) §1/§4/§6; [PRD](./PRD.md) §4 |
| O12 | Dictionary KPI Dashboard M11 + pha triển khai? | Xem mục **O12** bên dưới — chốt theo tổng hợp thị trường 18/10/2026; không thay non-goals O10 | Đã chốt (MVP) 2026-10-18 | [PRD](./PRD.md) M11; [DASHBOARD-MARKET-SYNTHESIS](./plans/DASHBOARD-MARKET-SYNTHESIS.md) |
| O13 | Trang bán platform GTM + tách subdomain? | Xem mục **O13** — buyer Owner+Agency; `vemoki.com`/`app.`; CTA demo+quan tâm; demo giả lập; **VI+EN**; code ngay sau PD | Đã chốt (GTM) 2026-10-18 | [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH](./plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md); ASC; ADR subdomain |

### O11 — Định hướng mở rộng UX/UI cho vận hành production (18/10/2026)

User giao mở rộng MVP, đẩy mạnh UX/UI và yêu cầu BA (`product-ba`) cùng PD (`product-design`) nghiên cứu/thiết kế. **Đã chốt định hướng và ủy quyền discovery/design**; danh sách tính năng mới, roadmap triển khai và thiết kế chi tiết **chưa được duyệt**. D11 ([#222](https://github.com/hangndat/ticket-solution/issues/222)) cung cấp báo cáo BA, handoff PD/prototype và kế hoạch để review trước feature coding. Không hồi sinh Android/payment/refund/transfer/seat map/Wallet; không đổi các invariant tenant/auth/quota/check-in, không tự deploy/submit store. Đánh giá production cần bằng chứng độc lập, không suy ra từ UI/prototype hay Status D0–D10.

## ADR — Quyết định kỹ thuật liên quan D1

| ID | Quyết định | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| ADR-07 | App chung hai chế độ | Khớp O01/O02 đã chốt | White-label cấu hình = **D8** (O10); không Android native trong MVP |
| ADR-09 | **Self-hosted OIDC (Keycloak)**, Auth Code + PKCE iOS | **Keycloak** trong Docker Compose / VPS — xem [spike](./spikes/D1-OIDC-PROVIDER.md) | **Đã chốt (MVP)** 2026-10-16 (user: cấm SaaS; App Store + DNS được phép). POC P4 trên Keycloak local trước business endpoints. |
| ADR-02 | Shared DB + RLS | Khớp O08 | Không đổi |
| ADR-11 | **Cấm SaaS runtime**; self-host stack | Postgres/Redis/Keycloak/MinIO/SMTP trên Compose → VPS; **không** Clerk/Auth0/SendGrid/Resend/Expo Push/CDN SaaS/managed DB | Ngoại lệ: Apple App Store / APNs; registrar DNS + Let's Encrypt; GitHub tooling (không runtime) |
| ADR-12 | Push qua **APNs trực tiếp** từ worker | Không Expo Push Service (`exp.host`) | Device token lưu DB; adapter tách transport |
| ADR-13 | Email qua **SMTP adapter** | Dev: Mailpit; prod: Postal hoặc Postfix trên VPS | Không transactional SaaS |
| ADR-14 | Object storage **MinIO** (S3-compatible) | Compose local; cùng image trên VPS | Signed URL ngắn hạn |
| ADR-15 | Admission / waiting room trên **Caddy hoặc nginx** | Rate-limit + token admission ký; Gate không đi qua layer này | Không Cloudflare Waiting Room |
| ADR-16 | VPS đầu: nginx có sẵn + image runtime mỏng, app mount từ đĩa host | pnpm store cùng mount với source để hard link. Redirect web dùng `PUBLIC_WEB_ORIGIN` / Host do nginx ghi đè — không tin client `X-Forwarded-*` thô; không bind `0.0.0.0` trong Location | Xem [infra/deploy/README.md](../infra/deploy/README.md). SMTP prod (ADR-13) vẫn để sau |
| ADR-17 | **MVP queue: leased PG outbox + worker poll trực tiếp** (không BullMQ trong MVP) | Bổ sung/đối chiếu ADR-04: Redis không nguồn chuẩn job; crash reclaim bằng lease; cân nhắc BullMQ sau benchmark | Chi tiết [ops/ADR-17-OUTBOX-PG-DIRECT.md](./ops/ADR-17-OUTBOX-PG-DIRECT.md); recovery `./scripts/rint-outbox-recovery.sh` |
| ADR-18 | **Offline Gate sync** — batch `CHECKIN_OFFLINE` + idempotency/skew/replay | Sửa ADR-06/§9.5 cho D7 (O10); contract Issue #105; apply #106 | [ops/ADR-18-OFFLINE-GATE-SYNC.md](./ops/ADR-18-OFFLINE-GATE-SYNC.md); `@ticket/contracts` `offline-sync.ts` |

## Điều kiện mở business endpoints

Chỉ mở redemption / Gate / admin tenant **sau khi**:

1. OIDC POC đạt P4 trên **Keycloak local** (PKCE, verified email, MFA staff TOTP, revocation, logout, account switch).
2. Membership deny-by-default + thu hồi chặn request tiếp theo có test.
3. Session web (BFF cookie) và iOS SecureStore đúng ranh giới đã có ở W0 spike.

## Lịch sử

| Ngày | Thay đổi |
| --- | --- |
| 2026-10-16 | User duyệt roadmap/D0. Chốt O01–O05, O07–O08 theo baseline PRD. O06 giữ mở. Đề xuất Clerk cho ADR-09. |
| 2026-10-16 | User xác nhận **Clerk ok**. ADR-09 chốt Clerk. Dispatch POC song song BE/web/iOS (Orca `--agent cursor`). |
| 2026-10-16 | User đổi: **không dùng SaaS**; App Store + DNS tự mua được phép. **ADR-09 → Keycloak self-host**; thêm ADR-11…15 (MinIO, SMTP, APNs direct, Caddy admission). Gỡ Clerk SDK. |
| 2026-10-17 | User chốt thương hiệu **Vemoki** và domain `vemoki.com` (O09). |
| 2026-10-17 | VPS `vemoki.com`: ADR-16 — runtime image + bind mount, nginx proxy web/api/auth; PR #42 root assets port vào #53. |
| 2026-10-17 | Coordinator freeze MVP: **ADR-17** giữ leased PostgreSQL outbox + direct worker poll (không triển khai BullMQ); Redis restart/crash reclaim drills thuộc R-INT. |
| 2026-10-17 | Freeze security vận hành (không O06): invite TTL 48h, support grant max 1h, MFA `auth_time` step-up 15m, ACR=`2`; platform client/audience Keycloak; O06 giữ UNRESOLVED. |
| 2026-10-17 | User **mở rộng MVP (O10)**: D7–D10 vào phạm vi; hủy Android / payment·refund·chuyển nhượng / seat map / Apple·Google Wallet khỏi kế hoạch MVP. Cập nhật O01 (white-label → D8), ADR-07, ROADMAP, PRD §4. #7 rewrite trên board (không thuộc worker docs). |
| 2026-10-17 | **ADR-18** — contract Offline Gate sync (Issue #105): payload, idempotency `clientEventId`, clock skew ±300s, conflict codes, replay order; endpoint OpenAPI stub 501 đến #106. |
| 2026-10-18 | User **chốt O12** Dashboard M11: dictionary check-in = Gate confirm; day-of Manager→Supervisor; email = cần CS; watermark + refresh thủ công pilot; event-scoped; không tự sửa AC `#229`. Nguồn: `docs/plans/DASHBOARD-MARKET-SYNTHESIS.md`. |
| 2026-10-18 | User **chốt O13** GTM sales page: buyer Owner+Agency; `vemoki.com` = marketing, `app.vemoki.com` = product; CTA Xem demo + Đăng ký quan tâm; mọi demo hiện tại = giả lập (không social proof khách). Nguồn: `docs/plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md`. |
| 2026-10-18 | O13 bổ sung: marketing **VI+EN**; ủy quyền **code web ngay sau PD** (không hỏi lại); vẫn PR/DoD; không tự deploy/store. |

## O11 — Phê duyệt thực thi 18/10/2026

User duyệt gói D11 trong cuộc hội thoại: admin theo công việc/readiness, iOS Gate feedback/offline/conflict, attendee web/iOS và brand/a11y trong scope. Bắt đầu wave web admin ∥ iOS Gate, tiếp theo attendee. Dùng feature branch/PR, review độc lập, CI và coordinator integration theo git-workflow. Không tự mở validate-only/manual lookup, metrics mới, policy O06 số liệu, publish privacy, deploy production hoặc submit store. Phần discovery trước đó giữ làm lịch sử; approval không thay bằng chứng runtime/pilot.

## O12 — Dashboard M11: dictionary KPI và pha triển khai (18/10/2026)

User chốt theo đề xuất sau research nội bộ + BA A/B (`docs/plans/DASHBOARD-*.md`). **Giữ đích PRD M11**; không mở revenue/UTM/seat/Wallet/RFID/BI đa event (O10). O12 làm rõ định nghĩa và thứ tự wave — **chưa** tự ủy quyền coding; Wave coding vẫn cần dispatch/Epic planner theo ownership và WIP.

| # | Quyết định | Chi tiết MVP |
| - | ---------- | ------------ |
| 1 | Mẫu số check-in trên Dashboard | Đếm **lượt Gate confirm thành công** (operation APPLIED), không lấy một mình `tickets.state=USED` khi có undo Supervisor. **Không** check-out / tách *đang trong* vs *đã từng vào* trong MVP (khớp O05 một lượt). |
| 2 | Thứ tự day-of trên trang event | **Manager trước:** readiness/quota/pending (dẫn `#228/#229`); **Supervisor ngay sau:** check-in success + reject theo lý do·cổng trên cùng event Dashboard. |
| 3 | Email lỗi | Count **cần CS xử lý** (failed cuối / hết retry hữu ích), không đếm mọi lần retry tạm. Thẻ KPI chỉ deep-link CS; **không** resend từ thẻ. |
| 4 | Độ tươi pilot | Bắt buộc **`asOf`/watermark** + copy “server đã ghi nhận”; pilot = **refresh thủ công**. Mục tiêu PRD ≤10s = độ trễ commit→UI đã đo trong tải pilot — **không** suy ra bắt buộc poll 10s. Auto-refresh chỉ xét sau khi có budget/query plan (giảm reporting trước Gate). |
| 5 | Phạm vi đợt | **Chỉ event-scoped.** Multi-event Owner overview = pha sau. Staff “Đầy đủ” / Scanner “tóm tắt theo quyền” giữ ma trận PRD §5. |
| 6 | Quan hệ `#229` readiness | Research/O12 **chỉ bổ sung KPI/copy Dashboard**; **không** tự sửa AC readiness `#229` đã nộp trừ khi có ủy quyền riêng. Publish ≠ mở đổi vé ≠ mở check-in vẫn theo PRD M03. |

**Wave sau O12 (khi được dispatch):** P1 mở rộng `EventReport` (check-in/reject + remaining quota có định nghĩa + email-cần-CS) → P2 watermark/fail-closed UI → P3 deep-link việc cần làm → hòa copy với `#229` → mới xét auto-refresh / drilldown / multi-event.

## O13 — Trang bán platform GTM + tách subdomain (18/10/2026)

User chốt theo research [`docs/plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md`](./plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md). **Không** mở payment/Android/Wallet/seat (O10). O13 khóa GTM/host — **chưa** tự ủy quyền coding/deploy; cần architect handoff subdomain rồi PD/web/coordinator theo ownership và WIP.

| # | Quyết định | Chi tiết |
| - | ---------- | -------- |
| 1 | Primary buyer trang bán | **Tenant Owner + Agency**. Attendee không phải buyer. |
| 2 | Root theo buyer | **`vemoki.com/` = sales** (Owner+Agency). Product/attendee/demo/redeem/admin/gate trên **`app.vemoki.com`**. |
| 3 | CTA P1 | **Cả hai:** Xem demo (→ app, fixture) **và** Đăng ký quan tâm (form/email trên marketing). |
| 4 | Demo / proof | **Mọi demo hiện nay = giả lập.** Không dùng demo seed làm logo/case study khách thật; UI nhãn rõ fixture. |
| 5 | Host model | **Tách subdomain:** marketing `vemoki.com`, product `app.vemoki.com`. Architecture impact: Có (DNS/TLS/nginx, cookie, OIDC redirect, `PUBLIC_WEB_ORIGIN`) — Task `architect` trước consumer deploy. |
| 6 | Locale marketing | **VI và EN** trên trang bán (`vemoki.com`). UI product pilot vẫn mặc định VI (O04) trừ khi task riêng mở EN app. |
| 7 | Ủy quyền sau PD | User (18/10/2026): **sau khi PD xong → code web ngay**, không hỏi lại. Vẫn qua feature branch/PR + DoD độc lập; không tự deploy prod / submit store. |

**Còn mở:** lịch host privacy/support (khuyến nghị P0 cùng sales — trước store); tách git repo marketing (không bắt buộc nếu monorepo + host routing).

**Wave sau O13:** architect ADR/handoff ∥ PD wireframe sales (VI+EN) → **web coding ngay khi PD handoff sẵn** (ủy quyền #7) → coordinator DNS khi được phép deploy → form quan tâm + demo link nhãn giả lập → ASC URL + headless UAT + reviewer-dod.
