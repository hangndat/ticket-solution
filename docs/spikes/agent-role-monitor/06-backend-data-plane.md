# 06 — Backend data plane (Role × Dispatch metrics)

**Spike:** Agent Role Effectiveness Monitor  
**Role:** `backend` (`docs/agents/roles/backend.md`)  
**Architecture impact:** Có — quyết định nơi lưu metric; **chỉ đề xuất**, không migration / không code `apps/*`.  
**Neo:** [TECHNICAL-DESIGN.md](../../TECHNICAL-DESIGN.md) (ADR-02 RLS, Redis không SoT), [README spike](./README.md)

---

## 1. Mục tiêu data plane

Lưu và truy vấn metric gắn **Role catalog × Dispatch** (cost/token, chất lượng output proxy, RAM/CPU host nếu có) phục vụ đo hiệu quả role trong stack Orca + Cursor — **không** thay SoT nghiệp vụ vé/quota/check-in.

| Câu hỏi | Trả lời ngắn |
| ------- | ------------ |
| Đơn vị ghi? | Một **record / Dispatch** (có thể nhiều event thời gian trong lifecycle; aggregate khóa `(runId, dispatchId)`) |
| Khóa attribution? | `roleId` (catalog) + `dispatchId` + `taskId` + `runId` |
| SoT metric MVP? | File JSONL local (tooling) — xem §5 |
| Redis? | Chỉ hot cache / live counter — **không** SoT (khớp TD §3.1 / ADR-11) |
| Product Postgres + RLS? | **Không** đưa vào schema tenant nghiệp vụ ở MVP; nếu sau này vào PG thì DB/schema tách hoặc bảng ops global — xem §6 |

---

## 2. Nguồn ingest (coordinator mailbox settlement)

Orca reality (README): `worker-list --json` có lifecycle/provider, **chưa** có token/CPU per role. Data plane phải giả định **ingest chủ động từ coordinator** tại checkpoint settlement, không chờ Cursor/Orca emit GenAI metrics sẵn.

### 2.1 Điểm hook khuyến nghị

| Sự kiện mailbox / lifecycle | Ghi gì |
| --------------------------- | ------ |
| `worker-start` / dispatch | Envelope mở: `dispatchId`, `taskId`, `runId`, `roleId` (từ Task Spec), `agent` (`cursor`), `startedAt`, worktree/issue refs nếu có |
| `heartbeat` | Optional sample: `phase`, `ts` (không bắt buộc persist mọi heartbeat) |
| `worker_done` | Kết thúc: `outcome` (`succeeded`/`failed`), `subject`, `body` tóm tắt, `--files-modified` / `--report-path` nếu có, `endedAt`, duration |
| `escalation` / `ask` đã reply | Cờ `blockedMs`, `escalationCount`, `questionCount` |
| `worker-release` / reclaimable settle | Đóng vòng: `releasedAt`; gắn process RSS/CPU sample cuối nếu collector host có |

**Nguyên tắc:** chỉ coordinator (hoặc script tooling chạy **cùng machine** với coordinator) được ghi SoT. Worker không tự POST vào product API.

### 2.2 Envelope tối thiểu từ Orca (đã có)

Từ `worker-list` / dispatch projection (quan sát thực tế):

- `dispatchId`, `taskId`, `runId`
- `provider.id` (vd. `cursor`), `host.kind`
- `workerState` / `dispatchStatus` / `terminalState`
- `resource.worktreeId`, `agentTerminalHandle`

**Thiếu (cần bổ sung ở lớp spike):** `roleId`, token/cost, RSS/CPU, SHA tip, Issue/PR numbers — lấy từ Task Spec + git + optional OS sampler tại settlement.

### 2.3 Pipeline đề xuất (MVP)

```text
coordinator check --wait
  → validate worker_done
  → scripts/agent-role-monitor/ingest-settlement.mjs  (đề xuất tên)
       đọc: payload worker_done + Task Spec roleId + optional host sample
       append 1 dòng JSONL (idempotent theo dispatchId)
  → worker-release / idle-fill
```

Idempotency: khóa tự nhiên `dispatchId`. Re-ingest cùng `dispatchId` → upsert / skip (at-least-once mailbox).

---

## 3. Schema draft (logical)

Không phải Prisma migration. Record JSON (một dòng JSONL = một object; cột PG tương đương nếu promote).

### 3.1 Bảng logic `role_dispatch_metric` (SoT row)

| Field | Type | Bắt buộc | Ghi chú |
| ----- | ---- | -------- | ------- |
| `schemaVersion` | int | có | Bắt đầu `1` |
| `dispatchId` | string | có | PK / unique |
| `taskId` | string | có | |
| `runId` | string | có | |
| `roleId` | string | có | Catalog: `backend`, `web`, `ios`, `architect`, `product-ba`, `product-design`, `reviewer-dod`, `reviewer-security`, hoặc `epic-planner` / `coordinator` nếu đo |
| `agent` | string | có | Thường `cursor` |
| `outcome` | enum | có khi settled | `succeeded` \| `failed` \| `cancelled` \| `unknown` |
| `startedAt` / `endedAt` | ISO-8601 UTC | endedAt khi settled | |
| `durationMs` | int | khuyến nghị | |
| `issueNumber` / `prNumber` | int null | không | Từ worktree link / Task Spec |
| `headSha` | string null | không | Exact SHA tip wt lúc settle (không PII) |
| `filesModifiedCount` | int null | không | Từ `--files-modified` nếu worker gửi |
| `reportPath` | string null | không | Path relative repo; không đọc nội dung vào SoT |
| `tokensIn` / `tokensOut` / `costUsd` | number null | không | **Null ở MVP** cho đến khi có nguồn tin cậy (Cursor/OTel) |
| `hostRssMbPeak` / `hostCpuPctAvg` | number null | không | Optional sampler; null nếu không đo |
| `escalationCount` / `questionCount` | int | default 0 | |
| `qualityProxy` | object null | không | VD. `{ dodPass: bool, knownGap: bool }` — **không** nhúng body review đầy đủ |
| `labels` | object | không | `epic`, `ownershipSlice`, `architectureImpact` — chỉ enum/short string |
| `ingestedAt` | ISO-8601 | có | |
| `source` | string | có | vd. `mailbox.worker_done` |

### 3.2 Event phụ (optional, cùng JSONL file hoặc `*.events.jsonl`)

Chỉ khi cần debug timeline: `{ dispatchId, type, ts, phase }` cho heartbeat thưa. Retention ngắn hơn row SoT (§4).

### 3.3 Aggregates (materialized offline)

Script đọc JSONL → `by_role.json`:

```json
{
  "roleId": "backend",
  "dispatchCount": 12,
  "successRate": 0.83,
  "p50DurationMs": 420000,
  "tokensOutSum": null
}
```

Không cần DB cho MVP dashboard nội bộ.

---

## 4. Retention & PII / privacy

| Hạng mục | Khuyến nghị |
| -------- | ----------- |
| Retention SoT row | 90 ngày local mặc định; xóa/archive theo `endedAt` |
| Heartbeat events | 7–14 ngày hoặc không persist |
| **Cấm** trong SoT | Prompt đầy đủ, transcript chat, secrets, `.env`, email user, nội dung `ask` dài, diff source |
| `worker_done` body | Chỉ giữ **hash/length** hoặc bỏ; executive summary 3 câu có thể chứa path/Issue — ưu tiên strip path home user (`/Users/...`) |
| SHA / Issue / PR | Cho phép (không phải PII sản phẩm Vemoki) |
| Tenant product | Metric role **không** gắn `tenant_id` Vemoki trừ khi sau này product hóa monitor multi-team — lúc đó là **tenant ops riêng**, không reuse RLS vé |

Privacy default: **host-local, gitignored**, không push JSONL lên remote; không gửi SaaS observability (ADR-11 cấm SaaS runtime; ngoại lệ tooling GitHub đã có — không mở rộng sang Langfuse cloud trừ quyết định ADR mới).

---

## 5. So sánh storage & khuyến nghị MVP

| Option | Ưu | Nhược | Phù hợp |
| ------ | -- | ----- | ------- |
| **A. JSONL local** (`var/agent-role-monitor/` hoặc `docs/spikes/.../data/` gitignored) | Zero RLS risk; idempotent append; fit spike; script ngoài monorepo apps | Không multi-host; không query SQL; backup thủ công | **MVP khuyến nghị** |
| **B. Postgres product DB** (bảng trong schema tenant) | Query mạnh; đồng bộ stack | Rủi ro lẫn ops metric với nghiệp vụ; bắt buộc `tenant_id`/RLS hoặc BYPASS anti-pattern; migration + role DB mới | **Không** cho spike/MVP |
| **C. Postgres ops/sidecar** (DB hoặc schema `orca_ops`, không RLS tenant vé) | SoT bền, vẫn tách trust boundary | Thêm Compose service/credentials; chưa cần cho đo nội bộ | Sau MVP nếu JSONL đau |
| **D. Redis** | Live “agent-top” counters | **Không SoT** (TD: Redis không quyết định trạng thái đúng); mất data khi restart | Chỉ cache/derived view |

### Khuyến nghị MVP (chốt đề xuất)

1. **SoT = JSONL local** + script ingest tại mailbox settlement (tooling dưới `scripts/agent-role-monitor/`, **không** `apps/api`).
2. Redis: optional sau, prefix riêng `arm:` — chỉ mirror aggregate gần đây.
3. Postgres product: **cấm** cho đến ADR riêng; nếu promote → option **C** (ops DB/schema), role DB kiểu Reporting/ops writer, **không** dùng Tenant API writer / không `set_config('app.tenant_id')` giả.

---

## 6. Fit monorepo & RLS nếu sau này vào product DB

### 6.1 Placement MVP

```text
scripts/agent-role-monitor/     # ingest, aggregate, retention GC
var/agent-role-monitor/         # gitignored JSONL (hoặc XDG data dir)
docs/spikes/agent-role-monitor/ # chỉ đặc tả (file này)
```

**Không** đặt Nest module trong `apps/api` / `packages/backend` ở giai đoạn spike: tránh authz surface, OpenAPI, và nhầm “product feature”.

Web surface (`07-web-surfaces.md`) đọc aggregate file hoặc static export — không cần BFF tenant.

### 6.2 Nếu promote vào Postgres (tương lai — không làm trong spike)

Điều kiện bắt buộc để **không phá** ADR-02:

| Quy tắc | Chi tiết |
| ------- | -------- |
| Tách trust | Schema `orca_ops` hoặc database riêng; **không** FK sang `tenants` / `tickets` |
| Không giả tenant | Không gán `tenant_id` Vemoki cho metric role trừ product multi-customer monitor đã thiết kế |
| DB role | Role mới `orca_ops_writer` / read-only reporter; **không** BYPASSRLS trên schema nghiệp vụ |
| Connection | Pool riêng; không share transaction client với tenant repositories |
| API | Nếu có HTTP: platform-operator only; không route `/v1/tenants/{id}/...` |
| Redis | Vẫn không SoT; rebuild từ PG/JSONL |

Vi phạm điển hình cần tránh: bảng `role_metrics` trong public schema với policy permissive “true”, hoặc worker product ghi metric bằng quyền Tenant API writer.

---

## 7. Rủi ro

| Risk | Mức | Mitigation |
| ---- | --- | ---------- |
| Attribution sai role (Spec thiếu Role ID) | Cao | Ingest fail-soft + `roleId=unknown`; DoD Task Spec bắt buộc Role ID (đã có rule catalog) |
| Token/cost mãi `null` | Trung bình | MVP vẫn hữu ích với duration/outcome/escalation; chờ OTel/Cursor export — không bịa số |
| Trùng ingest / mất mailbox message | Trung bình | Idempotent `dispatchId`; GC không xóa row chưa `endedAt` |
| PII lọt qua `body` / report path | Trung bình | Allowlist field; strip home paths; không copy transcript |
| Nhét vào product PG sớm | Cao (arch) | Giữ JSONL; promote chỉ qua ADR + schema ops |
| Coi Redis là SoT metric | Cao (đúng đắn) | Document + code review checklist backend |
| Multi-worktree ghi chung một file | Thấp–TB | Một writer = coordinator host; file lock hoặc append-only + unique key |
| Dashboard web đọc file local trong prod | Thấp (sau) | Chỉ khi có ops API; spike web dùng export tĩnh |

---

## 8. Acceptance (doc này)

- [x] Schema draft Role × Dispatch (§3)
- [x] Khuyến nghị MVP storage: **JSONL local + scripts tooling**; Redis không SoT; PG product không dùng (§5)
- [x] Retention / PII (§4)
- [x] Ingest từ mailbox settlement (§2)
- [x] RLS / tenant boundary nếu promote (§6)
- [x] Rủi ro (§7)

**Không làm trong task này:** migration, Nest module, Compose service, commit bắt buộc.

---

## 9. Handoff cho `00-synthesis` / roles khác

- **BA (`01`):** map taxonomy metric → field §3; đánh dấu field nào MVP vs later.
- **Architect (`03`):** xác nhận boundary “ops vs product DB”; OTel attribute names nếu align GenAI conventions.
- **Web (`07`):** đọc `by_role.json` export; không gọi `apps/api` tenant.
- **DoD (`05`):** exact-SHA evidence vẫn ở `docs/reviews/*` — data plane chỉ **proxy** chất lượng, không thay DoD artifact.
