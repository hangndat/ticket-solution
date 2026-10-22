# Coordinator đánh giá review lần 2 (`review-2/review.md`)

| Trường | Giá trị |
| --- | --- |
| Run / task / dispatch | `run_3aad5e1c919b` / `task_321a5ae0e7a0` / `ctx_ac8ec6a95c27` (cursor, composer-2.5 — cùng model lần 1) |
| Mục đích | Kiểm thử role `reviewer-uiux` sau khi thêm bước 7 "Kiểm evidence" |
| Phương pháp | Mở ảnh của các finding chính + ảnh nav ở 1280/390; md5 toàn bộ assets |

## So với lần 1

| Tiêu chí | Lần 1 | Lần 2 |
| --- | --- | --- |
| Ảnh trùng hash | 2 cặp | 0 (23 ảnh) |
| Ảnh app lệch nhãn | 3 | 0 (đã kiểm user-catalog, mobile wallet) |
| False positive persona/journey | 2 (UX-APP-001/002) | 0 — đọc bảng `screens` trước khi kết luận |
| Mobile 390 app có evidence thật | Không | Có (khung đổi layout, «≡ Menu») |
| State phủ | ~9 | 16 app + 5 marketing |

Bước 7 có tác dụng rõ với app.

## Lỗi còn lại

1. **Locale lệch nhãn (marketing):** `marketing-en-desktop-1280-interest-form.png` thực tế có toggle **VI** active. UX-MKT-002 (form không i18n) vẫn đúng theo source, nhưng ảnh dẫn không chứng minh được.
2. **Giữ ảnh sai nhãn:** `marketing-vi-desktop-1280-interest-form.png` là ảnh hero, worker ghi chú nhưng vẫn để trong assets.
3. **Bỏ sót lần 2:** nav app đã đăng nhập ở Desktop 1280 xuống 2 dòng («Khám / phá», «Vé của / tôi»…) — thấy rõ trong `app-vi-desktop-1280-user-catalog.png` do chính worker chụp. Header marketing desktop cũng wrap («Đăng / nhập», CTA 2 dòng); worker chỉ ghi UX-MKT-003 là "mật độ cao, thấp".

## Findings mới đáng giữ

- UX-APP-001: «Sắp diễn ra» trùng giữa dropdown và chip — hợp lệ.
- UX-APP-002/003: gap handoff, mức thấp — hợp lệ như ghi chú PD.
- Verdict "PASS with known gap" cho scope mockup chấp nhận được, nhưng cần thêm nav wrap 1280 vào gap.

## Phản hồi role của worker → xử lý

| Đề xuất | Xử lý |
| --- | --- |
| Prototype có khung: cuộn/anchor phải trong khung | Đã thêm vào bước 7 |
| Nhánh render-only không bắt buộc fetch checklist web | Đã có trong `ui-workflow.md` ("khi kiểm code web") — không đổi |
| Nới yêu cầu chụp lại ảnh | Không áp dụng — chính lỗi lần 1/2 đến từ ảnh sai nhãn |
| Cấm script chụp tự động trong template | Đã có ở `uat-headless.mdc`/task spec — không đổi |

## Đã sửa role sau lần 2

- Bước 3: soát chrome (nav/nút/nhãn) ở mỗi viewport × persona; chữ xuống dòng/cắt/chồng là finding.
- Bước 7: xác nhận **locale active từ toggle trong ảnh**; ảnh không dùng được thì xóa/đổi tên; prototype có khung phải thao tác trong khung.

> **Đính chính (sau lần 3):** khung "Desktop 1280" thực đo chỉ 878px; nav wrap xảy ra ở ≤~1000px, không phải 1280. Xem `review-3/coordinator-evaluation.md`.
