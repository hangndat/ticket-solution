# #869 — bàn giao một lượt ngoại lệ

Review gốc: `UI869-INDEPENDENT-REVIEW.md`, SHA `7df8f64124ea5dfc58de4db33bc12e775cc5ade2`; quyết định và chẩn đoán: `UI869-DIAGNOSIS.md`. Counter **2/2 + ngoại lệ duy nhất đã dùng**. Implementer: Minh (root). Cần James xác minh độc lập exact SHA mới, không kế thừa PASS.

| Finding | Sửa / căn cứ mới | Check |
| --- | --- | --- |
| F01 | Snapshot private process group với PID/start identity; sau TERM theo dõi cả group, dùng surviving original member để chứng minh ownership trước KILL; xác minh không còn member. Không xóa owner file nếu không chứng minh/không dừng được. Legacy stop dùng identity riêng từng descendant. | Test child ignore TERM, leader thoát, child bị dừng; foreign/reused identity không bị kill; private group/idempotency/pause. |
| F02 | Down giữ pause, thử dừng cả API/web và Compose; trả nonzero + thông báo nếu có lỗi, bỏ nhánh nuốt lỗi. | Stub Docker trả37, down nonzero, paused còn; không chạm stack thật trong test. |
| F03 | Checkpoint/handoff/review có UUID riêng; retry truyền lại returned ID. Lifecycle singleton giữ dispatch:type stable ID. Cùng ID nhưng đổi summary/identity bị từ chối. | Hai checkpoint cùng dispatch còn đủ; retry từng ID không thêm dòng. |
| F04 | Append và validate đối chiếu employee/run/task trên toàn dispatch; recovery tham chiếu dispatch đã có cũng giữ cùng danh tính, kiểm hai hướng kể cả import đảo thứ tự. | Cross-type và recovery conflict bị reject, validate journal hỏng fail; chain đúng pass. |
| F05 | Không đổi source: renderer Orca thiếu frame. Chẩn đoán ghi RAF0 trong2s, sau render animation tiến đến target96px với CSS smooth; click FAQ, keyboard Features, Back đều đạt. | Reviewer tái kiểm qua screenshot/render rồi đo; reduced motion auto từ CSS không đổi. |
| F06 | Bỏ px20 của hero grid, giữ section padding20; đổi riêng hero interest thành “Trao đổi nhu cầu”/“Discuss your needs”, đích/analytics/test IDs không đổi. | VI390 H1 x20, figure x20/w350, scrollWidth390; ảnh `assets/UI869-ROOT/exception-hero-390.png`. Cần reviewer đối chiếu thêm EN/1024. |

Checks local: workflow **80/80**, process/down **6/6**, company validate16 employees/25 events; web tests, lint, production build + TypeScript PASS; shell syntax và diff whitespace PASS. Warning build filesystem tracing marketing lead là warning cũ, không sửa ngoài scope. Local down thực tế exit0, pause=true, ports3417/3498 rỗng, không containerui869dev chạy (`exception-stop-proof.json`). Up hoàn tất, services healthy; psql read-only xác nhận **3 events/3 tickets/25 codes** (`exception-restart-proof.json`); không reseed hoặc reset volumes.

Giới hạn: không re-audit toàn repo, không claim native/portal pilot UAT. Nếu reviewer còn blocker, giữ Bị chặn và báo user; không lặp ngoại lệ. Root đã đóng tab chẩn đoán; stack local được khởi động lại để live check.
