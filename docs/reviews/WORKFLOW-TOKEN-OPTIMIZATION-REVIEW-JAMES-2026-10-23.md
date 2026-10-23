# Review DoD — workflow telemetry/lifecycle (James)

Run `run_2caf6c29acd4` · Reviewer James (`reviewer-dod`) · dispatch `ctx_2bd49da1526c` · độc lập implementer (coordinator Codex + Composer `ctx_8378173aad65`, `ctx_fbd091fd2a48`).

**Tóm tắt (≤3 câu):** Đã đọc diff in-scope trên base `8a222cd84e443d4acb17a829d018d62a20d122fd` và working tree chưa commit, chạy `pnpm agent:workflow:test` (64/64), và tái hiện độc lập F1/F2 trong fixture tạm. Prefix-hash append-only, ledger telemetry append-only, quyền 0600/0700, và contract `start`/settle proven-run khớp AC; hai lỗi chặn merge F1 (release sau collect thất bại) và F2 (`includes` worktree sibling) vẫn còn. F3–F5 xác nhận nhẹ, không chặn merge nếu coordinator chấp nhận gap metadata/hook.

**Verdict:** **FAIL** (local working-tree review — không phải exact-SHA merge DoD).

| Trường | Giá trị |
| --- | --- |
| Base commit | `8a222cd84e443d4acb17a829d018d62a20d122fd` |
| Đối tượng duyệt | Base + **working tree chưa commit** |
| Architecture impact | Không (tooling local) |
| Evidence gốc | [WORKFLOW-TOKEN-OPTIMIZATION-2026-10-23.md](WORKFLOW-TOKEN-OPTIMIZATION-2026-10-23.md) |
| Review trước | [WORKFLOW-TOKEN-OPTIMIZATION-INDEPENDENT-REVIEW-2026-10-23.md](WORKFLOW-TOKEN-OPTIMIZATION-INDEPENDENT-REVIEW-2026-10-23.md) (FAIL F1–F5) |
| Fix rounds (findings này) | 0/2 |

## Phạm vi

`scripts/agent-workflow-run.mjs`; `scripts/agent-role-monitor/{telemetry.mjs,cli.mjs,auto-join-from-hook.mjs}`; `scripts/agent-role-monitor/lib/{usage.mjs,provider-baseline.mjs,provider-file.mjs,telemetry-ledger.mjs,ledger.mjs}`; `.cursor/hooks/agent-metrics-{auto-join,cursor-turn}.sh`.

Ngoài scope: `agent-workflow-guard`, `agent-evidence`, `agent-review-publish`, rules/docs.

## Checks

| Lệnh | Kết quả |
| --- | --- |
| `pnpm agent:workflow:test` | **64/64 PASS** (2026-10-23, working tree) |
| Fixture F1/F2/F5 (temp, đã xoá) | F1/F2 tái hiện như bảng dưới; F5 `join_ambiguous=true` khi 0 active worker |
| `git rev-parse HEAD` | `8a222cd84e443d4acb17a829d018d62a20d122fd` |

Bộ test không có case collect fail + `--release` (F1) hay sibling worktree cùng tiền tố (F2).

## AC (đối chiếu)

| AC | Kết luận |
| --- | --- |
| Baseline prefix-hash chịu append, chặn sửa/cắt | **Đạt** — test `provider boundary accepts real appends…`; `applyProviderBaseline` + `providerPrefixHash` |
| Ledger append-only không mất event | **Đạt** — `upsertTelemetryCollectEvent` append thay vì read-modify-write |
| `start` không tự retry | **Đạt** — `agent-workflow-run.mjs` + test `start_not_ready` / `observe_existing_dispatch_do_not_restart` |
| Settle chỉ collect khi dispatch completed/failed đúng run; collect trước release **không mất dữ liệu** | **Một phần** — thứ tự gọi đúng; **F1** release vẫn chạy khi collect fail → mất telemetry terminal fallback |
| Join chỉ khi đúng một live dispatch khớp ID | **Một phần** — logic đúng khi list worker chính xác; **F2** làm `active.length !== 1` nhầm → join/fallback tắt |
| `.orca-metrics` 0600 / dir 0700 | **Đạt** — `telemetry-ledger.mjs`, `ledger` test, hook `umask 077` + `chmod 600` |

## Findings

| ID | Mức | Chặn merge | Path | Bằng chứng / tái hiện | Điều kiện đóng |
| --- | --- | --- | --- | --- | --- |
| **F1** | High | **Có** — vi phạm AC “collect trước release không mất dữ liệu” | `scripts/agent-workflow-run.mjs:82-88` | `settle --release` với telemetry `collect` exit 1 → `telemetryCollected:false`, `release:"released"`, `worker-release` vẫn trong call log (fixture độc lập 2026-10-23). Code: release block chạy trước `if(!collected.ok)process.exitCode=1`. | Không gọi `worker-release` khi `!collected.ok`; `nextAction` retry; test regression. |
| **F2** | High | **Có** — join/fallback sai trên worktree sibling | `scripts/agent-role-monitor/lib/usage.mjs:63-67` | Worker `uuid::/tmp/wt/proj` + `uuid::/tmp/wt/proj-2` → `isWorktreeDispatchAmbiguous('/tmp/wt/proj', …, 'ctx1') === true` dù chỉ một dispatch trên `proj` (fixture 2026-10-23). `ws.includes(resolved)` khớp `proj` trong `proj-2`. | So path sau `::`, normalize `===`; test sibling prefix. |
| **F3** | Low | Không | `usage.mjs:49-51`, `agent-metrics-cursor-turn.sh:32-44` | **Đồng ý** review trước: `execFileSync` không `timeout`; hook retry 6× trên `join_missing` (F2 cũng trả ambiguous → `join_missing`). | Timeout ~3s cho hook path; không retry khi ambiguous. |
| **F4** | Low | Không | `usage.mjs:359-364` | **Đồng ý**: `stat` → full `parse` → `providerPrefixHash` có cửa sổ ghi đồng thời; `task_delta` có thể hơi thấp, prefix check vẫn PASS. | Single-buffer read cho hash + parse + offset. |
| **F5** | Low | Không | `usage.mjs:635` | **Đồng ý** thiếu `dispatchId`; **bổ sung**: `worker-list` rỗng (0 active) → `isWorktreeDispatchAmbiguous` = **true** → mọi `telemetry.collect` ghi `join_ambiguous:true` sau settle (fixture 2026-10-23). Chỉ metadata, không chặn collect. | Truyền `dispatchId`; hoặc coi 0 active là không ambiguous khi đang collect dispatch đã proven settled. |

### Revalidation F1–F5 (so với review độc lập trước)

| ID | Kết luận reviewer James |
| --- | --- |
| F1 | **Xác nhận** — bác bỏ không có căn |
| F2 | **Xác nhận** — bác bỏ không có căn |
| F3 | **Xác nhận** (nhẹ) |
| F4 | **Xác nhận** (nhẹ) |
| F5 | **Xác nhận** + bổ sung hành vi 0 active worker |

## Đạt (không finding mới F6+)

- Thread mismatch / counter monotonic / tamper prefix.
- `upsertTelemetryCollectEvent` idempotent theo `collect_key` mà vẫn append-only.
- Hooks fail-open; auto-join truyền `expectedDispatchId`.
- Settle từ chối dispatch chưa `completed`/`failed` hoặc sai `runId` (test có).

## Limitations

- Không exact-SHA: working tree có thể đổi sau báo cáo; merge DoD cần revalidate trên commit đầy đủ.
- Không gọi Orca/GitHub production trong review; F1/F2/F5 dùng fake CLI trong `/tmp`.
- `join_ambiguous` trên collect là cờ báo cáo; chưa đo impact quota thật trên Composer terminal fallback.
- F3 chưa đo wall-clock hook vs Cursor 15s limit trong môi trường Orca chậm.

## Revalidate 85e98fc1

Đã revalidate trên exact SHA `85e98fc19b62b10891320f350c822202cd63ded6` (trước `8a222cd84e443d4acb17a829d018d62a20d122fd`), đọc diff in-scope và chạy `pnpm agent:workflow:test` (66/66 PASS). F1/F2 đóng theo AC: `settle --release` bỏ `worker-release` khi collect fail (test `failed collect with --release skips worker-release`) và `resolvedWorkspacePath` + equality loại sibling cùng tiền tố (test `worktree match uses exact resolved path not prefix`). **Verdict: PASS** (exact-SHA local; branch chưa push).

| Lệnh | Kết quả |
| --- | --- |
| `git rev-parse HEAD` | `85e98fc19b62b10891320f350c822202cd63ded6` |
| `pnpm agent:workflow:test` | **66/66 PASS** (2026-10-23) |

| ID | Trạng thái | Ghi chú |
| --- | --- | --- |
| F1 | **Đã xác minh** | `agent-workflow-run.mjs` gán `skipped_collect_failed` / `retry_collect_before_release`; không gọi release khi `!collected.ok`. |
| F2 | **Đã xác minh** | `usage.mjs` `resolvedWorkspacePath` + `===`; sibling `proj` / `proj-2` không ambiguous cho `ctx1`. |
| F3 | **Mở** (nhẹ) | Không đổi trong lượt fix; hook vẫn không timeout cứng. |
| F4 | **Mở** (nhẹ) | Không đổi; race read provider file vẫn có thể lệch `task_delta`. |
| F5 | **Đã xác minh** (phần chặn) | `collectTelemetry` truyền `dispatchId` vào `isWorktreeDispatchAmbiguous`; metadata `join_ambiguous:true` khi 0 active worker sau settle vẫn có thể xảy ra (chấp nhận gap nhẹ). |

**Findings mới F6+:** Không.

**Limitations:** Chỉ review commit local; không push/CI GitHub trên SHA này; không chạy Orca production; `workspace.id` rỗng sau `::` vẫn resolve về cwd — chưa có test regression riêng.
