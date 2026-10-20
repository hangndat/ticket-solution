# MPR Web mockup UAT — baseline vs `web-prototype.html`

**Ngày:** 2026-10-20  
**Phạm vi:** Visual QA local (desktop ~1280×800, mobile web ~390×844) — **không** sửa `apps/web`, **không** commit.  
**Mockup SoT:** [`docs/plans/mobile-production-refactor/web-prototype.html`](../../plans/mobile-production-refactor/web-prototype.html) + [`WEB-HANDOFF.md`](../../plans/mobile-production-refactor/WEB-HANDOFF.md) (đã duyệt user; **chưa** triển khai code web trong Epic #580).  
**App thật:** `apps/web` Next.js hiện có (routes production trước mockup).  
**Worktree kiểm tra:** `/Users/admin/orca/workspaces/main/uat-web-mockup-check` @ `67420283d899ab339f2e182a6b7402d9a9ce0ee5`  
**Công cụ:** Orca embedded browser (`orca tab` / `orca exec`, `set viewport` → `goto` → `screenshot`).

## Môi trường chạy

| Thành phần | Trạng thái |
| --- | --- |
| Web dev | `pnpm exec next dev --port 3002` trên worktree UAT (sau `pnpm install` + `pnpm --filter @ticket/contracts build`). `.env.local` từ `.env.example`. |
| Cổng 3000 | Đang bị chiếm bởi **worktree khác** (`mola/apps/web`) — **không** dùng cho UAT này. |
| Keycloak | Container `ticket-solution-keycloak-1` healthy (`:8080`). |
| Nest API (`:3001`) | **Không chạy** (build API local fail TS config trong wt; không kéo full stack). |
| OIDC login E2E | `OIDC_REDIRECT_URI` trong `.env.example` trỏ `:3000` — trên `:3002` redirect login khởi tạo OK nhưng **callback không khớp** → **không** chụp trạng thái đã đăng nhập (`attendee@example.com`). |
| `/gate` (staff scan) | **Không test** — cần phiên staff + setup cổng; ngoài thời gian hợp lý khi chưa login E2E. |

Ảnh: [`assets/mpr-web-mockup-uat-2026-10-20/`](assets/mpr-web-mockup-uat-2026-10-20/) (bản sao trong worktree: `apps/web/.uat-artifacts/mpr-mockup-uat-2026-10-20/`).

## Verdict tổng

**Baseline / gap-discovery cho Epic/Issue web redesign tương lai (MPR-W1+)** — so sánh mockup đã duyệt với web hiện tại.  
**Không** phải DoD Epic **#580** (mobile). Phần lớn lệch layout/IA so với mockup là **chưa triển khai thiết kế mới**, không phải bug regression của mockup.  
Web hiện tại **cùng thương hiệu Vemoki** (nav, đổi mã, tài khoản) nhưng **IA và layout khác** mockup (hero landing vs catalog 3 cột; admin mockup vs redirect OIDC; không có route ví/scan như prototype).

## Bảng so sánh route × viewport

Cột **Đã triển khai mockup mới?** — đánh giá so với `web-prototype.html`, không so với “ý tưởng chung”.

| Route | Viewport | Hiện trạng web thật (`:3002`) | Mockup (màn tương ứng) | Đã triển khai mockup mới? | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| `/` (catalog) | Desktop | Hero «Điều tốt đẹp đưa chúng ta lại gần», nav Đổi mã / Nhận lời mời / Đăng nhập; **alert** «Không tải được danh sách» (API unreachable, fail-closed). ![app](assets/mpr-web-mockup-uat-2026-10-20/app-home-desktop.png) | Khách · Sự kiện: headline «Hẹn bạn ở trải nghiệm tiếp theo», **lưới 3 cột**, search + filter thời gian. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-events-guest-desktop.png) | **Chưa** | Baseline gần **cùng domain** (sự kiện công khai) nhưng **layout/IA khác hẳn** mockup. Thiếu data do API tắt — hành vi đúng spec fail-closed. |
| `/` | Mobile | Cùng hero + alert; nav gọn. ![app](assets/mpr-web-mockup-uat-2026-10-20/app-home-mobile.png) | Danh sách 1 cột, menu thu gọn. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-events-guest-mobile.png) | **Chưa** | Responsive shell ổn; chưa có catalog mockup. |
| Event detail (`/t/.../events/...`) | Desktop / Mobile | `/t/demo/events/sample` → trạng thái **không tải / không tìm** (upstream unreachable). ![app-d](assets/mpr-web-mockup-uat-2026-10-20/app-event-detail-desktop.png) ![app-m](assets/mpr-web-mockup-uat-2026-10-20/app-event-detail-mobile.png) | Khách · chi tiết MFest: 2 cột, CTA, facts. ![mock-d](assets/mpr-web-mockup-uat-2026-10-20/mock-event-detail-desktop.png) ![mock-m](assets/mpr-web-mockup-uat-2026-10-20/mock-event-detail-mobile.png) | **Chưa** (route có) | **Không đánh giá layout đầy đủ** vì không có event published + API. |
| `/redeem` | Desktop | Form đổi mã **đầy đủ**: tenant/event UUID, slug, tải biểu mẫu, trạng thái chờ — form sản phẩm hiện tại. ![app](assets/mpr-web-mockup-uat-2026-10-20/app-redeem-desktop.png) | «Đổi mã»: form gọn, luồng auth gate trong prototype. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-redeem-desktop.png) | **Một phần** | **Chức năng đổi mã đã có** (baseline mạnh); **UI/flow mockup chưa**. |
| `/redeem` | Mobile | Form xếp dọc, usable. ![app](assets/mpr-web-mockup-uat-2026-10-20/app-redeem-mobile.png) | Mobile narrow form. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-redeem-mobile.png) | **Một phần** | Không vỡ layout trên 390px trong session. |
| Ví / «Vé của tôi» | Desktop / Mobile | **Không có route** tương đương prototype; vé gắn redeem/BFF. | «Vé của tôi»: lưới vé + lọc event. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-wallet-desktop.png) | **Chưa** | Đúng kỳ vọng handoff — feature mockup chưa code web. |
| `/account` (guest) | Desktop | «Tài khoản», «Chưa đăng nhập», xóa tài khoản (form disabled khi guest). ![app](assets/mpr-web-mockup-uat-2026-10-20/app-account-desktop.png) | «Tài khoản»: sidebar + nhóm cài đặt. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-account-desktop.png) | **Một phần** | Nội dung compliance (xóa tài khoản) **có**; **chrome mockup** (sidebar IA) **chưa**. |
| `/account` | Mobile | Một cột, nav trên. ![app](assets/mpr-web-mockup-uat-2026-10-20/app-account-mobile.png) | Tab nav ngang + thẻ. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-account-mobile.png) | **Một phần** | |
| `/account` (logged-in) | — | **Không test** | User · Tài khoản có avatar/menu | **—** | OIDC callback `:3000` vs app `:3002`. |
| `/admin` | Desktop | **Redirect** tới Keycloak login (guard staff), không có dashboard mockup. ![app](assets/mpr-web-mockup-uat-2026-10-20/app-admin-desktop.png) | «Quản trị · Tổng quan»: sidebar, stats, bảng. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-admin-overview-desktop.png) | **Chưa** | Admin **shell thật** khác hoàn toàn prototype (preview layout trong mockup). |
| `/admin` | Mobile | Màn hình login IdP (không phải admin UI). ![app](assets/mpr-web-mockup-uat-2026-10-20/app-admin-mobile.png) | Sidebar cuộn ngang + thẻ. ![mock](assets/mpr-web-mockup-uat-2026-10-20/mock-admin-overview-mobile.png) | **Chưa** | |
| `/auth` | Desktop / Mobile | **307** về `/` (stub redirect, không UI đăng nhập riêng). ![app](assets/mpr-web-mockup-uat-2026-10-20/app-auth-desktop.png) | Đăng nhập mô phỏng trong prototype | **Chưa** (by design hiện tại) | Khớp code: `app/auth/route.ts` redirect-only. |
| `/gate` (scan) | — | **Không test** | Cổng · Quét / Lịch sử | **Chưa** | Cần staff session; bỏ qua có chủ đích. |
| `/marketing` | Desktop | Trang marketing sản phẩm hiện có (ngoài mockup MPR). ![app](assets/mpr-web-mockup-uat-2026-10-20/app-marketing-desktop.png) | Không nằm trong prototype MPR | **N/A** | Route legacy; không so mockup. |

## Điểm baseline (web hiện tại đã gần ý tưởng mockup)

- Thương hiệu **Vemoki**, token màu đỏ/xanh, nav **Đổi mã** / **Đăng nhập**.
- **Đổi mã** và **Tài khoản** (guest + privacy/xóa tài khoản) là surface thật, không phải placeholder HTML.
- **Fail-closed** khi API/identity thiếu (home không fake event list; redeem không mock session).
- **Responsive** shell (nav, form redeem, account) không overflow ngang ở 390px trong ảnh chụp.

## Gap mockup mới (kỳ vọng «chưa triển khai»)

- Catalog platform **3 cột** + search/filter; guest hero copy mockup.
- **Ví vé** lọc theo sự kiện, QR ticket, luồng staff **quét / nhập tay / lịch sử**.
- **Admin org** layout (sidebar, stats, bảng → thẻ mobile) như prototype.
- IA mockup: guest ẩn «Vé của tôi»; đổi mã sau auth — web hiện tại dùng form OIDC/BFF khác prototype.

## Vấn đề thật (không phải do mockup chưa code)

| # | Mô tả | Mức | Ghi chú |
| --- | --- | --- | --- |
| 1 | **Cổng 3000 mặc định** dễ nhầm app (session đầu chụp nhầm `mola` trên `:3000`). | Ops/local | Dùng worktree + port rõ ràng trong README UAT. |
| 2 | `/account` guest: block «Đang tải trạng thái tài khoản…» khi BFF/API không có — có thể kéo dài. | Minor UX | Cần xác nhận với API tắt: fail-closed vs spinner vô hạn (chưa xác minh timeout trong session ngắn). |
| 3 | Orca browser: **client navigation** một số route (`/auth`, event detail) dễ kẹt skeleton `app/loading.tsx` nếu không `set viewport` trước `goto`. | Tooling | SSR `curl` có nội dung; ảnh final dùng pattern viewport-first. |
| 4 | Monorepo wt sạch: thiếu `@ticket/contracts` build → Next **500** cho đến khi `pnpm --filter @ticket/contracts build`. | DevEx | Không phải regression UI production. |

**Không ghi nhận** crash layout mobile trên các route đã chụp từ `:3002`.

## Kết luận cho coordinator

- **Mockup:** reference redesign; **web:** baseline sản phẩm + vài surface trùng domain (redeem, account).
- **Epic #580:** không yêu cầu khớp mockup web; task này chỉ tạo evidence cho **MPR web track sau**.
- **Follow-up đề xuất:** Issue web redesign; UAT lặp với API + OIDC redirect đúng port; optional `/gate` khi có staff seed.

---

*Reviewer: Orca worker `task_d708ac48bf8c` · Visual QA only · No commit.*
