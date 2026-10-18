# 09 — Probe: Cursor hooks → `cursor.turn` (Orca terminal)

**Spike:** [Agent Role Effectiveness Monitor](./README.md)  
**Role:** `product-ba` · Architecture impact: **Không** (probe evidence)  
**Ngày:** 2026-10-18 · Host: darwin (Orca `1.4.229`)  
**Dispatch:** `ctx_aa0222a159fc` · Task: `task_2d2a26bb54f9` · Run: `run_037f1d25830f`  
**Branch tip (hooks wired):** `e141af6` — `feat(tooling): Cursor hooks join + cursor.turn token ingest`  
**Không:** sửa `scripts/**` · không commit ledger/sample · không post Slack/GitHub

---

## 1. Mục tiêu probe

Sau khi BE merge hooks (`stop` / `afterAgentResponse` → `.cursor/hooks/agent-metrics-cursor-turn.sh`):

1. `record-join` cho **chính** Dispatch worker này (lấy `conversation_id`).
2. Chạy ≥1 agent turn trên môi trường thực tế, rồi kiểm tra ledger có `cursor.turn` với tokens **không-null** đến từ hook tự động — hoặc ghi **FAIL**.
3. Ghi evidence: IDE vs terminal Orca, lệnh, excerpt JSON đã redact, kết luận khả thi.

---

## 2. Môi trường quan sát

| Trường | Giá trị |
| ------ | ------- |
| Surface | **Orca terminal agent** (`CURSOR_INVOKED_AS=cursor-agent`), **không** Composer IDE chat |
| `CURSOR_AGENT` | `1` |
| `ORCA_TERMINAL_HANDLE` | `term_f60a6e92-7430-453f-a0df-cc8dda679926` |
| `ORCA_APP_VERSION` | `1.4.229` |
| Project hooks | `.cursor/hooks.json` — `stop` + `afterAgentResponse` → `agent-metrics-cursor-turn.sh` |
| Ledger SoT | `.orca-metrics/role-dispatch.jsonl` (gitignored) |
| Hook log kỳ vọng | `.orca-metrics/cursor-hooks.log` (chỉ tạo khi script ingest chạy) |

**Hooks engine sống trên terminal agent:** `sessionStart` / `beforeSubmitPrompt` (CRG) và `preToolUse` (lean-ctx deny native Grep) **có** fire trong cùng session. Kết luận FAIL bên dưới **không** nghĩa “mọi hook chết” — chỉ `stop` / `afterAgentResponse` → metrics ingest.

---

## 3. Cách lấy `conversation_id` + `record-join`

### 3.1 Nguồn ID (không có trong ledger/spool trước probe)

- Ledger / `cursor-hooks.log`: **chưa tồn tại** trước khi worker ghi `record-opened`.
- Hook payload `stop`/`afterAgentResponse`: **không** thấy (script chưa được Cursor gọi — mục 4).
- **Cách lấy được:** biến môi trường session agent:

```bash
echo "$CURSOR_CONVERSATION_ID"
# → 395ae0f7-33f3-4879-bd81-9261dd3e83b5
```

Khớp thư mục transcript: `…/agent-transcripts/<CURSOR_CONVERSATION_ID>/`.

### 3.2 Lệnh join (đã chạy)

```bash
node scripts/agent-role-monitor/cli.mjs record-opened \
  --dispatch-id ctx_aa0222a159fc \
  --task-id task_2d2a26bb54f9 \
  --run-id run_037f1d25830f \
  --role-id product-ba \
  --agent cursor \
  --worktree "$(pwd)"

node scripts/agent-role-monitor/cli.mjs record-join \
  --conversation-id "$CURSOR_CONVERSATION_ID" \
  --dispatch-id ctx_aa0222a159fc \
  --task-id task_2d2a26bb54f9 \
  --run-id run_037f1d25830f \
  --role-id product-ba
```

**Kết quả join:** `ok: true`, `event: join.conversation`, `appended: true`.

---

## 4. Quan sát hook tự động (acceptance chính)

### 4.1 Turn đã chạy

Worker đã thực hiện một turn dài (nhiều tool round: orchestration heartbeat, đọc spike/scripts, `record-opened`/`record-join`, kiểm tra env). Trong suốt cửa sổ quan sát (~23:40–23:43 local):

| Tín hiệu | Kết quả |
| -------- | ------- |
| File `.orca-metrics/cursor-hooks.log` | **Không** tạo |
| Event `cursor.turn` do hook Cursor ghi | **Không** |
| Tokens không-null từ hook tự động | **Không** |

### 4.2 Verdict hook fire

| Tiêu chí | Kết quả |
| -------- | ------- |
| `stop` / `afterAgentResponse` gọi `agent-metrics-cursor-turn.sh` trên **Orca `cursor-agent` terminal** trong probe này | **FAIL** |
| Ledger có `cursor.turn` tokens không-null **từ hook tự động** | **FAIL** |

**Ghi chú giới hạn:** `stop` thường fire khi agent **kết thúc** turn — probe kiểm tra trước `worker_done`, nên có thể miss `stop` cuối session. Tuy nhiên `afterAgentResponse` (đã wire cùng script) cũng **không** để lại log sau nhiều vòng tool; cộng với không có spool payload → coi là **FAIL thực dụng** cho path token-on-terminal-agent.

---

## 5. Smoke CLI (không đếm PASS hook)

Để tách “wire ingest” vs “Cursor gọi hook”, pipe JSON giả lập **một lần** (generation_id cố ý `probe-manual-gen-09`):

```bash
printf '%s\n' '{
  "hook_event_name":"stop",
  "conversation_id":"'"$CURSOR_CONVERSATION_ID"'",
  "generation_id":"probe-manual-gen-09",
  "model":"composer-probe",
  "status":"completed",
  "input_tokens":111,
  "output_tokens":22,
  "cache_read_tokens":80,
  "cache_write_tokens":5,
  "text":"REDACT_DO_NOT_STORE"
}' | node scripts/agent-role-monitor/cli.mjs ingest-cursor-turn
```

| Kiểm tra | Kết quả |
| -------- | ------- |
| `cursor.turn` append sau `join` | **OK** |
| `input_tokens` / `output_tokens` / cache ≠ null | **OK** (111 / 22 / 80 / 5) |
| `token_source` | `hooks` |
| Field `text` **không** vào ledger | **OK** (`REDACT_DO_NOT_STORE` count = 0) |

→ Path join→ingest **khả thi**; thiếu mắt xích là **Cursor runtime không gọi hook** (trên surface này), không phải CLI hỏng.

---

## 6. Excerpt JSON đã redact

Sample gitignored: `.orca-metrics/09-cursor-hooks-probe-sample.jsonl`.

```json
{"v":1,"ts":"2026-10-18T15:41:52.837Z","event":"dispatch.opened","run_id":"run_<redacted>","task_id":"task_<redacted>","dispatch_id":"ctx_<redacted>","role_id":"product-ba","agent":"cursor","issue":null,"attrs":{"worktree":"<repo>"}}
{"v":1,"ts":"2026-10-18T15:41:52.887Z","event":"join.conversation","run_id":"run_<redacted>","task_id":"task_<redacted>","dispatch_id":"ctx_<redacted>","role_id":"product-ba","agent":"cursor","issue":null,"attrs":{"conversation_id":"conv_<redacted>"}}
{"v":1,"ts":"2026-10-18T15:42:48.867Z","event":"cursor.turn","run_id":"run_<redacted>","task_id":"task_<redacted>","dispatch_id":"ctx_<redacted>","role_id":"product-ba","agent":"cursor","issue":null,"attrs":{"conversation_id":"conv_<redacted>","generation_id":"probe-manual-gen-09","model":"composer-probe","input_tokens":111,"output_tokens":22,"cache_read_tokens":80,"cache_write_tokens":5,"token_source":"hooks","hook_event_name":"stop","status":"completed"}}
```

(`cursor.turn` trên là **manual smoke**, không phải hook tự động.)

---

## 7. Kết luận khả thi

| Hạng mục | Verdict | Ý nghĩa vận hành |
| -------- | ------- | ---------------- |
| Join Dispatch ↔ conversation trên Orca terminal | **PASS** | Dùng `CURSOR_CONVERSATION_ID` (env) khi hook payload chưa có |
| CLI `ingest-cursor-turn` + privacy | **PASS** | Tokens ghi được; không lưu `text`/`prompt` |
| Hook `stop`/`afterAgentResponse` tự động trên **terminal Orca `cursor-agent`** | **FAIL** | Không có `cursor-hooks.log` / không có turn tự động trong cửa sổ probe |
| Token SoT per Dispatch từ hooks trên surface worker Orca | **Chưa khả thi** (gap) | Giữ `tokens_*=null` / `token_source=unknown` trên path terminal; thử lại trên **IDE Composer** (cursor chat) nếu cần PASS hooks |

**Khuyến nghị BA (non-coding):**

1. Coordinator/worker: luôn `record-join` từ `CURSOR_CONVERSATION_ID` sớm trong Dispatch terminal.
2. Đừng crowning cost/token per role từ hooks cho worker Orca terminal cho đến khi probe IDE PASS hoặc Cursor gọi `afterAgentResponse`/`stop` ổn định trên `cursor-agent`.
3. Gap vẫn khớp runbook **G-CURSOR-TOKEN-NULL**; agent-top (file `08`) không thay token Cursor.

### Non-goals (probe)

- Không sửa scripts.
- Không claim PASS hook dựa trên smoke stdin.
- Không mở portal / Admin API trong probe này.

---

## 8. Acceptance checklist

| Tiêu chí | Kết quả |
| -------- | ------- |
| `record-join` cho Dispatch này + cách lấy `conversation_id` | **OK** — env `CURSOR_CONVERSATION_ID` |
| ≥1 turn rồi kiểm tra `cursor.turn` tokens từ hook **hoặc** FAIL rõ | **FAIL** — hooks `stop`/`afterAgentResponse` không fire/ghi trên terminal agent (quan sát) |
| Evidence môi trường + lệnh + excerpt redact | **OK** — mục 2–6 |
| Chỉ file `09` (+ sample gitignored) | **OK** |
| Tiếng Việt user-facing | **OK** |

**Outcome probe:** **succeeded** (evidence đủ; verdict hook tự động = **FAIL**; join + CLI wire = **PASS**).
