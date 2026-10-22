# Coordinator đánh giá review lần 3 (`review-3/review.md`)

| Trường | Giá trị |
| --- | --- |
| Run / task / dispatch | `run_3aad5e1c919b` / `task_b6a3a6ebc579` / `ctx_e188f40c0e63` (cursor, composer-2.5) |
| Mục đích | Kiểm thử bước 3 (soát chrome) + bước 7 (locale, ảnh sai, khung prototype) |
| Phương pháp | Mở ảnh; chạy `docs/agents/tools/ui-chrome-wrap-probe.js` qua `orca exec eval` ở nhiều viewport đo thật |

## Kết quả kiểm thử quy tắc

| Quy tắc | Kết quả |
| --- | --- |
| Không ảnh trùng / sai nhãn | Đạt — 18 ảnh, hash khác nhau; ảnh form sai đã **xóa** thay vì giữ |
| Locale đọc từ toggle trong ảnh | Đạt — bảng ảnh ghi locale active; EN spot-check cả app |
| Persona theo bảng `screens` | Đạt — chép bảng state vào report |
| Soát chrome xuống dòng (bước 3) | **Không đạt** — UX-M3-05 ghi "chưa thấy wrap" trong khi `marketing-vi-desktop-1280.png` rõ ràng wrap («Đăng / nhập», CTA 2 dòng, nav 2 hàng); nav app user cũng wrap trong ảnh |

Kết luận: quy tắc dạng "nhìn kỹ hơn" không đủ với model hiện tại — 3 lần liền bỏ sót lỗi hiển thị rõ trong ảnh do chính worker chụp.

## Phát hiện gốc: nhãn viewport sai

Đo bằng probe: cửa sổ Orca mặc định rộng **918px**, khung "Desktop 1280" thực tế chỉ **878px** (`max-width: 1280px`). Mọi ảnh "1280" của cả ba lần review — và kết luận "nav wrap ở 1280" trong hai bản đánh giá coordinator trước — đều sai nhãn.

Đo lại sau `orca exec --command "set viewport <W> 900"`:

| Khung đo thật | App (user) | Marketing |
| --- | --- | --- |
| 878 | nav 5 mục wrap 2 dòng | nav 2 hàng, «Đăng nhập» + CTA wrap |
| 1024 | không wrap | «Đăng nhập», «Đăng ký quan tâm» wrap |
| 1124–1280 | không wrap | không wrap |

Finding đúng: **chrome không có breakpoint trung gian** — marketing wrap ở ≤1024 (laptop nhỏ/tablet ngang), app user wrap dưới ~1000. Mockup chỉ định nghĩa 1280 và 390, nên đây là gap thiết kế cho PD, mức Trung bình.

## Findings lần 3

| ID | Đánh giá |
| --- | --- |
| UX-M3-01 marketing mobile thiếu nav | Đúng (khớp lần 1, 2) |
| UX-M3-02 lọc trùng | Đúng (khớp lần 2) |
| UX-M3-03 ngày "24 Oct" khi VI | Đúng, mới |
| UX-M3-04 «Đổi mã» vs «Đổi mã lấy vé» | Đúng, mới |
| UX-M3-05 | Sai mô tả ("chưa thấy wrap"); thay bằng finding breakpoint ở trên |
| Thiếu | UX-MKT-002 (form không i18n EN) bị bỏ do không chụp được form — lẽ ra ghi theo source + Limitations |

## Phản hồi role của worker → xử lý

| Đề xuất | Xử lý |
| --- | --- |
| Cách thao tác trong khung khi scroll không đổi ảnh | Đã có ý trong bước 7; giữ |
| Phân loại finding chrome vs IA | Hợp lý, chưa sửa — đề xuất user quyết |
| Gộp checklist evidence vào Task Spec | Hợp lý — Task Spec nên trỏ role bước 7 thay vì chép lại |
| `web-design-guidelines` tùy chọn với mockup | Đã có trong `ui-workflow.md` |

## Đã sửa role sau lần 3

- Bước 3: soát chrome bằng **probe** (`docs/agents/tools/ui-chrome-wrap-probe.js`), không dựa mắt.
- Bước 7: viewport phải **đo** (`set viewport` + `frameWidth`), không lấy nhãn nút prototype.

## Đính chính đánh giá trước

`coordinator-evaluation.md` (lần 1) UX-APP-005 và `review-2/coordinator-evaluation.md` mục "Bỏ sót lần 2": lỗi nav wrap xảy ra ở khung **878px**, không phải 1280.
