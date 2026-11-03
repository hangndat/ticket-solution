# Agent Role Monitor (MVP)

Local append-only JSONL ledger for **Role catalog × Orca Dispatch** metrics.

- **SoT:** `.orca-metrics/role-dispatch.jsonl` (gitignored)
- **Schema:** v1 events — `dispatch.opened`, `dispatch.settled`, `join.conversation`, `cursor.turn`, optional `host.sample`, `dispatch.heartbeat`
- **No product DB / Redis SoT** — tooling only under `scripts/agent-role-monitor/`
- **Project hooks:** `.cursor/hooks.json` → `stop` / `afterAgentResponse` → `.cursor/hooks/agent-metrics-cursor-turn.sh` (does **not** touch `~/.cursor/hooks.json`)

## Quick start

```bash
# Record dispatch open (role_id required)
pnpm agent-metrics:opened -- \
  --dispatch-id ctx_abc --task-id task_1 --run-id run_1 --role-id backend

# Join Cursor conversation_id ↔ Dispatch (before/while agent runs)
pnpm agent-metrics:join -- \
  --conversation-id conv_abc --dispatch-id ctx_abc \
  --task-id task_1 --run-id run_1 --role-id backend

# Ingest worker_done settlement (stdin JSON; idempotent on dispatch_id + event)
echo '{
  "dispatchId":"ctx_abc",
  "taskId":"task_1",
  "runId":"run_1",
  "roleId":"backend",
  "outcome":"succeeded",
  "subject":"done"
}' | pnpm agent-metrics:ingest

# Or from file
pnpm agent-metrics:ingest -- --file /tmp/settlement.json

# Ingest Cursor hook turn (stdin JSON from stop | afterAgentResponse)
echo '{
  "hook_event_name":"stop",
  "conversation_id":"conv_abc",
  "generation_id":"gen_1",
  "model":"composer",
  "status":"completed",
  "input_tokens":100,
  "output_tokens":20,
  "cache_read_tokens":80,
  "cache_write_tokens":5
}' | pnpm agent-metrics:ingest-cursor-turn

# Optional host sample (ps RSS/CPU)
pnpm agent-metrics:host-sample -- --pid $$ --dispatch-id ctx_abc --role-id backend

# Rollup by role (stdout + optional --out) — includes tokens_*_sum when present
pnpm agent-metrics:rollup
pnpm agent-metrics:rollup -- --out .orca-metrics/by_role.json
```

Override ledger path with `--ledger PATH` or `ORCA_METRICS_LEDGER`.

## npm scripts

| Script | Command |
| ------ | ------- |
| `agent-metrics:opened` | `record-opened` |
| `agent-metrics:join` | `record-join` |
| `agent-metrics:ingest` | `ingest-settlement` |
| `agent-metrics:ingest-cursor-turn` | `ingest-cursor-turn` |
| `agent-metrics:rollup` | `rollup` |
| `agent-metrics:host-sample` | `host-sample` |
| `agent-metrics:test` | `node --test` smoke |

## Cursor hooks (project)

| Hook | Script | Behavior |
| ---- | ------ | -------- |
| `stop` | `.cursor/hooks/agent-metrics-cursor-turn.sh` | **Source of truth** for turn tokens → `ingest-cursor-turn` |
| `afterAgentResponse` | same script | Accepted; **skipped** if `generation_id` already ingested |

Hook log (best-effort): `.orca-metrics/cursor-hooks.log`. Fail-open (never blocks the agent).

Ledger và hai hook tạo `role-dispatch.jsonl` / `cursor-hooks.log` với quyền 0600, đồng thời siết file cũ về 0600 trước khi ghi; event trùng cũng sửa quyền ledger. Hook bỏ ghi log nếu không thể bảo đảm quyền này. Không mặc định mọi artifact cũ dưới `.orca-metrics/` đều private.

### Join missing

If there is no `join.conversation` for the hook’s `conversation_id` (and no join via `attrs.dispatch_id` / `dispatch_id`), `ingest-cursor-turn` **skips** the row (exit 0), prints a clear message on **stderr**, and returns JSON `{ reason: "join_missing" }`. Call `record-join` when the conversation↔dispatch map is known (coordinator/worker probe — not spike `09`).

## Idempotency

| Event | Key |
| ----- | --- |
| `dispatch.opened` / `dispatch.settled` | `(dispatch_id, event)` |
| `join.conversation` | `(conversation_id, dispatch_id)` |
| `cursor.turn` | `generation_id` |
| `host.sample` / `dispatch.heartbeat` | always append (time series) |

## Telemetry (`telemetry.mjs`)

Separate metadata ledger: `.orca-metrics/telemetry-metadata.jsonl` (gitignored, **mode 0600**). Role/dispatch metrics ledger above stays unchanged.

```bash
# Collect transcript structure + optional Codex provider JSONL (uses ORCA_CLI_COMMAND)
node scripts/agent-role-monitor/telemetry.mjs collect \
  --dispatch-id ctx_abc --role-id backend --run-id run_1 \
  --provider-file /path/to/codex-events.jsonl --thread-id thread_abc

# Provider-only (no Orca dispatch): JSONL + thread id
node scripts/agent-role-monitor/telemetry.mjs collect \
  --role-id backend --provider-file /path/to/codex-events.jsonl --thread-id thread_abc

# Account allowance snapshot (codex app-server account/rateLimits/read — no inference)
node scripts/agent-role-monitor/telemetry.mjs snapshot --out .orca-metrics/account-snap.json

# Report for a run (optional baseline); shared allowance deltas in percentage points only
node scripts/agent-role-monitor/telemetry.mjs report --run-id run_1 --baseline-run-id run_0
```

Task token delta cần `snapshot-provider --provider-file PATH --thread-id ID --out BEFORE.json` **trước** boundary, sau đó `collect ... --baseline-file BEFORE.json`. Không có boundary thì `task_delta: null`; cumulative session không phải chi phí task. Baseline chấp nhận append và xác minh SHA-256 prefix; thread/prefix/counter mismatch bị từ chối. `cachedInput/input` là tỷ lệ token cached, không phải % quota tiết kiệm. Report so sánh cần `--comparison-key` cho cùng workload/model/provider và task boundary; xem [workflow vận hành](../../docs/agents/workflow-evidence-telemetry.md).

Collect theo dispatch xác minh `worker-show` (cả receipt flat và nested): dispatch/run/task/workspace, kể cả worker đã release. Không dùng số worker active để phủ nhận binding lịch sử; auto-join từ hook vẫn yêu cầu một worker live duy nhất. Sai dispatch/run bị từ chối; thiếu workspace hoặc khác worktree giữ `join_ambiguous: true`. Output có `join_source`, `join_reason` và `token_delta_reason`; `provider_usage_not_supplied` không có nghĩa zero token. Cursor đứng yên ở trang rỗng/cuối không phải cycle; cycle thật và thay đổi nguồn vẫn được đánh dấu.

Wrapper start/settle và collector dùng `--full`: concise receipt không chứa `launch.effective`, không được xem việc lược field là host không biết model. Collector lấy route từ full receipt và tìm nguồn usage qua Orca search scoped worktree + dispatch, bắt buộc khớp `structuredSession.sessionId` với `dispatch.processIncarnation`; không chọn session chỉ vì có nhắc dispatch ID. Codex đọc counter JSONL với thread identity đã xác minh; OpenCode đọc đúng hàng `session_v2` bằng SQLite readonly, chỉ các cột counter/directory/ID. Không đọc auth hoặc lưu nội dung hội thoại. Thiếu index, nhiều nguồn, sai identity hoặc schema không hỗ trợ giữ reason cụ thể và null.

`tokens_session_total`/report `tokens_provider_session` là tổng session provider, **không phải** task delta. OpenCode input/cache/reasoning giữ semantics gốc; không cộng chúng hoặc so trực tiếp với Codex khi chưa chuẩn hóa. Task delta vẫn cần baseline; follow-up/reuse không được tự gán cả session cho một task. Các field `effective_route`, `requested_route`, `provider_usage_reason`, `usage_scope` cho biết nguồn và phạm vi evidence.

| Command | Events / output |
| ------- | ---------------- |
| `collect` | `telemetry.collect` — structural transcript rows only; `sourceExact` / `contentComplete` / `clipping` from worker-read; Cursor terminal fallback **never** claims complete |
| `snapshot` | `telemetry.account_snapshot` — whitelisted `plan`, `usedPercent`, `windowDurationMins`, `resetsAt`, `timestamp`; `accountId` → one-way hash only |
| `report` | stdout JSON — compatible-run comparison only; no per-dispatch quota attribution unless proven |

Env: `ORCA_CLI_COMMAND`, `ORCA_TELEMETRY_LEDGER`, `CODEX_TELEMETRY_APP_SERVER_FIXTURE` (tests), `CODEX_CLI_COMMAND`.

Tests: `node --test scripts/agent-role-monitor/telemetry.test.mjs` (+ existing `smoke.test.mjs`).

## Privacy

Ledger stores IDs, counters, outcome enums, model ids — **not** prompts, completion text, or transcript bodies. Settlement body is stored as length + short hash only. Hook ingest never copies `text` / `prompt` / `transcript_path`.

## Rollup tokens

`rollup` sums `tokens_in_sum`, `tokens_out_sum`, `tokens_cache_read_sum`, `tokens_cache_write_sum` per `role_id` from `cursor.turn` attrs. If every turn has `null` for a field, the sum stays `null` (missing ≠ zero).
