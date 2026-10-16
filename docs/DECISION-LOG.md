# Decision log — sản phẩm & kỹ thuật

Ngày cập nhật: 2026-10-16  
Nguồn: [PRD](./PRD.md) mục 15, [Technical Design](./TECHNICAL-DESIGN.md) mục 2 & 18, [ROADMAP](./ROADMAP.md)  
Tracking: Issues [#10](https://github.com/hangndat/ticket-solution/issues/10), [#11](https://github.com/hangndat/ticket-solution/issues/11)

**Quy ước:** `Đã chốt (MVP)` = áp dụng cho release đầu / pilot. `Giữ mở` = chưa khóa số liệu hoặc chính sách dài hạn. Đổi quyết định phải ghi dòng mới, không sửa im lặng.

## O — Quyết định sản phẩm (PRD)

| ID | Câu hỏi | Quyết định MVP | Trạng thái | Ảnh hưởng |
| --- | --- | --- | --- | --- |
| O01 | App chung hay app riêng từng công ty? | **Một app chung** platform; chế độ khách / nhân viên theo quyền server cấp | Đã chốt (MVP) | Bundle ID, store branding, deep link; white-label **sau MVP** |
| O02 | App riêng cho staff? | **Không** — staff trong cùng app, navigation theo permission | Đã chốt (MVP) | UX mode switch; không cấp quyền mới chỉ vì đổi tab |
| O03 | Tải / số tenant / cổng thực tế? | Theo PRD §9: **2 event đồng thời**, **20.000 vé/event**, **50 thiết bị scan/event**; API p95 theo bảng PRD; **chưa** claim 50k concurrent | Đã chốt (baseline test) | Capacity S1–S4; không dùng làm SLA khách hàng đến khi benchmark |
| O04 | Form dữ liệu và ngôn ngữ? | **Tiếng Việt** làm mặc định UI/email pilot; schema form **versioned JSON** sẵn sàng mở rộng field/locale | Đã chốt (MVP) | Nội dung, email, privacy copy |
| O05 | Tái nhập cổng / nhiều ngày / nhiều phiên? | **Một vé → một lượt vào** toàn event; không re-entry mặc định | Đã chốt (MVP) | Gate entitlement; đổi sau phải migration + UAT lại |
| O06 | Retention, vùng dữ liệu, SLA hỗ trợ? | Retention/anonymize **bắt buộc có policy trước dữ liệu user thật**; giá trị ngày/region/SLA **chưa chốt số** | Giữ mở (chốt trước production data) | Hạ tầng, DPA, support access |
| O07 | Custom domain / sender ngay release đầu? | **Không** — subdomain platform + sender platform trên DNS user mua; custom domain/sender **sau MVP** | Đã chốt (MVP) | DNS, deliverability |
| O08 | Database riêng theo tổ chức? | **Shared PostgreSQL schema + RLS** (+ authz app); không DB-per-tenant | Đã chốt (MVP) | Deployment, isolation tier |

## ADR — Quyết định kỹ thuật liên quan D1

| ID | Quyết định | Trạng thái | Ghi chú |
| --- | --- | --- | --- |
| ADR-07 | App chung hai chế độ | Khớp O01/O02 đã chốt | White-label vẫn sau MVP |
| ADR-09 | **Self-hosted OIDC (Keycloak)**, Auth Code + PKCE iOS | **Keycloak** trong Docker Compose / VPS — xem [spike](./spikes/D1-OIDC-PROVIDER.md) | **Đã chốt (MVP)** 2026-10-16 (user: cấm SaaS; App Store + DNS được phép). POC P4 trên Keycloak local trước business endpoints. |
| ADR-02 | Shared DB + RLS | Khớp O08 | Không đổi |
| ADR-11 | **Cấm SaaS runtime**; self-host stack | Postgres/Redis/Keycloak/MinIO/SMTP trên Compose → VPS; **không** Clerk/Auth0/SendGrid/Resend/Expo Push/CDN SaaS/managed DB | Ngoại lệ: Apple App Store / APNs; registrar DNS + Let's Encrypt; GitHub tooling (không runtime) |
| ADR-12 | Push qua **APNs trực tiếp** từ worker | Không Expo Push Service (`exp.host`) | Device token lưu DB; adapter tách transport |
| ADR-13 | Email qua **SMTP adapter** | Dev: Mailpit; prod: Postal hoặc Postfix trên VPS | Không transactional SaaS |
| ADR-14 | Object storage **MinIO** (S3-compatible) | Compose local; cùng image trên VPS | Signed URL ngắn hạn |
| ADR-15 | Admission / waiting room trên **Caddy hoặc nginx** | Rate-limit + token admission ký; Gate không đi qua layer này | Không Cloudflare Waiting Room |

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
