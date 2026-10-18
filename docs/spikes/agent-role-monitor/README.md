# Spike — Agent Role Effectiveness Monitor

**Mục tiêu nghiên cứu:** làm sao đo hiệu quả từng Role catalog (`docs/agents/roles/*`) về cost/token, output chất lượng, và resource host (RAM/CPU) trong stack Orca + Cursor của ticket-solution / Vemoki.

**Không phải:** implement production dashboard ngay; không deploy; không merge bắt buộc.


## Trạng thái MVP (implementation)

| Hạng mục | Status | Path |
| -------- | ------ | ---- |
| Research spike `01`–`07` + `00` | **Xong** (research) | thư mục này |
| Runbook coordinator (mailbox ingest) | **Xong** (docs) | [`docs/ops/AGENT-ROLE-MONITOR.md`](../../ops/AGENT-ROLE-MONITOR.md) |
| Scripts CLI (`record-opened` / `ingest-settlement` / `rollup`) | **Đang làm** (ownership BE) | [`scripts/agent-role-monitor/`](../../../scripts/agent-role-monitor/) — lib ledger đã có; entry CLI theo Task BE |
| Portal `apps/web` | **Hoãn** | xem `07-web-surfaces.md` |
| Token Cursor / OTel export | **Gap** (`null` / phase 2) | runbook §6 · `03` / `05` |

Coordinator: copy-paste hook từ runbook vào `check --wait` loop — **không** đợi portal.

## Output files (ownership — không đụng file người khác)

| Role | File |
| ---- | ---- |
| product-ba | `01-ba-metrics-taxonomy.md` |
| product-design | `02-pd-monitor-ux.md` |
| architect | `03-architect-telemetry.md` |
| research/SOTA (BA-lens) | `04-sota-landscape.md` |
| reviewer-dod | `05-dod-evidence-gates.md` |
| backend | `06-backend-data-plane.md` |
| web | `07-web-surfaces.md` |
| coordinator (sau wave) | `00-synthesis.md` — **đã có** (Run `run_0736a709b8b9`) |

## Điểm neo internet (seed — worker SOTA phải mở rộng/verify)

- OpenTelemetry GenAI semantic conventions / agent observability: https://zylos.ai/research/2026-02-28-opentelemetry-ai-agent-observability/
- Multi-agent OTel handoff + token per agent: https://docs.base14.io/guides/ai-observability/agent-observability/
- Agent monitoring layers (Langfuse, vLLM, node exporter): https://devfloor9.github.io/engineering-playbook/en/docs/agentic-ai-platform/operations-mlops/observability/agent-monitoring
- Google Gemini Enterprise Agent Platform observability: https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/observability/overview
- agent-top (live CPU/MEM/tokens/cost per harness): https://agenttop.dev/live-view/

## Context nội bộ bắt buộc đọc

- `docs/agents/README.md` — Role ID catalog
- `.cursor/rules/orca-agent-routing.mdc` — agent = cursor
- `.cursor/rules/github-project-tracking.mdc` — WIP / đo nhẹ process
- `.cursor/rules/orca-coordinator-mailbox.mdc` — Dispatch lifecycle
- Orca reality: `worker-list --json` có lifecycle/provider, **chưa** có token/CPU per role

## Constraints chung

- Tiếng Việt user-facing; giữ URL/IDs/commands tiếng Anh.
- Architecture impact: Có (telemetry / privacy / attribution).
- Không sửa apps production ngoài docs spike này.
- Commit không bắt buộc; ưu tiên file markdown đủ evidence + khuyến nghị MVP.
