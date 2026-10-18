# Runbook — Agent Role Effectiveness Monitor

Ngày: 2026-10-18  
**Audience:** coordinator gốc (depth 0) — copy-paste vào mailbox loop.  
**Mode:** ops handoff / kiểm tra sự phù hợp (Role `architect`).  
**Architecture impact:** Có — ingest quanh Orca Dispatch; **docs + tooling local**, không portal Vemoki.

Spike research: [`docs/spikes/agent-role-monitor/`](../spikes/agent-role-monitor/README.md) · synthesis [`00-synthesis.md`](../spikes/agent-role-monitor/00-synthesis.md) (mục **Hooks status**).  
Scripts (ownership BE — không sửa trong Task docs này): [`scripts/agent-role-monitor/`](../../scripts/agent-role-monitor/).  
**Probe 09 (hooks live / join reliability):** chưa có artifact — **xem `09` khi probe xong** (placeholder: `docs/spikes/agent-role-monitor/09-*.md`).

---

## 1. Mục tiêu và non-goals

| Làm | Không làm |
| --- | --------- |
| Ghi ledger Role catalog × Dispatch khi spawn / settle / join | Coi `worker_done` = Project `Hoàn thành` |
| Join Cursor `conversation_id` → `dispatch_id` rồi ingest hook `stop` → `cursor.turn` | Bịa token = 0 khi thiếu join / hook chưa fire |
| Rollup markdown/CLI (kể cả `tokens_*_sum` khi có `cursor.turn`) | Nhúng monitor vào `apps/web` / product Postgres |
| Giữ token/CPU **null** khi chưa có meter | Vanity score / “statistically significant” với n nhỏ |

**SoT MVP:** append-only JSONL gitignored:

```text
.orca-metrics/role-dispatch.jsonl
```

Schema v1 và event types: spike [`03-architect-telemetry.md`](../spikes/agent-role-monitor/03-architect-telemetry.md) §4 · [`06-backend-data-plane.md`](../spikes/agent-role-monitor/06-backend-data-plane.md) §3.  
Lib đã có: `scripts/agent-role-monitor/lib/ledger.mjs` (`buildOpenedEvent`, `buildJoinEvent`, `buildCursorTurnEvent`, `normalizeSettlementInput`, `rollupByRole`, …).

---

## 2. Map Role ID (catalog → `--role-id`)

Lấy **Role ID từ Task Spec** lúc `worker-start` — **không** dùng Orca `projection.role` (luôn `worker`). Agent runtime = `cursor` trừ override rõ.

| Role ID | File | Khi gắn |
| ------- | ---- | ------- |
| `product-ba` | `docs/agents/roles/product-ba.md` | Discovery / AC / taxonomy |
| `product-design` | `docs/agents/roles/product-design.md` | Flow / UX handoff |
| `architect` | `docs/agents/roles/architect.md` | ADR / telemetry design / kiểm tra phù hợp |
| `backend` | `docs/agents/roles/backend.md` | `apps/api`, `apps/worker`, `packages/backend` |
| `web` | `docs/agents/roles/web.md` | `apps/web` |
| `ios` | `docs/agents/roles/ios.md` | `apps/mobile` |
| `reviewer-dod` | `docs/agents/roles/reviewer-dod.md` | DoD exact-SHA |
| `reviewer-security` | `docs/agents/roles/reviewer-security.md` | Security-sensitive review |

**Ngoài catalog (optional nếu đo):** `epic-planner`, `coordinator` — chỉ khi Task Spec ghi rõ; không đoán từ folder.

Catalog đầy đủ: [`docs/agents/README.md`](../agents/README.md).

---

## 3. Chèn vào mailbox loop (copy-paste)

Neo process: `.cursor/rules/orca-coordinator-mailbox.mdc` — vòng `check --wait` → settle → ack → idle-fill → `check --wait`.

```text
worker-start (max fan-out ready)
  → [ARM] record-opened          ← ngay sau mỗi spawn thành công
  → [ARM] record-join            ← khi biết conversation_id ↔ dispatch (IDE session)
  → (async) Cursor hook stop|afterAgentResponse
         → agent-metrics-cursor-turn.sh → ingest-cursor-turn → cursor.turn
  → check --wait
  → process batch
       worker_done / fail / cancel
         → [ARM] ingest-settlement   ← trước worker-release / reuse
       question → reply
       escalation → xử lý / ghi chú
  → reuse | retain | worker-release
  → check --ack <delivery_id>
  → idle-fill
  → (cuối wave / cuối Run / trước báo cáo đợt) [ARM] rollup
  → nếu còn Dispatch live → lặp check --wait
```

| Hook / lệnh | Khi nào | Lệnh |
| ----------- | ------- | ---- |
| **record-opened** | Sau **mỗi** `worker-start` OK (có `dispatchId`) | §4.1 |
| **record-join** | Khi có `conversation_id` Cursor gắn session worker đó (trước/trong lúc agent chạy) | §4.2 |
| **ingest-cursor-turn** | Tự động qua project hooks `stop` (SoT) / `afterAgentResponse` (dedupe) — **không** gọi tay trong mailbox trừ debug | §4.4 |
| **ingest-settlement** | Sau validate `worker_done` / fail / cancel — **trước** `worker-release` | §4.3 |
| **rollup** | Cuối wave, cuối Run, hoặc trước comment Project / synthesis | §4.5 |

**Không bắt buộc:** persist mọi heartbeat — optional `dispatch.heartbeat` / `host.sample` nếu BE CLI hỗ trợ; thiếu thì bỏ, không block mailbox.

**Idempotency:**

| Event | Key |
| ----- | --- |
| `dispatch.opened` / `dispatch.settled` | `(dispatch_id, event)` |
| `join.conversation` | `(conversation_id, dispatch_id)` |
| `cursor.turn` | `generation_id` |

Re-run an toàn khi mailbox / hooks at-least-once.

---

## 4. Lệnh CLI (copy-paste)

Chạy từ **repo root** trên máy coordinator (cùng host ghi ledger). Entry thống nhất: `scripts/agent-role-monitor/cli.mjs` (hoặc `pnpm agent-metrics:*`). **Không** viết Nest/API / product DB.

Biến môi trường optional:

```bash
export ORCA_METRICS_LEDGER="${ORCA_METRICS_LEDGER:-.orca-metrics/role-dispatch.jsonl}"
```

Chi tiết flags: [`scripts/agent-role-monitor/README.md`](../../scripts/agent-role-monitor/README.md).

### 4.1 `record-opened` — sau `worker-start`

```bash
pnpm agent-metrics:opened -- \
  --dispatch-id "<dispatchId>" \
  --task-id "<taskId>" \
  --run-id "<runId>" \
  --role-id "<RoleID từ Task Spec>" \
  --agent cursor \
  --issue "<N hoặc bỏ>" \
  --worktree "<abs path hoặc bỏ>" \
  --architecture-impact "Có|Không"
```

Tương đương: `node scripts/agent-role-monitor/cli.mjs record-opened …`

**Bắt buộc:** `--dispatch-id`, `--role-id`.  
Event ghi: `dispatch.opened`.

### 4.2 `record-join` — map `conversation_id` ↔ Dispatch

Gọi **sau** `record-opened` khi biết Cursor `conversation_id` của session worker (IDE Agent chat / Orca pane gắn Cursor). Không có conversation → **bỏ**; hook `stop` sẽ skip (`join_missing`) thay vì bịa token.

```bash
pnpm agent-metrics:join -- \
  --conversation-id "<conversation_id từ Cursor>" \
  --dispatch-id "<dispatchId>" \
  --task-id "<taskId>" \
  --run-id "<runId>" \
  --role-id "<cùng RoleID lúc opened>" \
  --agent cursor
```

Tương đương: `node scripts/agent-role-monitor/cli.mjs record-join …`

**Bắt buộc:** `--conversation-id`, `--dispatch-id`, `--role-id`.  
Event ghi: `join.conversation` (idempotent trên cặp conversation+dispatch).  
Cách lấy `conversation_id` ổn định trên Orca CLI / terminal-only worker: **xem `09` khi probe xong** (gap `G-CLI-TERMINAL-FIRE` §6).

### 4.3 `ingest-settlement` — sau `worker_done` (và fail/cancel)

Pipe JSON (camelCase / snake_case đều được — lib `normalizeSettlementInput`):

```bash
printf '%s\n' '{
  "dispatchId":"ctx_…",
  "taskId":"task_…",
  "runId":"run_…",
  "roleId":"architect",
  "outcome":"succeeded",
  "subject":"runbook done",
  "agent":"cursor",
  "source":"mailbox.worker_done"
}' | pnpm agent-metrics:ingest
```

Hoặc `--file PATH` / `--role-id` khi JSON thiếu role. Tương đương: `node scripts/agent-role-monitor/cli.mjs ingest-settlement …`

**Privacy:** chỉ subject ngắn + hash/length body nếu có — **không** pipe full transcript / secrets vào stdin.  
Event ghi: `dispatch.settled`. Settlement **không** mang token — token chỉ từ `cursor.turn` (§4.4) rồi vào rollup (§4.5).

### 4.4 Hook `stop` → `cursor.turn` (`ingest-cursor-turn`)

**Source of truth turn tokens:** project hook Cursor `stop` (không đụng `~/.cursor/hooks.json`).

| Hook | Script | Hành vi |
| ---- | ------ | ------- |
| `stop` | `.cursor/hooks/agent-metrics-cursor-turn.sh` | SoT → `ingest-cursor-turn` → `cursor.turn` (`token_source=hooks`) |
| `afterAgentResponse` | cùng script | Accepted; **bỏ qua** nếu `generation_id` đã ingest |

Fail-open: hook **không** block agent; log best-effort → `.orca-metrics/cursor-hooks.log`.

Luồng:

```text
Cursor stop JSON (stdin)
  → cli ingest-cursor-turn
  → lookup join.conversation by conversation_id (hoặc attrs.dispatch_id)
  → append cursor.turn  OR  skip exit 0 + stderr join_missing
```

Manual debug (copy-paste):

```bash
printf '%s\n' '{
  "hook_event_name":"stop",
  "conversation_id":"conv_…",
  "generation_id":"gen_…",
  "model":"composer",
  "status":"completed",
  "input_tokens":100,
  "output_tokens":20,
  "cache_read_tokens":80,
  "cache_write_tokens":5
}' | pnpm agent-metrics:ingest-cursor-turn
```

**Privacy hook:** ingest **không** lưu `text` / `prompt` / `transcript_path` / tool args — chỉ IDs + counters + model.  
**Join missing:** không có `join.conversation` → skip (exit 0), JSON `{ "reason":"join_missing" }` — gọi §4.2 rồi chờ turn sau (hoặc re-fire debug).

### 4.5 `rollup` — aggregate theo Role (+ tokens)

```bash
# JSON stdout
pnpm agent-metrics:rollup

# Durable file
pnpm agent-metrics:rollup -- --out ".orca-metrics/by_role.json"
# hoặc copy JSON đã format vào docs/spikes/agent-role-monitor/reports/ khi cần artifact đợt
```

Output kỳ vọng theo `role_id`:

- opened / settled counts, success/fail, p50 duration (khi có opened+settled)
- RSS peak nếu có `host.sample`
- **`tokens_in_sum` / `tokens_out_sum` / `tokens_cache_read_sum` / `tokens_cache_write_sum`** — cộng từ mọi `cursor.turn` của role đó
- Field token **null** nếu mọi turn thiếu số (thiếu meter ≠ `0`)

Surface MVP: CLI + markdown — **không** `apps/web` ([`07-web-surfaces.md`](../spikes/agent-role-monitor/07-web-surfaces.md)).

---

## 5. Privacy (bắt buộc)

| Được ghi | Cấm mặc định |
| -------- | ------------- |
| `run_id`, `task_id`, `dispatch_id`, `role_id`, `issue`, `conversation_id` (opaque) | Full prompt / completion / tool args |
| Outcome, subject ngắn, model id, token **counters** từ hooks | `.env`, API keys, signing material, session tokens |
| `generation_id`, `token_source=hooks` | `text` / `prompt` / `transcript_path` từ hook payload |
| `report_path` relative, SHA tip (khi có) | PII sản phẩm (email attendee, QR, OTP) |
| Host `cpu_pct` / `rss_mb` mẫu | Nội dung `ask` dài; body `worker_done` đầy đủ |

- Ledger **local + gitignored**; không commit JSONL / `cursor-hooks.log`; không push SaaS observability trừ ADR mới.  
- Hook script fail-open; không gửi payload ra ngoài repo.  
- Retention gợi ý: SoT row 14–90 ngày; heartbeat / hook log ngắn hơn hoặc không persist.  
- Chi tiết: spike `03` §7 · `06` §4 · DoD `05` M-9 / AC-3 · CLI README Privacy.

---

## 6. Known gaps (ghi rõ — không crowning)

| Gap ID | Ý nghĩa | Hành xử coordinator |
| ------ | ------- | ------------------- |
| **G-CURSOR-TOKEN-NULL** | Chưa có `cursor.turn` (thiếu join, hook chưa fire, hoặc agent-top tokens “not yet”) | Để `tokens_*` / `costUsd` = **null**; `token_source=unknown`; **không** ghi `0` |
| **G-SUBAGENT** | `subagentStop` **không** expose token; reasoning tokens chưa có trên hooks | Rollup parent turn ≠ tổng subtree; ghi limitation khi claim cost |
| **G-CLI-TERMINAL-FIRE** | Orca CLI / terminal-only worker: hook `stop` / `conversation_id` có fire và join được không? | **Chưa chứng minh** — xem **`09` khi probe xong**; đến lúc đó coi token CLI path = null |
| G-ORCA-METER | `worker-list` không có token/CPU per role | Claim cost/resource = out-of-scope hoặc `unknown` |
| G-HOST-MAP | Map `terminalHandle` → PID chưa ổn định | Bỏ `host.sample` hoặc sample fail-soft (agent-top: host OK, token Cursor vẫn 0) |
| G-ROLE-MISSING | Task Spec thiếu Role ID | Không guess; ingest fail-soft / `role_id=unknown` + sửa process spawn |
| G-JOIN-MISSING | Hook chạy trước `record-join` | Skip turn; join rồi chờ generation sau — không backfill prompt |
| G-SAMPLE-SIZE | n nhỏ | Chỉ exploratory; cấm “statistically significant” |

Anti-vanity: [`05-dod-evidence-gates.md`](../spikes/agent-role-monitor/05-dod-evidence-gates.md).  
`worker_done --outcome succeeded` **không** chứng minh chất lượng role — cần Project Status + exact-SHA DoD khi claim coding effectiveness.

---

## 7. Checklist nhanh mỗi wave

1. Mỗi `worker-start` có Role ID trong Spec → `record-opened`.  
2. Khi biết Cursor `conversation_id` → `record-join` (cùng `role_id` / `dispatch_id`).  
3. Xác nhận project hooks `stop` / `afterAgentResponse` trỏ `.cursor/hooks/agent-metrics-cursor-turn.sh` (fail-open).  
4. Mỗi settle → `ingest-settlement` với **cùng** `role_id` / `dispatch_id`.  
5. Không block mailbox nếu CLI/hook lỗi — log stderr / `.orca-metrics/cursor-hooks.log`, escalate nếu lặp; mailbox vẫn `ack` / release.  
6. Cuối Run → `rollup` (kiểm `tokens_*_sum` null vs số) + (optional) file dưới `docs/spikes/agent-role-monitor/reports/`.  
7. Không mở Epic portal / Nest metrics từ runbook này.

---

## 8. Liên kết

| Path | Nội dung |
| ---- | -------- |
| [`scripts/agent-role-monitor/`](../../scripts/agent-role-monitor/) | CLI + `lib/ledger.mjs`, `lib/host-sample.mjs` |
| [`docs/spikes/agent-role-monitor/00-synthesis.md`](../spikes/agent-role-monitor/00-synthesis.md) | Verdict + Implementation status + **Hooks status** |
| [`03-architect-telemetry.md`](../spikes/agent-role-monitor/03-architect-telemetry.md) | Data-flow + schema (`cursor.turn` / `join.conversation`) |
| [`06-backend-data-plane.md`](../spikes/agent-role-monitor/06-backend-data-plane.md) | JSONL SoT + ingest mailbox |
| [`08-agent-top-trial.md`](../spikes/agent-role-monitor/08-agent-top-trial.md) | Host CPU/MEM; Cursor tokens vẫn 0 qua agent-top |
| **Probe 09** | **Chưa có** — xem `09` khi probe xong (hooks live / CLI·terminal fire?) |
| [`docs/agents/README.md`](../agents/README.md) | Catalog Role ID |
| `.cursor/hooks.json` + `.cursor/hooks/agent-metrics-cursor-turn.sh` | Project hooks → `ingest-cursor-turn` |
| `.cursor/rules/orca-coordinator-mailbox.mdc` | Continuous listen loop |

---

## 9. Kết luận handoff (architect)

**Đủ để coordinator triển khai ingest trong scope tooling** — chèn `record-opened` → `record-join` → settle `ingest-settlement` → `rollup` như §3–§4; hooks `stop` → `cursor.turn` tự chạy khi join sẵn; privacy §5; gaps §6 (subagent + CLI/terminal fire chờ probe **09**).  
Consumer code (entry `.mjs`, tests, hook script) thuộc ownership **backend** / tooling trên `scripts/agent-role-monitor/**` và `.cursor/hooks/*` — Task này **không** sửa scripts.  
**Không** promote product DB / `apps/*` từ runbook này.
