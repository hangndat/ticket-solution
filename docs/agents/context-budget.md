# Agent context budget (rules)

## Review chi phí token — 2026-10-23

Điều chỉnh mới nhất: user giữ max fan-out và planner; đã khôi phục caps 5 non-review + 3 reviewer và một planner/Epic. Các số đo bytes trong bảng là snapshot của lượt review chi phí trước khi khôi phục chính sách này, không phải số đo của tip hiện tại. Mẫu review hiện hành: [review.md](templates/review.md), thay việc dùng đồng thời task-spec/worker-report; một báo cáo trên PR/SHA, revalidation theo findings/diff và evidence dùng chung giữa các vai trò.

| Nguồn | Trước lần review này | Sau | Ý nghĩa |
| --- | --- | --- | --- |
| Rules cố định worker, gồm user rules | 28.609 B ≈ 8.174 tok | 27.477 B ≈ 7.851 tok | Giảm khoảng 4% riêng phần rules cố định; không phải 4% quota |
| Rules coordinator bắt buộc trước dispatch | 8 file, 49.411 B ≈ 14.117 tok | 3 file, 10.405 B ≈ 2.973 tok | Giảm khoảng 79% riêng nhóm nạp đầu; rules còn lại đọc khi hành động cần |
| Evidence output mặc định | 500 files / 200 checks | 60 files / 20 checks | Vẫn có total/omitted và CI counts; mở rộng có chủ đích khi thiếu evidence |

Đã sửa: nạp tài liệu không liên quan, poll ngắn và đọc transcript lặp, tạo session lại chỉ vì nhãn tier. Đề xuất giảm fan-out/planner đã được user yêu cầu rút lại; giữ max fan-out và một planner/Epic. Không đổi model đang chạy, không sửa cấu hình user toàn máy, không chạy benchmark model. `node --test scripts/agent-evidence.test.mjs`: 11/11 PASS; `git diff --check`: PASS. Review local bởi coordinator; chưa phải DoD exact-SHA sau commit.

Giới hạn đo: lịch sử dài của phiên hiện tại vẫn tồn tại; sửa rules không xóa token đã dùng và không đảm bảo giảm ngay quota của phiên này. Khi đổi phase hoặc context đã phình, bàn giao checkpoint sang session mới sau settlement thay vì kéo toàn bộ transcript; không tách session cho từng việc nhỏ. Skills catalog/runtime instructions và cache không được đo ở bảng trên. Chưa có token/allowance per-task để tính ROI; không hứa phần trăm tiết kiệm thực tế.

## Vận hành Codex coordinator + Composer workers

- Template review đầy đủ chỉ dành cho coordinator, đọc một lần rồi gửi spec đã điền khoảng 150–250 từ. Reviewer không nạp template trống/task-spec/worker-report; vẫn đọc role/rules và source/evidence cần thiết. Báo cáo ≤3 câu tóm tắt + checks + findings mới/mở đủ bằng chứng; findings đóng dẫn ID/report trước. Coordinator chỉ ghi trạng thái/decision mới và link báo cáo để tránh phát sinh bản sao.

- Theo điều chỉnh mới nhất của user: giữ max fan-out task ready trong scope, một planner/Epic, trần 5 non-review + 3 reviewer theo `orca-parallel-workers.mdc`. Tối ưu token bằng context/reuse/review theo diff, không hạ concurrency.
- Chờ một `check --wait` 45 giây; resume đúng tool session với wait dài, không poll 1 giây/đọc transcript liên tục. Ba lần timeout mới enumerate nếu chưa có tín hiệu cần xử lý sớm.
- Guide/rules coordinator nạp theo hành động trong `orca-leader-activation.mdc`; business docs đọc phần liên quan theo AGENTS. Không nạp tài liệu sản phẩm đầy đủ cho task docs/tooling thuần.
- Các con số dưới đây là **ước lượng bytes/3.5 trên đĩa**, không phải token usage thực tế hay chi phí quota. Cursor alwaysApply không chứng minh Codex nạp cùng nội dung; runtime có thể thêm instructions/skills/history và cache. Không cộng toàn bộ requestable rules thành chi phí thực của mỗi turn.

- Dispatch dùng [Task Spec ngắn](templates/task-spec.md); worker trả [báo cáo ngắn](templates/worker-report.md). Không nạp hai template vào alwaysApply; chỉ đọc khi chuẩn bị task/bàn giao.
- Một session đọc tài liệu bắt buộc lần đầu; sau đó chỉ đọc lại khi nội dung thay đổi, scope đổi hoặc cần xác minh chi tiết. Session mới vẫn phải nạp instructions bắt buộc; checkpoint không thay AGENTS/rules.
- Composer chuẩn bị evidence; Codex đọc tóm tắt, diff và đoạn source liên quan khi quyết định. Không paste toàn bộ PRD, test log hoặc transcript vào mỗi dispatch.
- Gộp công việc nhỏ cùng ownership, đầu vào và mục tiêu; không gộp các slice độc lập hoặc giữ worker rảnh. Không spawn chỉ để chạy một lệnh thu evidence.
- Reviewer độc lập với implementer. Revalidation dùng SHA cũ → mới, findings còn mở và vùng regression; auth/tenant/contract/migration đổi thì mở rộng phạm vi. Chưa đổi SHA/input/evidence thì tái sử dụng kết quả với nguồn và lý do, không gọi là test mới.
- Chọn checks theo tác động, chạy một lần và lưu artifact; không lặp khi không có thay đổi hoặc giả thuyết mới. CI/gate bắt buộc trên SHA tích hợp vẫn giữ nguyên.
- Coordinator giữ checkpoint ngắn: `Task | owner/dispatch | SHA | AC còn thiếu | findings/lượt fix | quyết định | bước tiếp`. Raw logs ở artifact, chỉ mở đoạn cần điều tra. Không chứa secrets hoặc dữ liệu người dùng thật.

### Evidence packet

```bash
# Chỉ đọc git local; dùng SHA đã chốt thay vì ref di động khi bàn giao.
node scripts/agent-evidence.mjs --base <base-sha> --head <head-sha>

# CI theo PR, cùng exact SHA; chỉ đọc GitHub khi có --pr.
node scripts/agent-evidence.mjs --base <base-sha> --head <head-sha> \
  --pr <number> --repo hangndat/ticket-solution \
  --artifact <report-path> --out /tmp/task-evidence-unique.json

node --test scripts/agent-evidence.test.mjs
```

Packet gom metadata git, CI và fingerprint artifact; không chứa raw diff/log hoặc nội dung artifact. Đây là index để reviewer mở evidence đúng chỗ, không phải verdict DoD. Diff là base → head trực tiếp; muốn diff PR phải chọn merge-base phù hợp trước. Working tree dirty được ghi riêng, không gán thay đổi chưa commit vào head SHA. Artifact local có hash tại thời điểm thu, không tự chứng minh được tạo từ head SHA.

Kiểm mọi trạng thái missing/unavailable/mismatch và số mục bị lược trước khi dùng. Không coi CI xanh hoặc script exit 0 là acceptance/pilot ready; phải đối chiếu checks bắt buộc và AC. Packet là snapshot, thu lại khi SHA/checks/artifact thay đổi; không poll định kỳ khi chưa cần quyết định.

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
- **Tiết kiệm:** CRG xác định symbol/impact; `ctx_read` chọn một mode map/signatures/lines/anchored/full theo mục đích, không đi tuần tự các mode. Routing, root và smoke checks: [MCP-SETUP.md](MCP-SETUP.md).
- **Chi phí:** shadow MCP round-trip; không giảm gói rules ~19k tok trước refactor.

## Session types

| Session          | Nạp thêm                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| Ownership worker | `*-core`, `github-project-tracking`, git, worktree, CRG                           |
| Reviewer         | + review bullets trong core                                                       |
| Coordinator gốc  | Read leader-activation; rules coordinator theo hành động, không nạp toàn bộ lúc đầu |

Skills: catalog metadata trong prompt (~8–9k tok); `SKILL.md` full chỉ khi `Read`.
