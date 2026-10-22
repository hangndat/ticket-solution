# Agent context budget (rules)

Đo **bytes on disk** của rules luôn nạp vs coordinator Read-on-demand. Token ≈ `bytes / 3.5` (ước lượng).

## Đo lại

```bash
node scripts/orca-context-budget.mjs --user-rules
node scripts/orca-context-budget.mjs --json --user-rules
```

Baseline trước refactor: `.context-budget-before.json` (gitignored snapshot local).

## Trước refactor (2026-10-19)

| Thành phần                             | Bytes      | ~Tok        |
| -------------------------------------- | ---------- | ----------- |
| Repo `alwaysApply` (7 file)            | 41 104     | 11 744      |
| `.cursorrules` + `AGENTS.md`           | 16 485     | 4 710       |
| User `~/.cursor/rules` always (5 file) | 10 067     | 2 876       |
| **Worker fixed**                       | **67 656** | **~19 330** |
| Coordinator requestable (4 file)       | 36 093     | ~10 312     |

Trùng lặp: block CRG ~3× (`.cursorrules`, `AGENTS.md`, `code-review-graph-ready`); `orca-leader-activation` always dù không gọi leader.

## Sau refactor (2026-10-19, đo `orca-context-budget.mjs --user-rules`)

| Thành phần                                                   | Bytes      | ~Tok       | Δ vs trước                                           |
| ------------------------------------------------------------ | ---------- | ---------- | ---------------------------------------------------- |
| Repo `alwaysApply` (6 file)                                  | 16 231     | 4 637      | −24.9k tok                                           |
| `.cursorrules` + `AGENTS.md`                                 | 3 100      | 886        | −3.8k tok                                            |
| User always (3 file: apple, lean-ctx, sideproject-git)       | 7 756      | 2 216      | −0.7k tok                                            |
| **Worker fixed**                                             | **27 087** | **~7 739** | **−~11.6k tok (−60%)**                               |
| Coordinator requestable (9 file, gồm split + legacy pointer) | 41 588     | ~11 882    | +1.6k tok (nội dung tách ra, không auto-load worker) |

Thay đổi chính:

- **CRG:** một nguồn `code-review-graph-ready.mdc`; `.cursorrules` / `AGENTS.md` chỉ pointer.
- **Orca / Project:** `*-core.mdc` always; `*-coordinator.mdc` + `orca-leader-activation` requestable.
- **User:** `jira-commit-pr`, `local-portal-credentials` glob Seatincorp/portal — **−2.1k B** khỏi worker fixed trên ticket-solution.

Snapshot: `.context-budget-before.json` · `.context-budget-after.json` (local).

## Sau T1/T2 (#819, 2026-10-22, `orca-context-budget.mjs --user-rules`)

| Thành phần              | Trước                  | Sau                       | Δ ~tok                                           |
| ----------------------- | ---------------------- | ------------------------- | ------------------------------------------------ |
| **Worker fixed**        | 35 594 B (~10 170 tok) | **28 210 B (~8 060 tok)** | **−~2 110 tok (−21%)**                           |
| Repo `alwaysApply`      | 7 file                 | 5 file                    | −`orca-worktree-hygiene`, −`lean-ctx-mcp-cursor` |
| Coordinator requestable | (đo cùng lần)          | +66 128 B (~18 894 tok)   | worktree + lean-ctx MCP chuyển sang Read         |

Thay đổi: `orca-worktree-hygiene.mdc` + `lean-ctx-mcp-cursor.mdc` → `alwaysApply: false`; reviewer gộp `reviewer-merged.md`; CRG rule mô tả hook worktree vs MCP `main`; routing cites → `-core`/`-coordinator`.

## lean-ctx

- **Cố định (user):** `lean-ctx.mdc` (~4 KB). **`lean-ctx-mcp-cursor.mdc`** requestable (~2.4 KB) khi MCP/hook lỗi.
- **Tiết kiệm:** `ctx_read` map/signatures/lines vs full file; CRG trước khi đọc file.
- **Chi phí:** shadow MCP round-trip; không giảm gói rules ~19k tok trước refactor.

## Session types

| Session          | Nạp thêm                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| Ownership worker | `*-core`, `github-project-tracking`, git, worktree, CRG                           |
| Reviewer         | + review bullets trong core                                                       |
| Coordinator gốc  | Read leader-activation + 6 coordinator rules (~+15–20k tok một lần khi kích hoạt) |

Skills: catalog metadata trong prompt (~8–9k tok); `SKILL.md` full chỉ khi `Read`.
