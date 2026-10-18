# 10 — Probe: IDE Composer / Cursor Task auto-hooks → ledger

**Ngày:** 2026-10-18 · Worktree: `Agent-monitor` (hooks from PR #461 + local probe fixes)  
**Dispatch probe:** `ctx_ide_composer_probe_001`

## Verdict

| Tiêu chí | Kết quả |
| -------- | ------- |
| Orca `agent launch` mở **structured Composer chat** | **FAIL** — luôn `outcome.kind=terminal` (`agent_without_structured_session`) |
| Auto `stop` / `afterAgentResponse` fire trên **Cursor Task (IDE subagent)** | **PASS (ít nhất 1 lần)** — `conversation_id=074656cc-…` ghi `join_missing` ×2 trong `.orca-metrics/cursor-hooks.log` |
| Auto hook → `cursor.turn` **có tokens** (join sẵn trước stop) | **CHƯA PASS end-to-end** trong session này (race join; Task sau đó không tái fire hook vào log) |
| Ingest + join khi hook chạy | **PASS** — CLI/sim với join sẵn append `cursor.turn` + tokens |

## Evidence chi tiết

### A. Orca không spawn Composer

```text
orca agent launch --agent cursor --worktree current --prompt "…"
→ receipt.mode=terminal
→ preferred=structured
→ reason=agent_without_structured_session
```

### B. IDE Task #1 — hook **có** fire

- Task agent id: `c6c768db-d0fb-4905-bab8-6ce5aa4a04e3`
- Hook `conversation_id`: `074656cc-dffb-4311-b5b6-2c2a90659c5f` (≠ agent id folder)
- Log: `join missing for conversation_id=074656cc-…` xuất hiện **hai lần** (stop + afterAgentResponse)
- Join lúc đó **chưa** có → không thành `cursor.turn` tự động

### C. IDE Task #2+ / background Task

- `fc20b4f7…`, `1a73847f…`, `3b261179…` tạo transcript nhưng **không** thêm dòng mới vào `cursor-hooks.log`
- Kết luận: fire không ổn định trên mọi Task subagent; không dùng làm SoT duy nhất

### D. Pipeline đúng khi hook chạy + join có

- Sau `record-join` cho `074656cc…`, stdin sim `stop` với tokens → `appended: true`, `token_source=hooks`

### E. Cải tiến đã thêm khi probe (chưa merge)

- `agent-metrics-cursor-turn.sh`: retry ingest ~1.2s khi `join_missing`
- `agent-metrics-auto-join.sh` + `auto-join-from-hook.mjs` trên `beforeSubmitPrompt` + file `.orca-metrics/active-dispatch.json`

## Cách tái hiện PASS đầy đủ (Composer UI)

1. Trong worktree này, đảm bảo `.orca-metrics/active-dispatch.json` có `dispatch_id` + `role_id`.
2. Mở **Composer / Agent Chat** (structured UI, không phải `cursor-agent` terminal Orca).
3. Gửi một message ngắn (`ping`).
4. Kiểm tra:

```bash
rg '"event": "cursor.turn"' .orca-metrics/role-dispatch.jsonl | tail
tail .orca-metrics/cursor-hooks.log
pnpm agent-metrics:rollup
```

Kỳ vọng: `beforeSubmitPrompt` auto-join → `stop` append `cursor.turn` với `input_tokens`/`output_tokens` không-null.

## Khuyến nghị

1. Coi **auto-hook FIRE trên IDE** là đã chứng minh (074656cc).
2. Để fleet Orca terminal: giữ CLI ingest / proxy wall-clock; không chờ Composer.
3. Merge retry + auto-join `beforeSubmitPrompt` để giảm race.
4. User xác nhận thêm bằng **một** message Composer UI (mục E).
