# DoD — Agent Role Monitor MVP tooling

| Field | Value |
| ----- | ----- |
| Reviewer / session | Orca Cursor `reviewer-dod` · terminal `term_e4760862-ba20-4e04-a0a5-96d34a21378c` · task `task_8c8f0695245a` · dispatch `ctx_b05f81e01e96` |
| Independence | ≠ implementer coding workers + coordinator commits trên Run `run_bea857f8b31e` / research `run_0736a709b8b9` |
| Scope | `scripts/agent-role-monitor/**`, `package.json` `agent-metrics:*`, `.gitignore` `.orca-metrics/`, `docs/ops/AGENT-ROLE-MONITOR.md`, `docs/spikes/agent-role-monitor/**` |
| Commit SHA reviewed | `eb8292dc10ade8f29ba8932570103accd5397d1a` (`git rev-parse` trên branch `hangndat/Agent-monitor`) |
| Author of reviewed SHA | `hangndat <hangndat@gmail.com>` — `feat(tooling): MVP Agent Role metrics ledger + CLI` |
| Architecture impact | Không (review) |
| Neo | `github-project-tracking.mdc` evidence + [`docs/spikes/agent-role-monitor/05-dod-evidence-gates.md`](../spikes/agent-role-monitor/05-dod-evidence-gates.md) **tầng B** (MVP tooling vừa đủ) |
| Verdict | **PASS with known gap** |

## Checks (trên exact SHA)

| Check | Kết quả |
| ----- | ------- |
| `git rev-parse HEAD` | `eb8292dc10ade8f29ba8932570103accd5397d1a` |
| `node --test scripts/agent-role-monitor/smoke.test.mjs` | **pass** — 2/2 (idempotent settle + CLI ingest/rollup E2E) |
| Demo CLI `record-opened` → `ingest-settlement` → `rollup` (tmp ledger) | **ok** — `tokens_out_sum: null`, success_rate từ settled counts |
| Demo `host-sample --pid $$ --dispatch-id …` | **ok** — `ps` CPU/RSS → `host.sample` |
| Product DB / `apps/*` coupling trong `scripts/agent-role-monitor/**` | **không có** (grep postgres/Prisma/`apps/` trống) |
| Ledger path | default `.orca-metrics/role-dispatch.jsonl` · `.gitignore` dòng `.orca-metrics/` · `git check-ignore` xác nhận |

## Tầng B (MVP vừa đủ) — gate map

| Gate | Verdict | Evidence / ghi chú |
| ---- | ------- | ------------------ |
| M-1 Ledger schema | Partial → gap | Có `role_id`, `dispatch_id`, `task_id`, `run_id`, `agent`, outcome; thiếu persist đầy đủ §3.1 (`impl_sha` / `review_sha` / `reviewer_session` / Status timeline) — đủ cho ingest mailbox MVP, **không** crowning quality |
| M-2 Status ingest | Gap | Chỉ mailbox `worker_done`-ish settle; chưa ingest Project #3 Status authority |
| M-3 Exact-SHA link | N/A MVP | CLI-only; chưa UI so sánh chất lượng |
| M-4 Independence flag | Gap | Tooling không reject self-review; process vẫn dựa coordinator spawn reviewer ≠ implementer |
| M-5 Cost/resource | **PASS** | `tokens_out_sum` luôn `null` trong rollup; không điền `0`; host sample optional |
| M-6 Anti-cheat tests | Partial | Smoke chứng minh AC-6 idempotency `(dispatch_id, event)`; chưa fixture đủ AC-1…AC-10 |
| M-7 Sample integrity | Gap | Chưa exclusion log / cửa sổ pre-register |
| M-8 DoD artifact | **PASS** | File này + exact SHA + reviewer độc lập |
| M-9 Privacy | **PASS** | JSONL local gitignored; body → length + `body_sha256_12` only; không prompt/secret; không product Postgres |
| M-10 Incomparable | **PASS** (token) | Token thiếu = `null`, không crowning cost; docs ghi G-CURSOR-TOKEN-NULL |

**Claim boundary:** MVP **không** tuyên bố «role X hiệu quả hơn Y». Chỉ ledger + rollup process counts + optional host sample.

## Findings

### Non-blocking (đã sửa docs trong commit artifact)

1. **Ops runbook §4 lệch entrypoint (trên SHA review):** `docs/ops/AGENT-ROLE-MONITOR.md` còn trỏ `record-opened.mjs` / `ingest-settlement.mjs` / `rollup.mjs` + `ARM_LEDGER` — file đó **không tồn tại**; entry thật là `cli.mjs` + `ORCA_METRICS_LEDGER` / `pnpm agent-metrics:*` (khớp `scripts/agent-role-monitor/README.md`). Sửa docs trong commit kèm artifact này (không đổi behavior tooling).
2. **`00-synthesis` Implementation status** còn «CLI entry: Chờ BE» — stale; cập nhật «Đã có».

### Should-fix (không FAIL MVP)

3. Schema chưa persist `cost_tokens_*` / meter status enum — rollup hard-code `tokens_out_sum: null` (đúng gap, nhưng chưa có field audit `token_source=unknown` trên từng event).
4. Chưa có ingest Project Status / exact review SHA — cần trước khi claim coding effectiveness theo role.

### Không phát hiện

- Không vanity / fantasy score trong rollup.
- Không ghi ledger vào product DB / Redis SoT.
- Không sửa `apps/api|web|mobile` trong commit reviewed.

## Known gaps (chấp nhận — khớp `05` §7 + runbook §6)

| Gap ID | Mô tả | Điều kiện |
| ------ | ----- | --------- |
| G-CURSOR-TOKEN-NULL | Cursor path opaque; tokens chưa join Dispatch | Để `null`; **cấm** crowning cost; **cấm** ghi `0` |
| G-ORCA-METER | `worker-list` không token/CPU per role | Claim resource = unknown / out-of-scope |
| G-HOST-MAP | Map `terminalHandle` → PID chưa ổn định | `host.sample` optional / fail-soft |
| G-MVP-SCHEMA | Thiếu field §3.1 đầy đủ + Status timeline + independence flag | Chỉ exploratory process metrics; cấm public ranking «role winner» |
| G-SAMPLE-SIZE | Chưa có fleet sample thật trên đợt production | Chỉ tooling readiness |

## Verdict rationale

MVP tooling **đạt** tiêu chí task «vừa đủ»: CLI/smoke tái chạy trên exact SHA; ledger local gitignored + privacy OK; không vanity claims; gap token Cursor ghi rõ và rollup giữ `null`.  
**Không** đủ M-1…M-7 đầy đủ để công bố so sánh hiệu quả role production — vì vậy **PASS with known gap**, không **PASS** tuyệt đối.

## Merge / Project note

Reviewer **không** merge và **không** đặt Project `Hoàn thành`. Coordinator quyết định board sau khi đọc gaps.
