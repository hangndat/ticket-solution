# Vai trò chuyên môn Vemoki (Orca)

**Trạng thái:** đã áp dụng trên `main` (PR #195 + wiring process). Catalog này **bổ sung chuyên môn** khi spawn worker — bắt buộc gắn Role ID vào Task Spec theo `AGENTS.md` / rule Orca. Không thay thế và không được ưu tiên hơn:

- [AGENTS.md](../../AGENTS.md)
- `.cursor/rules/orca-agent-routing-core.mdc` (worker/reviewer) · `orca-agent-routing-coordinator.mdc` (leader Read) — Cursor, Cost tier, Wave E/D: [cost-catalog.md](./cost-catalog.md)
- `.cursor/rules/orca-epic-orchestrator.mdc` · `orca-parallel-workers.mdc` · `orca-idle-worker-fill.mdc` · `orca-coordinator-mailbox.mdc` — **coordinator-only** (`alwaysApply: false`; leader Read khi kích hoạt — Wave B)
- `.cursor/rules/github-project-tracking.mdc` (+ `github-project-tracking-coordinator.mdc` leader), `git-workflow.mdc`
- [context-budget.md](./context-budget.md) — đo rules/token
- [MCP-SETUP.md](./MCP-SETUP.md) — MCP local (`code-review-graph-ticket`, lean-ctx)
- `.cursor/rules/uat-headless.mdc` — **Wave G:** không `alwaysApply`; globs UAT/artifacts; Task UAT/milestone → Read nếu cần

**Không** cài toàn bộ [agency-agents](https://github.com/msitarzewski/agency-agents) thành `alwaysApply` rules. Gắn role chính vào Task Spec; khi gộp review chỉ nạp các role đúng checklist. Task UI chọn role, skill và mẫu chuẩn theo [ui-workflow.md](./ui-workflow.md).

## Cấu trúc

```text
docs/agents/
  README.md                 ← file này
  cost-catalog.md           ← pin Cursor --model theo Cost tier + Wave D/E (receipt / preflight)
  ui-workflow.md            ← chọn role/skill UI theo scope, mẫu chuẩn và evidence
  upstream/                 ← nguồn MIT + provenance (không chỉnh để “fit” Vemoki)
  roles/                    ← hướng dẫn đã điều chỉnh cho Vemoki + Orca
```

## Catalog vai trò

| ID                                          | File                                                       | Khi dùng                                                                                                                                              | Ownership / ghi chú                                                                    |
| ------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `product-ba`                                | [roles/product-ba.md](./roles/product-ba.md)               | Làm rõ bài toán, non-goals, AC, ưu tiên trong MVP đã chốt                                                                                             | Docs/Issue; không mở rộng MVP                                                          |
| `product-design`                            | [roles/product-design.md](./roles/product-design.md)       | User flow, trạng thái UI, a11y, AC UI, handoff; brand/visual budget khi Epic revamp. Task Design System nạp capability `vemoki-design-system`, không tạo Role riêng | Docs/design handoff/spec; không code ownership slice khác                    |
| `architect`                                 | [roles/architect.md](./roles/architect.md)                 | Quyết định kiến trúc, contract, ADR, failure/recovery và kiểm tra sự phù hợp khi cần                                                                  | Docs/handoff trong scope; không sở hữu code đa slice hoặc thay reviewer độc lập        |
| `backend`                                   | [roles/backend.md](./roles/backend.md)                     | Implement NestJS / DB / worker                                                                                                                        | `apps/api`, `apps/worker`, `packages/backend`                                          |
| `web`                                       | [roles/web.md](./roles/web.md)                             | Implement Next.js                                                                                                                                     | `apps/web` only                                                                        |
| `ios`                                       | [roles/ios.md](./roles/ios.md)                             | Implement Expo/RN iOS                                                                                                                                 | `apps/mobile` only; local build, không EAS Cloud                                       |
| `reviewer-dod`                              | [roles/reviewer-dod.md](./roles/reviewer-dod.md)           | DoD / acceptance trên **exact SHA**                                                                                                                   | Session **≠** implementer                                                              |
| `reviewer-uiux`                             | [roles/reviewer-uiux.md](./roles/reviewer-uiux.md)         | Critique thiết kế hoặc review bản chạy theo mẫu, usability và a11y                                                                                    | Review only; độc lập với tác giả; ưu tiên gộp DoD khi cùng PR/SHA                      |
| `reviewer-security`                         | [roles/reviewer-security.md](./roles/reviewer-security.md) | Review bảo mật slice nhạy cảm                                                                                                                         | Session **≠** implementer; không thay DoD nếu cần cả hai                               |
| _(gộp `dod+ux` / `dod+sec` / `dod+sec+ux`)_ | [roles/reviewer-merged.md](./roles/reviewer-merged.md)     | Checklist một file; mapping gate → file role gốc                                                                                                      | Spec ghi `reviewer-merged.md` thay vì nhiều `reviewer-*.md`                            |
| `launch-uat`                                | [roles/launch-uat.md](./roles/launch-uat.md)               | Hành trình thật trên production cho go/no-go launch                                                                                                   | Không thay `reviewer-dod`; catalog [`PROD-LAUNCH-UAT.md`](../plans/PROD-LAUNCH-UAT.md) |

Agent runtime: Codex điều phối; Composer thực thi phần ít cần suy luận; worker/reviewer ưu tiên Claude Sonnet 5 trước Codex ở focused/advanced/high theo cost-catalog cho reasoning/review. Role **≠** agent vendor **≠** Cost tier **≠** Persona — xem `orca-agent-routing-core.mdc`.

## Persona roster (`--display-name` + `--task-title`)

Coordinator **bắt buộc cả hai** khi `task-create` (không rename worker đang live). `worker-start` current/existing lấy Persona từ Task, không truyền creation flag `--display-name`; flag này chỉ dành cho placement tạo worktree mới:

| Flag             | Format                                          | Orchestration field |
| ---------------- | ----------------------------------------------- | ------------------- |
| `--display-name` | `"<Persona> · <ui-label>"`                      | `display_name`      |
| `--task-title`   | `"<Persona> · <ui-label> — #<issue> <tóm tắt>"` | `title`             |

Cùng prefix Persona; `display-name` ngắn, `task-title` có Issue + tóm tắt scope.

### Ba surface UI (không trùng)

| Surface                              | Label bạn thấy                                                         | Persona?                                                     |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| `orchestration task-list` / Dispatch | `display_name`, `title`                                                | **Có** — nguồn kiểm tra sau spawn                            |
| Cây worktree → node con `Shell`      | `worker-task_<task_id>`                                                | **Không** — id nội bộ Orca; không thay bằng `--display-name` |
| Card worktree (folder)               | `--name` lúc `worktree create`; tuỳ chọn `worktree set --display-name` | Tuỳ chọn — đặt nếu cần nhận slice trên sidebar               |

**Không** suy Persona từ `worker-task_*`. Sau wave: `orca orchestration run-use --id <run> --json` rồi `task-list --json` — mỗi task phải có `display_name` **và** `title` khác null.

| Role ID / vai                         | Persona pool               | Ghi chú                                                                                      |
| ------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| `web`                                 | Higo, Enton, Linh          | FE — pick free khi song song; Linh giữ danh tính theo yêu cầu user                            |
| `backend`                             | Gonic, Colin, Remy, Monica | pick free khi song song                                                                      |
| Root tooling local được giao rõ       | Noah                      | Không tự đổi auth business; scope do coordinator giao                                        |
| Coordinator gốc                      | Minh                      | Danh tính điều phối; không thay routing model do user chỉ định                               |
| `ios`                                 | Zico                       | 1 người                                                                                      |
| `architect`                           | Dexter                     |                                                                                              |
| `product-design`                      | Liv                        |                                                                                              |
| `product-ba`                          | Kazu                       |                                                                                              |
| `reviewer-dod`                        | James                      | UI label: **`dod`** (không ghi `reviewer-dod`)                                               |
| `reviewer-uiux`                       | Mira; gộp DoD dùng James   | UI label: **`ux`**; gộp **`dod+ux`** / **`dod+sec+ux`**; session độc lập với tác giả         |
| `reviewer-security`                   | James                      | UI label: **`sec`**; gộp cùng DoD → **`dod+sec`** (Wave C)                                   |
| `launch-uat`                          | Sora                       | UI label: **`uat`**. Không dùng James (James là DoD/security)                                |
| Epic planner (không Role catalog)     | Dexter                     | `--display-name "Dexter · planner"`                                                          |
| Wave leader (logic)                   | Coordinator gốc depth 0    | Fan-out `worker-start` trong wave — **không** spawn depth 1 (Orca `nested_worker_depth`)     |
| `Leader · wave` (tuỳ chọn, plan-only) | _(không Persona roster)_   | Worker depth 1 chỉ lập kế hoạch / `ask`; coordinator gốc spawn thật — `orca-wave-leader.mdc` |

**Format:** `--display-name "<Persona> · <ui-label>"` — Role ID trong Spec vẫn đầy đủ; **ui-label** ngắn trên Orca:

Hồ sơ và văn phong cố định: [`company/employees.json`](../../company/employees.json). Quy trình giao việc/nhật ký có cấu trúc: [`company/README.md`](../../company/README.md). Mỗi lần start dùng `--employee <id>` trong workflow wrapper; giữ nhân viên qua các dispatch phục hồi, ghi model requested/effective thực tế. Không tạo dashboard trong phạm vi hiện tại.

| Role ID                           | ui-label     |
| --------------------------------- | ------------ |
| `web`                             | `web`        |
| `backend`                         | `be`         |
| `ios`                             | `ios`        |
| `architect`                       | `arch`       |
| `product-ba`                      | `ba`         |
| `product-design`                  | `pd`         |
| `reviewer-dod`                    | `dod`        |
| `reviewer-uiux`                   | `ux`         |
| `reviewer-security`               | `sec`        |
| `launch-uat`                      | `uat`        |
| DoD+security cùng PR/SHA (Wave C) | `dod+sec`    |
| DoD+UI/UX cùng PR/SHA             | `dod+ux`     |
| DoD+security+UI/UX cùng PR/SHA    | `dod+sec+ux` |
| Epic planner                      | `planner`    |
| Wave Leader                       | `wave`       |

Ví dụ: `Higo · web`, `Mira · ux`, `James · dod+ux`, `James · dod+sec+ux`, `Gonic · be`, `Dexter · planner`.

**Chọn persona (pool):**

- Pool 1 người → luôn tên đó.
- Pool nhiều (`web`, `backend`): trước spawn, đọc `worker-list --include-remote --json` trong Run; lấy persona **chưa** xuất hiện trong `displayName` / task title của Dispatch **live** cùng role; round-robin theo thứ tự bảng nếu tất cả free hoặc tất cả busy.
- Reuse terminal: giữ persona của pane đang giữ (không đổi tên giữa Task nếu reuse cùng slice).

Ví dụ spawn:

```text
ORCA orchestration task-create \
  --task-title "Higo · web — #123 membership UI" \
  --display-name "Higo · web" \
  --spec "…" --json

ORCA orchestration worker-start \
  --task <task_id> --worktree … --agent cursor \
  --task-title "Higo · web — #123 membership UI" \
  --json
```

Chi tiết spawn: [orca-agent-routing-coordinator.mdc](../../.cursor/rules/orca-agent-routing-coordinator.mdc); chọn chuyên môn UI theo [ui-workflow.md](./ui-workflow.md).

## Cách coordinator chọn và truyền vai trò

### 1. Chọn role chính và bổ sung đúng checklist

| Loại Task                                            | Role chính                           | Role phụ (tùy chọn)                                                                                                           |
| ---------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Discovery / AC / phân Story                          | `product-ba`                         | `product-design` nếu cần flow UI (revamp: gộp visual vào PD, bỏ BA nếu AC đã chốt)                                            |
| Thiết kế kỹ thuật có architecture impact             | `architect`                          | BA/PD là Task riêng khi cần                                                                                                   |
| Kiểm tra sự phù hợp kiến trúc trên exact SHA khi cần | `architect` (session độc lập)        | Không thay DoD/security                                                                                                       |
| Design trước coding UI                               | `product-design`                     | —                                                                                                                             |
| Epic revamp user site/app (visual + UX)              | `product-design` (một Task, mục 0–5) | Không thêm Role graphic; BA/Architect chỉ khi scope/IA chưa chốt                                                              |
| Coding BE / web / iOS                                | `backend` / `web` / `ios`            | —                                                                                                                             |
| Critique thiết kế / review UI riêng                  | `reviewer-uiux`                      | Không thay DoD; không tự sửa code                                                                                             |
| DoD sau `Chờ duyệt`                                  | `reviewer-dod`                       | + `reviewer-uiux` khi có UI (`dod+ux`); + `reviewer-security` nếu slice nhạy cảm (`dod+sec` / `dod+sec+ux`), **cùng session** |
| UAT production / go-no-go launch                     | `launch-uat`                         | Sóng cuối: `reviewer-dod`+`reviewer-security` chỉ đọc artifact, không tự chạy lại                                             |
| Epic planner                                         | Không gắn role catalog này           | Planner theo `orca-epic-orchestrator.mdc`                                                                                     |

Không spawn PD/BA để “làm luôn” code BE+web+iOS. Không reuse session implementer làm reviewer. **Không** spawn DoD/security/UI reviewer trùng checklist trên cùng PR/SHA; gộp session khi scope cho phép. Sửa UI nhỏ theo mẫu có sẵn giao thẳng `web`/`ios`, không spawn thêm PD/BA/architect nếu không có việc thuộc chuyên môn đó.

### 2. Task Spec tối thiểu (Wave C) + khối role

Mẫu dùng khi dispatch: [Task Spec ngắn](templates/task-spec.md). Mẫu bàn giao: [báo cáo worker ngắn](templates/worker-report.md). Cách thu evidence và dùng lại context: [context-budget](context-budget.md#vận-hành-codex-coordinator--composer-workers). Đọc on-demand, không paste nguyên mẫu/tài liệu vào mọi prompt.

Coordinator dùng [review.md](templates/review.md) một lần để soạn spec review đã điền (150–250 từ, initial/revalidate). Reviewer chỉ nhận spec + evidence links, đọc role/rules áp dụng; không phải đọc template trống hoặc hai mẫu trên. Một báo cáo/checks chung cho DoD/security/UI trên cùng PR/SHA, verdict riêng; coordinator chỉ bổ sung trạng thái/decision mới và link báo cáo, không chép lại.

Ưu tiên spec ngắn — đủ AC/paths/Role/Persona/Cost tier/SHA; **không** paste nguyên `roles/*.md`.

```markdown
## Task

- Issue/PR: #<n> / PR #<n>
- Paths: <ownership>
- AC: <3–7 gạch đầu dòng>
- Ngoài phạm vi / Decision IDs: <ranh giới + quyết định áp dụng>
- Checks / evidence bắt buộc: <lệnh hoặc bằng chứng nghiệm thu>
- Architecture impact: Có | Không — <1 câu>
- Cost tier: cheap | standard | focused | advanced | high
- --display-name: "<Persona> · <ui-label>"
- --task-title: "<Persona> · <ui-label> — #<issue> <tóm tắt>"

## Vai trò chuyên môn

- Role ID: <id> (role đơn) | `dod+ux` | `dod+sec` | `dod+sec+ux` (reviewer gộp — một session)
- Persona: <Name>
- File: docs/agents/roles/<id>.md (role đơn) hoặc docs/agents/roles/reviewer-merged.md (reviewer gộp); đọc sau AGENTS.md
- Skills cần nạp: <tên + mục đích, hoặc Không nếu không cần; chỉ nạp skill liên quan>
- Nếu Task UI: Mẫu thiết kế chuẩn + Evidence UI theo docs/agents/ui-workflow.md
```

### 2b. Spawn snippet (Wave E+G) — copy-paste

Preflight **trước** `worker-start` (fresh launch; bỏ qua khi `--terminal` reuse):

```text
node scripts/orca-spawn-model-preflight.mjs -- \
  --cost-tier <cheap|standard> \
  --agent cursor \
  --model <pin> \
  --display-name "<Persona> · <ui-label>"

ORCA orchestration worker-start \
  --task <task_id> \
  --worktree path:<abs> \
  --agent cursor \
  --model <pin> \
  --task-title "<Persona> · <ui-label> — #<issue> <tóm tắt>" \
  --json
```

| Tier     | `--model` pin (cost-catalog)                                                                    |
| -------- | ----------------------------------------------------------------------------------------------- |
| cheap    | `composer-2.5` (Composer Standard; cấm `composer-2.5-fast`)                                     |
| standard | `composer-2.5` (fallback `claude-sonnet-5-thinking-low`; cấm `claude-sonnet-5-thinking-medium`) |

Sau wave: `node scripts/orca-cost-wave-evidence.mjs --run <RUN> --dispatch <DISPATCH> [--receipt-file <start-receipt.json>]` (lặp flag cho từng dispatch) → ghi dòng `cost-wave` (`source=receipt`). Comment wt `Cost … · model …` **không** thay `--model` argv.

UAT / milestone gate (a): Read `.cursor/rules/uat-headless.mdc` (Wave G — không alwaysApply).

Reviewer (thêm):

```markdown
## Review independence

- Implementer dispatch: <id>
- Exact SHA: <sha>
- Artifact: <comment Issue/PR hoặc docs/reviews/<slug>.md>
- Checklist: [reviewer-merged.md](./roles/reviewer-merged.md) khi gộp `dod+ux` / `dod+sec` / `dod+sec+ux`; từng kết luận DoD | UI | security riêng
- Revalidation: <SHA trước + link findings/checkpoint; lần đầu ghi Không>
- Lượt sửa tự động: <0|1|2>/2; ngoại lệ: <chưa dùng|đã dùng>
```

Review/fix đọc [quy trình chung](../../.cursor/rules/orca-review-convergence.mdc). Spec fix chỉ rõ finding IDs cần sửa, điều kiện đóng và checks; worker bàn giao SHA/kết quả theo từng ID. Đổi Dispatch/Run không reset bộ đếm; ngắt vòng lặp chuyển sang chẩn đoán có giới hạn.

Khối mở rộng (khi cần) — giữ tương thích:

```markdown
## Vai trò chuyên môn (bổ sung)

- Role ID: <product-ba|product-design|architect|backend|web|ios|reviewer-dod|reviewer-uiux|reviewer-security>
- Persona: <Name từ Persona roster — vd. Higo, Gonic, James>
- File: docs/agents/roles/<id>.md
- Đọc file role SAU AGENTS.md và rule Orca; nếu xung đột → rule dự án thắng.
- Không mở rộng MVP / ngoài phạm vi Issue.
- Agent/model/effort: chọn mapping đã đăng ký cho tier trong cost-catalog; tên tier độc lập với hãng/model
- Cost tier: cheap | standard | focused | advanced | high — pin agent/model/effort từ docs/agents/cost-catalog.md (cấm inherit mặc định)
- Architecture impact: Có | Không — lý do + link thiết kế/ADR hiện hành
- Nếu Có: quyết định còn mở, Task architect/handoff và consumer thực sự phải chờ
- Orca: --display-name "<Persona> · <ui-label>" (vd. James · dod+sec)
```

### 3. Architect trong quy trình

```text
Coordinator + Epic planner: xác định scope, xét architecture impact
  BA ∥ PD ∥ Architect (khi có quyết định kỹ thuật còn mở) ∥ planner
                       ↓ handoff/ADR được coordinator xác nhận trong thẩm quyền
  BE ∥ web ∥ iOS (chỉ consumer phụ thuộc phải chờ; Task độc lập chạy ngay)
                        ↓ PR / exact SHA
  DoD(+sec gộp cùng SHA) ∥ kiểm tra kiến trúc độc lập khi cần
                       ↓ CI + evidence + coordinator integration đã được ủy quyền
```

Áp dụng trigger, đầu ra và giới hạn trong [role architect](./roles/architect.md). Không thêm gate Architect cho mọi PR. Architect đề xuất giải pháp, planner chia việc; coordinator quyết định trong thẩm quyền và giao đúng ownership. ADR/scope vượt thẩm quyền phải chuyển user, không tự duyệt. Reviewer DoD kiểm tra handoff/ADR khi Task có impact; review kiến trúc không thay nghiệm thu/security.

Khối bổ sung khi giao Task Architect (điền cùng parent/scope/AC trong spec thông thường):

```markdown
## Vai trò chuyên môn (bổ sung)

- Role ID: architect
- Persona: Dexter
- File: docs/agents/roles/architect.md
- Agent: cursor (theo orca-agent-routing-core.mdc)
- Cost tier: standard (`composer-2.5`)
- Mode: Thiết kế | Kiểm tra sự phù hợp
- Architecture impact: Có — <quyết định/rủi ro cụ thể>
- Orca: --display-name "Dexter · architect"

- Input: <Issue/Task, PR nếu có, exact source SHA, thiết kế/ADR liên quan>
- Output/paths được sửa: <docs/architecture/<slug>.md hoặc docs/reviews/<slug>-architecture.md>
- Quyết định cần giải: <câu hỏi + constraints đã chốt>
- Consumer thực sự phải chờ: <Task IDs + artifact thiếu, hoặc không có>
- Người xác nhận handoff/quyết định: coordinator trong thẩm quyền
- Checks/evidence: <source/tests cần đối chiếu, không tự claim runtime PASS>
- Nếu review: session khác tác giả implementation/design liên quan; ghi exact SHA + verdict
- Đọc AGENTS.md + rule Orca trước role; không code chéo scope hoặc spawn con.
```

### 4. Không làm gì với role

- Không copy `roles/*.md` vào `.cursor/rules/` với `alwaysApply: true`.
- Không cài roster upstream qua Agency Agents app / `install.sh --tool cursor` cho toàn bộ division.
- Không đổi `--agent` theo role hoặc theo Persona.
- Không gắn model vượt standard cho Task “quan trọng”; trần tier = `standard`.
- Không để worker depth > 1 (Wave Leader depth 1 chỉ spawn ownership/reviewer trong wave — không spawn Leader/planner con).
- Không bỏ `--display-name` / `--task-title` / Persona khỏi spawn mới (xem roster ở trên).

### 5. Wave tối đa song song (ownership giữ nguyên)

Coordinator/planner fan-out hết task ready độc lập dưới caps/WIP (5 non-review + 3 reviewer). Một planner/Epic, không tạo dependency giả; scope task lẻ nhỏ có thể làm inline. Authority: `orca-parallel-workers.mdc`.

```text
Wave rộng (ví dụ — spawn cùng lúc nếu unblocked):
  product-ba ∥ product-design ∥ architect khi cần ∥ backend ∥ web ∥ ios
       │              │              │
       └──────────────┴── contract / PD handoff chỉ khi thật sự chặn ──┘
                                      ↓
              reviewer (dod ± ux ± sec)  ×  N PR độc lập (cap ≤3 live)
```

| Được song song                                                  | Không gom serial                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| BA ∥ PD (docs khác path)                                        | BA xong mới PD nếu PD không cần AC BA                                  |
| BE ∥ web ∥ iOS sau contract (hoặc ngay nếu không đụng contract) | Một mega-worker làm cả ba slice                                        |
| Nhiều reviewer trên **PR khác nhau**                            | Review trùng checklist trên **cùng** PR/SHA (gộp `dod` ± `ux` ± `sec`) |
| Coding slice A ∥ review/fix slice B ∥ BA/PD                     | Chờ cả Story đóng mới mở Task ready Story khác                         |

Cùng ownership slice: tối đa **một** feature coding Dispatch active (tránh conflict git). Soft cap: ≤**5** non-review live / Run, ≤**3** reviewer; fix CI hẹp không chiếm bucket feature. Parallel vẫn theo `orca-parallel-workers.mdc` + idle fill. WIP / `Chờ duyệt` đầy **hoặc** soft cap đầy → ưu tiên **song song** reviewer/fix trước feature mới.

## Upstream

Workflow evidence/UAT, review canonical và đo token/cache/allowance: [hướng dẫn vận hành](workflow-evidence-telemetry.md), chỉ đọc khi áp dụng; không thêm vào context mặc định của mọi worker.

Chi tiết license, SHA và mapping: [upstream/PROVENANCE.md](./upstream/PROVENANCE.md).
