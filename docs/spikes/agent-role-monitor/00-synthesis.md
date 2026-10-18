# 00 — Synthesis: Agent Role Effectiveness Monitor

**Run:** `run_0736a709b8b9` (2026-10-18)  
**Coordinator:** depth 0 · wave research 7 Task (BA ∥ PD ∥ Architect ∥ SOTA ∥ DoD ∥ BE ∥ Web)  
**Artifacts:** `01`–`07` completed + released · reclaimable = 0  
**Không spawn:** `ios` (không liên quan surface), `reviewer-security` (privacy đã nằm trong Architect/BE)

---

## 1. Verdict ngắn

**Có thể đo hiệu quả theo Role catalog** — nhưng **không** bằng cách mua một SaaS LLM observability rồi gắn vào Cursor.

| Layer | MVP khả thi ngay | Gap chính |
| ----- | ---------------- | --------- |
| Attribution | Role ID trong Task Spec × `dispatch_id` | Orca `projection.role` = `worker`, **không** = catalog |
| Cost / token | Proxy: wall-clock + rework + turns | Cursor path opaque; agent-top: Cursor = process only, tokens “not yet” |
| Quality | Project Status + DoD exact-SHA + reopen | Không dùng vanity / tự chấm |
| Host | PID sampler / agent-top CPU·MEM | Cần map terminalHandle → process tree |
| Surface | CLI + markdown export | **Không** nhét vào portal Vemoki (`apps/web`) ở MVP |

**Chiến lược:** **hybrid** — build ledger + join Orca/Project; adopt agent-top (host); align attribute với OTel GenAI sau; **không** full-buy Langfuse/LangSmith/Helicone làm SoT cho session Cursor.

---

## 2. Internet đã có gì (SOTA)

Đã khảo sát ≥8 hệ (chi tiết `04-sota-landscape.md`):

| Hệ | Token/cost | CPU/RAM | Multi-agent | Fit Cursor+Orca |
| -- | ---------- | ------- | ----------- | --------------- |
| OTel GenAI conventions | Có (spec) | Không | `gen_ai.agent.name` | Từ điển attribute; Cursor chưa được liệt kê emit |
| Langfuse / Phoenix | Có | Không | Graph/nest | Self-host OK nếu **ta** gọi LLM; miss IDE agent |
| LangSmith | Có | Không | Nested runs | SaaS/Enterprise; stack không phải LangChain |
| Helicone | Có (qua proxy) | Không | Session props | Cursor thường **không** đi qua proxy của ta |
| Google Agent Platform obs. | Có | Container | Topology | Pattern tham khảo; không migrate |
| **agent-top** | Transcript-based; **Cursor tokens not yet** | **Có** (process tree) | Per harness | **Gần nhất** cho host parallel workers |

**Insight chung ngành:** cost-per-outcome + trace handoff orchestrator→worker; stack ta thiếu “SDK gọi model” nên phải **ledger quanh Orca Dispatch**.

---

## 3. Taxonomy (BA) — ngôn ngữ chung

Hiệu quả role ≈ **Quality / (Cost_proxy + Host_proxy + Process_penalty)** — **role-specific**, không leaderboard token chung.

Bốn lớp: `cost.*` · `qual.*` · `host.*` · process WIP (đã có mầm trong `github-project-tracking.mdc`).

MVP đo được **hôm nay không cần token meter:** `cost.wall_ms`, `cost.rework_dispatches`, `qual.reopen`, thời gian chờ duyệt, CI re-run — gắn `meter=proxy` khi thiếu token.

Chi tiết bảng theo từng Role: `01-ba-metrics-taxonomy.md`.

---

## 4. Kiến trúc + data plane

**Architect (`03`) + Backend (`06`) hội tụ:**

```text
worker-start (Role ID bắt buộc)
  → events: dispatch.opened / heartbeat / worker_done
  → join: Cursor hooks/Admin API (nếu có conversation_id)
  → join: host sampler (PID)
  → join: Project #3 status timeline
  → append-only JSONL (gitignored), ví dụ .orca-metrics/role-dispatch.jsonl
  → rollup CLI → markdown report
```

- Redis **không** SoT; product Postgres **cấm** cho đến ADR ops riêng.
- Privacy: counters + IDs; không full transcript/prompt.
- Phase 2 optional: OTLP export map Role → `gen_ai.agent.name`.

---

## 5. UX + surface

- **PD (`02`):** một composition — bảng Role × Cost × Quality × Host; states partial-data khi thiếu token; tránh dashboard card nhồi.
- **Web (`07`):** MVP = **(C) CLI-only + (B) markdown/CI artifact**; hoãn **(A)** trang `apps/web` (sai audience, coupling portal vé).

---

## 6. DoD chống vanity (`05`)

Claim “role X hơn Y” chỉ PASS khi: cùng class Task, cùng cửa sổ, sample size, evidence ngoài chat, ledger fields đủ, **cấm tự chấm điểm**.  
`worker_done` ≠ Project `Hoàn thành`. Checklist tầng A (spike) / B (MVP tooling) trong file 05.

---

## 7. Đề xuất bước tiếp (cần bạn chốt)

| # | Quyết định | Gợi ý coordinator |
| - | ---------- | ----------------- |
| D1 | Mở Epic implement MVP ledger + CLI rollup? | Có — scope tooling, không portal |
| D2 | Thử agent-top trên fleet Orca (host only)? | Có — evaluate Cursor token gap |
| D3 | Cursor Teams Admin API / hooks cho token join? | Spike riêng nếu account hỗ trợ |
| D4 | Commit spike docs `docs/spikes/agent-role-monitor/*` lên branch? | Khi bạn yêu cầu commit |
| D5 | Đưa metric vào Project automation weekday? | Sau khi có JSONL ổn định |

**Không làm mặc định:** deploy prod, nhúng monitor vào tenant admin, mua LangSmith làm SoT.

---

## 8. Index artifact

| File | Role | Trọng tâm |
| ---- | ---- | --------- |
| [01-ba-metrics-taxonomy.md](./01-ba-metrics-taxonomy.md) | product-ba | Định nghĩa hiệu quả + metric IDs |
| [02-pd-monitor-ux.md](./02-pd-monitor-ux.md) | product-design | UX composition + states |
| [03-architect-telemetry.md](./03-architect-telemetry.md) | architect | Data-flow + ADR draft |
| [04-sota-landscape.md](./04-sota-landscape.md) | product-ba (SOTA) | Internet scan + build/buy/hybrid |
| [05-dod-evidence-gates.md](./05-dod-evidence-gates.md) | reviewer-dod | Chống vanity / checklist |
| [06-backend-data-plane.md](./06-backend-data-plane.md) | backend | JSONL schema + retention |
| [07-web-surfaces.md](./07-web-surfaces.md) | web | CLI+MD vs portal |

---

## 9. Giới hạn wave này

- Research docs only — chưa chạy thu thập trên đợt production.
- Chưa có số đo thật từ fleet (token/CPU) trong spike.
- iOS / reviewer-security không có file riêng; host iOS sim nằm trong taxonomy BA + architect host layer.


---

## Implementation status

> Mục này bổ sung sau wave research — **không thay** verdict / SOTA / taxonomy ở các mục trên.

| Artifact | Status | Ghi chú |
| -------- | ------ | ------- |
| Runbook ops | **Đã có** | [`docs/ops/AGENT-ROLE-MONITOR.md`](../../ops/AGENT-ROLE-MONITOR.md) — khi nào gọi `record-opened` / `ingest-settlement` / `rollup` trong mailbox loop; map Role ID; privacy; known gaps (token Cursor **null**); link `scripts/agent-role-monitor/` |
| Ledger lib | **Partial** | `scripts/agent-role-monitor/lib/ledger.mjs` (+ `host-sample.mjs`) — schema v1, opened/settled/rollup helpers |
| CLI entry | **Chờ BE** | `record-opened.mjs`, `ingest-settlement.mjs`, `rollup.mjs` — ownership worker backend; architect Task **không** sửa `scripts/**` |
| Surface | CLI + MD | Portal hoãn (`07`) |
| Meter token | Gap | Cursor tokens chưa join Dispatch → rollup để `null`, không `0` |

**Pointer cho coordinator:** bắt đầu ingest theo runbook ngay khi CLI sẵn; research `01`–`07` vẫn là nguồn taxonomy / privacy / DoD chống vanity.
