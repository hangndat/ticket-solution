# Orca — worktree hygiene + DAG/gates (ROI cao)

**Coordinator-only** (`alwaysApply: false`): **coordinator gốc** (depth 0) áp dụng khi tạo/gắn worktree, wave Epic và fleet hygiene. Worker **không** tạo worktree hay gắn Issue/PR mặc định — chỉ Read file này khi Task Spec giao việc tạo/đụng worktree (pointer `docs/agents/policies/routing.md`). DAG/ready queue/caps/gates theo [dispatch](dispatch.md); settlement theo [lifecycle](lifecycle.md).

## 1. Worktree phải có link + comment sống

Mỗi Orca worktree phục vụ một Issue/PR **bắt buộc** gắn metadata trước khi coding sâu:

```text
# Khi tạo
ORCA worktree create --name <slug> --issue <N> --pr <N> --comment "<1 dòng trạng thái>" --json
# hoặc
ORCA worktree create --name <slug> --reference https://github.com/hangndat/ticket-solution/issues/<N> --comment "…" --json

# Khi đã có wt
ORCA worktree set --worktree path:<abs> --issue <N> --pr <N> --comment "<status>" --json
ORCA reference add https://github.com/hangndat/ticket-solution/issues/<N> --worktree path:<abs> --json
```

| Sự kiện                   | Cập nhật                                                        |
| ------------------------- | --------------------------------------------------------------- |
| Dispatch / bắt đầu code   | `--issue` (và `--pr` nếu đã mở) + comment `Đang làm: …`         |
| Mở PR                     | `--pr <n>` + `reference add` URL PR                             |
| Checkpoint / blocker      | `--comment` ngắn (VI): đang test / chờ CI / bị chặn X           |
| `worker_done` → Chờ duyệt | comment `Chờ duyệt DoD · SHA <short>`                           |
| Merge + DoD xong          | comment `Merged · dọn wt` rồi archive/`worktree rm` khi an toàn |

**Cấm** để wt feature lâu dài với `linkedIssue`/`linkedPR` trống khi đã biết số Issue/PR.

Tìm agent/wt theo Issue/PR bằng **URL GitHub đầy đủ** — không dùng số Issue/PR đơn lẻ, không đoán từ tên folder:

```text
ORCA reference find https://github.com/hangndat/ticket-solution/issues/<N> --json
ORCA reference find https://github.com/hangndat/ticket-solution/pull/<N> --json
```

**Persona vs label Shell:** node con `worker-task_<task_id>` trên cây worktree **không** hiển thị Higo/Kazu — Persona nằm ở `orchestration task-list` (`display_name`, `title`). Tuỳ chọn nhận slice trên card: `ORCA worktree set --worktree path:<abs> --display-name "<Persona> · <ui-label> — #<issue>" --json` (không thay `worker-task_*`).

## 2. Fleet hygiene (`worktree ps` + dọn)

Mỗi checkpoint Epic / cuối Run / automation:

1. `ORCA worktree ps --json` (và/hoặc `worktree list` scoped ticket-solution).
2. Ứng viên dọn: PR **merged**, không agent live, không reviewer đang dùng path, working tree đã bàn giao hoặc sạch theo DoD.
3. Trước `worktree rm`: xác nhận evidence/SHA đã lưu; không `reset --hard` / force-clean để “dọn”.
4. Giữ `main` / integration wt; không xóa wt đang `Đang làm` / `Chờ duyệt` còn open PR.
5. **Trần sống:** sau checkpoint Epic/merge, số git worktree ≤ **8** (`main` + live). Cấm để 50+ wt merged tồn — dọn trong cùng checkpoint. Cursor workspace chỉ mở **một root** repo, không add từng folder `vcx-*`.

Worker V3 xong tự đóng; chỉ `worker-release` khi receipt/`next` yêu cầu cleanup owned và đủ bằng chứng. Agent đóng hoặc Dispatch settled **≠** xóa worktree — dọn worktree riêng khi scope cho phép; tôn trọng keep-open/user takeover.

## 3. Automations (ticket-solution)

Host nên có automation **Cursor** trên workspace ticket-solution (existing), ví dụ:

- Weekday: đếm Project `Chờ duyệt` / PR mở thiếu DoD → báo + đề xuất review wave (không merge/deploy).
- Weekly: liệt kê wt thiếu link / PR merged dư → đề xuất `worktree rm` an toàn.

Coordinator tạo/sửa qua `ORCA automations …`; không để automation tự merge `main` hoặc deploy prod.

## Anti-patterns

```text
❌ Spawn worker trên wt không gắn Issue/PR khi số đã biết
❌ Epic ≥3 Task mà không task-create / deps — chỉ nhớ trong transcript
❌ Dùng gate thay ask (hoặc ngược lại)
❌ Để hàng chục wt merged tồn vô hạn không comment / không dọn (trần ≤8 sống)
❌ Automation merge/deploy/store ngoài ủy quyền

✅ create/set --issue/--pr/--comment trước coding
✅ task-create --deps → task-list --ready → worker-start wave
✅ gate cho quyết định nhánh; ask cho câu worker
✅ worktree ps + rm khi merged và không còn consumer
```
