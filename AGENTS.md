# Agent working agreement

Read your task spec and applicable instructions. Với business code/acceptance: đọc các mục liên quan trong docs/PRD.md, docs/TECHNICAL-DESIGN.md, docs/DECISION-LOG.md; mở rộng khi scope/contract/invariant yêu cầu. Với docs/tooling thuần: chỉ đọc quyết định ảnh hưởng scope, không nạp toàn bộ tài liệu sản phẩm. Trong cùng session không đọc lại nội dung chưa đổi. Work only in assigned scope. **Trạng thái đột:** [GitHub Project #3](https://github.com/users/hangndat/projects/3). Scope/gates: [docs/ROADMAP.md](docs/ROADMAP.md). Ba lớp complete bắt buộc ở Epic phát hành, không ở Task docs/tooling. Gói rules/docs thuần: không gọi CRG `list_graph_stats`.

## Planning and tracking language

Roadmap, Project, Issue, status, progress: **Tiếng Việt** (giữ ID/API/commands). Không mở feature mới khi roadmap chưa review.

## Ownership

- Coordinator: root tooling, lockfile, CI, contracts, integration.
- Architect: ADR/handoff trong scope; không sở hữu đa slice — `docs/agents/roles/architect.md`.
- Backend: `apps/api`, `apps/worker`, `packages/backend`, DB.
- Web: `apps/web` only.
- Portal: `apps/portal` only — role `docs/agents/roles/portal.md`.
- iOS: `apps/mobile` only — đọc Expo overview trước code.
- Không sửa slice khác để build pass; hỏi coordinator cho contract.

## iOS build policy

- **Không** Expo/EAS Cloud Build.
- Local prebuild + Xcode/xcodebuild/fastlane trên Mac. Trước build/signing/provisioning/store: đọc `docs/agents/policies/ios-signing.md`; xác minh personal team, không lấy mặc định từ Xcode/Keychain.
- Không upload signing lên Expo cloud.

## Safety and correctness

- Không secrets/user data thật; không mock auth production; PG = SoT business state; tenant transaction-local + RLS.
- Cloud prod / store chỉ khi task authorize. Commit/PR/merge: `docs/agents/policies/git.md`.
- UAT session: Orca browser + emulator — `docs/agents/workflows/uat.md` (Read nếu glob chưa khớp).
- Sau UAT luôn tự đóng browser page/tab do agent mở; không đóng tab user, giữ server local nếu còn phục vụ review/dev.
- Công ty agent: mỗi task gắn nhân viên cố định trong `company/employees.json`, đọc persona/văn phong của người nhận; start qua workflow wrapper với `--employee <id>`. Tracking append-only theo `company/README.md` và `company/work-events.jsonl`; không đổi nhân viên khi phục hồi phiên/đổi model, không ghi secrets hoặc suy nghĩ nội bộ. Chưa build dashboard.

## Bản đồ đọc

Đọc [hướng dẫn agent](docs/agents/README.md) để chọn policy/workflow theo hành động. Mọi agent đọc [routing](docs/agents/policies/routing.md); source task đọc [context/CRG](docs/agents/policies/context.md), Git task đọc [quyền Git](docs/agents/policies/git.md), nghiệm thu theo [Project/DoD](docs/agents/policies/project.md).

- **Leader / boss / orchestrator:** session = coordinator gốc → Read `docs/agents/workflows/dispatch.md` + coordinator-only rules theo hành động cần làm + skill `orchestration` khi supervise.
- **Leader:** đọc [dispatch](docs/agents/workflows/dispatch.md) và [lifecycle](docs/agents/workflows/lifecycle.md) trước supervise; dùng Orca qua workflow wrapper, không dùng subagent tool để dispatch worker/reviewer. Kiểm receipt state/next/requested/effective; nhường turn để Orca wake. Không tắt hooks để mở capability; lỗi hook giữ checkpoint và báo lỗi cụ thể.
- **Worker/reviewer** không spawn con; không Read mailbox/parallel/idle-fill/epic-orchestrator trừ khi được giao coordinator.
- Mỗi Task Spec: `Architecture impact: Có|Không`, `Cost tier: cheap|standard|focused|advanced|high`, Role ID + `docs/agents/roles/<id>.md` khi spawn chuyên môn.
- Task nghiệm thu E2E (F04 #1029–#1037): đọc [E2E acceptance](docs/agents/policies/e2e-acceptance.md). Một PR = một ID AC; cost tier theo rủi ro; hạ tầng E2E tách nhánh `e2e-infra-*`; không coding trên `main*` worktree; tiến độ đo bằng `pnpm e2e:f04-status`.
- Task UI: ghi `Skills cần nạp`, mẫu thiết kế chuẩn và evidence; chọn role theo `docs/agents/ui-workflow.md`, chỉ nạp skill liên quan.
- DoD: nhánh B (product rủi ro) reviewer ≠ implementer, một session/PR, gộp dod±sec±ux; nhánh A (docs/tooling) không reviewer độc lập. Exact SHA → comment Issue/PR (ưu tiên) hoặc `docs/reviews/*.md` ngắn. Revalidate diff/findings, tái dùng evidence còn hiệu lực theo `docs/agents/workflows/review.md`; không thêm vòng DoD/security riêng mặc định.

## Nguồn dùng chung

Policy/workflow chuẩn nằm trong docs/agents; .cursor/rules chỉ giữ trigger và pointer. Skills chuẩn ở .agents/skills, Cursor đọc qua symlink. CLAUDE.md trỏ AGENTS; mọi host theo cùng [bản đồ đọc](docs/agents/README.md).
