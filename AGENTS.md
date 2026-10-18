# Agent working agreement

Read docs/PRD.md, docs/TECHNICAL-DESIGN.md, docs/DECISION-LOG.md and your task spec. Work only in assigned scope. **Trạng thái đợt động:** [GitHub Project #3](https://github.com/users/hangndat/projects/3) (không đoán từ docs cũ). Scope/gate/evidence: [docs/ROADMAP.md](docs/ROADMAP.md). Phân biệt code complete / acceptance complete / pilot ready — chưa tuyên bố pilot production hay store submission.

## Planning and tracking language

All user-facing roadmap, GitHub Projects, milestones, Issue titles/bodies, labels, statuses and progress reports must be in Vietnamese. Preserve technical terms, IDs, API names, commands and original verification logs as needed. Do not start new product feature code until the roadmap is prepared for user review.

## Ownership

- Coordinator owns root tooling, lockfile, CI, shared contracts and integration.
- Architect: thiết kế/ADR/contract handoff trong docs được giao; xét architecture impact trước coding có rủi ro và kiểm tra sự phù hợp khi cần. Không sở hữu code đa slice, không thay planner/coordinator hoặc DoD/security độc lập. Xem `docs/agents/roles/architect.md`.
- Backend worker: apps/api, apps/worker, packages/backend and database tests/migrations.
- Web worker: apps/web only.
- iOS worker: apps/mobile only. Read Expo overview and React Native skills before coding.
- Do not edit another scope to make your build pass. Ask the coordinator for contract/dependency changes.

## iOS build policy — explicit user requirement

- NEVER use Expo/EAS Cloud Build, including automatic cloud-build fallback or EAS-hosted build workflows. This requirement persists across all tasks.
- Build native iOS binaries on a local Mac or a self-managed macOS runner using local Expo prebuild plus Xcode/xcodebuild or fastlane. Expo framework and local CLI remain allowed.
- Do not upload source, credentials or signing material to Expo build infrastructure. If local build tooling is unavailable, report that limitation; do not switch to cloud builds.

## Safety and correctness

- Never add real secrets, credentials or user data. .env.example is documentation only.
- Do not silently add mock authentication to production paths. Mark fixture/demo data explicitly.
- Database business state belongs in PostgreSQL. Redis is not the source of truth for quota or check-in.
- Tenant context must be transaction-local and queries parameterized. Runtime role must not own tables or bypass RLS.
- Do not create cloud resources, publish production or submit stores unless the task explicitly authorizes it. Commit/push/PR/merge permissions follow `.cursor/rules/git-workflow.mdc`; a general request to edit or review files does not authorize remote integration.
- Do not control another worker's simulator or database. Use task-specific ports/project names.
- **UAT is headless (web + iOS):** never steal the user's macOS mouse. Web → `scripts/web-uat.sh` (Playwright headless) or HTTP scripts / Orca embedded browser; iOS → `scripts/sim-uat.sh` (AXe HID + `simctl`). Never `cliclick`, AppleScript clicks, or `ORCA computer click` on Chrome/Safari/Simulator. See `.cursor/rules/uat-headless.mdc`.

## Workflow

- pnpm workspaces; install exact versions. Root lockfile belongs to coordinator.
- Generated code is regenerated, not edited manually. API contract changes require coordinator agreement.
- Report commit SHA, changed files, exact checks and limitations. A successful build does not prove security/concurrency behavior.
- Use Orca lifecycle commands from your live dispatch preamble. Check follow-ups at checkpoints and before worker_done.
- Delegation is authorized within an assigned implementation Epic or multi-ownership task, including independent DoD/security reviewers. Do not delegate Q&A/read-only work or expand beyond the assigned scope. A local docs/rules edit does not require worker dispatch unless integration/DoD is requested.
- **Orca agent routing:** `.cursor/rules/orca-agent-routing.mdc` là nguồn chính sách duy nhất: tạm thời mọi Task dùng Cursor, gồm plan/design và DoD/security review. Chỉ đổi agent khi user chỉ định rõ cho Task đó; quota Codex không phải gate khi spawn Cursor. Mỗi Task Spec ghi **Cost tier** `cheap|standard|heavy` và map `--model`/`--effort` theo rule đó (mặc định rẻ; không bịa model id; so sánh `launch.effective`).
- **Orca leader activation:** Gọi `leader` / `boss` / `orchestrator` / `coordinator` (hoặc `làm leader` / `làm boss`…) khi start agent mới → session đó = **coordinator gốc (depth 0)**; load skill `orchestration` và áp dụng rules mailbox / parallel / idle-fill / epic planner. Xem `.cursor/rules/orca-leader-activation.mdc`.
- **Vai trò chuyên môn (role ≠ agent ≠ Cost tier):** Catalog áp dụng tại [docs/agents/README.md](docs/agents/README.md) (`product-ba`, `product-design`, `architect`, `backend`, `web`, `ios`, `reviewer-dod`, `reviewer-security`). Coordinator gốc (và Epic planner khi soạn spec) **phải** gắn Role ID + path `docs/agents/roles/<id>.md` vào Task Spec khi spawn architecture/ownership/reviewer worker. Mỗi Epic/Task Spec ghi `Architecture impact: Có | Không` kèm lý do **và** `Cost tier`; quyết định kiến trúc chưa giải quyết giao `architect`, chỉ chặn consumer phụ thuộc thật. Role chỉ bổ sung chuyên môn; không ghi đè rule dự án; **không** cài `roles/*.md` thành `alwaysApply`.
- **Epic planner:** Coordinator gốc (depth 0) trực tiếp spawn một planner mỗi Epic và các ownership workers/reviewers; quản lý dispatch, lifecycle và integration. Planner phân Epic → Story → Task, đề xuất **wave bề rộng tối đa** (mọi Task unblocked, kể cả khác Story) dưới soft cap, theo dõi phụ thuộc thật và chuẩn bị nghiệm thu; không spawn worker con hoặc tự code toàn Epic. Reuse planner đang active. `worker_done` ≠ Hoàn thành. Xem `.cursor/rules/orca-epic-orchestrator.mdc`.
- **Orca parallel-first (max fan-out):** Mỗi wave, `worker-start` **hết** Task độc lập còn ready dưới concurrent soft caps + WIP (BE ∥ web ∥ iOS ∥ BA/PD ∥ nhiều reviewer trên PR khác nhau) trước `check --wait` — không serialize việc không phụ thuộc. Soft cap: ≤**5** non-review live / Run, ≤**1** feature coding / slice, ≤**2** `heavy` live; reviewer/fix không chiếm bucket feature. Dependencies chỉ khi ordering thật (contract trước consumer). Epic ≥2 Task: `task-create` (+ `--deps`) → `task-list --ready` → `worker-start --task`; nhánh quyết định dùng `gate-create`. Xem `.cursor/rules/orca-parallel-workers.mdc` và `.cursor/rules/orca-worktree-hygiene.mdc`.
- **Orca worktree hygiene:** Mỗi wt feature gắn `--issue` / `--pr` / `--comment` (và `reference add` khi cần); `worktree ps` + dọn wt PR merged khi không còn consumer. Automations weekday/weekly trên ticket-solution hỗ trợ queue duyệt và stale wt — không auto-merge/deploy. Xem `.cursor/rules/orca-worktree-hygiene.mdc`.
- **DoD / acceptance review:** Với mỗi PR/Issue `Chờ duyệt` độc lập còn room, spawn reviewer riêng (routing rule, ≠ implementer); gắn role `reviewer-dod` (và `reviewer-security` khi slice nhạy cảm) theo [docs/agents/README.md](docs/agents/README.md); có thể nhiều reviewer cùng wave. Do not wait for the user to approve. Exact-SHA evidence in `docs/reviews/*` (or Issue/PR comment).
- **Milestone gates:** Closing a milestone/Epic requires (a) headless UAT evidence, (b) local iOS build evidence when mobile is in scope, (c) deploy prod evidence only when the task authorizes it, (d) review artifacts + exact SHA. See `.cursor/rules/github-project-tracking.mdc` and `.cursor/rules/uat-headless.mdc`.
- **GitHub Project sync:** Keep [Project #3](https://github.com/users/hangndat/projects/3) Status in sync **per Task** (Đang làm → Chờ duyệt → Hoàn thành / Bị chặn) without waiting for user board approval. Hierarchy Epic → Story → Task. See `.cursor/rules/github-project-tracking.mdc` and `docs/ROADMAP.md` §2/§8.
- **Orca idle fill:** Within the authorized Epic/Run and available worker/WIP limits, fill **every** free unblocked slot in the same checkpoint (coding + reviewer + BA/PD) — do not wait for the full wave or for the user to pick the next Issue. See `.cursor/rules/orca-idle-worker-fill.mdc`.
- **Orca coordinator mailbox:** Coordinators always `check` / `reply` / `ack` / `worker-release` themselves — do not wait for “You have N messages” or a user nudge. While supervising a Run: keep the **continuous listen loop** (`check --wait` → settle → idle-fill → `check --wait`); do not end the turn while in-scope Dispatches are still live. See `.cursor/rules/orca-coordinator-mailbox.mdc`.
- **Agent/worker cleanup:** Coordinator must promptly release every finished or superseded worker after preserving handoff/evidence; close its task-owned session/terminal and stop task-owned background processes through supported lifecycle commands. Reuse only for an immediately assigned authorized task; otherwise release, do not retain idle workers indefinitely. Audit cleanup before ending the Run/turn. See `.cursor/rules/orca-coordinator-mailbox.mdc` § Cleanup.
- **Git workflow:** Feature branch off integration `main` → conventional commits → push → PR → independent DoD review → CI → coordinator merge. No feature commits directly on `main`. See `.cursor/rules/git-workflow.mdc`.


<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

Namespace: `user-code-review-graph-ticket` (ticket-solution). Other graphs: BE=`user-code-review-graph`, FE=`user-code-review-graph-fe`, SGAMES=`user-code-review-graph-sgames`.
Graph auto-updates via daemon watch (alias `ticket-solution`) + session/edit hooks. Narrow with the graph, then verify in source.

### Graph readiness gate (bắt buộc trước khi làm việc)

1. First tool call for coding/explore/review: MCP `code-review-graph-ticket` → `list_graph_stats_tool`.
2. If empty / stale / MCP error → `build_or_update_graph_tool`, then continue.
3. Do not Grep/broad-scan first when CRG MCP is available. Docs-only Q&A exempt.
4. Hooks auto-refresh on sessionStart/beforeSubmitPrompt; agent must still verify via step 1.
5. Daemon watch alias `ticket-solution` keeps `.code-review-graph/graph.db` current; data persists across agent restarts.


### Preferred tool flow (when tools are available)

If graph/lean-ctx tools are unavailable, error, or do not index the relevant source, use `rg` and direct source reads; report the limitation. Docs/rules-only work can read files directly. Do not block work solely on missing MCP tools.

1. **Symbols first** — query actual class/function/hook names (`TicketService`, `CheckInController`, etc.), not URL slugs.
2. Call MCP namespace `user-code-review-graph-ticket`: `semantic_search_nodes_tool(query=Symbol)` → if ambiguous, retry with `qualified_name`.
3. Then `query_graph_tool` (`callees_of` / `callers_of` / `imports_of` / `tests_for`) or `get_impact_radius_tool` / `get_affected_flows_tool`.
4. **lean-ctx** only for routes/docs/literals CRG does not index.
5. **ctx_read** hotspots; source wins if graph and source disagree.
6. Do not change code from graph output alone.

**This project has a knowledge graph. Start with the code-review-graph
MCP tools to narrow scope, then read the source.** The graph is cheaper than scanning files and
gives you structural context (callers, dependents, test coverage) that file search cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact**: `get_impact_radius_tool` instead of manually tracing imports
- **Code review**: `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships**: `query_graph_tool` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview_tool` + `list_communities_tool`

### Verify in the source

- Narrow scope with the graph, then read the source. Do not change code from graph output alone.
- For any non-trivial change, read the implementation and the relevant tests before concluding.
- Verify the exact source when touching behavior, database logic, migrations, retries, fallbacks,
  recovery, or compatibility code.
- When the graph and the source disagree, the source wins. The graph may be stale or may not
  model that relationship.
- An empty graph result can mean "not indexed" or "not statically visible", not "does not exist".

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes_tool` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context_tool` | Need source snippets for review — token-efficient |
| `get_impact_radius_tool` | Understanding blast radius of a change |
| `get_affected_flows_tool` | Finding which execution paths are impacted |
| `query_graph_tool` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes_tool` | Finding functions/classes by name or keyword |
| `get_architecture_overview_tool` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` pattern="tests_for" to check coverage.
<!-- /code-review-graph MCP tools -->
