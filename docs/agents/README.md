# Vai trò chuyên môn Vemoki (Orca)

**Trạng thái:** đã áp dụng trên `main` (PR #195 + wiring process). Catalog này **bổ sung chuyên môn** khi spawn worker — bắt buộc gắn Role ID vào Task Spec theo `AGENTS.md` / rule Orca. Không thay thế và không được ưu tiên hơn:

- [AGENTS.md](../../AGENTS.md)
- `.cursor/rules/orca-agent-routing.mdc` (mọi worker dùng `--agent cursor`)
- `.cursor/rules/orca-epic-orchestrator.mdc` (cây worker phẳng; chỉ coordinator gốc dispatch)
- `.cursor/rules/orca-parallel-workers.mdc`, `orca-idle-worker-fill.mdc`, `orca-coordinator-mailbox.mdc`
- `.cursor/rules/github-project-tracking.mdc`, `git-workflow.mdc`, `uat-headless.mdc`

**Không** cài toàn bộ [agency-agents](https://github.com/msitarzewski/agency-agents) thành `alwaysApply` rules. Chỉ gắn **một** file `roles/*.md` vào Task Spec khi cần chuyên môn đó.

## Cấu trúc

```text
docs/agents/
  README.md                 ← file này
  upstream/                 ← nguồn MIT + provenance (không chỉnh để “fit” Vemoki)
  roles/                    ← hướng dẫn đã điều chỉnh cho Vemoki + Orca
```

## Catalog vai trò

| ID | File | Khi dùng | Ownership / ghi chú |
| -- | ---- | -------- | ------------------- |
| `product-ba` | [roles/product-ba.md](./roles/product-ba.md) | Làm rõ bài toán, non-goals, AC, ưu tiên trong MVP đã chốt | Docs/Issue; không mở rộng MVP |
| `product-design` | [roles/product-design.md](./roles/product-design.md) | User flow, trạng thái UI, a11y, AC UI, hướng dẫn triển khai | Docs/design handoff; không code ownership slice khác |
| `backend` | [roles/backend.md](./roles/backend.md) | Implement NestJS / DB / worker | `apps/api`, `apps/worker`, `packages/backend` |
| `web` | [roles/web.md](./roles/web.md) | Implement Next.js | `apps/web` only |
| `ios` | [roles/ios.md](./roles/ios.md) | Implement Expo/RN iOS | `apps/mobile` only; local build, không EAS Cloud |
| `reviewer-dod` | [roles/reviewer-dod.md](./roles/reviewer-dod.md) | DoD / acceptance trên **exact SHA** | Session **≠** implementer |
| `reviewer-security` | [roles/reviewer-security.md](./roles/reviewer-security.md) | Review bảo mật slice nhạy cảm | Session **≠** implementer; không thay DoD nếu cần cả hai |

Agent runtime: luôn Cursor (`--agent cursor`), trừ khi user override rõ. Role ≠ agent vendor.

## Cách coordinator chọn và truyền vai trò

### 1. Chọn đúng một (hoặc hai) role theo loại Task

| Loại Task | Role chính | Role phụ (tùy chọn) |
| --------- | ---------- | ------------------- |
| Discovery / AC / phân Story | `product-ba` | `product-design` nếu cần flow UI |
| Design trước coding UI | `product-design` | — |
| Coding BE / web / iOS | `backend` / `web` / `ios` | — |
| DoD sau `Chờ duyệt` | `reviewer-dod` | `reviewer-security` nếu slice authz/RLS/quota/check-in/secrets |
| Epic planner | Không gắn role catalog này | Planner theo `orca-epic-orchestrator.mdc` |

Không spawn PD/BA để “làm luôn” code BE+web+iOS. Không reuse session implementer làm reviewer.

### 2. Nhúng vào Task Spec (bắt buộc khi dùng role)

Thêm khối sau vào spec `worker-start` (tiếng Việt cho phần mô tả user-facing; giữ path/SHA/command tiếng Anh kỹ thuật):

```markdown
## Vai trò chuyên môn (bổ sung)
- Role ID: <product-ba|product-design|backend|web|ios|reviewer-dod|reviewer-security>
- File: docs/agents/roles/<id>.md
- Đọc file role SAU AGENTS.md và rule Orca; nếu xung đột → rule dự án thắng.
- Không mở rộng MVP / ngoài phạm vi Issue.
- Agent: cursor (theo orca-agent-routing.mdc)
```

Với reviewer, thêm:

```markdown
## Review independence
- Implementer session/dispatch: <id>
- Reviewer session phải khác implementer
- Exact SHA: <40-char hoặc unambiguous>
- Artifact: docs/reviews/<slug>.md
```

### 3. Không làm gì với role

- Không copy `roles/*.md` vào `.cursor/rules/` với `alwaysApply: true`.
- Không cài roster upstream qua Agency Agents app / `install.sh --tool cursor` cho toàn bộ division.
- Không đổi `--agent` theo role.
- Không để worker depth > 1; planner/worker không spawn con.

### 4. Wave tối đa song song (ownership giữ nguyên)

Coordinator / Epic planner **fan-out hết** Task ready trong một wave (capacity + WIP cho phép). Chỉ xếp tuần tự khi có dependency artifact thật.

```text
Wave rộng (ví dụ — spawn cùng lúc nếu unblocked):
  product-ba ∥ product-design ∥ backend ∥ web ∥ ios
       │              │              │
       └──────────────┴── contract / PD handoff chỉ khi thật sự chặn ──┘
                                      ↓
              reviewer-dod (± reviewer-security)  ×  N PR/Issue độc lập
```

| Được song song | Không gom serial |
| -------------- | ---------------- |
| BA ∥ PD (docs khác path) | BA xong mới PD nếu PD không cần AC BA |
| BE ∥ web ∥ iOS sau contract (hoặc ngay nếu không đụng contract) | Một mega-worker làm cả ba slice |
| Nhiều `reviewer-dod` trên PR khác nhau | Một reviewer duyệt tuần tự mọi PR khi còn room |
| Coding slice A ∥ review/fix slice B ∥ BA/PD | Chờ cả Story đóng mới mở Task ready Story khác |

Cùng ownership slice: tối đa **một** feature coding Dispatch active (tránh conflict git). Parallel vẫn theo `orca-parallel-workers.mdc` + idle fill. WIP / `Chờ duyệt` đầy → ưu tiên **song song** reviewer/fix trước feature mới.

## Upstream

Chi tiết license, SHA và mapping: [upstream/PROVENANCE.md](./upstream/PROVENANCE.md).
