# 04 — SOTA landscape: agent observability / cost / resource

**Role:** `product-ba` · **Architecture impact:** Không (scan landscape).  
**Phát hiện buộc ADR (nếu làm tiếp):** xem §6 — không phải quyết định trong file này.

**Mục tiêu:** so sánh các hệ đã làm observability / cost / resource cho agent với nhu cầu đo hiệu quả **Role catalog** Vemoki trên stack **Orca + Cursor local**; kết luận build vs buy vs hybrid.

**Nguồn:** WebSearch/WebFetch tháng 10/2026; chỉ ghi tính năng đã thấy trên tài liệu chính thức hoặc trang sản phẩm đã mở. Không suy diễn “chắc có”.

---

## 1. Nhu cầu Vemoki / Orca (khung so sánh)

Từ spike README + catalog roles (`docs/agents/README.md`):

| Nhu cầu | Ý nghĩa trên stack ta |
| ------- | --------------------- |
| Attribution theo **Role ID** | `product-ba`, `backend`, `web`, `ios`, `reviewer-dod`, … — khác “agent framework name” |
| Attribution theo **Dispatch / Task / Run** | Orca đã có lifecycle (`taskId`, `dispatchId`, `worker-list`); chưa có token/CPU per role |
| Token + cost | Cursor là agent vendor; transcript/API usage thường **không** nằm trong app LangChain của ta |
| Host resource | Parallel workers → cần CPU/RAM (và leak MCP/process) theo session/worker |
| Quality | DoD / exact-SHA / review verdict — không chỉ LLM-as-judge trên prompt |
| Privacy / local-first | Prompt, code, credentials không nên mặc định lên SaaS |

**Gap trung tâm:** hầu hết LLM observability giả định *bạn instrument app gọi model*. Stack ta là *IDE agent (Cursor) do Orca điều phối* — lớp proxy/SDK thường **không** chạm được request LLM của Cursor.

---

## 2. Seed links — verify

| Seed (README) | Kết quả verify |
| ------------- | -------------- |
| [zylos — OTel AI agent observability](https://zylos.ai/research/2026-02-28-opentelemetry-ai-agent-observability/) | Tổng hợp GenAI conventions + agent spans; hữu ích làm overview, không phải spec chuẩn |
| [base14 — agent observability](https://docs.base14.io/guides/ai-observability/agent-observability/) | Guide OTel: `gen_ai.conversation.id` + `gen_ai.agent.name` + `invoke_agent` / `execute_tool`; backend thương mại **base14 Scout** |
| [devfloor9 — agent monitoring layers](https://devfloor9.github.io/engineering-playbook/en/docs/agentic-ai-platform/operations-mlops/observability/agent-monitoring) | Mô hình lớp: Langfuse (LLM) + vLLM + DCGM + Node Exporter — pattern hybrid rõ |
| [Google Gemini Enterprise Agent Platform — observability](https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/observability/overview) | Dashboard token/latency/quality + **container CPU/memory** + dual-attribution audit; gắn GCP |
| [agent-top live view](https://agenttop.dev/live-view/) | TUI local: CPU/MEM/tokens/cost per harness; refresh ~1s |

**Bổ sung (mở rộng ngoài seed):** OpenTelemetry blog GenAI (2026), Langfuse Agent Graphs, LangSmith Observability, Helicone self-host/cost, Arize Phoenix self-host.

---

## 3. Hệ / tool đã khảo sát (≥5)

### 3.1 OpenTelemetry GenAI semantic conventions

- **Là gì:** Chuẩn attribute/span/metric cho GenAI (status **Development** trên repo conventions), không phải sản phẩm dashboard.
- **Tín hiệu:** `gen_ai.usage.input_tokens` / `output_tokens`; metrics agent (`gen_ai.invoke_agent.duration`, `.inference_calls`, `.tool_calls`); spans `invoke_agent`, `execute_tool`, `chat`.
- **Multi-agent:** `gen_ai.agent.name` + `gen_ai.conversation.id` (và workflow spans).
- **License / host:** Spec Apache-2.0 (OTel); tự chọn backend OTLP.
- **Cite:** [GenAI metrics](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md), [OTel blog GenAI observability](https://opentelemetry.io/blog/2026/genai-observability/).
- **Cursor+Orca:** Blog nêu VS Code Copilot / Codex / Claude Code có đường OTel; **không** liệt kê Cursor. Áp dụng được như **từ điển attribute** nếu sau này Orca hoặc harness emit OTLP — map Role ID → `gen_ai.agent.name`, Dispatch → `gen_ai.conversation.id` (hoặc attribute custom). Không giải CPU host một mình.

### 3.2 Langfuse

- **Là gì:** Nền tảng LLM eng (trace, prompt, eval, dashboard); Cloud hoặc self-host.
- **Tín hiệu:** Trace/observation, token & cost, latency; agent graphs từ observation types / LangGraph.
- **Multi-agent:** Graph/nesting theo observation; không phải “Role catalog” sẵn.
- **License / host:** OSS **MIT**; self-host core free (unlimited units); Cloud có Hobby/Core/Pro.
- **Cite:** [Agent Graphs](https://langfuse.com/docs/observability/features/agent-graphs), [Self-hosted pricing](https://langfuse.com/pricing-self-host), [Cloud pricing](https://langfuse.com/pricing).
- **Cursor+Orca:** Mạnh nếu ta **instrument** worker/app gọi LLM. Yếu cho session Cursor IDE (không đi qua Langfuse SDK). Không đo CPU process tree harness. Self-host phù hợp privacy hơn Cloud.

### 3.3 LangSmith

- **Là gì:** Observability + evaluation (+ deployment adjacency) của LangChain.
- **Tín hiệu:** Traces/runs, monitor dashboards, feedback/annotation, online evals; token/cost theo usage billing của nền tảng.
- **Multi-agent:** Nested runs / threads trong app được instrument.
- **License / host:** Commercial SaaS; self-hosted / hybrid trong gói **Enterprise** (theo pricing + platform docs).
- **Cite:** [LangSmith Observability](https://docs.smith.langchain.com/observability), [Pricing](https://www.langchain.com/pricing).
- **Cursor+Orca:** Fit kém — stack không phải LangChain app; self-host Enterprise nặng cho side-project local. Không giải host RAM/CPU worker Orca.

### 3.4 Helicone

- **Là gì:** AI Gateway + LLM observability; tích hợp chủ đạo qua **proxy** / gateway.
- **Tín hiệu:** Cost (gateway = accurate per docs; direct integration = best-effort), latency, tokens, sessions + custom properties; caching/routing khi dùng gateway.
- **Multi-agent:** Session headers / properties để nhóm request — không có model “role catalog” sẵn.
- **License / host:** OSS; self-host Docker / K8s documented.
- **Cite:** [GitHub Helicone](https://github.com/Helicone/helicone/), [Self-host overview](https://docs.helicone.ai/getting-started/self-host/overview), [Cost tracking](https://docs.helicone.ai/guides/cookbooks/cost-tracking).
- **Cursor+Orca:** Chỉ hữu ích nếu mọi LLM call đi qua proxy Helicone. Cursor vendor path thường **không** cho ta gắn base URL proxy → **không áp dụng trực tiếp** cho worker Cursor hiện tại. Có thể xét sau cho service **trong repo** (API/eval scripts) nếu có.

### 3.5 agent-top

- **Là gì:** TUI/local dashboard kiểu htop cho coding agents trên máy; đọc transcript + process table; read-only.
- **Tín hiệu:** Tokens + cost (từ transcript harness), CPU%/MEM process tree, tool calls, MCP/orphan processes, burn rate ($/h); export Perfetto / OTLP.
- **Multi-agent:** Hàng theo session/harness; subagent fold theo harness; **không** biết Role ID Orca.
- **License / host:** Crate `agent-top` (agenttop.dev / docs.rs): **MIT**; data không rời máy (trừ update check tắt được / OTLP endpoint bạn chỉ định).
- **Cite:** [Live view](https://agenttop.dev/live-view/), [Harness support](https://agenttop.dev/harnesses/), [crates.io README / MIT](https://docs.rs/crate/agent-top/latest/source/README.md).
- **Cursor+Orca (quan trọng):** Bảng harness ghi **Aider, Copilot CLI, cursor-agent: process table only — tokens “not yet”**; state CPU heuristic. → Hữu ích ngay cho **CPU/MEM/MCP leak** của process Cursor; **chưa** thay thế đo token/cost Cursor. Rất gần nhu cầu resource host của Orca parallel workers.

### 3.6 Google Gemini Enterprise Agent Platform (observability)

- **Là gì:** Observability trong nền tảng agent Google Cloud (Registry → Observability tab).
- **Tín hiệu:** Sessions/turns/invocations; token in/out; latency p50/p95/p99; error rates; **Evaluation** (quality, safety, hallucination, tool-use quality); **Usage** = container CPU/memory allocation + tokens; traces DAG; dual-attribution (agent SPIFFE + human user).
- **Multi-agent:** Topology + per-agent dashboards; MCP server metrics.
- **License / host:** Dịch vụ GCP (không self-host stack ta).
- **Cite:** [Observability overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/observability/overview).
- **Cursor+Orca:** Pattern tham khảo (token + quality + infra trên cùng UI). **Buy/migrate** không khớp local Cursor+Orca.

### 3.7 base14 Scout (+ guide OTel)

- **Là gì:** Hướng dẫn instrument agent bằng OTel GenAI + sản phẩm **Scout** lưu/truy vấn trace LLM/agent.
- **Tín hiệu:** Timeline conversation; token/cost metrics theo guide; tool/MCP `execute_tool`; evaluation events; cost theo agent.
- **Multi-agent:** Handoff = `invoke_agent` con + `gen_ai.agent.name` khác nhau + cùng `gen_ai.conversation.id`.
- **License / host:** Commercial observability (Scout); pattern OTel có thể tái dùng với backend khác.
- **Cite:** [AI Agent Observability](https://docs.base14.io/guides/ai-observability/agent-observability/), [AI Observability overview](https://docs.base14.io/guides/ai-observability/).
- **Cursor+Orca:** Pattern attribution multi-agent **rất khớp** mental model Orca (Run/conversation + Role/agent name). Cần emitter — chưa có sẵn từ Cursor.

### 3.8 Arize Phoenix (bổ sung)

- **Là gì:** OSS AI observability & evaluation trên OpenTelemetry / OpenInference; local `phoenix serve` hoặc Docker/K8s.
- **Tín hiệu:** Traces, evals, datasets/experiments; native OTel.
- **Multi-agent:** Qua instrumentation framework (LangGraph, Agents SDK, …).
- **License / host:** **Elastic License 2.0** — self-host free; cấm offer như managed service cho bên thứ ba.
- **Cite:** [Self-hosting](https://arize.com/docs/phoenix/self-hosting), [License](https://arize.com/docs/phoenix/self-hosting/license), [GitHub phoenix](https://github.com/Arize-ai/phoenix).
- **Cursor+Orca:** Backend OTLP local tốt nếu có emitter; vẫn phụ thuộc instrument. MCP server của Phoenix có thể hữu ích cho debug trace — không thay DoD Project.

### 3.9 Layered ops playbook (tham chiếu kiến trúc, không phải 1 vendor)

- **Cite:** [Agent monitoring](https://devfloor9.github.io/engineering-playbook/en/docs/agentic-ai-platform/operations-mlops/observability/agent-monitoring).
- **Bài học:** Tách lớp LLM (Langfuse) vs model server vs GPU vs **Node Exporter (CPU/mem host)** — khớp việc Orca cần resource host **độc lập** với LLM SaaS.

---

## 4. Bảng so sánh

Ký hiệu: ✅ có (đã document) · ◐ một phần / phụ thuộc tích hợp · ❌ không / không áp dụng stack ta · ? chưa thấy trên nguồn đã mở.

| Hệ | Token | Cost | CPU/RAM host | Quality / eval | Multi-agent attribution | License / self-host | Áp dụng Cursor+Orca local |
| -- | ----- | ---- | ------------ | -------------- | ----------------------- | ------------------- | ------------------------- |
| **OTel GenAI conventions** | ✅ attrs/metrics | ◐ derive từ token | ❌ (cần infra metrics riêng) | ◐ eval events (tùy impl) | ✅ `agent.name` + `conversation.id` | Spec mở; backend tùy chọn | Từ điển + future emit; Copilot/Codex có OTel, Cursor chưa thấy |
| **Langfuse** | ✅ | ✅ | ❌ | ✅ scores/evals | ✅ graphs / nesting | MIT + self-host | Self-host OK cho app instrumented; không cover Cursor LLM path |
| **LangSmith** | ✅ | ✅ (platform usage) | ❌ | ✅ datasets/evals/feedback | ✅ nested runs | SaaS; self-host Enterprise | Buy kém fit; nặng cho local |
| **Helicone** | ✅ (qua proxy) | ✅ (gateway accurate) | ❌ | ◐ metrics “quality” ở cấp request | ◐ sessions/properties | OSS + self-host | Proxy thường **không** gắn được vào Cursor |
| **agent-top** | ✅ harness có transcript; **Cursor: not yet** | ✅ tương tự | ✅ process tree | ❌ (không DoD) | ◐ session/harness, không Role ID | MIT (crate agent-top) | **Cao** cho resource; token Cursor còn gap |
| **Google Agent Platform obs.** | ✅ | ◐ (usage/token; cost cloud) | ✅ container CPU/mem | ✅ online eval widgets | ✅ topology + agent identity | GCP managed | Pattern tham khảo; không deploy stack ta |
| **base14 Scout** | ✅ (qua OTel) | ✅ (guide) | ◐ nếu correlate infra spans | ✅ eval events | ✅ swim lanes / handoff | Commercial + OTel pattern | Pattern attribution; cần emitter |
| **Arize Phoenix** | ✅ (OTel) | ◐ từ usage attrs | ❌ native | ✅ evals/experiments | ◐ qua instrument | ELv2 self-host free | Backend local tốt nếu có OTLP |

---

## 5. Map sang nhu cầu Role monitor

| Nhu cầu Vemoki | Hệ gần nhất | Ghi chú BA |
| -------------- | ----------- | ---------- |
| Cost/token per **Role ID** | OTel attrs / Langfuse metadata / Helicone properties | Phải **gắn nhãn** từ Orca Task Spec — không vendor nào biết `reviewer-dod` sẵn |
| Cost/token per **Dispatch** | `gen_ai.conversation.id` (OTel/Scout) hoặc session id | Map 1–1 Dispatch ↔ conversation/session |
| CPU/RAM worker song song | **agent-top** + Node Exporter pattern (playbook) | Ưu tiên local; Cursor token vẫn thiếu |
| Quality / DoD | Project + `docs/reviews/*` (nội bộ) | Langfuse/LangSmith/Phoenix eval = lớp phụ, **không thay** exact-SHA DoD |
| Multi-agent Orca tree | Scout/OTel handoff model | Coordinator depth-0 + workers = conversation + agent names |
| Không leak prompt | agent-top (local) / Phoenix-Langfuse self-host / OTel metadata-only | Cloud LangSmith/Helicone/Google = ADR privacy nếu bật content |

---

## 6. Architecture impact — khi nào cần ADR

Landscape này **Không** chọn ADR. Các hướng sau **sẽ** buộc ADR nếu coordinator mở Epic implement:

1. **Gửi transcript/prompt Cursor lên SaaS** (LangSmith Cloud, Helicone Cloud, Scout Cloud, …).
2. **Bắt buộc OTel collector** trong đường critical của Orca (deps, retention, PII).
3. **Proxy LLM Cursor** qua Helicone/gateway (thường infeasible + vendor constraint).
4. **Thay DoD Project bằng LLM-as-judge** từ Langfuse/Phoenix (xung đột `github-project-tracking.mdc`).

---

## 7. Kết luận: build vs buy vs hybrid

### Khuyến nghị: **hybrid** (không full-buy, không full-build dashboard GenAI)

| Lớp | Chiến lược | Vì sao |
| --- | ---------- | ------ |
| **Attribution plane (Role / Task / Dispatch)** | **Build** mỏng trên Orca | Chỉ Orca biết Role ID + lifecycle; vendor không biết catalog Vemoki |
| **Host CPU/RAM / MCP leak** | **Buy/adopt** agent-top (hoặc tương đương local) + metric OS | Đã có tín hiệu process; Cursor token chưa có nhưng CPU đã có |
| **Token/cost Cursor** | **Build/wait** | agent-top: cursor-agent tokens *not yet*; không giả định Helicone/Langfuse cover được |
| **Chuẩn schema** | **Adopt** OTel GenAI attribute names | Tránh invent taxonomy song song; map Role → `gen_ai.agent.name` khi emit |
| **Trace UI / eval lab (optional)** | **Buy/self-host** Langfuse **hoặc** Phoenix | Chỉ khi có emitter (worker script / future harness OTel) — không bắt buộc MVP |
| **LangSmith / Google Agent Platform / Helicone-as-Cursor-proxy** | **Defer / không mua** cho spike này | Fit sản phẩm hoặc path tích hợp không khớp local Cursor+Orca |

### Không khuyến nghị

- **Full buy** một SaaS GenAI observability làm “source of truth” hiệu quả Role — sẽ miss host resource + Role catalog + DoD.
- **Full build** clone Langfuse — lãng phí; chất lượng/eval UI đã có OSS.
- Coi **VS Code Copilot OTel** (blog OTel) là bằng chứng Cursor đã emit — nguồn không khẳng định vậy.

### MVP áp dụng gợi ý (cho `00-synthesis` / Epic sau — ngoài scope file này)

1. Emit/ghi nhận từ Orca: `roleId`, `taskId`, `dispatchId`, pid/worktree (build).
2. Join với agent-top (hoặc `ps`/cgroup) theo pid/cwd (adopt).
3. Token/cost: theo dõi agent-top Cursor adapter; tạm thời manual/vendor invoices nếu cần.
4. Quality: giữ DoD exact-SHA; optional Phoenix/Langfuse chỉ cho experiment prompt — tách khỏi Project Status.

---

## 8. Non-goals (file này)

- Không chọn stack production cuối cùng (đó là synthesis/ADR).
- Không benchmark giá Cloud chi tiết theo volume Vemoki (pricing đổi nhanh — cite trang, không lock số vào AC).
- Không implement collector / dashboard.

---

## 9. Sources (index URL)

1. https://zylos.ai/research/2026-02-28-opentelemetry-ai-agent-observability/
2. https://docs.base14.io/guides/ai-observability/agent-observability/
3. https://docs.base14.io/guides/ai-observability/
4. https://devfloor9.github.io/engineering-playbook/en/docs/agentic-ai-platform/operations-mlops/observability/agent-monitoring
5. https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/observability/overview
6. https://agenttop.dev/live-view/
7. https://agenttop.dev/harnesses/
8. https://docs.rs/crate/agent-top/latest/source/README.md
9. https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md
10. https://opentelemetry.io/blog/2026/genai-observability/
11. https://langfuse.com/docs/observability/features/agent-graphs
12. https://langfuse.com/pricing-self-host
13. https://langfuse.com/pricing
14. https://docs.smith.langchain.com/observability
15. https://www.langchain.com/pricing
16. https://github.com/Helicone/helicone/
17. https://docs.helicone.ai/getting-started/self-host/overview
18. https://docs.helicone.ai/guides/cookbooks/cost-tracking
19. https://arize.com/docs/phoenix/self-hosting
20. https://arize.com/docs/phoenix/self-hosting/license
21. https://github.com/Arize-ai/phoenix
