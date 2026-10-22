# Review UI/UX mockup — một worker độc lập
- Yêu cầu trực tiếp của user: spawn đúng một worker review mockup rồi coordinator đánh giá báo cáo. Không mở feature hoặc sửa UI.
- Nguồn: docs/design/ui-uplift-2026-10/marketing/ và app/ (mockup liên quan Epic #770/#766; không thay trạng thái Issue/Project).
- Worktree: /Users/admin/orca/workspaces/main/FE-refactor; dùng local files hiện có. Exact source HEAD: de08f97a4f6498b789d81bce2dbd88b4e6d2ffa5. Source hashes: docs/reviews/uiux-mockup-2026-10-22/source-manifest.json.
- Role ID: reviewer-uiux. Persona: Mira. Read docs/agents/roles/reviewer-uiux.md + docs/agents/ui-workflow.md sau AGENTS.md.
- Architecture impact: Không — chỉ đánh giá mockup, không đổi IA/contract.
- Cost tier: standard. Agent cursor; model composer-2.5.
- --display-name: Mira · ux
- --task-title: Mira · ux — Đánh giá mockup UI uplift #766/#770
- Skills cần nạp: /Users/admin/.agents/skills/impeccable/SKILL.md (critique; context chạy với target mockup cụ thể, không init/rewrite PRODUCT.md/DESIGN.md); /Users/admin/.agents/skills/web-design-guidelines/SKILL.md (fetch checklist và kiểm HTML/CSS liên quan); orca-cli để browser evidence. Không React/Expo/backend skills vì đây là HTML mockup.

## Input và cách làm
- Chỉ review mockup, không đọc các review cũ để giữ nhận định độc lập.
- Đọc phần liên quan docs/PRD.md, docs/TECHNICAL-DESIGN.md, docs/DECISION-LOG.md, docs/ROADMAP.md; marketing brief docs/reviews/MKT-PD-EVENT-OS-SPEC-2026-10-22.md; brand/vemoki/tokens.json. Mẫu visual là artifact đang duyệt, không mặc định đã đạt chất lượng.
- Server do coordinator giữ: http://127.0.0.1:63783/marketing/ và http://127.0.0.1:63783/app/. Không khởi động server khác; không dừng server này.
- Dùng Orca embedded browser theo .cursor/rules/uat-headless.mdc. Mở tab riêng, ghi browserPageId và luôn truyền --page; không đụng tab coordinator/user. Không Playwright trực tiếp/capture-screenshots.mjs/Computer Use.
- Xem ảnh render thật, không chỉ chụp rồi không đọc. Kiểm desktop 1280 và mobile 390 (ghi cả outer viewport và chế độ frame mockup); VI chính, EN spot-check nếu có.
- Marketing: hierarchy, proposition, CTA/navigation, nội dung/proof/demo honesty, responsiveness. App: catalog/detail và luồng guest → redeem form/terms/error/success → wallet/ticket. Chọn trạng thái đại diện, ghi rõ coverage và phần chưa kiểm; không cần chụp mọi tổ hợp.
- Phân biệt thanh điều khiển prototype với UI sản phẩm; click giả lập/href placeholder không tự là production bug. Review thiết kế và hành vi mockup có thể quan sát, không claim backend/auth/production accessibility đã kiểm.

## Output / ownership
- Chỉ ghi docs/reviews/uiux-mockup-2026-10-22/worker-review.md và assets/worker/ trong cùng thư mục. Không sửa source, rule/skill, manifest hoặc tài liệu khác. Không commit/push/PR/deploy; không spawn con.
- Báo cáo tiếng Việt: reviewer/session/dispatch, exact source SHA + hashes, skills/checklist thực dùng, URL/viewport/state/locale, lệnh và ảnh đã xem, 2–3 điểm làm tốt, findings có ID ổn định (vấn đề → tác động → evidence/path:line → mức độ/chặn → điều kiện đóng), thứ tự ưu tiên, limitations và kết luận trong scope mockup.
- Tập trung tối đa khoảng 8 findings có ích; không đặt số lượng tối thiểu, không chấm điểm cảm tính, không ép verdict FAIL/PASS. Không đưa sở thích typography/brand thành blocker trái brief.
- Ưu tiên hoàn thành trong khoảng 12 phút bằng coverage đại diện; nếu tool bị chặn ghi evidence và limitation, không lặp retry vô hạn.
- Trước kết thúc kiểm inbox, gửi worker_done đúng live preamble một lần; report-path đúng file thực. Dọn tab chỉ do mình tạo nếu không cần cho evidence; không giữ process riêng.
