# Review UI/UX mockup lần 4 — kiểm thử role reviewer-uiux (bản đầy đủ)
- Yêu cầu user: review độc lập để kiểm thử bộ role/workflow mới. Coordinator so với 3 lần trước. Không sửa UI.
- Nguồn: docs/design/ui-uplift-2026-10/marketing/ và app/ (Epic #770/#766). Worktree: /Users/admin/orca/workspaces/main/FE-refactor. Exact HEAD: de08f97a4f6498b789d81bce2dbd88b4e6d2ffa5; hashes theo docs/reviews/uiux-mockup-2026-10-22/source-manifest.json (coordinator đã kiểm).
- Role ID: reviewer-uiux. Persona: Mira. Đọc AGENTS.md → docs/agents/roles/reviewer-uiux.md → docs/agents/ui-workflow.md. Làm đúng toàn bộ "Cách review" và "Artifact" của role (gồm loại finding).
- Architecture impact: Không. Cost tier: standard. Agent cursor; model composer-2.5.
- Bề mặt / chế độ: marketing + consumer web (HTML prototype) / review.
- Skills: /Users/admin/.agents/skills/impeccable/SKILL.md (critique, single-context, không init/ghi PRODUCT.md/DESIGN.md/.impeccable); web-design-guidelines tùy chọn theo ui-workflow; orca-cli cho browser.
- Mẫu thiết kế chuẩn: chính prototype đang duyệt (không mặc định đạt); brief docs/reviews/MKT-PD-EVENT-OS-SPEC-2026-10-22.md; brand/vemoki/tokens.json.
- Evidence UI: http://127.0.0.1:63783/marketing/ và http://127.0.0.1:63783/app/ (coordinator giữ server, không khởi động/dừng); khung Desktop 1280 + Mobile 390; VI chính, EN spot-check; persona theo bảng `screens` của app; states: marketing hero/nav/form, app guest+user catalog, event detail, redeem gate/form/terms/error/success, wallet, wallet-empty, ticket QR, loading/error. Quy tắc evidence theo role bước 3 và 7.

## Độc lập
- Trong docs/reviews/uiux-mockup-2026-10-22/ chỉ được đọc source-manifest.json và review-4/task-spec.md. Không đọc review UI/UX khác trong docs/reviews/.

## Output / ownership
- Chỉ ghi docs/reviews/uiux-mockup-2026-10-22/review-4/review.md và review-4/assets/ (kể cả output probe). Không sửa source/rule/skill/tool; không commit/push; không spawn con.
- Báo cáo tiếng Việt theo bảng Artifact của role; tối đa ~8 findings; không chấm điểm cảm tính. Thêm mục cuối "Phản hồi về role/workflow" (mơ hồ, mâu thuẫn, thiếu, tốn công vô ích — kèm đề xuất câu chữ).
- Mục tiêu ~15 phút; tool bị chặn → ghi limitation, không retry vô hạn.
- Trước kết thúc kiểm inbox, gửi worker_done một lần với report-path đúng; đóng tab mình tạo.
