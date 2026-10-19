# Vai trò chuyên môn Vemoki (Orca)

**Trạng thái:** đã áp dụng trên `main` (PR #195 + wiring process). Catalog này **bổ sung chuyên môn** khi spawn worker — bắt buộc gắn Role ID vào Task Spec theo `AGENTS.md` / rule Orca. Không thay thế và không được ưu tiên hơn:

- [AGENTS.md](../../AGENTS.md)
- `.cursor/rules/orca-agent-routing.mdc` (mọi worker dùng `--agent cursor`; **Cost tier** `cheap|standard` — trần standard; pin `--model` từ [cost-catalog.md](./cost-catalog.md) — **cấm inherit UI mặc định**; Wave E: `scripts/orca-spawn-model-preflight.mjs` trước spawn; `cost-wave` từ receipt)
- `.cursor/rules/orca-epic-orchestrator.mdc` · `orca-parallel-workers.mdc` · `orca-idle-worker-fill.mdc` · `orca-coordinator-mailbox.mdc` — **coordinator-only** (`alwaysApply: false`; leader Read khi kích hoạt — Wave B)
- `.cursor/rules/github-project-tracking.mdc`, `git-workflow.mdc`
- `.cursor/rules/uat-headless.mdc` — **Wave G:** không `alwaysApply`; globs UAT/artifacts; Task UAT/milestone → Read nếu cần

**Không** cài toàn bộ [agency-agents](https://github.com/msitarzewski/agency-agents) thành `alwaysApply` rules. Chỉ gắn **một** file `roles/*.md` vào Task Spec khi cần chuyên môn đó.

## Cấu trúc

```text
docs/agents/
  README.md                 ← file này
  cost-catalog.md           ← pin Cursor --model theo Cost tier + Wave D/E (receipt / preflight)
  upstream/                 ← nguồn MIT + provenance (không chỉnh để “fit” Vemoki)
  roles/                    ← hướng dẫn đã điều chỉnh cho Vemoki + Orca
```

## Catalog vai trò

| ID | File | Khi dùng | Ownership / ghi chú |
| -- | ---- | -------- | ------------------- |
| `product-ba` | [roles/product-ba.md](./roles/product-ba.md) | Làm rõ bài toán, non-goals, AC, ưu tiên trong MVP đã chốt | Docs/Issue; không mở rộng MVP |
| `product-design` | [roles/product-design.md](./roles/product-design.md) | User flow, trạng thái UI, a11y, AC UI, hướng dẫn triển khai; **brand/visual budget** khi Epic revamp (`Visual budget: Có`) — không Role graphic riêng | Docs/design handoff (một artifact); không code ownership slice khác |
| `architect` | [roles/architect.md](./roles/architect.md) | Quyết định kiến trúc, contract, ADR, failure/recovery và kiểm tra sự phù hợp khi cần | Docs/handoff trong scope; không sở hữu code đa slice hoặc thay reviewer độc lập |
| `backend` | [roles/backend.md](./roles/backend.md) | Implement NestJS / DB / worker | `apps/api`, `apps/worker`, `packages/backend` |
| `web` | [roles/web.md](./roles/web.md) | Implement Next.js | `apps/web` only |
| `ios` | [roles/ios.md](./roles/ios.md) | Implement Expo/RN iOS | `apps/mobile` only; local build, không EAS Cloud |
| `reviewer-dod` | [roles/reviewer-dod.md](./roles/reviewer-dod.md) | DoD / acceptance trên **exact SHA** | Session **≠** implementer |
| `reviewer-security` | [roles/reviewer-security.md](./roles/reviewer-security.md) | Review bảo mật slice nhạy cảm | Session **≠** implementer; không thay DoD nếu cần cả hai |

Agent runtime: luôn Cursor (`--agent cursor`), trừ khi user override rõ. Role **≠** agent vendor **≠** Cost tier **≠** Persona — xem bảng Cost tier và Persona trong `orca-agent-routing.mdc`.

## Persona roster (Orca `--display-name`)

Nguồn sự thật cho label UI trên hàng Dispatch. Coordinator **bắt buộc** truyền `--display-name` khi `task-create` / `worker-start` (dispatch mới; không rename worker đang live).

| Role ID / vai | Persona pool | Ghi chú |
| ------------- | ------------ | ------- |
| `web` | Higo, Enton | FE — pick free khi song song |
| `backend` | Gonic, Colin, Remy, Monica | pick free khi song song |
| `ios` | Zico | 1 người |
| `architect` | Dexter | |
| `product-design` | Liv | |
| `product-ba` | Kazu | |
| `reviewer-dod` | James | UI label: **`dod`** (không ghi `reviewer-dod`) |
| `reviewer-security` | James | UI label: **`sec`**; gộp cùng DoD → **`dod+sec`** (Wave C) |
| Epic planner (không Role catalog) | Dexter | `--display-name "Dexter · planner"` |

**Format:** `--display-name "<Persona> · <ui-label>"` — Role ID trong Spec vẫn đầy đủ; **ui-label** ngắn trên Orca:

| Role ID | ui-label |
| ------- | -------- |
| `web` | `web` |
| `backend` | `be` |
| `ios` | `ios` |
| `architect` | `arch` |
| `product-ba` | `ba` |
| `product-design` | `pd` |
| `reviewer-dod` | `dod` |
| `reviewer-security` | `sec` |
| DoD+security cùng PR/SHA (Wave C) | `dod+sec` |
| Epic planner | `planner` |

Ví dụ: `Higo · web`, `James · dod`, `James · dod+sec`, `Gonic · be`, `Dexter · planner`.

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
  --display-name "Higo · web" \
  --task-title "Higo · web — #123 membership UI" \
  --json
```

Chi tiết spawn: `.cursor/rules/orca-agent-routing.mdc` § Persona.

## Cách coordinator chọn và truyền vai trò

### 1. Chọn đúng một (hoặc hai) role theo loại Task

| Loại Task | Role chính | Role phụ (tùy chọn) |
| --------- | ---------- | ------------------- |
| Discovery / AC / phân Story | `product-ba` | `product-design` nếu cần flow UI (revamp: gộp visual vào PD, bỏ BA nếu AC đã chốt) |
| Thiết kế kỹ thuật có architecture impact | `architect` | BA/PD là Task riêng khi cần |
| Kiểm tra sự phù hợp kiến trúc trên exact SHA khi cần | `architect` (session độc lập) | Không thay DoD/security |
| Design trước coding UI | `product-design` | — |
| Epic revamp user site/app (visual + UX) | `product-design` (một Task, mục 0–5) | Không thêm Role graphic; BA/Architect chỉ khi scope/IA chưa chốt |
| Coding BE / web / iOS | `backend` / `web` / `ios` | — |
| DoD sau `Chờ duyệt` | `reviewer-dod` | + `reviewer-security` trên **cùng session** (`dod+sec`) nếu slice nhạy cảm — Wave C |
| Epic planner | Không gắn role catalog này | Planner theo `orca-epic-orchestrator.mdc` |

Không spawn PD/BA để “làm luôn” code BE+web+iOS. Không reuse session implementer làm reviewer. **Không** spawn `James · dod` và `James · sec` song song trên cùng PR/SHA.

### 2. Task Spec tối thiểu (Wave C) + khối role

  Ưu tiên spec ngắn — đủ AC/paths/Role/Persona/Cost/model/SHA; **không** paste nguyên `roles/*.md`.

  ```markdown
  ## Task
  - Issue/PR: #<n> / PR #<n>
  - Paths: <ownership>
  - AC: <3–7 gạch đầu dòng>
  - Architecture impact: Có | Không — <1 câu>
  - Cost tier: cheap | standard
  - --model: <pin từ docs/agents/cost-catalog.md>
  - --display-name: "<Persona> · <ui-label>"

  ## Vai trò chuyên môn
  - Role ID: <id>[, reviewer-security nếu gộp dod+sec]
  - Persona: <Name>
  - File: docs/agents/roles/<id>.md  (đọc sau AGENTS.md; rule dự án thắng)
  ```

### 2b. Spawn snippet (Wave E+G) — copy-paste

Preflight **trước** `worker-start` (fresh launch; bỏ qua khi `--terminal` reuse):

```text
node scripts/orca-spawn-model-preflight.mjs -- \
  --agent cursor \
  --model <pin> \
  --display-name "<Persona> · <ui-label>"

ORCA orchestration worker-start \
  --task <task_id> \
  --worktree path:<abs> \
  --agent cursor \
  --model <pin> \
  --display-name "<Persona> · <ui-label>" \
  --json
```

| Tier | `--model` pin (cost-catalog) |
| ---- | ---------------------------- |
| cheap | `composer-2.5` (Composer Standard; cấm `composer-2.5-fast`) |
| standard | `composer-2.5` (fallback `claude-sonnet-5-thinking-low`; cấm `claude-sonnet-5-thinking-medium`) |

Sau wave: `node scripts/orca-cost-wave-evidence.mjs` → ghi dòng `cost-wave` (`source=receipt`). Comment wt `Cost … · model …` **không** thay `--model` argv.

UAT / milestone gate (a): Read `.cursor/rules/uat-headless.mdc` (Wave G — không alwaysApply).

Reviewer (thêm):

```markdown
## Review independence
- Implementer dispatch: <id>
- Exact SHA: <sha>
- Artifact: docs/reviews/<slug>.md
- Checklist: DoD [| security]  # gộp khi dod+sec
```

Khối mở rộng (khi cần) — giữ tương thích:

```markdown
## Vai trò chuyên môn (bổ sung)
- Role ID: <product-ba|product-design|architect|backend|web|ios|reviewer-dod|reviewer-security>
- Persona: <Name từ Persona roster — vd. Higo, Gonic, James>
- File: docs/agents/roles/<id>.md
- Đọc file role SAU AGENTS.md và rule Orca; nếu xung đột → rule dự án thắng.
- Không mở rộng MVP / ngoài phạm vi Issue.
- Agent: cursor (theo orca-agent-routing.mdc)
- Cost tier: cheap | standard — pin --model từ docs/agents/cost-catalog.md (cấm inherit mặc định; trần standard)
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
- Agent: cursor (theo orca-agent-routing.mdc)
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
- Không để worker depth > 1; planner/worker không spawn con.
- Không bỏ `--display-name` / Persona khỏi spawn mới (xem roster ở trên).

### 5. Wave tối đa song song (ownership giữ nguyên)

Coordinator / Epic planner **fan-out hết** Task ready trong một wave (concurrent soft caps + WIP cho phép — xem `orca-parallel-workers.mdc`). Chỉ xếp tuần tự khi có dependency artifact thật.

```text
Wave rộng (ví dụ — spawn cùng lúc nếu unblocked):
  product-ba ∥ product-design ∥ architect khi cần ∥ backend ∥ web ∥ ios
       │              │              │
       └──────────────┴── contract / PD handoff chỉ khi thật sự chặn ──┘
                                      ↓
              reviewer (dod hoặc dod+sec)  ×  N PR độc lập (cap ≤3 live)
```

| Được song song | Không gom serial |
| -------------- | ---------------- |
| BA ∥ PD (docs khác path) | BA xong mới PD nếu PD không cần AC BA |
| BE ∥ web ∥ iOS sau contract (hoặc ngay nếu không đụng contract) | Một mega-worker làm cả ba slice |
| Nhiều reviewer trên **PR khác nhau** | `dod` ∥ `sec` trên **cùng** PR/SHA (dùng `dod+sec`) |
| Coding slice A ∥ review/fix slice B ∥ BA/PD | Chờ cả Story đóng mới mở Task ready Story khác |

Cùng ownership slice: tối đa **một** feature coding Dispatch active (tránh conflict git). Soft cap: ≤**5** non-review live / Run; reviewer/fix không chiếm bucket feature. Parallel vẫn theo `orca-parallel-workers.mdc` + idle fill. WIP / `Chờ duyệt` đầy **hoặc** soft cap đầy → ưu tiên **song song** reviewer/fix trước feature mới.

## Upstream

Chi tiết license, SHA và mapping: [upstream/PROVENANCE.md](./upstream/PROVENANCE.md).
