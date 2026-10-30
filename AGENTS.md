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
- Local prebuild + Xcode/xcodebuild/fastlane trên Mac. Trước build/signing/provisioning/store: đọc `/Users/admin/.cursor/rules/apple-developer-personal.mdc`; xác minh personal team, không lấy mặc định từ Xcode/Keychain.
- Không upload signing lên Expo cloud.

## Safety and correctness

- Không secrets/user data thật; không mock auth production; PG = SoT business state; tenant transaction-local + RLS.
- Cloud prod / store chỉ khi task authorize. Commit/PR/merge: `.cursor/rules/git-workflow.mdc`.
- UAT session: Orca browser + emulator — `.cursor/rules/uat-headless.mdc` (Read nếu glob chưa khớp).
- Sau UAT luôn tự đóng browser page/tab do agent mở; không đóng tab user, giữ server local nếu còn phục vụ review/dev.
- Công ty agent: mỗi task gắn nhân viên cố định trong `company/employees.json`, đọc persona/văn phong của người nhận; start qua workflow wrapper với `--employee <id>`. Tracking append-only theo `company/README.md` và `company/work-events.jsonl`; không đổi nhân viên khi phục hồi phiên/đổi model, không ghi secrets hoặc suy nghĩ nội bộ. Chưa build dashboard.

## Workflow (pointers — chi tiết trong rules)

| Topic                                       | Rule file                                                        |
| ------------------------------------------- | ---------------------------------------------------------------- |
| CRG                                         | `.cursor/rules/code-review-graph-ready.mdc`                      |
| Project #3 status / DoD worker              | `.cursor/rules/github-project-tracking.mdc`                      |
| Project WIP / `gh` / milestone              | `.cursor/rules/github-project-tracking-coordinator.mdc` (leader) |
| Agent, Persona, Cost tier worker            | `.cursor/rules/orca-agent-routing-core.mdc`                      |
| Spawn wave D+E, Codex fallback              | `.cursor/rules/orca-agent-routing-coordinator.mdc` (leader)      |
| Giới hạn review/fix, findings, revalidation | `.cursor/rules/orca-review-convergence.mdc` (khi review/fix)     |
| Git / PR                                    | `.cursor/rules/git-workflow.mdc`                                 |
| Worktree                                    | `.cursor/rules/orca-worktree-hygiene.mdc`                        |
| Roles catalog                               | [docs/agents/README.md](docs/agents/README.md)                   |
| Task UI: chọn role/skill, mẫu chuẩn, review | [docs/agents/ui-workflow.md](docs/agents/ui-workflow.md)         |
| Context budget                              | [docs/agents/context-budget.md](docs/agents/context-budget.md)   |

- **Leader / boss / orchestrator:** session = coordinator gốc → Read `.cursor/rules/orca-leader-activation.mdc` + coordinator-only rules theo hành động cần làm + skill `orchestration` khi supervise.
- **Leader — bắt buộc:** tool đầu tiên khi được gọi leader là Read `orca-leader-activation.mdc`. **Cấm** dùng `Agent` tool (Claude Code subagent) để spawn worker/reviewer; chỉ dùng Orca CLI (`task-create` → `worker-start` với agent/model theo `docs/agents/cost-catalog.md` (Codex điều phối; Composer thực thi thường lệ; worker/reviewer focused/advanced/high ưu tiên Claude Sonnet 5 trước Codex) + `--display-name`/`--task-title` Persona → `check --wait`). Sau `worker-start` đọc `result.state`, không chỉ `ok` (`ok:true` vẫn có thể `state=failed`, vd. sai base branch — lấy tên branch từ `gh pr view <N> --json headRefName`). `.claude/settings.json` có hook PreToolUse chặn `Agent` để ép quy tắc này; cần subagent chỉ đọc cho việc ngoài leader thì hỏi user hoặc đặt `"disableAllHooks": true` trong `.claude/settings.local.json` (tắt mọi hook, chỉ cho phiên đó).
- **Worker/reviewer** không spawn con; không Read mailbox/parallel/idle-fill/epic-orchestrator trừ khi được giao coordinator.
- Mỗi Task Spec: `Architecture impact: Có|Không`, `Cost tier: cheap|standard|focused|advanced|high`, Role ID + `docs/agents/roles/<id>.md` khi spawn chuyên môn.
- Task UI: ghi `Skills cần nạp`, mẫu thiết kế chuẩn và evidence; chọn role theo `docs/agents/ui-workflow.md`, chỉ nạp skill liên quan.
- DoD: nhánh B (product rủi ro) reviewer ≠ implementer, một session/PR, gộp dod±sec±ux; nhánh A (docs/tooling) không reviewer độc lập. Exact SHA → comment Issue/PR (ưu tiên) hoặc `docs/reviews/*.md` ngắn. Revalidate diff/findings, tái dùng evidence còn hiệu lực theo `orca-review-convergence.mdc`; không thêm vòng DoD/security riêng mặc định.
