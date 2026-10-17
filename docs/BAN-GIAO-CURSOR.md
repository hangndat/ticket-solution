# Bàn giao cho Cursor agent

> **TÀI LIỆU LỊCH SỬ (2026-10-16).** Bàn giao W0 → lập roadmap/Project lần đầu.  
> **Không** dùng làm trạng thái hiện tại. Status động: [Project #3](https://github.com/users/hangndat/projects/3). Phạm vi/gate: [ROADMAP.md](./ROADMAP.md). Kế hoạch wave: [AGENT-DEVELOPMENT-PLAN.md](./AGENT-DEVELOPMENT-PLAN.md).

Ngày: 2026-10-16. Đây là bàn giao toàn bộ quyền tiếp tục công việc, không phải task worker có coordinator giám sát. Agent cũ dừng sau khi Cursor nhận prompt. Không phát lifecycle message theo các Dispatch cũ.

## Yêu cầu mới nhất và thứ tự ưu tiên

1. Tiếp tục bằng Cursor agent trong Orca, theo cấu hình model mặc định của người dùng.
2. Trước khi code nghiệp vụ tiếp, lập roadmap để tracking toàn bộ công việc trên GitHub.
3. Toàn bộ roadmap, milestone, Issue, mô tả task, labels, trạng thái và báo cáo tiến độ dùng tiếng Việt, ngoại trừ thuật ngữ technical, ID, tên API, câu lệnh và raw log.
4. **Không bao giờ sử dụng Expo/EAS Cloud Build**, kể cả fallback. Native iOS build chỉ local Xcode/xcodebuild/fastlane trên Mac hoặc runner macOS tự quản lý. Quy tắc đã ghi vào root/mobile AGENTS.md, README, PRD và technical design.
5. Stack đã chốt: Next.js web, React Native + Expo iOS, NestJS + PostgreSQL + Redis. Android giai đoạn sau. Multi-tenant, tùy chỉnh công ty/event, không TikTok. Không quan tâm giá ở giai đoạn đặc tả.

## Repo và quyền truy cập

- Workspace: `/Users/admin/SideProject/ticket-solution`.
- GitHub private: https://github.com/hangndat/ticket-solution ; main là nhánh tích hợp.
- Git identity local: hangndat / GitHub noreply. Không đổi global config.
- GitHub CLI đang đăng nhập đúng `hangndat`; người dùng vừa hoàn tất OAuth và scope `project` đã được xác nhận, ngoài các scope có sẵn repo/workflow/read:org/gist. Không cần xin quyền lại hoặc đọc/in token.
- `gh project list --owner hangndat --format json` đã đọc được. Có project cá nhân số 2 chưa đặt tên, 0 item; không sửa project không rõ nguồn gốc. Chưa tạo project riêng cho ticket-solution, chưa tạo roadmap Issues/milestones.

## Công việc đã làm

Đã tạo Git/repo private, baseline monorepo và chạy ba worker Codex song song bằng Orca supervised orchestration. Đã tích hợp các phần:

- Root tooling: pnpm 10.32.1, Node 24 CI (local Node 26), Turborepo, TypeScript, shared contracts, formatter, AGENTS ownership, Compose PostgreSQL/Redis.
- Backend: NestJS 12/Fastify `/v1/health`, generated OpenAPI, env validation, shutdown; worker idle riêng; Prisma 7, tenants/events schema mẫu, FORCE RLS, transaction-local tenant context.
- Web: Next.js 16 shell với hai tenant demo, route đúng cặp tenant/event, admin placeholder không giả auth.
- iOS: Expo SDK 58 / RN 0.88, native shell, event fixtures, ví vé trống, staff placeholder, SecureStore boundary và chống stale response khi đổi tài khoản.
- Không có production login/provider, đổi vé, quota transaction, outbox thật hoặc Gate business implementation. Fixture được ghi rõ, không được coi là auth/thông tin event thật.

W0 lịch sử: `run_0cf97c970de0`; tất cả Dispatch đã settled. Ba resource released, một resource runtime giữ với `user_takeover`, không đụng vào resource người dùng giữ. Không có worker đang được coordinator chờ. Worktrees cũ còn để bảo toàn evidence, không cần mở lại.

Các commit gốc worker (đã cherry-pick vào main): backend `bc75565`, web `7a3ff7d`, iOS `95e7e3f`, sửa harness PostgreSQL `0ab4c40`.

Remote main lần kiểm tra gần nhất: `1796e79`; GitHub CI run `38903208707` PASS cả check và database-isolation trên Node 24/Linux, khi đó chưa có iOS trong remote. Main local đã có iOS ở `3d91c64`; lockfile, docs và policy cập nhật có thể còn chờ commit/push. Hãy đọc `git status`, `git log` và `git diff` để xác nhận trạng thái thực tế; không reset mất việc.

## Kiểm chứng đã có

- Workspace tích hợp sau khi thêm iOS: `pnpm check` PASS (lint/typecheck/18 tests/builds), log local `/tmp/ticket-solution-w0-check.log`.
- Real PostgreSQL isolation test PASS độc lập sau khi sửa readiness, gồm non-owner/non-BYPASSRLS, A/B reads/writes, absent context, commit/rollback reset và pool reuse. Worker chạy sáu lượt container mới sau fix.
- Một lần test DB độc lập ban đầu gặp startup disconnect. Đã sửa probe Unix socket thành final TCP + connection/query readiness có deadline; không retry assertion RLS.
- Web production HTTP routing test PASS; OpenAPI regenerate không drift.
- Expo Doctor trên workspace tích hợp PASS 20/20.
- iOS worker đã build unsigned generic Simulator binary local bằng Xcode, log có `BUILD SUCCEEDED`. Không có signed device/archive/TestFlight build hay interactive/physical UAT.
- Log native: `/Users/admin/orca/workspaces/ticket-solution/w0-ios/apps/mobile/.expo/w0-xcodebuild.log`.
- Root format:check PASS trước khi viết file bàn giao này; nên format/check lại docs/policy sau cập nhật.
- Root PostgreSQL/Redis đang healthy qua Docker Compose, bind localhost 55432/56379. Test DB tự tạo/xóa container riêng, không dùng superuser để kết luận RLS.

Đọc `docs/W0-FOUNDATION-REPORT.md`, `packages/backend/W0-REPORT.md`, `apps/mobile/W0-REPORT.md` cho chi tiết. Hai báo cáo worker còn tiếng Anh; nội dung tracking user-facing mới phải tiếng Việt, có thể dịch narrative nhưng giữ raw commands/evidence.

## Việc tiếp theo — làm roadmap, không code tính năng

1. Đọc PRD, technical design, agent development plan, root/mobile AGENTS và diff hiện tại.
2. Hoàn tất bảo toàn foundation/policy/lockfile lên GitHub; kiểm tra CI toàn bộ workspace có iOS JS export trên Node 24. CI Linux không phải native cloud build. Không dùng Expo build service.
3. Tạo `docs/ROADMAP.md` có toàn bộ phạm vi PRD, thứ tự phụ thuộc, tiêu chí nghiệm thu, agent phụ trách, trạng thái và quyết định còn mở. Chưa có artifact roadmap hoặc backlog JSON nào được tạo.
4. Tạo một GitHub Project private riêng cho repo, link repository. Dùng Issues làm đầu việc thực thi, parent/sub-issues cho nhóm module, milestones cho đợt bàn giao. Không tạo lại repo hoặc tổ chức.
5. Các field/view/status do mình đặt dùng tiếng Việt: ví dụ “Trạng thái”, “Ưu tiên”, “Đợt bàn giao”, “Nhóm phụ trách”, “Ngày bắt đầu”, “Ngày mục tiêu”; các trạng thái “Chưa lên lịch”, “Sẵn sàng”, “Đang làm”, “Chờ duyệt”, “Bị chặn”, “Hoàn thành”. Nhãn và mô tả cũng tiếng Việt.
6. Có view tổng quan/backlog, board theo trạng thái, roadmap. Không bịa ngày hoặc thời lượng: timeline dates chưa có input, ghi chưa chốt; có thể tạo view trước, không tự gắn lịch giả.
7. Ghi W0 là foundation/prototype có evidence, không đánh dấu production auth, full tenant isolation của mọi module hoặc ticketing đã xong. Các task nghiệp vụ chưa bắt đầu ở backlog. Giữ các task quyết định sản phẩm/kỹ thuật trước khi dispatch code.
8. Definition of Done: đã review, tích hợp, CI pass và có evidence nghiệm thu; worker_done không đồng nghĩa task đã hoàn thành trên board. GitHub là nơi tracking lâu dài; Orca Task/Dispatch là từng lần giao thực hiện.
9. Sau khi tạo, kiểm tra board/items/visibility/dependencies thực sự có, gửi link Project/roadmap và tóm tắt tiếng Việt. Chưa launch W1 coding khi roadmap chưa được user review.

Gợi ý chia đợt từ kế hoạch cũ (có thể tinh chỉnh để thêm identity gate): W0 foundation; chốt quyết định/identity/tenant; nhận vé xuyên web/app; check-in; hoàn thiện admin/platform; hardening/capacity/recovery/UAT/phát hành iOS local. Bao phủ đủ M01–M12 và quality/release; Android và payment/refund/seat map/white-label nằm sau MVP.

## API/CLI đã khám phá

Dùng `gh` qua structured argv hoặc --body-file cho mô tả nhiều dòng. Không in token hoặc dùng JSON.stringify như shell escaping.

- `gh project create --owner hangndat --title ... --format json`.
- `gh project edit <n> --owner hangndat --visibility PRIVATE`.
- `gh project link <n> --owner hangndat --repo ticket-solution`.
- `gh project field-create`: hỗ trợ TEXT/SINGLE_SELECT/DATE/NUMBER.
- GraphQL schema hiện có `createProjectV2View`, `updateProjectV2View`, `updateProjectV2Field`, `addSubIssue`, `addBlockedBy`. Introspect input types trước khi gọi; không đoán schema.
- CLI gh hiện 2.86, có thể thiếu flags sub-issues mới; GraphQL/REST đã hỗ trợ. Không cần update gh chỉ để lập roadmap.
- Tài liệu GitHub chính thức: https://docs.github.com/en/issues/planning-and-tracking-with-projects ; https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues ; https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies .

## Orca

Executable cố định của session: `/Applications/Orca.app/Contents/Resources/bin/orca`. Không chuyển binary khác. Repo id: `502a43cf-38ab-43f8-9570-73fa212c4e2b`; current worktree id: `502a43cf-38ab-43f8-9570-73fa212c4e2b::/Users/admin/SideProject/ticket-solution`.

Đây là full handoff sang Cursor. Tiếp tục trực tiếp với người dùng, không dùng worker_done hoặc lifecycle IDs của lượt Codex đã kết thúc.
