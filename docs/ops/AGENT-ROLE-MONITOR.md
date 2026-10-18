# Runbook — Agent Role Effectiveness Monitor

Ngày: 2026-10-18  
**Audience:** coordinator gốc (depth 0) — copy-paste vào mailbox loop.  
**Mode:** ops handoff / kiểm tra sự phù hợp (Role `architect`).  
**Architecture impact:** Có — ingest quanh Orca Dispatch; **docs + tooling local**, không portal Vemoki.

Spike research: [`docs/spikes/agent-role-monitor/`](../spikes/agent-role-monitor/README.md) · synthesis [`00-synthesis.md`](../spikes/agent-role-monitor/00-synthesis.md).  
Scripts (ownership BE — không sửa trong Task docs này): [`scripts/agent-role-monitor/`](../../scripts/agent-role-monitor/).

---

## 1. Mục tiêu và non-goals

| Làm | Không làm |
| --- | --------- |
| Ghi ledger Role catalog × Dispatch khi spawn / settle | Coi `worker_done` = Project `Hoàn thành` |
| Rollup markdown/CLI để retro đợt | Nhúng monitor vào `apps/web` / product Postgres |
| Giữ token/CPU **null** khi chưa có meter | Bịa token = 0 hoặc vanity score |

**SoT MVP:** append-only JSONL gitignored:

```text
.orca-metrics/role-dispatch.jsonl
```

Schema v1 và event types: spike [`03-architect-telemetry.md`](../spikes/agent-role-monitor/03-architect-telemetry.md) §4 · [`06-backend-data-plane.md`](../spikes/agent-role-monitor/06-backend-data-plane.md) §3.  
Lib đã có: `scripts/agent-role-monitor/lib/ledger.mjs` (`buildOpenedEvent`, `normalizeSettlementInput`, `rollupByRole`, …).

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

| Hook | Khi nào | Lệnh |
| ---- | ------- | ---- |
| **record-opened** | Sau **mỗi** `worker-start` OK (có `dispatchId`) | §4.1 |
| **ingest-settlement** | Sau validate `worker_done` / fail / cancel — **trước** `worker-release` | §4.2 |
| **rollup** | Cuối wave, cuối Run, hoặc trước comment Project / synthesis | §4.3 |

**Không bắt buộc:** persist mọi heartbeat — optional `dispatch.heartbeat` / `host.sample` nếu BE CLI hỗ trợ; thiếu thì bỏ, không block mailbox.

**Idempotency:** `(dispatch_id, event)` cho `dispatch.opened` / `dispatch.settled` — re-run an toàn khi mailbox at-least-once.

---

## 4. Lệnh CLI (copy-paste)

Chạy từ **repo root** trên máy coordinator (cùng host ghi ledger). Entry scripts dưới `scripts/agent-role-monitor/` — nếu file chưa có trên branch, dùng `node --input-type=module` gọi lib hoặc đợi Task BE merge; **không** viết Nest/API.

Biến môi trường optional:

```bash
export ARM_LEDGER="${ARM_LEDGER:-.orca-metrics/role-dispatch.jsonl}"
```

### 4.1 `record-opened` — sau `worker-start`

```bash
node scripts/agent-role-monitor/record-opened.mjs \
  --dispatch-id "<dispatchId>" \
  --task-id "<taskId>" \
  --run-id "<runId>" \
  --role-id "<RoleID từ Task Spec>" \
  --agent cursor \
  --issue "<N hoặc bỏ>" \
  --worktree "<abs path hoặc bỏ>" \
  --architecture-impact "Có|Không"
```

**Bắt buộc:** `--dispatch-id`, `--role-id`.  
Event ghi: `dispatch.opened`.

### 4.2 `ingest-settlement` — sau `worker_done` (và fail/cancel)

```bash
node scripts/agent-role-monitor/ingest-settlement.mjs \
  --dispatch-id "<dispatchId>" \
  --task-id "<taskId>" \
  --run-id "<runId>" \
  --role-id "<cùng Role ID lúc opened>" \
  --outcome "succeeded|failed|cancelled|unknown" \
  --subject "<subject worker_done>" \
  --agent cursor \
  --files-modified "<count hoặc bỏ>" \
  --report-path "<relative path hoặc bỏ>"
```

Hoặc pipe JSON (camelCase / snake_case đều được — lib `normalizeSettlementInput`):

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
}' | node scripts/agent-role-monitor/ingest-settlement.mjs --stdin
```

**Privacy:** chỉ subject ngắn + hash/length body nếu có — **không** pipe full transcript / secrets vào stdin.  
Event ghi: `dispatch.settled`. Token fields **không** điền → để `null` (xem §6).

### 4.3 `rollup` — aggregate theo Role

```bash
# Bảng terminal
node scripts/agent-role-monitor/rollup.mjs --format table

# Markdown durable (ví dụ artifact đợt)
node scripts/agent-role-monitor/rollup.mjs --format md \
  > "docs/spikes/agent-role-monitor/reports/$(date -u +%Y%m%dT%H%M%SZ).md"
```

Output kỳ vọng: theo `role_id` — opened/settled counts, success/fail, p50 duration (khi có opened+settled), RSS peak nếu có `host.sample`, **tokens = null** khi chưa meter.

Surface MVP: CLI + markdown — **không** `apps/web` ([`07-web-surfaces.md`](../spikes/agent-role-monitor/07-web-surfaces.md)).

---

## 5. Privacy (bắt buộc)

| Được ghi | Cấm mặc định |
| -------- | ------------- |
| `run_id`, `task_id`, `dispatch_id`, `role_id`, `issue`, `conversation_id` (opaque) | Full prompt / completion / tool args |
| Outcome, subject ngắn, model id, counters | `.env`, API keys, signing material, session tokens |
| `report_path` relative, SHA tip (khi có) | PII sản phẩm (email attendee, QR, OTP) |
| Host `cpu_pct` / `rss_mb` mẫu | Nội dung `ask` dài; body `worker_done` đầy đủ |

- Ledger **local + gitignored**; không commit JSONL; không push SaaS observability trừ ADR mới.  
- Retention gợi ý: SoT row 14–90 ngày; heartbeat events ngắn hơn hoặc không persist.  
- Chi tiết: spike `03` §7 · `06` §4 · DoD `05` M-9 / AC-3.

---

## 6. Known gaps (ghi rõ — không crowning)

| Gap ID | Ý nghĩa | Hành xử coordinator |
| ------ | ------- | ------------------- |
| **G-CURSOR-TOKEN-NULL** | Cursor path opaque; agent-top: Cursor = process only, tokens “not yet”; hooks/Admin API chưa join Dispatch | Để `tokens_*` / `costUsd` = **null**; `token_source=unknown`; **không** ghi `0` |
| G-ORCA-METER | `worker-list` không có token/CPU per role | Claim cost/resource = out-of-scope hoặc `unknown` |
| G-HOST-MAP | Map `terminalHandle` → PID chưa ổn định | Bỏ `host.sample` hoặc sample fail-soft |
| G-ROLE-MISSING | Task Spec thiếu Role ID | Không guess; ingest fail-soft / `role_id=unknown` + sửa process spawn |
| G-SAMPLE-SIZE | n nhỏ | Chỉ exploratory; cấm “statistically significant” |

Anti-vanity: [`05-dod-evidence-gates.md`](../spikes/agent-role-monitor/05-dod-evidence-gates.md).  
`worker_done --outcome succeeded` **không** chứng minh chất lượng role — cần Project Status + exact-SHA DoD khi claim coding effectiveness.

---

## 7. Checklist nhanh mỗi wave

1. Mỗi `worker-start` có Role ID trong Spec → `record-opened`.  
2. Mỗi settle → `ingest-settlement` với **cùng** `role_id` / `dispatch_id`.  
3. Không block mailbox nếu CLI lỗi — log stderr, escalate nếu lặp; mailbox vẫn `ack` / release.  
4. Cuối Run → `rollup` + (optional) file dưới `docs/spikes/agent-role-monitor/reports/`.  
5. Không mở Epic portal / Nest metrics từ runbook này.

---

## 8. Liên kết

| Path | Nội dung |
| ---- | -------- |
| [`scripts/agent-role-monitor/`](../../scripts/agent-role-monitor/) | CLI + `lib/ledger.mjs`, `lib/host-sample.mjs` |
| [`docs/spikes/agent-role-monitor/00-synthesis.md`](../spikes/agent-role-monitor/00-synthesis.md) | Verdict + Implementation status |
| [`03-architect-telemetry.md`](../spikes/agent-role-monitor/03-architect-telemetry.md) | Data-flow + schema |
| [`06-backend-data-plane.md`](../spikes/agent-role-monitor/06-backend-data-plane.md) | JSONL SoT + ingest mailbox |
| [`docs/agents/README.md`](../agents/README.md) | Catalog Role ID |
| `.cursor/rules/orca-coordinator-mailbox.mdc` | Continuous listen loop |

---

## 9. Kết luận handoff (architect)

**Đủ để coordinator triển khai ingest trong scope tooling** — chèn 3 lệnh vào loop như §3–§4; privacy §5; gaps §6.  
Consumer code (entry `.mjs`, tests) thuộc ownership **backend** trên `scripts/agent-role-monitor/**`.  
**Không** promote product DB / `apps/*` từ runbook này.
