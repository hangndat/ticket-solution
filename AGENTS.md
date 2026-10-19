# Agent working agreement

Read docs/PRD.md, docs/TECHNICAL-DESIGN.md, docs/DECISION-LOG.md and your task spec. Work only in assigned scope. **Trạng thái đột:** [GitHub Project #3](https://github.com/users/hangndat/projects/3). Scope/gates: [docs/ROADMAP.md](docs/ROADMAP.md). Phân biệt code complete / acceptance complete / pilot ready.

## Planning and tracking language

Roadmap, Project, Issue, status, progress: **Tiếng Việt** (giữ ID/API/commands). Không mở feature mới khi roadmap chưa review.

## Ownership

- Coordinator: root tooling, lockfile, CI, contracts, integration.
- Architect: ADR/handoff trong scope; không sở hữu đa slice — `docs/agents/roles/architect.md`.
- Backend: `apps/api`, `apps/worker`, `packages/backend`, DB.
- Web: `apps/web` only.
- iOS: `apps/mobile` only — đọc Expo overview trước code.
- Không sửa slice khác để build pass; hỏi coordinator cho contract.

## iOS build policy

- **Không** Expo/EAS Cloud Build.
- Local prebuild + Xcode/xcodebuild/fastlane trên Mac.
- Không upload signing lên Expo cloud.

## Safety and correctness

- Không secrets/user data thật; không mock auth production; PG = SoT business state; tenant transaction-local + RLS.
- Cloud prod / store chỉ khi task authorize. Commit/PR/merge: `.cursor/rules/git-workflow.mdc`.
- UAT session: Orca browser + emulator — `.cursor/rules/uat-headless.mdc` (Read nếu glob chưa khớp).

## Workflow (pointers — chi tiết trong rules)

| Topic | Rule file |
| ----- | --------- |
| CRG | `.cursor/rules/code-review-graph-ready.mdc` |
| Project #3 status / DoD worker | `.cursor/rules/github-project-tracking.mdc` |
| Project WIP / `gh` / milestone | `.cursor/rules/github-project-tracking-coordinator.mdc` (leader) |
| Agent, Persona, Cost tier worker | `.cursor/rules/orca-agent-routing-core.mdc` |
| Spawn wave D+E, Codex fallback | `.cursor/rules/orca-agent-routing-coordinator.mdc` (leader) |
| Git / PR | `.cursor/rules/git-workflow.mdc` |
| Worktree | `.cursor/rules/orca-worktree-hygiene.mdc` |
| Roles catalog | [docs/agents/README.md](docs/agents/README.md) |
| Context budget | [docs/agents/context-budget.md](docs/agents/context-budget.md) |

- **Leader / boss / orchestrator:** session = coordinator gốc → Read `.cursor/rules/orca-leader-activation.mdc` + coordinator-only rules + skill `orchestration`.
- **Worker/reviewer** không spawn con; không Read mailbox/parallel/idle-fill/epic-orchestrator trừ khi được giao coordinator.
- Mỗi Task Spec: `Architecture impact: Có|Không`, `Cost tier: cheap|standard`, Role ID + `docs/agents/roles/<id>.md` khi spawn chuyên môn.
- DoD: reviewer ≠ implementer; exact SHA → `docs/reviews/*` — Wave C `dod+sec` một session/SHA.
