# Coordinator đánh giá review lần 4 (`review-4/review.md`)

| Trường | Giá trị |
| --- | --- |
| Run / task / dispatch | `run_3aad5e1c919b` / `task_cb849fc0d913` / `ctx_92eab45ab6d6` (cursor, composer-2.5) |
| Mục đích | Kiểm thử role đầy đủ với Task Spec gọn (chỉ trỏ role, không gợi ý probe/viewport) |
| Phương pháp | Mở ảnh; `ui-evidence-check.sh`; đo lại H1/form bằng probe ở viewport 1440 và 430 |

## Quy tắc tự áp dụng (không được nhắc trong Task Spec)

| Quy tắc | Kết quả |
| --- | --- |
| Chạy probe chrome | Đạt — 7 file probe JSON |
| `set viewport` + ghi `frameWidth` | Đạt — phát hiện khung marketing 1260 ≠ 1280 |
| Gắn loại finding | Đạt — 6/6 |
| Bắt i18n form EN | Đạt — kiểm bằng eval `formLabels`, không phụ thuộc ảnh |
| Không file trùng / sai nhãn | **Không đạt** — 8 ảnh app trùng một hash, 3 ảnh trùng hash khác, 2 cặp probe JSON trùng; `mkt-vi-mobile-390-hero.png` thực tế là section Solutions; `probe-marketing-desktop.json` thực tế là output form mobile |

## False positive do chính quy tắc coordinator

UX-4-01 (H1 mobile 1 từ/dòng) và UX-4-02 (form mobile wrap) chỉ xảy ra khi **khung mobile 390 nằm trong viewport 1440**: CSS dùng media query theo viewport thật (`@media (max-width: 959px)` …), khung `.browser.mobile` không kích hoạt chúng.

| Viewport thật | Khung | H1 | Form | Probe |
| --- | --- | --- | --- | --- |
| 1440 | 390 | 60px, 15 dòng | rộng 92px | 3 control wrap |
| 430 | 390 | 37.6px, 4 dòng | rộng 298px | 0 issue |

Nguyên nhân: quy tắc lần 3 chỉ nói "đặt viewport đủ rộng (vd. 1440)" mà không tách mobile. Đã sửa: viewport thật = kích thước mục tiêu; khung mobile trong viewport desktop không phải bằng chứng mobile. Hành vi này của prototype là gap công cụ PD (mức thấp), không phải lỗi sản phẩm.

## Findings lần 4

| ID | Đánh giá |
| --- | --- |
| UX-4-01 | Sai (artifact prototype) — xem trên |
| UX-4-02 | Sai (artifact prototype) |
| UX-4-03 marketing mobile thiếu nav (`IA`) | Đúng — khớp lần 1–3 |
| UX-4-04 form không i18n EN (`copy/locale`) | Đúng — evidence bằng eval tốt hơn lần 2 |
| UX-4-05 lọc trùng (`IA`) | Đúng — khớp lần 2–3 |
| UX-4-06 khung 1260 | Đúng nhưng thuộc công cụ prototype, không phải lệch mẫu sản phẩm |
| Thiếu | Wrap header marketing ở khung 1024 và nav app user dưới ~1000 — role chưa yêu cầu đo bề rộng trung gian |

## Phản hồi role của worker → xử lý

| Đề xuất | Xử lý |
| --- | --- |
| Ưu tiên API JS prototype thay click nút | Đã thêm bước 7 |
| Probe sau khi cuộn tới control | Đã thêm bước 7 |
| Impeccable sub-agent: cho single-context | Đã thêm bước 2 |
| Assert DOM trước khi chụp | Gộp vào bước 7 (xác nhận state bằng probe/DOM) + `ui-evidence-check.sh` |

## Đã sửa sau lần 4

- `docs/agents/tools/ui-evidence-check.sh`: exit 1 nếu assets có file trùng nội dung; bắt buộc `OK` trước `worker_done`. Chạy trên review-4 → FAIL; review-3 → OK.
- Bước 3: probe thêm một bề rộng trung gian (vd. 1024).
- Bước 7: viewport thật = mục tiêu (mobile 390–430); API JS prototype; probe sau cuộn.
- Bước 2: critique single-context hợp lệ khi worker không được spawn.
