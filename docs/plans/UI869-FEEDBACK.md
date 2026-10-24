# #869 — Tổng hợp feedback web và local dev

PR #870, Epic #867 / Story #868. Baseline `30ce1daa60572f6309305436ff9aa29a17ccebe1`.
Run `run_e037a166ddea`. User đã yêu cầu thực hiện, chưa authorize merge/deploy.

Đây là batch sửa **2/2** của #869 và phạm vi bổ sung được user yêu cầu trực tiếp. Giữ nguyên finding/counter lịch sử; không reset khi phục hồi worker hoặc thay SHA. Review phát hiện blocker sau batch này phải chẩn đoán và ghi quyết định trước vòng sửa tiếp.

| ID | Feedback / kết quả cần đạt | Owner | Kiểm chứng |
| --- | --- | --- | --- |
| FB01 | Chọn ngôn ngữ marketing không làm nhảy layout; giữ hash đang xem | Web | VI ↔ EN tại 390/1024/1440, đo slot và nhìn header |
| FB02 | Media phải là ảnh chụp sản phẩm thật, thay mockup | Web | Manifest nguồn capture, route/build/persona, dữ liệu demo; không AI/prototype giả sản phẩm |
| FB03 | Card Khám phá đều chiều cao trong hàng, CTA ổn định | Coordinator `packages/ui`, Web consumer | Nội dung dài/ngắn, guest/owned, nhiều cột và mobile; không cắt mất nội dung |
| FB04 | Đồng bộ input/search/select/textarea | Web | Kích thước/viền/radius/focus/error/disabled; textarea giữ nhiều dòng |
| FB05 | Section nav mượt, không bị sticky header che | Web | Anchor/hash, keyboard/history, reduced motion |
| FB06 | Empty state bị ép thành dải một dòng trong ảnh user | Web | Filter không có kết quả, có khoảng thở và reset filter hoạt động |
| FB07 | Bỏ trang đệm tải xấu, ưu tiên skeleton | Web | Skeleton đúng bố cục route, giữ shell/nav, không nháy màn chờ toàn trang |
| FB08 | Thiết kế lại toàn bộ banner/hero giao diện | PD → Web | Mẫu đại diện marketing/catalog, responsive, brand hiện hành; ảnh bìa sự kiện chờ xác định thêm |
| DEV01 | Local đủ dữ liệu demo cho full flow | Tooling + Coordinator UAT | API/database local, nhiều sự kiện/trạng thái, mã mẫu; không dùng proxy production cho mutation |
| DEV02 | Bật OIDC để user verify | Tooling + Coordinator UAT | Keycloak thật local, redirect/callback/session, đăng nhập → đổi mã → xem vé; không mock auth |
| DEV03 | Starter chạy lâu dài và live check | Tooling | URL cố định, persistent volume, seed không tự reset, up/status/logs/down, autostart đăng nhập và tự phục hồi tiến trình |
| OPS01 | Phục hồi Linh | Coordinator | Giữ task/branch/checkpoint, xác nhận dispatch sẵn sàng; không chạy hai web owner |
| OPS02 | Luôn đóng browser sau khi xong | Mọi agent | Đóng đúng tab/page do agent mở; không đụng tab user, giữ local server |
| ORG01 | Công ty agent có hồ sơ và nhật ký có cấu trúc; chưa dashboard | Coordinator | JSON registry/persona/model, JSONL schema, task/dispatch/recovery/settlement và kiểm identity trước launch |

Nguồn thiết kế: `brand/vemoki/tokens.json`, O22 và UI hiện hành. Handoff banner: `docs/design/UI869-FEEDBACK/`.

Không đổi business contract, tenant/RLS, auth boundary hoặc scope native/portal để vượt lỗi môi trường. Local dùng dữ liệu fixture có nhãn và OIDC thật. Secret/runtime state để trong ignored paths, không đưa token/cookie vào evidence.

Trước bàn giao: integration commit cụ thể → reviewer độc lập `dod+ux` (thêm security nếu diff auth thực sự thay đổi) → checks/CI phù hợp. Tách code complete / acceptance complete / pilot ready; không gọi source PASS là full-flow UAT PASS.
