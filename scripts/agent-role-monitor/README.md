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

### Join missing

If there is no `join.conversation` for the hook’s `conversation_id` (and no join via `attrs.dispatch_id` / `dispatch_id`), `ingest-cursor-turn` **skips** the row (exit 0), prints a clear message on **stderr**, and returns JSON `{ reason: "join_missing" }`. Call `record-join` when the conversation↔dispatch map is known (coordinator/worker probe — not spike `09`).

## Idempotency

| Event | Key |
| ----- | --- |
| `dispatch.opened` / `dispatch.settled` | `(dispatch_id, event)` |
| `join.conversation` | `(conversation_id, dispatch_id)` |
| `cursor.turn` | `generation_id` |
| `host.sample` / `dispatch.heartbeat` | always append (time series) |

## Privacy

Ledger stores IDs, counters, outcome enums, model ids — **not** prompts, completion text, or transcript bodies. Settlement body is stored as length + short hash only. Hook ingest never copies `text` / `prompt` / `transcript_path`.

## Rollup tokens

`rollup` sums `tokens_in_sum`, `tokens_out_sum`, `tokens_cache_read_sum`, `tokens_cache_write_sum` per `role_id` from `cursor.turn` attrs. If every turn has `null` for a field, the sum stays `null` (missing ≠ zero).
