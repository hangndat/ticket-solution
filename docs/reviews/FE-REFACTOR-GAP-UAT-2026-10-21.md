# FE refactor gap UAT — Slice A (guest web)

**Ngày:** 2026-10-21  
**Worktree / SHA:** `hangndat/FE-refactor` · `9515c980db4185c8109fe648204036e3e0e56fb1`  
**Phạm vi:** Guest routes `apps/web` — read-only audit, không sửa `apps/*`.  
**Mockup SoT:** `fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/web-prototype.html` (+ `WEB-HANDOFF.md`).  
**App URL:** `http://127.0.0.1:3010`  
**Ảnh:** `docs/reviews/assets/fe-refactor-gap-2026-10-21/` (`app-*` = thực tế, `mock-*` = prototype cùng viewport).

## Môi trường & dữ liệu

| Thành phần | Trạng thái |
| --- | --- |
| Web `:3010` | Lúc audit **không có listener** (coordinator báo đang chạy). Đã khởi động lại `next dev --port 3010` trong worktree để chụp ảnh — **không** dừng Keycloak `:8080`. |
| API `:3001` | Ban đầu tắt. Đã `pnpm --filter @ticket/backend build` + `apps/api` build + chạy Nest trên `:3001` với `DATABASE_URL` → `ticket_d9_demo` (`55432`). |
| Postgres `ticket_d9_demo` | Có seed: tenants `demo-fun`, `demo-studio`; events `fun-fest`, `studio-night` (PUBLISHED). |
| API ↔ catalog | `GET /v1/public/events` → **500** (`permission denied` / `SET ROLE ticket_platform_runtime` / bảng `events`). Web home hiển thị lỗi **「Dữ liệu sự kiện không hợp lệ」**. Event detail `/t/demo-fun/events/fun-fest` → **404/empty state** (không load published event). **Chưa đạt** luồng dữ liệu thật trong khung ~20 phút (cần bootstrap runtime role đúng như `scripts/d9-demo-seed-smoke.mjs` / `d9_demo_rt` password gốc, không đổi tay). |
| Chụp ảnh | Playwright headless (`channel: chrome`) viewport 1280×800 và 390×844; bổ sung `orca tab` + `orca exec snapshot` (page `f8e8a9f6-…`). Orca embedded browser **không** có lệnh đổi viewport — dùng Playwright theo task cho kích thước chuẩn. |

## Mức độ (severity)

| Mã | Ý nghĩa |
| --- | --- |
| **P0** | Chặn nghiệm vụ / dữ liệu hỏng |
| **P1** | Lệch layout hoặc IA lớn so mockup đã duyệt |
| **P2** | Lệch copy, thành phần phụ, responsive vừa |
| **P3** | Chi tiết visual nhỏ |
| **N/A** | Mockup không có màn tương ứng |

## Bảng route × viewport

| Route | Viewport | Ảnh app | Ảnh mock | Lệch chính | Mức |
| --- | --- | --- | --- | --- | --- |
| `/` (catalog guest) | Desktop 1280×800 | [app-home-desktop](assets/fe-refactor-gap-2026-10-21/app-home-desktop.png) | [mock-home-desktop](assets/fe-refactor-gap-2026-10-21/mock-home-desktop.png) | App = **landing marketing** (hero 「Điều tốt đẹp…」, 2 CTA) + **khối lỗi API**; mock = **catalog 3 cột**, search + filter 「Sắp diễn ra」, thẻ sự kiện MFest/… Nav mock: 「Sự kiện｜Đổi mã｜Tài khoản」; app guest: 「Đổi mã｜Nhận lời mời｜Đăng nhập」 (không tab Sự kiện/Tài khoản). | **P0** (data) + **P1** (IA/layout) |
| `/` | Mobile 390×844 | [app-home-mobile](assets/fe-refactor-gap-2026-10-21/app-home-mobile.png) | [mock-home-mobile](assets/fe-refactor-gap-2026-10-21/mock-home-mobile.png) | Cùng lệch desktop; mobile app chưa hamburger/menu vai trò như mock (nav links xếp dọc góc phải). | **P0** + **P1** |
| `/t/demo-fun/events/fun-fest` | Desktop | [app-event-detail-desktop](assets/fe-refactor-gap-2026-10-21/app-event-detail-desktop.png) | [mock-event-detail-desktop](assets/fe-refactor-gap-2026-10-21/mock-event-detail-desktop.png) | App: **404** 「Chưa có gì ở đây」; mock: **detail 2 cột** (hero MFest, facts, prose, sidebox 「Đổi mã lấy vé」). | **P0** + **P1** |
| `/t/…/events/…` | Mobile | [app-event-detail-mobile](assets/fe-refactor-gap-2026-10-21/app-event-detail-mobile.png) | [mock-event-detail-mobile](assets/fe-refactor-gap-2026-10-21/mock-event-detail-mobile.png) | Tương tự desktop — không có nội dung sự kiện. | **P0** + **P1** |
| `/redeem` | Desktop | [app-redeem-desktop](assets/fe-refactor-gap-2026-10-21/app-redeem-desktop.png) | [mock-redeem-desktop](assets/fe-refactor-gap-2026-10-21/mock-redeem-desktop.png) | App: form **kỹ thuật** (UUID tổ chức/sự kiện, đường dẫn, tải biểu mẫu, nhiều nút dev); mock guest redeem = **cổng đăng nhập** 「Tiếp tục đăng nhập」 (auth gate). Lệch flow UX đã duyệt (đổi mã sau auth, không lộ UUID). | **P1** |
| `/redeem` | Mobile | [app-redeem-mobile](assets/fe-refactor-gap-2026-10-21/app-redeem-mobile.png) | [mock-redeem-mobile](assets/fe-refactor-gap-2026-10-21/mock-redeem-mobile.png) | Form dài, chưa card/narrow như mock login. | **P1** |
| `/account` (guest) | Desktop | [app-account-desktop](assets/fe-refactor-gap-2026-10-21/app-account-desktop.png) | [mock-account-desktop](assets/fe-refactor-gap-2026-10-21/mock-account-desktop.png) | App: trang **Tài khoản** thật (phiên + xóa tài khoản) — hợp spec privacy; mock chụp **login gate** (guest chưa đăng nhập). So mock **logged-in** (`user/account`, sidebar) app chưa có layout 2 cột accountnav. | **P2** (guest) / **P1** (đã login — chưa UAT) |
| `/account` | Mobile | [app-account-mobile](assets/fe-refactor-gap-2026-10-21/app-account-mobile.png) | [mock-account-mobile](assets/fe-refactor-gap-2026-10-21/mock-account-mobile.png) | Tương tự. | **P2** |
| `/auth` | Desktop | [app-auth-desktop](assets/fe-refactor-gap-2026-10-21/app-auth-desktop.png) | [mock-auth-desktop](assets/fe-refactor-gap-2026-10-21/mock-auth-desktop.png) | `GET /auth` → **307** `location: http://localhost:3010/` (stub về home, không màn login mock). Ảnh app ≈ home redirect. | **P1** |
| `/auth` | Mobile | [app-auth-mobile](assets/fe-refactor-gap-2026-10-21/app-auth-mobile.png) | [mock-auth-mobile](assets/fe-refactor-gap-2026-10-21/mock-auth-mobile.png) | Cùng hành vi redirect. | **P1** |
| `/marketing` | Desktop | [app-marketing-desktop](assets/fe-refactor-gap-2026-10-21/app-marketing-desktop.png) | — | Trang **sales/apex** dài (demo, đăng ký quan tâm, form lead) — **không có** trong `web-prototype.html`. | **N/A** (mock) |
| `/marketing` | Mobile | [app-marketing-mobile](assets/fe-refactor-gap-2026-10-21/app-marketing-mobile.png) | — | Cùng — chỉ app. | **N/A** |

## Tóm tắt điều phối

1. **Outdated vs mockup:** Xác nhận user — IA product (catalog, event detail, nav) **chưa** khớp handoff 20/10; redeem/auth còn **developer-facing**; home trộn marketing + lỗi upstream.
2. **Blocker dữ liệu:** Cần API `:3001` + runtime DB role đúng (smoke script/bootstrap) trước khi đánh giá visual catalog/event có nội dung.
3. **Việc còn:** Implement theo `WEB-HANDOFF.md` + mockup; re-UAT sau API xanh và web dev ổn định; bổ sung mock marketing hoặc tách rõ product vs apex.

## Lệnh evidence (rút gọn)

```bash
# Ảnh (đã chạy)
pnpm exec node /tmp/fe-gap-uat-capture.mjs

# API (session UAT — không commit)
cd apps/api && DATABASE_URL='postgresql://d9_demo_rt:…@127.0.0.1:55432/ticket_d9_demo' … node dist/main.js
curl -s http://127.0.0.1:3001/v1/public/events  # → 500 tại thời điểm audit
```

**Verdict slice A:** **FAIL** — guest catalog/event không hiển thị dữ liệu; lệch mockup **P1** trên hầu hết route guest.
