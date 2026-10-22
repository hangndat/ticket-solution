# Coordinator đánh giá báo cáo `worker-review.md` (Mira · ux)

| Trường | Giá trị |
| --- | --- |
| Run / dispatch | `run_3aad5e1c919b` / `ctx_d8bb02100f05` |
| Ngày | 2026-10-22 |
| Phương pháp | Đối chiếu từng finding với source mockup (working tree) và ảnh trong `assets/worker/`; md5 ảnh để phát hiện trùng |

## Kết luận

**Chấp nhận một phần — chưa dùng làm căn cứ handoff.** Phần marketing đúng; phần app có 2 false positive do ảnh lệch nhãn, và bỏ sót một lỗi layout thấy rõ trong chính ảnh worker chụp.

## Kiểm chứng findings

| ID | Kết quả | Căn cứ |
| --- | --- | --- |
| UX-MKT-001 | Xác nhận | `marketing/css/marketing.css` `.browser.mobile .mkt-nav .mkt-nav-links { display: none }`; không có menu/drawer trong source |
| UX-MKT-002 | Xác nhận | `marketing/index.html` form: label/consent hardcode VI, chỉ `formLead`/`formSubmit` có `data-i18n` |
| UX-MKT-003 | Giữ, thấp | Chưa tái kiểm; giá trị thấp vì là hành vi khung prototype |
| UX-MKT-004 | Xác nhận | Option `Tenant Owner`, `Agency` trong form VI |
| UX-APP-001 | **Sai** | `app-catalog-vi-desktop.png` cho thấy Guest · Catalog **không** có «Vé của tôi»/avatar; code gate `role !== "guest"` (`app/index.html` ~L343, L362) |
| UX-APP-002 | **Sai** | Màn «Event detail» được khai báo role `user` (`screens` ~L258) nên hiển thị «Bạn có 2 vé» là đúng thiết kế |
| UX-APP-003 | Giữ, cần evidence | Chưa có ảnh mobile app hợp lệ |
| UX-CODE-004 | Giữ | Pass hẹp, không ảnh hưởng |

## Lỗi evidence

- Ảnh app bị **lệch một bước**: tên file mô tả màn trước/sau màn thực tế.
  - `app-event-detail-vi.png` thực tế là **Redeem · gate**.
  - `app-guest-catalog-mobile-390.png` thực tế là **Event detail** (desktop) — không phải guest, không phải mobile.
  - `app-mobile-catalog-390.png` trùng byte với `app-redeem-terms-vi.png` (md5 `11924fe9…`).
- `marketing-vi-desktop-1280.png` trùng byte với `marketing-vi-desktop-frame-1280.png`.
- Hệ quả: worker kết luận từ ảnh sai nhãn → UX-APP-001/002 sai, và "mobile 390 không đổi layout" chưa được chứng minh.

## Bị bỏ sót

| ID đề xuất | Vấn đề | Evidence | Mức độ |
| --- | --- | --- | --- |
| UX-APP-005 | Ở Desktop 1280, trạng thái **đã đăng nhập**: 5 mục nav xuống 2 dòng («Khám / phá», «Vé của / tôi», «Đổi / mã»…) | `app-guest-catalog-mobile-390.png`, `app-mobile-catalog-390.png` (thực tế là desktop user) | **Trung bình–Cao** — lỗi ngay ở viewport chính |

## Yêu cầu nếu chạy lại

1. Chụp ảnh **sau khi** state render xong; kiểm tra tên file khớp nội dung (không ảnh trùng md5).
2. Đối chiếu role của từng state trong `screens` trước khi kết luận lệch journey.
3. Có ảnh Mobile 390 hợp lệ cho app + menu sheet.
4. Ghi nhận UX-APP-005.

> **Đính chính (sau lần 3):** khung "Desktop 1280" thực đo chỉ 878px; nav wrap xảy ra ở ≤~1000px, không phải 1280. Xem `review-3/coordinator-evaluation.md`.
