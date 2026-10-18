# Spike — Architect: Telemetry Role ID × Dispatch

**Role:** `architect` · Mode: Thiết kế  
**Parent:** [README.md](./README.md)  
**Architecture impact:** Có — attribution Role×Dispatch, nguồn token, host sampler, privacy, ADR-draft.  
**Base SHA đọc:** `cd7f2261b829dc366b3a8e946f33ae092f69a396` (branch `hangndat/Agent-monitor`)  
**Ngày draft:** 2026-10-18  
**Kết luận:** `Đề xuất` — MVP = local JSONL ledger + join keys; OTel GenAI optional phase 2. Cần user chốt vài quyết định mở (§9).

---

## 1. Phạm vi và non-goals

### Mục tiêu

Thiết kế lớp thu thập / ghi / aggregate metric **theo Role catalog × Dispatch** trong stack thật của ticket-solution:

| Nguồn | Tín hiệu có hôm nay | Gap |
| ----- | ------------------- | --- |
| Orca orchestration | `runId`, `taskId`, `dispatchId`, `worker-list` lifecycle, `provider.id`, heartbeats, `worker_done` outcome | **Không** có token/CPU/RAM; `projection.role` = lifecycle role (`worker`), **không** = Role ID catalog |
| Cursor | Hooks `stop` / `afterAgentResponse` (input/output/cache tokens + `conversation_id`); Teams Admin API `filtered-usage-events`; UI Usage | Không join sẵn với Orca Dispatch; subagentStop **không** có token; reasoning tokens chưa expose qua hooks |
| Host | PID của terminal/agent process (CPU%, RSS) | Chưa map Dispatch → PID ổn định; sampler chưa có |
| GitHub Project #3 | Status transitions (`Sẵn sàng`→`Đang làm`→`Chờ duyệt`→…) | Event stream không native; phải poll/`gh` + comment timestamps |

### Non-goals (spike này)

- Không implement collector, dashboard, migration, hay deploy.
- Không đụng file ownership worker khác (`01`…`07`, `00-synthesis`).
- Không claim đo production / SLO khách hàng.
- Không log full transcript, secrets, PII sản phẩm (xem §7).

### Invariant thiết kế

1. **Khóa attribution bắt buộc:** `(role_id, dispatch_id)` — Role ID từ catalog `docs/agents/roles/*`, Dispatch từ Orca.
2. **Role ≠ agent:** agent runtime luôn `cursor` (routing rule); Role ID là chiều phân tích chuyên môn.
3. **Orca `projection.role` không thay Role ID** — phải lấy từ Task Spec / dispatch evidence lúc `worker-start`.
4. **Thiếu số ≠ zero:** token/CPU vắng mặt → `null` + `source_quality`, không mặc định `0`.
5. **Privacy-first:** ledger chỉ metadata + counters; không body prompt/completion mặc định.

---

## 2. Sơ đồ data-flow (chữ)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  DISPATCH START (coordinator)                                           │
│  worker-start --task|--spec + Role ID trong Task Spec                   │
│       │                                                                 │
│       ▼                                                                 │
│  Emit: dispatch.opened {run_id, task_id, dispatch_id, role_id,          │
│         agent=cursor, issue?, worktree?, started_at}                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ ORCA LIFECYCLE│     │ CURSOR TOKENS   │     │ HOST SAMPLER     │
│ worker-list   │     │ A) hooks stop   │     │ ps/top by PID    │
│ check/ack     │     │    (local turn) │     │ mapped via       │
│ heartbeat     │     │ B) Admin API    │     │ terminalHandle → │
│ worker_done   │     │    (team bill)  │     │ process tree     │
│               │     │ join:           │     │                  │
│ keys:         │     │ conversation_id │     │ metrics:         │
│ run/task/     │     │ ± wall-clock    │     │ cpu_pct, rss_mb, │
│ dispatch      │     │ window          │     │ sample_ts        │
└───────┬───────┘     └────────┬────────┘     └────────┬─────────┘
        │                      │                       │
        └──────────┬───────────┴───────────┬───────────┘
                   ▼                       ▼
         ┌─────────────────────────────────────────────┐
         │  LEDGER (MVP): append-only JSONL            │
         │  path đề xuất: local gitignored             │
         │  .orca-metrics/role-dispatch.jsonl          │
         │  1 dòng = 1 event typed (schema §4)         │
         └─────────────────────┬───────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐
     │ AGGREGATE    │  │ OPTIONAL    │  │ PROJECT #3 JOIN  │
     │ CLI / script │  │ OTel export │  │ poll Status +    │
     │ group by     │  │ GenAI attrs │  │ Issue # ↔ task   │
     │ role_id ×    │  │ (phase 2)   │  │ wait_review_ms   │
     │ dispatch_id  │  │             │  │                  │
     └──────────────┘  └─────────────┘  └──────────────────┘
```

**Luồng thời gian điển hình một Dispatch:**

```text
opened → (heartbeat* | host.sample* | cursor.turn*) → settled(worker_done)
                                                      → project.status?*
                                                      → aggregate rollup
```

---

## 3. Nguồn dữ liệu — chi tiết và chất lượng

### 3.1 Orca (authority lifecycle)

**Có evidence hôm nay** (`worker-list --include-remote --json`):

- Keys: `runId`, `taskId`, `dispatchId`, `agentTerminalHandle`
- Provider: `projection.provider.id` (vd. `cursor`), `model` thường `null`
- Stage/outcome/liveness; `nextAction` / `attention`
- **Không có:** token, cost, CPU, Role ID catalog

**Sự kiện lifecycle dùng cho ledger:**

| Event | Trigger | Fields tối thiểu |
| ----- | ------- | ---------------- |
| `dispatch.opened` | sau `worker-start` thành công | keys + `role_id` (từ spec) + timestamps |
| `dispatch.heartbeat` | worker heartbeat (optional sample) | `dispatch_id`, `phase`, `observed_at` |
| `dispatch.settled` | `worker_done` / fail / cancel | `outcome`, `subject`, summary hash (không full body nếu dài) |
| `dispatch.released` | `worker-release` | cleanup timestamp |

**Gap bắt buộc sửa ở process (không cần code Orca core):** coordinator/worker ghi `role_id` vào evidence lúc start — hiện Role chỉ nằm trong prose Task Spec.

### 3.2 Cursor (token / cost) — giới hạn visibility

Ba lớp, độ tin cậy khác nhau:

| Lớp | Cách lấy | Granularity | Join với Dispatch | Ghi chú |
| --- | -------- | ----------- | ----------------- | ------- |
| **A. Hooks local** | Cursor `stop` / `afterAgentResponse` | Per agent turn: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `conversation_id`, `model` | Cần map `conversation_id` ↔ `dispatch_id` (bảng join hoặc env inject lúc launch) | `input_tokens` **bao gồm** cache; không double-count. Reasoning tokens **chưa** có trên hooks. Subagent tokens **không** có trên `subagentStop`. |
| **B. Teams Admin API** | `POST /teams/filtered-usage-events` | Per model call + `chargedCents`, `conversationId` | Join `conversationId` + time window | Rate limit; poll ≤1/h khuyến nghị docs; cần team API key; phù hợp reconcile billing |
| **C. UI / CSV export** | Dashboard Usage | Manual | Weak | Chỉ audit thủ công, không MVP tự động |

**Khuyến nghị source of truth token cho MVP side-project (hangndat individual):** ưu tiên **A (hooks)** nếu host cho phép hook script ghi ledger; **B** chỉ khi account có Admin API và user chấp nhận secret scoping. Cá nhân/non-team có thể **không có B** → thiết kế phải degrade graceful (`token_source=hooks|admin_api|unknown`).

**BDK** `GET /v1/session/:id/cost` (nếu dùng Cursor BDK) là nguồn bổ sung cho session có `sessionId` ổn định — vẫn cần join Dispatch.

### 3.3 Host sampler (CPU / RAM)

```text
dispatch_id → agentTerminalHandle → OS process group / child PIDs
                                 → sample every N seconds while live
                                 → cpu_pct, rss_mb, optional cpu_seconds_delta
```

**Tradeoff mẫu:**

| Cách | Ưu | Nhược |
| ---- | -- | ----- |
| Poll `ps`/`top` theo PID từ Orca terminal metadata | Đơn giản, local | PID reuse; cần re-resolve; nhiễu từ process khác cùng tree |
| `psutil` / `proc_pidinfo` wrapper | Ổn định hơn | Thêm dependency tooling |
| cgroup / `agent-top` style | Đẹp multi-agent | Overkill MVP; phụ thuộc harness |

**MVP:** sampler optional, interval 15–30s, chỉ khi Dispatch `live`; ghi `host.sample` events; aggregate `cpu_seconds_est`, `rss_mb_peak`.

### 3.4 GitHub Project #3

Không phải metrics runtime agent; là **process effectiveness**:

- `time_in_status_ms` (Đang làm, Chờ duyệt)
- `reopen_count`, CI re-run (từ PR checks — phase sau)

Join: Issue # trong Task Spec / worktree `--issue` → Project item Status. Poll `gh project item-list` (đã có option ids trong rule tracking).

---

## 4. Schema ledger (MVP JSONL)

Mỗi dòng = một JSON object. Version field cho forward-compat.

```json
{
  "v": 1,
  "ts": "2026-10-18T15:00:00.000Z",
  "event": "dispatch.opened",
  "run_id": "run_…",
  "task_id": "task_…",
  "dispatch_id": "ctx_…",
  "role_id": "architect",
  "agent": "cursor",
  "issue": 123,
  "attrs": {}
}
```

### Event types đề xuất

| `event` | `attrs` chính |
| ------- | ------------- |
| `dispatch.opened` | `worktree`, `spec_hash?`, `architecture_impact?` |
| `dispatch.heartbeat` | `phase` |
| `cursor.turn` | `conversation_id`, `generation_id?`, `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, `token_source` |
| `host.sample` | `pid`, `cpu_pct`, `rss_mb` |
| `dispatch.settled` | `outcome` (`succeeded`\|`failed`\|…), `subject`, `files_modified_count?`, `report_path?` |
| `project.status` | `issue`, `from_status`, `to_status` |
| `join.conversation` | `conversation_id`, `dispatch_id` (explicit map) |

### Aggregate views (derived, không lưu bắt buộc)

```text
per (role_id, dispatch_id):
  wall_ms, outcome,
  tokens_in, tokens_out, tokens_cache_read, tokens_cache_write,
  token_source, token_completeness (full|partial|unknown),
  cpu_seconds_est, rss_mb_peak,
  wait_review_ms (từ Project)

per role_id (rolling window):
  dispatch_count, success_rate,
  p50/p95 tokens_out, p50/p95 wall_ms,
  mean rss_mb_peak
```

---

## 5. Semantic alignment — OpenTelemetry GenAI

### Fit assessment

OTel GenAI (status **Development**, SIG active; metrics restructure 2026-09: counters theo hướng + cache/reasoning) **fit cho phase 2 export**, không bắt buộc MVP:

| Khái niệm Vemoki/Orca | GenAI / OTel gần đúng | Ghi chú |
| --------------------- | --------------------- | ------- |
| Dispatch attempt | Span `invoke_agent` / INTERNAL | `gen_ai.agent.name` ← `role_id`; `gen_ai.agent.id` ← `dispatch_id` |
| Cursor model turn | Span `chat` + usage attrs | `gen_ai.provider.name` ← `cursor` (hoặc model vendor nếu biết); map hooks → `gen_ai.usage.*` |
| Token counters | `gen_ai.client.inference.usage.input_tokens` / `.output_tokens` / cache_* / reasoning_* | Hooks chưa có reasoning → omit, không fake |
| Tool calls (optional) | `execute_tool` | Chỉ nếu sau này instrument MCP/tool; **không** log args chứa secret |
| Host CPU/RAM | **Ngoài** GenAI — dùng `process.cpu.*` / `process.memory.*` OTel runtime | Giữ riêng resource metrics |
| Project Status | Business/process event — **không** nhồi vào GenAI | Custom attrs `vemoki.project.status` nếu export |

**Khuyến nghị naming nội bộ ledger:** giữ snake_case Vemoki (`role_id`, `dispatch_id`). Khi export OTel, **map** sang GenAI attributes — tránh buộc JSONL phải đổi mỗi lần SIG rename (đã xảy ra với `gen_ai.client.token.usage` → usage counters tách hướng).

**Không capture** `gen_ai.content.prompt` / `.completion` events mặc định (privacy §7).

---

## 6. Phương án kiến trúc (options + tradeoff)

### Option A — Local JSONL ledger only (khuyến nghị MVP)

**Mô tả:** Append-only file gitignored; scripts `record`/`rollup`; Role ID bắt buộc lúc open.

| Ưu | Nhược |
| -- | ----- |
| Zero infra; khớp side-project; dễ audit diff schema | Không multi-host; không real-time UI; join Cursor thủ công/hook |
| Privacy mặc định local disk | Dễ quên rotate/retention |
| Đủ cho so sánh Role effectiveness trong 1–2 tuần spike | Không OTel ecosystem sẵn |

**Chi phí vận hành:** thấp · **Đảo ngược:** xóa file + tắt hook · **Evidence:** rollup CSV/markdown từ JSONL.

### Option B — JSONL + optional OTel exporter (phase 2)

**Mô tả:** Cùng ledger; sidecar/batch export spans+metrics GenAI-aligned tới collector local (Jaeger/OTLP file) hoặc no-op.

| Ưu | Nhược |
| -- | ----- |
| Tương lai dashboard/vendor; chuẩn hóa | Complexity; SIG còn Development; rủi ro rename |
| Tách resource vs GenAI rõ | Dễ lỡ tay bật content capture |

**Điều kiện xét lại:** khi MVP đã có ≥N Dispatch/role và user muốn panel ngoài terminal.

### Option C — Push vào backend Vemoki (`apps/api` metrics)

**Mô tả:** Ghi metric agent vào PG/Prometheus của sản phẩm.

| Ưu | Nhược |
| -- | ----- |
| Một chỗ với ops platform | **Phạm vi sai:** agent-dev telemetry ≠ product runtime; ADR-11/SaaS; PII/process noise trong DB sản phẩm |
| | Ownership backend + migration + RLS — overkill spike |

**Khuyến nghị:** **Loại** cho spike/MVP. Chỉ mở lại nếu sau này có sản phẩm “Orca analytics” tách biệt và user approve.

### Option D — SaaS agent observability (Langfuse / vendor)

| Ưu | Nhược |
| -- | ----- |
| UI đẹp, token charts | Trái hướng self-host / ADR tránh SaaS runtime không được ủy quyền; privacy transcript; cost |

**Khuyến nghị:** **Không** mặc định. Chỉ nếu user explicit authorize và DPA/retention rõ.

### So sánh ngắn

```text
A (JSONL)     ← MVP đề xuất
B (JSONL+OTel)← phase 2 khi cần chuẩn hóa
C (product DB)← loại (sai boundary)
D (SaaS)      ← loại trừ khi user ủy quyền
```

---

## 7. Privacy và trust boundary

Áp dụng tinh thần TECHNICAL-DESIGN §13 (PII/token không vào telemetry sản phẩm) cho **dev-agent telemetry**:

### Được ghi

- IDs: `run_id`, `task_id`, `dispatch_id`, `role_id`, `issue`, `conversation_id` (opaque)
- Counters: tokens, duration, cpu/rss mẫu
- Outcome enums, model id strings
- Paths artifact **tương đối** (`docs/reviews/…`) — không nội dung file

### Cấm mặc định

- Full transcript / prompt / completion / tool args có thể chứa secrets
- `.env`, API keys, Apple signing material, Clerk/Keycloak tokens
- PII sản phẩm (email attendee, QR, OTP) nếu agent đọc nhầm vào context — **không** mirror sang ledger
- Nội dung `worker_done` body dài (chỉ subject + hash/length) nếu nghi có secret

### Retention

- Đề xuất mặc định: local only, retention **14–30 ngày** hoặc xóa theo Run; không commit JSONL.
- Nếu sau này share rollup: chỉ aggregate theo `role_id`, không raw `conversation_id` ra PR công khai trừ khi cần debug và đã redact.

### Security review trigger

Khi implement collector/hook ghi disk hoặc gọi Admin API: gắn `reviewer-security` (API key scope, path permissions, không upload cloud).

---

## 8. ADR draft (Đề xuất — chưa Accept)

> Coordinator xác nhận ADR ID trước khi copy vào `docs/ops/ADR-NN-…`. Draft dưới đây **không** tự Accept.

### Title (đề xuất)

**ADR-DRAFT — Agent Role×Dispatch telemetry ledger (local JSONL, OTel optional)**

### Context

Cần đo hiệu quả Role catalog (cost/token, wall time, host resource, process wait) trong Orca+Cursor. Orca cung cấp lifecycle keys nhưng không token/CPU; Cursor có tokens qua hooks/Admin API nhưng không biết Role; Project #3 có Status nhưng không runtime.

### Decision (Đề xuất)

1. **MVP:** append-only **local JSONL ledger** keyed by `(role_id, dispatch_id)` với events §4.
2. **Role ID** là dimension bắt buộc ghi lúc `dispatch.opened` (từ Task Spec); không suy từ `projection.role`.
3. **Token:** ưu tiên Cursor hooks; Admin API optional reconcile; thiếu số → `unknown`, không `0`.
4. **Host metrics:** optional sampler PID; không block MVP token/lifecycle.
5. **OTel GenAI:** optional export phase 2; map attrs, không log content events.
6. **Không** đưa ledger vào PostgreSQL sản phẩm Vemoki hay SaaS trừ ủy quyền riêng.

### Consequences

- (+) Đo được Role effectiveness mà không đợi Orca core thêm fields.
- (+) Privacy mặc định local; rẻ vận hành.
- (−) Join Cursor↔Dispatch là process debt (hook/env).
- (−) Multi-machine / remote worker cần mở rộng ledger path hoặc sync sau.

### Alternatives considered

Options B/C/D ở §6.

---

## 9. Open decisions — cần user / coordinator

| # | Quyết định | Options | Ảnh hưởng |
| - | ---------- | ------- | --------- |
| D1 | Nguồn token MVP | Hooks only / Hooks+Admin API / Manual CSV | Secret Admin API; độ đủ số |
| D2 | Có bật host CPU/RAM sampler ngay không? | Có (15–30s) / Chỉ lifecycle+token trước | Noise PID, complexity |
| D3 | Path ledger + retention | `.orca-metrics/` 14d / 30d / theo Run | Disk, privacy |
| D4 | ADR số chính thức | Chờ coordinator cấp `ADR-NN` | Liên kết Decision Log |
| D5 | Phase 2 OTel exporter? | Sau N Dispatch / Không bao giờ trừ khi dashboard | Effort |
| D6 | Có inject `ORCA_DISPATCH_ID` + `VEMOKI_ROLE_ID` vào môi trường worker lúc start? | Có (khuyến nghị) / Chỉ parse spec prose | Độ tin cậy join |
| D7 | Remote/Orca-hosted workers | In-scope MVP? / Local-only trước | Sampler + ledger path |

**Khuyến nghị architect cho D1–D7 nếu user muốn default:** D1=Hooks only; D2=Có nhưng best-effort; D3=`.orca-metrics/` + 30d; D5=sau khi có rollup hữu ích; D6=Có; D7=Local-only MVP.

---

## 10. Handoff

### Ownership khi implement (sau spike / sau Accept ADR)

| Slice | Việc |
| ----- | ---- |
| **coordinator** | Ghi `role_id` vào dispatch evidence; optional env inject; rollup script root tooling; ADR ID + Decision Log |
| **không** backend/web/iOS sản phẩm | Tránh Option C |
| **BA** (`01-…`) | Taxonomy metric names / AC đo “effectiveness” |
| **PD** (`02-…`) | UX monitor (nếu có UI sau) — đọc aggregate, không raw transcript |
| **backend data plane** (`06-…`) | Chỉ nếu sau này có service riêng *dev* metrics — không trộn Nest product |
| **web surfaces** (`07-…`) | Dashboard đọc rollup file/API dev — phase sau |
| **reviewer-dod / security** | DoD exact SHA khi có code collector; security nếu hook+API key |

### Dependencies thật (DAG gợi ý)

```text
[architect handoff này] ──► [BA taxonomy] ──┐
                     └──► [coordinator env+ledger MVP] ──► [optional PD/web UI]
                     └──► [DoD gates 05] song song khi có AC
```

Không block coding sản phẩm Vemoki.

### Xác minh (khi implement)

- [ ] Một Dispatch thử: có `opened` + `settled` + (nếu có) `cursor.turn` cùng `dispatch_id` + `role_id`
- [ ] Rollup theo `architect` vs `backend` ra số khác nhau trên Run thật
- [ ] File ledger không chứa secret (grep patterns)
- [ ] Thiếu token → `token_completeness=unknown`, không `0`
- [ ] Docs-only spike này: không yêu cầu runtime check

### Giới hạn evidence spike

- Đã đọc live `worker-list` (có lifecycle, không token).
- Cursor token paths xác minh qua docs/forum/Admin API (2026); chưa chạy hook collector trong task này.
- OTel GenAI metrics đang đổi (PR #374 merged 2026-09) — map exporter phải pin version conventions.

---

## 11. MVP khuyến nghị (tóm tắt điều hành)

1. **Ledger JSONL local** keyed `(role_id, dispatch_id)`.
2. **Bắt buộc** ghi Role ID lúc open (process + optional env).
3. **Token** từ Cursor hooks khi có; không block nếu thiếu.
4. **Host sampler** best-effort.
5. **Project #3** join Issue→wait_review sau.
6. **OTel / SaaS / product DB** — sau hoặc không, theo §6–§9.
7. **Privacy:** counters + IDs only; no transcripts.

**Kết luận artifact:** `Đề xuất` — đủ để BA/PD/backend-spike/web-spike bám contract; **chưa** “Đủ để triển khai production”; cần user/coordinator resolve §9 trước khi viết ADR Accept và code collector.
