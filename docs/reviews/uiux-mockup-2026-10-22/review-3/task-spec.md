# Review UI/UX mockup lần 3 — kiểm thử role reviewer-uiux (bước 3 + bước 7 đã cập nhật)
- Yêu cầu user: spawn review độc lập để đánh giá bộ role/workflow sau khi bổ sung quy tắc soát chrome và kiểm locale. Coordinator sẽ so report này với lần 1 và 2. Không sửa UI.
- Nguồn: docs/design/ui-uplift-2026-10/marketing/ và app/ (Epic #770/#766). Worktree: /Users/admin/orca/workspaces/main/FE-refactor. Exact HEAD: de08f97a4f6498b789d81bce2dbd88b4e6d2ffa5; source hashes không đổi so với docs/reviews/uiux-mockup-2026-10-22/source-manifest.json (coordinator đã kiểm).
- Role ID: reviewer-uiux. Persona: Mira. Đọc AGENTS.md → docs/agents/roles/reviewer-uiux.md (đặc biệt bước 3 soát chrome theo viewport × persona và bước 7 "Kiểm evidence trước khi kết luận") → docs/agents/ui-workflow.md.
- Architecture impact: Không. Cost tier: standard. Agent cursor; model composer-2.5.
- Skills: /Users/admin/.agents/skills/impeccable/SKILL.md (critique, single-context, không init/ghi PRODUCT.md/DESIGN.md/.impeccable); /Users/admin/.agents/skills/web-design-guidelines/SKILL.md; orca-cli cho browser evidence. Không React/Expo/backend skills.

## Độc lập
- KHÔNG đọc bất kỳ file nào khác trong docs/reviews/uiux-mockup-2026-10-22/ ngoài source-manifest.json và review-3/task-spec.md (không đọc worker-review.md, coordinator-evaluation.md, assets/worker/, review-2/). Không đọc review UI/UX cũ khác trong docs/reviews/.

## Cách làm
- Server do coordinator giữ: http://127.0.0.1:63783/marketing/ và http://127.0.0.1:63783/app/. Không khởi động/dừng server.
- Orca embedded browser theo .cursor/rules/uat-headless.mdc; tab riêng, ghi browserPageId, luôn --page. Không Playwright trực tiếp/capture-screenshots.mjs/Computer Use.
- Trước khi kết luận về journey/quyền, đọc bảng state `screens` trong app/index.html (role guest/user của từng state).
- Sau MỖI ảnh: mở lại ảnh, xác nhận URL trong khung, nút state đang active, persona/chrome và viewport khớp tên file. Cuối phiên chạy `shasum -a 256` trên assets/ và đưa bảng hash + "nội dung thực tế đã xác minh" vào report; ảnh trùng hash hoặc lệch nhãn phải chụp lại hoặc loại.
- Desktop 1280 và Mobile 390 (khung mockup); nếu khung mobile không đổi layout trong ảnh thì ghi chưa kiểm. VI chính, EN spot-check.
- Marketing: hierarchy, proposition, CTA/navigation (gồm mobile), form, demo honesty. App: guest catalog, user catalog, event detail, redeem gate/form/terms/error/success, wallet, ticket QR, và ít nhất một trong wallet-empty/loading/error; kiểm nav đã đăng nhập ở 1280 và 390.
- Thanh điều khiển prototype không phải UI sản phẩm.

## Output / ownership
- Chỉ ghi docs/reviews/uiux-mockup-2026-10-22/review-3/review.md và review-3/assets/. Không sửa source/rule/skill; không commit/push; không spawn con.
- Báo cáo tiếng Việt theo bảng Artifact của role: reviewer/dispatch, SHA, skills, URL/viewport/state/locale, bảng ảnh (file, hash, nội dung xác minh), 2–3 điểm tốt, findings ID ổn định (vấn đề → tác động → evidence ảnh/path:line → mức độ → điều kiện đóng), ưu tiên, limitations, kết luận trong scope mockup. Tối đa ~8 findings; không chấm điểm cảm tính.
- Thêm mục cuối "Phản hồi về role/workflow": chỗ nào trong reviewer-uiux.md / ui-workflow.md mơ hồ, mâu thuẫn, thiếu hoặc tốn công vô ích khi làm task này (cụ thể, kèm đề xuất câu chữ).
- Mục tiêu ~15 phút. Tool bị chặn → ghi limitation, không retry vô hạn.
- Trước kết thúc kiểm inbox, gửi worker_done một lần với report-path đúng; đóng tab mình tạo.
