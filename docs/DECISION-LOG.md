# Decision log — sản phẩm & kỹ thuật

Ngày cập nhật: 2026-10-19
Nguồn: [PRD](./PRD.md) mục 15, [Technical Design](./TECHNICAL-DESIGN.md) mục 2 & 18, [ROADMAP](./ROADMAP.md)
Tracking: Issues [#10](https://github.com/hangndat/ticket-solution/issues/10), [#11](https://github.com/hangndat/ticket-solution/issues/11)

## O17 — P2 portal: mở lại multi-event portfolio + phạm vi roles/onboarding (19/10/2026)

User ủy quyền Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) gói **A+B+C** (19/10/2026). Gói **B** gồm multi-event analytics (**mở lại** OUT O12 §5 / O14 §6), saved views/automation, portal EN, custom roles / self-serve onboarding — discovery BA∥PD∥architect rồi coding. Architecture handoff: [`docs/architecture/PORTAL-P2-ADR.md`](./architecture/PORTAL-P2-ADR.md). Run: `run_d04055a8969b`.

| # | Quyết định | Chi tiết |
| - | ---------- | -------- |
| 1 | Multi-event analytics | **Mở** portfolio Owner trên portal: tổng hợp / danh sách snapshot tái dụng dictionary KPI **O12** (check-in Gate confirm, pending, emailNeedsCs, quotaRemaining, `asOf`). **Không** mở revenue/UTM/seat/Wallet/RFID/BI doanh thu (O10). |
| 2 | Quan hệ O12 | Dictionary và refresh thủ công / watermark **giữ**. O12 §5 «chỉ event-scoped» được **nới** cho portfolio; trang event Dashboard vẫn event-scoped. |
| 3 | Quan hệ O14 | O14 §6 «multi-event / metrics product OUT» — **mở multi-event portfolio**; metrics product tùy tiện vẫn OUT. Validate-only / resolution desk vẫn OUT. |
| 4 | Custom roles | Cho phép khám phá/triển khai **named server presets** (role-map versioned); **cấm** client gửi permission array tùy ý. |
| 5 | Self-serve onboarding | Cho phép flow tenant **PENDING** + Owner invite sau verify; **ACTIVE** qua Operator (không auto-ACTIVE từ form marketing O13). |
| 6 | Saved views / EN | Trong phạm vi P2 khi BA ưu tiên; EN portal additive, mặc định VI (O04). |
| 7 | Non-goals / cutover | Giữ O10; cutover `portal.vemoki.com` prod chỉ Story C / [#502](https://github.com/hangndat/ticket-solution/issues/502). Không mock auth/UAT; không EAS. |
| 8 | Ủy quyền coding | Feature coding P2 **sau** AC BA + ADR handoff (+ PD khi UI); vẫn branch/PR + DoD độc lập. |

Architecture impact: **Có**. Approval phạm vi ≠ code complete ≠ acceptance complete ≠ pilot ready.

## O16 — Portal admin riêng Ant Design (18/10/2026)

Người dùng phản hồi **“duyệt”** sau [roadmap PORTAL](./plans/PORTAL-ROADMAP.md) và planning review độc lập PASS. Chấp nhận gói **P0 + P1**, Epic [#406](https://github.com/hangndat/ticket-solution/issues/406):

- `PORTAL-SEPARATE-APP`: `portal.vemoki.com`, Next `apps/portal` riêng trong monorepo; mở rộng ownership web cho `apps/portal` qua Task Spec; root tooling/CI/lockfile/contracts vẫn coordinator.
- `ANTD-CORE-FIRST`: Ant Design thuần, tiếng Việt, theme Vemoki; không đổi sang Umi/Ant Design Pro; ProComponents không mặc định.
- `GATE-STAY-APP`: Web Gate và iOS giữ nguyên trong đợt đầu; attendee/public vẫn `app.vemoki.com`, marketing vẫn `vemoki.com`.
- `PLATFORM-PORTAL-ZONE`: Platform Operator vào khu vực portal riêng theo wave, client/audience/session và quyền tách tenant; không nâng quyền tenant Owner.
- Đủ luồng admin hiện có trước cutover; đóng gap UI/BFF/contracts/Nest thực tế; audit/ops trong gói cần contract/RBAC/test, không fake dữ liệu hay coi UI có sẵn là API đã chạy.
- Cho phép implementation → conventional commit/feature branch → push/PR → review độc lập exact SHA → CI → coordinator integration theo git workflow. Không tự triển khai production DNS/TLS/cutover, tạo cloud resources hoặc submit store từ approval này; P1.2 hiện chỉ chuẩn bị cấu hình/runbook và kiểm thử local/môi trường được cho phép.
- Không mở enterprise SSO mới/billing/custom-domain, payment/refund/transfer, seat map, Wallet, Android hoặc validate-only desk trong gói P0+P1. **P2 / multi-event portfolio** được mở riêng bởi **O17** (Epic #491) — không phải BI doanh thu. Keycloak IdP SSO hiện có khác chia sẻ BFF cookie; cookie host-only từng host.

Architecture impact: **Có** — topology staff, OIDC/BFF, package UI và API gaps. ADR-20 ghi chi tiết kỹ thuật và handoff; không sửa lịch sử O13, chỉ chuyển audience admin theo quyết định mới. Run triển khai: `run_34fde1e32ed1`. Approval ≠ code complete ≠ acceptance complete ≠ pilot ready.

**Quy ước:** `Đã chốt (MVP)` = áp dụng cho release đầu / pilot. `Giữ mở` = chưa khóa số liệu hoặc chính sách dài hạn. Đổi quyết định phải ghi dòng mới, không sửa im lặng.

## O — Quyết định sản phẩm (PRD)

| ID | Câu hỏi | Quyết định MVP | Trạng thái | Ảnh hưởng |
| --- | --- | --- | --- | --- |
| O01 | App chung hay app riêng từng công ty? | **Một app chung** platform; chế độ khách / nhân viên theo quyền server cấp; white-label qua **cấu hình (D8)** trong MVP mở rộng — không fork per-tenant | Đã chốt (MVP); bổ sung O10 | Bundle ID, store branding, deep link; D8 |
| O02 | App riêng cho staff? | **Không** — staff trong cùng app, navigation theo permission | Đã chốt (MVP) | UX mode switch; không cấp quyền mới chỉ vì đổi tab |
| O03 | Tải / số tenant / cổng thực tế? | Theo PRD §9: **2 event đồng thời**, **20.000 vé/event**, **50 thiết bị scan/event**; API p95 theo bảng PRD; **chưa** claim 50k concurrent | Đã chốt (baseline test) | Capacity S1–S4; không dùng làm SLA khách hàng đến khi benchmark |
| O04 | Form dữ liệu và ngôn ngữ? | **Tiếng Việt** làm mặc định UI/email pilot; schema form **versioned JSON** sẵn sàng mở rộng field/locale | Đã chốt (MVP) | Nội dung, email, privacy copy |
| O05 | Tái nhập cổng / nhiều ngày / nhiều phiên? | **Một vé → một lượt vào** toàn event; không re-entry mặc định | Đã chốt (MVP) | Gate entitlement; đổi sau phải migration + UAT lại |
| O06 | Retention, vùng dữ liệu, SLA hỗ trợ? | Xem mục **O06** bên dưới — retention/region/SLA **đã chốt số** 18/10/2026 | Đã chốt (MVP) 2026-10-18 | Hạ tầng, DPA, privacy copy, support access |
| O07 | Custom domain / sender ngay release đầu? | **Không** — subdomain platform + sender platform trên DNS user mua; custom domain/sender **sau MVP** | Đã chốt (MVP) | DNS, deliverability |
| O08 | Database riêng theo tổ chức? | **Shared PostgreSQL schema + RLS** (+ authz app); không DB-per-tenant | Đã chốt (MVP) | Deployment, isolation tier |
| O09 | Tên thương hiệu và domain platform? | **Vemoki**, domain `vemoki.com` | Đã chốt (MVP) | Tên hiển thị store/web, sender `noreply@vemoki.com`, deep link `vemoki://`; repo `ticket-solution` và bundle `com.hangndat.ticket` giữ nguyên |
| O10 | Mở rộng MVP / hủy Android·payment·seat·Wallet? | **Có mở rộng** — đưa **D7** Offline Gate multi-device, **D8** White-label, **D9** Demo seed + UX/media, **D10** App Store metadata vào MVP. **Hủy khỏi kế hoạch MVP:** Android native; payment/refund/chuyển nhượng; seat map; Apple/Google Wallet (ngoài phạm vi có chủ đích). Issue [#7](https://github.com/hangndat/ticket-solution/issues/7) rewrite đồng bộ board (worker GitHub). | Đã chốt (MVP mở rộng) 2026-10-17 | [ROADMAP](./ROADMAP.md) §1/§4/§6; [PRD](./PRD.md) §4 |
| O12 | Dictionary KPI Dashboard M11 + pha triển khai? | Xem mục **O12** bên dưới — chốt theo tổng hợp thị trường 18/10/2026; không thay non-goals O10. **Cập nhật O17:** cho phép portfolio multi-event (tái dụng dictionary); event Dashboard vẫn event-scoped | Đã chốt (MVP) 2026-10-18; bổ sung O17 2026-10-19 | [PRD](./PRD.md) M11; [DASHBOARD-MARKET-SYNTHESIS](./plans/DASHBOARD-MARKET-SYNTHESIS.md); [PORTAL-P2-ADR](./architecture/PORTAL-P2-ADR.md) |
| O13 | Trang bán platform GTM + tách subdomain? | Xem mục **O13** — buyer Owner+Agency; `vemoki.com`/`app.`; CTA demo+quan tâm; demo giả lập; **VI+EN**; code ngay sau PD | Đã chốt (GTM) 2026-10-18 | [VEMOKI-PLATFORM-SALES-PAGE-RESEARCH](./plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md); ASC; ADR subdomain |
| O14 | Phê duyệt mở rộng MVP sau research day-of + residual? | Xem mục **O14** bên dưới — duyệt gói [`MVP-EXPAND-MARKET-SYNTHESIS`](./plans/MVP-EXPAND-MARKET-SYNTHESIS.md) 18/10/2026. **Cập nhật O17:** mở lại multi-event portfolio; validate-only/metrics tùy tiện vẫn OUT | Đã chốt (MVP) 2026-10-18; bổ sung O17 2026-10-19 | Epic [#222](https://github.com/hangndat/ticket-solution/issues/222); O12 consumer web; BE reject audit; Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) |
| O15 | Nguồn sự kiện public = server (bỏ fixture client SoT)? | Xem mục **O15** — Published projection SoT; Admin quản lý; Nest public GET; web SSR/ISR; iOS published-first | Đã chốt (MVP) 2026-10-18 | Epic [#254](https://github.com/hangndat/ticket-solution/issues/254); **ADR-19** |
| O17 | P2 portal — multi-event portfolio + roles/onboarding? | Xem mục **O17** — Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) A+B+C; handoff [PORTAL-P2-ADR](./architecture/PORTAL-P2-ADR.md) | Đã chốt (phạm vi P2) 2026-10-19 | Story [#493](https://github.com/hangndat/ticket-solution/issues/493); Task architect [#501](https://github.com/hangndat/ticket-solution/issues/501) |

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
| ADR-14 | Object storage **S3-compatible self-host** (MinIO API) | Image: `cleanstart/minio@sha256:4febd64f…` (O1 2026-10-18; official Hub/Quay unpullable) | Signed URL ngắn hạn; init `amazon/aws-cli` |
| ADR-15 | Admission / waiting room trên **Caddy hoặc nginx** | Rate-limit + token admission ký; Gate không đi qua layer này | Không Cloudflare Waiting Room |
| ADR-16 | VPS đầu: nginx có sẵn + image runtime mỏng, app mount từ đĩa host | pnpm store cùng mount với source để hard link. Redirect web dùng `PUBLIC_WEB_ORIGIN` / Host do nginx ghi đè — không tin client `X-Forwarded-*` thô; không bind `0.0.0.0` trong Location | Xem [infra/deploy/README.md](../infra/deploy/README.md). SMTP prod (ADR-13) vẫn để sau |
| ADR-17 | **MVP queue: leased PG outbox + worker poll trực tiếp** (không BullMQ trong MVP) | Bổ sung/đối chiếu ADR-04: Redis không nguồn chuẩn job; crash reclaim bằng lease; cân nhắc BullMQ sau benchmark | Chi tiết [ops/ADR-17-OUTBOX-PG-DIRECT.md](./ops/ADR-17-OUTBOX-PG-DIRECT.md); recovery `./scripts/rint-outbox-recovery.sh` |
| ADR-18 | **Offline Gate sync** — batch `CHECKIN_OFFLINE` + idempotency/skew/replay | Sửa ADR-06/§9.5 cho D7 (O10); contract Issue #105; apply #106 | [ops/ADR-18-OFFLINE-GATE-SYNC.md](./ops/ADR-18-OFFLINE-GATE-SYNC.md); `@ticket/contracts` `offline-sync.ts` |
| ADR-19 | **Published projection SoT** cho public/attendee event surfaces | Nest `GET /v1/public/tenants/{slug}/events` (+ detail); fixtures không fallback SoT; D9 seed publish marketing sections | [ops/ADR-19-EVENT-SERVER-SOURCE.md](./ops/ADR-19-EVENT-SERVER-SOURCE.md); Epic [#254](https://github.com/hangndat/ticket-solution/issues/254) · Task [#255](https://github.com/hangndat/ticket-solution/issues/255) |

## O15 — Nguồn sự kiện server (Epic #254) — Đã chốt 18/10/2026

User duyệt kiến trúc Epic [#254](https://github.com/hangndat/ticket-solution/issues/254): **PostgreSQL published event + config** là nguồn chuẩn cho public/attendee; client fixture không còn SoT / không fallback khi API lỗi. Contract thống nhất `@ticket/contracts` `PublishedEvent*` (mirror iOS). Marketing `category`/`description`/`highlights` map vào sections published. BE ship public Nest + seed publish (#255) trước/cùng wave với web/iOS consumer. Chi tiết: [ADR-19](./ops/ADR-19-EVENT-SERVER-SOURCE.md), [architecture/event-server-source.md](./architecture/event-server-source.md).

| # | Quyết định | Chi tiết |
| - | ---------- | -------- |
| 1 | SoT | PostgreSQL `events` + **published** `event_config_versions` / brand snapshot — không fixture client |
| 2 | Contract | Nest `GET /v1/public/tenants/{tenantSlug}/events` (+ `/{eventSlug}`); DTO mirror iOS → `@ticket/contracts` + OpenAPI |
| 3 | Fail-closed | Không fallback fixture khi API lỗi trên đường published; draft/unpublished → 404 |
| 4 | Marketing fields | `category`/`description`/`highlights` → published sections (hero/info/faq); không schema fixture riêng |
| 5 | Web | Bỏ SSG gắn `events.ts`; SSR/ISR từ BFF/API |
| 6 | Seed | D9 demo-seed **giữ và mở rộng** publish config; hardcode client không thay seed |
| 7 | Wave coding | **BE public + seed trước** → sau merge/CI: **web ∥ iOS** |
| 8 | Non-goals | Không đổi auth/RLS; không D8 branding public hoàn chỉnh trong ADR này; không CDN SaaS |

**Nguồn bổ sung:** `docs/plans/EVENT-SERVER-SOURCE-*.md`, `docs/design/event-server-source/`.

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
| 2026-10-18 | User **duyệt O14** gói mở rộng MVP (day-of + residual): Dashboard web O12 consumer + CS UX + BE reject-audit; invite sau attendee; giữ OUT validate-only/multi-event/metrics; O06/privacy tạm không ingest PII / không deploy privacy đến khi chốt số. Nguồn: `docs/plans/MVP-EXPAND-MARKET-SYNTHESIS.md`. |
| 2026-10-18 | User **chốt O13** GTM sales page: buyer Owner+Agency; `vemoki.com` = marketing, `app.vemoki.com` = product; CTA Xem demo + Đăng ký quan tâm; mọi demo hiện tại = giả lập (không social proof khách). Nguồn: `docs/plans/VEMOKI-PLATFORM-SALES-PAGE-RESEARCH.md`. |
| 2026-10-18 | O13 bổ sung: marketing **VI+EN**; ủy quyền **code web ngay sau PD** (không hỏi lại); vẫn PR/DoD; không tự deploy/store. |
| 2026-10-18 | User duyệt **O15 / ADR-19** — published projection SoT (Epic #254); dispatch BE public Nest + seed (#255). |
| 2026-10-18 | User **duyệt O06** — retention/region/SLA theo gói MVP (anonymize 30d; vé 365d; audit 730d; object 90d; single-region VPS; SLA support tách business-hours vs on-call cửa sổ Gate). Nguồn: `docs/ops/O06-OPTIONS.md`. |
| 2026-10-18 | **UX-11 chốt Option A** — MVP đổi mã guest = Keycloak verified email / UI «Cần đăng nhập»; OTP/magic link = sau MVP. Issue [#372](https://github.com/hangndat/ticket-solution/issues/372). |
| 2026-10-19 | User ủy quyền Epic [#491](https://github.com/hangndat/ticket-solution/issues/491) **A+B+C**. **O17:** mở lại multi-event portfolio (OUT O12/O14); phạm vi P2 roles/onboarding/saved views/EN; handoff [`PORTAL-P2-ADR`](./architecture/PORTAL-P2-ADR.md). Cutover prod chỉ #502. |

## UX-11 — Guest redeem auth MVP (18/10/2026)

Gap audit [PRODUCTION-READINESS-UX §6 UX-11](./plans/PRODUCTION-READINESS-UX.md): PRD §2/M02 mô tả OTP/magic link, runtime/PD pin D1 = Keycloak login + `email_verified`. **Chốt Option A** (khớp tip D11 / AC-A3) — không mở Task OTP/IdP mới trong MVP.

| # | Quyết định | Chi tiết MVP |
| - | ---------- | ------------ |
| 1 | Đường auth đổi mã (web + cùng contract) | **Keycloak** session + **verified email** trước issue vé (`UNAUTHENTICATED` / `EMAIL_NOT_VERIFIED`). Không anonymous redeem. |
| 2 | Copy UI bắt buộc (khớp tip PD) | Thiếu auth → title **«Cần đăng nhập»** (detail: đăng nhập rồi quay lại đổi mã). Email chưa verified → **«Xác minh email»** / tương đương messages hiện tại — **không** invent OTP/magic-link UI mới. |
| 3 | Option B (OTP / magic link guest) | **Sau MVP.** Chỉ mở Task IdP/contract khi user chọn B tường minh; coordinator **không** spawn OTP từ gap này. |
| 4 | PRD M02 | Wording OTP/magic link giữ tầm nhìn dài hạn; **MVP nghiệm thu** theo Option A + copy trên — không coi thiếu OTP guest là blocker DoD redeem. |
| 5 | Non-goals | Không code IdP mới; không đổi contract issue ngoài pin hiện tại; không mở anonymous by design (O11). |

**Hệ quả:** Coding/DoD redeem giữ pin fail-closed hiện tại; unit `redeem-messages` + UAT auth «Cần đăng nhập» đủ AC auth MVP. Nguồn tip: [`docs/design/D11-PRODUCTION-UX-UI.md`](./design/D11-PRODUCTION-UX-UI.md) §2.1 auth row / AC-A3.

## O06 — Retention / vùng dữ liệu / SLA hỗ trợ (18/10/2026)

User trả lời **duyệt** cho gói đề xuất trong hội thoại coordinator (sau research PRODUCTION-READINESS). **Đóng** trạng thái UNRESOLVED trước đây. Chi tiết vận hành: [`docs/ops/O06-OPTIONS.md`](./ops/O06-OPTIONS.md).

| # | Trục | Quyết định MVP |
| - | ---- | -------------- |
| 1 | Tài khoản khi user yêu cầu xóa | **Anonymize ≤ 30 ngày** (không xóa cứng ngay — giữ đối soát khiếu nại) |
| 2 | Vé / check-in sau event | **Giữ 365 ngày** rồi anonymize PII; giữ aggregate/KPI |
| 3 | Audit log | **TTL 730 ngày** |
| 4 | Object store (QR/export) | Signed URL ngắn hạn + **job xóa object ≤ 90 ngày** sau hết hạn nghiệp vụ |
| 5 | Backup vs erasure | Backup **tôn trọng xóa trong RPO** (sau restore không “sống lại” PII đã xóa quá cửa sổ) |
| 6 | Cache client | Purge khi logout / đổi user |
| 7 | Vùng dữ liệu | **Single-region VPS** — Postgres + MinIO + Keycloak + SMTP cùng quốc gia với VPS; ghi quốc gia host trong DPA khi có tenant thật; **không** split region MVP |
| 8 | SLA ngoài cửa sổ event | **Business hours** T2–T6 (giờ VN) |
| 9 | SLA trong cửa sổ Gate / opening | **On-call P1 24/7 theo lịch event** |
| 10 | P1 / P2 / P3 | P1 (cổng chết) **≤ 30 phút** trong cửa sổ; P2 **≤ 4 giờ** business / **≤ 1 giờ** trong cửa sổ; P3 **≤ 2 ngày làm việc** |
| 11 | Kênh support | Email + chat nội bộ; **cấm** log OTP/QR/PII thô vào ticket |
| 12 | RPO / RTO kỹ thuật | Mục tiêu PRD **RPO ≤ 15 phút, RTO ≤ 2 giờ** — chỉ công bố sau drill trên VPS đích; **không** dùng làm SLA support |

**Hệ quả:** Cho phép khớp copy `/privacy` với số trên; ingest PII ngoài demo **được phép về mặt policy** sau khi privacy/copy + ops gates đủ. **Không** tự ủy quyền deploy production hay store submit từ dòng này.

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
| 5 | Phạm vi đợt | **Event Dashboard = event-scoped.** Multi-event Owner overview = **pha sau** tại thời điểm O12; **đã mở lại** dưới **O17** (portfolio tái dụng dictionary, không BI doanh thu). Staff “Đầy đủ” / Scanner “tóm tắt theo quyền” giữ ma trận PRD §5. |
| 6 | Quan hệ `#229` readiness | Research/O12 **chỉ bổ sung KPI/copy Dashboard**; **không** tự sửa AC readiness `#229` đã nộp trừ khi có ủy quyền riêng. Publish ≠ mở đổi vé ≠ mở check-in vẫn theo PRD M03. |

**Wave sau O12 (khi được dispatch):** P1 mở rộng `EventReport` (check-in/reject + remaining quota có định nghĩa + email-cần-CS) → P2 watermark/fail-closed UI → P3 deep-link việc cần làm → hòa copy với `#229` → mới xét auto-refresh / drilldown / multi-event.

**Cập nhật sau merge:** P1 `EventReport` backend **đã merge** (PR #242 / `#241`). P2/P3 web consumer được ủy quyền bởi **O14**.

## O14 — Phê duyệt mở rộng MVP (day-of + residual) (18/10/2026)

User trả lời **duyệt** cho gói [`MVP-EXPAND-MARKET-SYNTHESIS.md`](./plans/MVP-EXPAND-MARKET-SYNTHESIS.md) (BA A day-of + BA B residual). **Ủy quyền coding** theo bảng dưới; vẫn feature branch/PR + DoD độc lập; không deploy/store trừ task riêng.

| # | Quyết định | Chi tiết |
| - | ---------- | -------- |
| 1 | Thứ tự đợt | Hoàn tất D11 `#230`–`#236` (attendee/Gate/UAT) trước khi tranh slot `web` với Task mới cùng slice. |
| 2 | Dashboard web O12 | **Mở** Task consumer KPI: `asOf`/watermark, check-in/reject, quotaRemaining, emailNeedsCs, deep-link việc cần làm; **không** sửa AC readiness `#229`; refresh thủ công pilot (O12). |
| 3 | CS / email recovery UX | **Gộp đợt** sau/∥ khi slot `web` rảnh — timeline + copy DELIVERED≠ACCEPTED; không resend từ thẻ KPI. |
| 4 | BE reject audit | **Ưu tiên ngay** (ownership `backend`): wire `recordGateReject` trên online deny paths — known gap DoD `#241`. |
| 5 | Invite Owner HTTP | **Sau** `#234` attendee web (tránh 2 feature Dispatch `web`); revalidate prod CSRF/copy VI. |
| 6 | Validate-only / resolution desk / multi-event / metrics product | **Lịch sử O14:** giữ OUT / defer. **Cập nhật O17:** multi-event **portfolio** được mở; validate-only / resolution desk / metrics product tùy tiện **vẫn OUT**. |
| 7 | O06 + privacy | *(Lịch sử O14)* Tạm không ingest PII / không deploy privacy đến khi chốt O06. **Cập nhật 18/10/2026:** O06 **đã chốt** — xem mục O06; deploy `/privacy` khớp số vẫn cần **ủy quyền deploy** riêng. |
| 8 | Non-goals | Giữ O10: Android / payment / seat / Wallet / RFID / revenue BI. |

**Wave sau O14:** backend reject-audit ∥ (khi `web` free) Dashboard O12 consumer → CS UX → invite revalidate → `#232`/`#236` theo board · không validate-only.

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
