# Review độc lập — phần sửa cuối của coordinator (workflow telemetry)

Verdict: **FAIL** — 2 finding chặn merge (F1, F2), 3 finding nhẹ (F3–F5).

Reviewer: Claude Code (Opus 5.5), khác implementer (coordinator Codex của run `run_2caf6c29acd4`).
Base HEAD `8a222cd84e443d4acb17a829d018d62a20d122fd` + working tree **chưa commit**. Đây **không phải verdict exact-SHA**; sau khi có commit cần revalidate theo SHA đó. Không đóng gate merge/DoD.

Báo cáo gốc: [WORKFLOW-TOKEN-OPTIMIZATION-2026-10-23.md](WORKFLOW-TOKEN-OPTIMIZATION-2026-10-23.md).

## Phạm vi

Các phần báo cáo gốc ghi "đang chờ reviewer độc lập":

- Prefix hash/baseline: `scripts/agent-role-monitor/lib/provider-baseline.mjs`, `lib/provider-file.mjs`, `lib/usage.mjs` (`applyProviderBaseline`, `snapshotProviderBaseline`).
- Telemetry append-only: `lib/telemetry-ledger.mjs`.
- Contract lifecycle/report: `scripts/agent-workflow-run.mjs`, `scripts/agent-role-monitor/telemetry.mjs`.
- Join: `auto-join-from-hook.mjs`, `cli.mjs` (`ingest-cursor-turn`), `lib/usage.mjs` (`isWorktreeDispatchAmbiguous`).
- Quyền ledger/hook: `lib/ledger.mjs`, `.cursor/hooks/agent-metrics-{auto-join,cursor-turn}.sh`.

Ngoài phạm vi: `agent-workflow-guard`, `agent-evidence`, `agent-review-publish` (đã có review riêng [AGENT-WORKFLOW-GUARD-LOCAL-REVIEW.md](AGENT-WORKFLOW-GUARD-LOCAL-REVIEW.md)), rules/docs.

## Kiểm tra đã chạy

- `pnpm agent:workflow:test`: **64/64 PASS** trên working tree. Hai lỗi chặn merge dưới đây không được bộ test phủ.
- Dựng lại F1, F2 bằng fixture `orca`/telemetry giả trong thư mục tạm (đã xoá sau khi chạy); không gọi Orca hay GitHub thật.

## Findings

### F1 — Chặn merge: `settle --release` vẫn giải phóng terminal khi collect thất bại

`scripts/agent-workflow-run.mjs:82`

- Dựng lại: telemetry `collect` trả exit 1 → output `telemetryCollected:false`, `release:"released"`; thứ tự gọi `worker-show → collect → snapshot → worker-release`.
- Tác động: Cursor worker chỉ có nguồn terminal buffer (`terminal_fallback`). Release xong thì không collect lại được, mất telemetry vĩnh viễn. Cam kết "collect trước release" chỉ đúng về thứ tự gọi, không bảo toàn dữ liệu.
- Yêu cầu sửa: khi `!collected.ok` thì không release; trả `nextAction` (ví dụ `retry_collect_before_release`). Thêm test collect lỗi + `--release` ⇒ không có lệnh `worker-release`.

### F2 — Chặn merge: lọc worker theo worktree bằng `includes` khớp nhầm worktree cùng tiền tố

`scripts/agent-role-monitor/lib/usage.mjs:66`

- Dựng lại: worktree `/tmp/wt/proj` có đúng một dispatch `ctx1`; thêm worker active ở `/tmp/wt/proj-2` ⇒ `isWorktreeDispatchAmbiguous('/tmp/wt/proj', env, 'ctx1')` trả `true`.
- Tác động: auto-join và fallback ingest bị tắt im lặng, token Cursor không được gán. Workspace Orca hay trùng tiền tố (`Codex-Pro-Integrate`, `Codex-Pro-Integrate-2`). Không gán nhầm sang worker khác, nhưng làm hỏng đường join mà báo cáo gốc nói đã sửa.
- Yêu cầu sửa: `projection.workspace.id` trên host thật có dạng `<uuid>::<abs path>` (đã thấy qua `worker-list`), nên tách phần path sau `::` rồi so sánh đường dẫn đã chuẩn hoá (`===`). Thêm test sibling cùng tiền tố.

### F3 — Nhẹ: lời gọi Orca trong hook không có timeout, có thể vượt giới hạn hook

`scripts/agent-role-monitor/lib/usage.mjs:51`, `.cursor/hooks/agent-metrics-cursor-turn.sh`

`orcaJson` dùng `execFileSync` không có `timeout`; `worker-list --include-remote` có thể chậm. Hook `stop` giới hạn 15s và retry tối đa 6 lần khi gặp `join_missing`, mà nhánh ambiguous (F2) cũng trả `join_missing` ⇒ có thể gọi `orca` 6 lần mỗi lần stop. Hook fail-open nhưng sẽ bị Cursor kill và mất log. Đề xuất: timeout khoảng 3s cho `orcaJson` khi gọi từ hook; không retry khi lý do là ambiguous.

### F4 — Nhẹ: baseline có thể lệch giữa `byte_offset` và counter

`scripts/agent-role-monitor/lib/usage.mjs:359-363`

`snapshotProviderBaseline` lấy `stat` trước, `parse` đọc lại cả file, rồi mới hash theo size cũ. Nếu session vẫn đang ghi tiếp (coordinator đo chính session của mình), `cumulative` có thể ứng với byte nằm sau `byte_offset`; `task_delta` hơi thấp hơn thực tế trong khi prefix check vẫn PASS. Đề xuất: đọc file vào một buffer duy nhất rồi dùng buffer đó cho cả hash, parse và offset.

### F5 — Nhẹ: `join_ambiguous` khi collect không truyền dispatch kỳ vọng

`scripts/agent-role-monitor/lib/usage.mjs:635`

`isWorktreeDispatchAmbiguous(root, env)` không truyền `dispatchId`, khác với hai chỗ gọi trong hook. Chưa xác minh worker đã hoàn tất mà chưa release có còn `terminalState: 'active'` không; nếu không, mọi lần settle đều bị đánh dấu ambiguous. Đề xuất: truyền `dispatchId` cho nhất quán.

## Đạt

- Prefix hash đọc theo `byte_offset`: file ghi thêm vẫn hợp lệ; sửa hoặc cắt phần đầu bị chặn (`baseline_prefix_mismatch`, `baseline_file_truncated`). Thay được identity size/mtime cũ.
- Kiểm thread mismatch/conflict và counter không giảm.
- `upsertTelemetryCollectEvent` chỉ ghi thêm; report lấy bản mới nhất theo dispatch/thread, tránh mất dữ liệu do đọc-sửa-ghi khi nhiều worker cùng ghi.
- Quyền 0600/0700: ledger (`fchmod` cả file cũ), hook (`umask 077`, `touch` + `chmod`), receipt và baseline (`wx`, không ghi đè nếu không có `--overwrite`).
- `start` không tự retry khi start lỗi/không rõ kết quả; `settle` yêu cầu đúng run và trạng thái `completed`/`failed`; quota lỗi được ghi là `unavailable`, không thành 0.

## Review thứ hai và checkpoint

- Reviewer James (`ctx_2bd49da1526c`, Cursor `composer-2.5`) review độc lập: **FAIL**, xác nhận F1–F5, không có finding mới — [báo cáo](WORKFLOW-TOKEN-OPTIMIZATION-REVIEW-JAMES-2026-10-23.md). Báo cáo đó ghi "Fix rounds 0/2" do spec của coordinator; bộ đếm đúng theo công việc là **2/2 lượt tự động + ngoại lệ đã dùng** (xem báo cáo gốc).
- **Quyết định 2026-10-23 (user duyệt):** mở thêm **1 lượt sửa ngoại lệ**, không reset bộ đếm. Owner: Composer fix-worker, coordinator commit. Scope: F1, F2 + regression test; F3–F5 chỉ sửa nếu nằm trong cùng hàm và không mở rộng diff. Điều kiện dừng: James revalidate trên exact SHA; còn FAIL thì giữ `Bị chặn` và báo user, không giao thêm lượt.

- **Kết quả lượt ngoại lệ:** Kazu · tooling (`ctx_aa0e33b32ebf`) sửa F1, F2, F5 + 2 regression test → coordinator commit `85e98fc19b62b10891320f350c822202cd63ded6` → James (`ctx_eb27a62c35ae`) revalidate **PASS** trên SHA đó. F3, F4 còn mở (nhẹ, không chặn). Follow-up nhẹ: `workspace.id` rỗng resolve về cwd, chưa có test (không gán nhầm vì vẫn so dispatch ID).

## Điều kiện revalidate

1. Implementer sửa F1, F2 (F3–F5 tuỳ chọn, nếu bỏ qua thì ghi lý do), thêm regression test tương ứng, rồi commit.
2. Reviewer khác implementer kiểm tra trên **full SHA** mới: chỉ các findings và phần diff liên quan, chạy lại `pnpm agent:workflow:test`.
3. Ghi verdict gắn SHA vào file này hoặc vào comment PR.
