# Agent Role Monitor (MVP)

Local append-only JSONL ledger for **Role catalog × Orca Dispatch** metrics.

- **SoT:** `.orca-metrics/role-dispatch.jsonl` (gitignored)
- **Schema:** v1 events — `dispatch.opened`, `dispatch.settled`, optional `host.sample`, `dispatch.heartbeat`
- **No product DB / Redis SoT** — tooling only under `scripts/agent-role-monitor/`

## Quick start

```bash
# Record dispatch open (role_id required)
pnpm agent-metrics:opened -- \
  --dispatch-id ctx_abc --task-id task_1 --run-id run_1 --role-id backend

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

# Optional host sample (ps RSS/CPU)
pnpm agent-metrics:host-sample -- --pid $$ --dispatch-id ctx_abc --role-id backend

# Rollup by role (stdout + optional --out)
pnpm agent-metrics:rollup
pnpm agent-metrics:rollup -- --out .orca-metrics/by_role.json
```

Override ledger path with `--ledger PATH` or `ORCA_METRICS_LEDGER`.

## npm scripts

| Script | Command |
| ------ | ------- |
| `agent-metrics:opened` | `record-opened` |
| `agent-metrics:ingest` | `ingest-settlement` |
| `agent-metrics:rollup` | `rollup` |
| `agent-metrics:host-sample` | `host-sample` |
| `agent-metrics:test` | `node --test` smoke |

## Idempotency

`dispatch.opened` and `dispatch.settled` skip append when the same `(dispatch_id, event)` already exists. `host.sample` / `dispatch.heartbeat` always append (time series).

## Privacy

Ledger stores IDs, counters, outcome enums — not prompts/transcripts. Settlement body is stored as length + short hash only.
