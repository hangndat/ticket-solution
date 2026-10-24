# Baseline triển khai thiết kế — 24/10/2026

**Nguồn:** so sánh file prototype trong thư mục này với source `HEAD 9e6565af`. Đây là kiểm kê source, chưa phải UAT runtime. Xem [plan triển khai](../../plans/VEMOKI-UNIFIED-DESIGN-IMPLEMENTATION-2026-10-24.md) cho owner và AC.

| Surface mẫu | Route/màn hiện có | Phần cần đối chiếu khi implement | State ưu tiên |
| --- | --- | --- | --- |
| Marketing `marketing/index.html` | `apps/web/app/marketing/**`, `apps/web/src/marketing/**` | Hero/CTA/copy/ảnh theo delta, giữ locale và chrome đã sửa trong #867/#870 | VI/EN, mobile nav, lead form, loading, reduced motion |
| Attendee web `product/attendee-web*.html` | `apps/web/app/(consumer)/t/[tenantSlug]/events/[eventSlug]`, `redeem`, `claim`, `wallet`, ticket, account | Event → redeem/link email → QR; không ghi đè contract claim/OIDC đã nghiệm thu, không dùng QR demo | pending/unknown, private/forbidden, ticket stale/revoked, tenant/session switch |
| Attendee iOS `product/attendee-mobile.html` | `apps/mobile/src/screens/events.tsx`, `event-detail.tsx`, `redeem.tsx`, `my-tickets.tsx`, `ticket-detail.tsx`, `account.tsx` | Điều chỉnh hierarchy/token theo native; một màn đại diện trước khi mở rộng | offline cached QR, claim chưa xác nhận, auth/logout, Dynamic Type |
| Staff iOS `product/staff-mobile.html` | `apps/mobile/src/screens/staff-scan.tsx`, `staff-manual.tsx`, `staff-history.tsx` và `src/gate/**` | Hiển thị context/outcome; giữ classifier và quy trình đã kiểm ở #859 | APPLIED/duplicate/rejected/queued/unknown/conflict, camera denied, offline restart |
| Portal `product/portal*.html` | `apps/portal/app/t/[tenantId]/**`, `apps/portal/src/theme/vemoki.ts`, Ant Design/ProComponents | Readiness, event list, bảng/form/compact; Gate report read-only theo `report.read` | role denied, asOf/stale, empty/error, compact table |

## Gate và assets

- `apps/web/app/gate` đã vắng mặt sau D-6. Còn link/copy lịch sử tại `apps/web/src/portal/dual-run-banner.tsx` và marketing demo copy; `apps/portal/.../gate` là **report**, không phải scanner. VD-01 chốt behavior direct route/deep link trước VD-02.
- Token SoT là `brand/vemoki/tokens.json`; product prototype token chỉ là đề xuất scoped. Không thay global brand, tenant branding hoặc semantic outcome bằng gradient marketing.
- `design-system/product/assets/qr-demo-not-valid.png` cố ý không hợp lệ, không dùng làm credential thật. Ảnh event/hero/product trong gói là minh họa; chưa có biên nhận license/consent cho production. Worker dùng media thật có provenance hoặc giữ placeholder được đánh nhãn cho preview, không tự công bố là khách hàng hay sự kiện thật.
- File HTML/PNG phục vụ tham chiếu thị giác; không chứng minh auth, backend, camera hay responsive trong app. Evidence implementation phải gắn build/SHA/route/persona/state/viewport hoặc UDID.
