# DoD — Cursor hooks → ledger (`cursor.turn` join + ingest)

| Field | Value |
| ----- | ----- |
| Reviewer / session | Orca Cursor `reviewer-dod` · terminal `term_195b1b9c-dbbe-4b28-94f3-5c9fe50e54c3` · task `task_fdae3b197e35` · dispatch `ctx_3768e2cca27d` |
| Independence | ≠ implementer BE `ctx_c11674e358b2` + docs/probe workers Run `run_037f1d25830f` |
| Scope | `scripts/agent-role-monitor/**`, `.cursor/hooks.json`, `.cursor/hooks/agent-metrics-cursor-turn.sh`, `docs/ops/AGENT-ROLE-MONITOR.md`, `docs/spikes/agent-role-monitor/09-cursor-hooks-probe.md` (+ synthesis pointer), `package.json` `agent-metrics:*` |
| Commit SHA reviewed | `0cf1dd8a893035d25649622a70b463488e4f31de` (`git rev-parse` trên branch `hangndat/agent-metrics-cursor-hooks`) |
| Author of reviewed SHA | `hangndat <hangndat@gmail.com>` — tip `docs(ops): Cursor hooks→ledger runbook + Orca terminal probe` (includes prior `e141af6` hooks/join/ingest) |
| Architecture impact | Không |
| Verdict | **PASS with known gap** |

## Checks (trên exact SHA)

| Check | Kết quả |
| ----- | ------- |
| `git rev-parse HEAD` | `0cf1dd8a893035d25649622a70b463488e4f31de` |
| `pnpm agent-metrics:test` | **pass** — 5/5 (`smoke.test.mjs`: settle dedupe, CLI E2E, join+`cursor.turn`+generation dedupe, join_missing skip, null token sums) |
| Privacy adversarial (tmp ledger) | **ok** — payload có `text`/`prompt`/`transcript`/`completion`/`response` → ledger `has_secret=false`; `duplicate_generation` skip lần 2 |
| Hook wiring | `.cursor/hooks.json` → `stop` + `afterAgentResponse` → `agent-metrics-cursor-turn.sh` (fail-open, stdout `{}`) |
| Probe honesty | `09-cursor-hooks-probe.md` ghi **FAIL** auto-hook trên Orca `cursor-agent` terminal; CLI stdin smoke **PASS** + không claim PASS hook từ smoke |

## AC checklist (task)

| # | Tiêu chí | Verdict | Evidence |
| - | -------- | ------- | -------- |
| 1 | Tests xanh | **PASS** | `pnpm agent-metrics:test` → 5 pass / 0 fail trên SHA |
| 2 | Privacy — no text/prompt in ledger | **PASS** | `buildCursorTurnEvent` whitelist attrs only; settlement body → `body_length` + `body_sha256_12`; smoke `MUST_NOT_BE_STORED`; adversarial no SECRET_* in JSONL. Hook log nhận stdout/stderr CLI (event đã sanitize), không pipe raw stdin vào file |
| 3 | Join + dedupe | **PASS** | `record-join` idempotent `(conversation_id, dispatch_id)`; `cursor.turn` idempotent `generation_id` (stop + afterAgentResponse cùng gen → 1 row); settle `(dispatch_id, event)` |
| 4 | Probe reflects FAIL auto on Orca terminal | **PASS** (honest) | Probe §4–§7: hook auto **FAIL**; join + CLI wire **PASS**; không crowning token SoT trên terminal worker |
| 5 | CLI path works → PASS with known gap OK | **PASS with known gap** | Spec cho phép; gap = Cursor runtime không gọi `stop`/`afterAgentResponse` trên surface Orca terminal trong cửa sổ probe |

## Findings

### Non-blocking / nit

1. **Hook fire gap (đã document):** Auto ingest trên Orca `cursor-agent` terminal **FAIL** theo probe 09 — giữ `tokens_*=null` / không crowning cost cho surface đó cho đến probe IDE hoặc runtime Cursor ổn định.
2. **`subject` trên `dispatch.settled`:** vẫn slice 240 chars vào attrs (metadata worker_done, không phải prompt). Chấp nhận trong scope privacy AC (no text/prompt/transcript).
3. **Hardcoded PATH prefix** trong `agent-metrics-cursor-turn.sh` (`/Users/admin/.local/bin`…) — host-local; fail-open vẫn OK cho agent loop.

### Không phát hiện

- Không lưu prompt/transcript/completion vào event ledger.
- Không coerce token thiếu thành `0` (giữ `null` trong rollup).
- Không sửa `apps/api|web|mobile` trong diff branch vs `main`.

## Known gaps (chấp nhận)

| Gap ID | Mô tả | Điều kiện chấp nhận |
| ------ | ----- | ------------------- |
| G-ORCA-TERMINAL-HOOKS | `stop` / `afterAgentResponse` không auto-ingest trên Orca `cursor-agent` terminal (probe 09) | CLI join+ingest verified; docs/runbook ghi gap; không claim token SoT từ hooks trên surface đó |
| G-CURSOR-TOKEN-NULL | Token thiếu / hook miss → rollup `null` | Cấm crowning cost; cấm ghi `0` giả |

## Verdict rationale

Branch đạt AC tooling: tests xanh trên exact SHA; privacy whitelist + smoke; join/dedupe đúng; probe **thành thật** FAIL auto-hook terminal và PASS CLI path.  
Vì auto-hook trên surface worker Orca vẫn FAIL (gap có chủ đích, không nuốt acceptance), verdict = **PASS with known gap** — không **PASS** tuyệt đối và không **FAIL** (CLI path đủ theo task).

## Merge / Project note

Reviewer **không** merge và **không** đặt Project `Hoàn thành`. Coordinator quyết định board / follow-up IDE probe nếu cần đóng G-ORCA-TERMINAL-HOOKS.
