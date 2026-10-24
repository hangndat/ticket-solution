# #869 — chẩn đoán sau review độc lập

SHA phát hiện: `7df8f64124ea5dfc58de4db33bc12e775cc5ade2`. Reviewer James; findings F01–F06 trong `UI869-INDEPENDENT-REVIEW.md`. Lượt sửa tự động **2/2**, ngoại lệ **chưa dùng**. Project: **Bị chặn**. Không acceptance/merge khi findings chặn còn mở.

## Lượt chẩn đoán duy nhất

Owner: Minh (coordinator/root). Ngân sách: tối đa 20 phút, bắt đầu 2026-10-24T09:52Z. Chỉ đọc/repro và ghi kế hoạch; chưa sửa source. Câu hỏi: xác định điều kiện gây F01/F03/F04; kiểm F02 bằng source/error branch; đối chiếu F06 với mẫu; phân biệt CSS smooth với giới hạn animation của Orca ở F05. Output: nguyên nhân, lý do checks cũ bỏ sót, kế hoạch xác minh cho từng ID; quyết định có/không dùng một lượt ngoại lệ. Không restart/reseed local hoặc tiêu thụ mã dành cho user trong chẩn đoán.

| ID | Giả thuyết / check cần làm |
| --- | --- |
| F01 | Leader thoát trước child làm bỏ qua KILL; cần snapshot identity các thành viên group trước TERM và xác minh toàn group, không chỉ leader. |
| F02 | `compose stop` lỗi bị nuốt; cần giữ pause, trả lỗi thật. |
| F03 | ID `dispatch:type` không đủ cho checkpoint/review nhiều lần; cần event identity riêng và retry key ổn định cho lifecycle singleton. |
| F04 | Validate chỉ từng row, thiếu invariant dispatch/recovery chain; cần đối chiếu employee/task giữa các event. |
| F05 | CSS smooth có computed đúng nhưng không tiến trong Orca; probe animation clock/scroll runtime để phân biệt công cụ và code. |
| F06 | Section + grid cùng px20; bỏ lớp grid và đồng bộ nhãn với mẫu. |

## Kết quả và quyết định — 2026-10-24T09:55Z

Chẩn đoán hoàn tất trong ngân sách. F01/F03/F04 là nguyên nhân code đã được James repro độc lập; F02/F06 khớp source. Checks trước chỉ kiểm child thuận TERM, một checkpoint/dispatch và identity cùng event ID, nên bỏ sót các nhánh này; UI chưa đối chiếu rect với prototype.

F05 là renderer bị ngừng frame khi Orca chờ: trên tab `d9530c7d-5e54-4558-8565-a2c6c526bdfc`, requestAnimationFrame đếm **0 frame** suốt 8 mẫu ×250ms, explicit native smooth scroll đứng y0; yêu cầu screenshot/render làm animation chạy. Click FAQ với CSS smooth: frame10/y29.5 → frame57/y4845/FAQ top96.0703125px. Keyboard focus Features + Enter → y1234/top96.015625px; Back → FAQ y4845/top96.0703125px. CSS vẫn `smooth`, không override `auto`. Không sửa nav để lách công cụ; reviewer cần tái kiểm bằng chuỗi render rồi đo, giữ reduced-motion auto.

**Quyết định coordinator Minh:** dùng **một lượt ngoại lệ duy nhất**, không reset **2/2**. Căn cứ mới là targeted repro của review và nguyên nhân renderer ở trên; phạm vi F01–F04/F06, không mở feature. Owner implementation: Minh (root, coordinator tooling/integration); reviewer độc lập: James ở exact SHA mới. Kế hoạch: stop kiểm và kết thúc toàn bộ owned group với identity guard, báo lỗi/giữ owner record khi không thể chứng minh; down không nuốt lỗi Compose; repeatable events có ID riêng và explicit retry ID; enforce employee/run/task cho dispatch và recovery chain; bỏ padding grid20px và đổi riêng nhãn hero VI/EN. Tests chỉ nhánh mới + suites liên quan; UAT down/up không reset dữ liệu, hero390/1024, nav click/keyboard/back, CI exact SHA. **Dừng:** ngoại lệ FAIL hoặc thiếu căn cứ đóng blocker → giữ Bị chặn, báo user; không thêm diagnosis/fix lặp.
