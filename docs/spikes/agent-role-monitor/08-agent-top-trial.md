# 08 — Trial: agent-top trên host Orca / Cursor

**Spike:** [Agent Role Effectiveness Monitor](./README.md)  
**Role:** `product-ba` · Architecture impact: **Không** (trial tool ngoài; chỉ evidence)  
**Ngày:** 2026-10-18 · Host: `Mac.bbrouter` (darwin aarch64)  
**Product URL:** [https://agenttop.dev](https://agenttop.dev) · Harness docs: [https://agenttop.dev/harnesses/](https://agenttop.dev/harnesses/) · Live view: [https://agenttop.dev/live-view/](https://agenttop.dev/live-view/)  
**Không:** sửa `scripts/**` · không commit binary · không upload snapshot/SaaS

---

## 1. Mục tiêu trial

Xác nhận trên máy này (fleet Orca + nhiều `cursor-agent`):

1. Cài / chạy được agent-top.
2. Có thấy session Cursor với **CPU / MEM** (và process tree).
3. Trạng thái **tokens / cost** cho Cursor — docs upstream nói *not yet*; xác nhận thực tế.
4. Khuyến nghị: **integrate với ledger** (join PID/cwd) hay chỉ **manual**.

---

## 2. Cài đặt — lệnh + kết quả

### 2.1 `cargo install` — FAIL (rustc)

```text
$ cargo --version
cargo 1.94.1 (29ea6fb6a 2026-03-24)

$ rustc --version
rustc 1.94.1 (e408947bf 2026-03-25)

$ cargo install agent-top
# → Downloaded agent-top v0.27.1
# → error: rustc 1.94.1 is not supported by sysinfo@0.39.6 (requires rustc 1.95)

$ cargo install --locked agent-top
# → cùng lỗi sysinfo@0.39.6 requires rustc 1.95
```

**Kết luận cài cargo:** không dùng được với toolchain stable hiện tại (1.94.1). Không có binary dưới `~/.cargo/bin/agent-top`.

### 2.2 Homebrew — OK (đường chính trên máy này)

Theo [Getting started](https://agenttop.dev/getting-started/):

```text
$ brew install kannandreams/tap/agent-top
# → Formula agent-top (0.27.1)
# → /opt/homebrew/Cellar/agent-top/0.27.1

$ which agent-top
/opt/homebrew/bin/agent-top

$ agent-top --version
agent-top 0.27.1
```

License (brew): **MIT**. Binary local only; chạy với `AGENT_TOP_NO_UPDATE_CHECK=1` trong trial để tránh network check không cần thiết.

---

## 3. Lệnh quan sát

```bash
export AGENT_TOP_NO_UPDATE_CHECK=1

# Bảng một lần (TUI → stdout)
agent-top --once

# Snapshot JSON (scripts / join ledger) — giữ local, không upload
agent-top --json
```

Không chạy interactive TUI lâu trong worker (không cần); `--once` / `--json` đủ evidence.

---

## 4. Quan sát Cursor sessions (2026-10-18 ~23:22–23:23 local)

### 4.1 `agent-top --once` (snapshot đại diện)

```text
AGENT                    HARNESS  STATE        PID MODEL            TOKENS     COST   CPU%     MEM TOOLS PROCS  MCP     AGE
cursor:admin             cursor   idle        3523 -                     0    $0.00    0.0    141M     0     1    0     35m
cursor:main              cursor   idle       42003 -                     0    $0.00    0.4    876M     0     9    0     23m
cursor:Agent-monitor     cursor   running    57753 -                     0    $0.00   59.9    1.3G     0    10    0      1m
cursor:Agent-monitor     cursor   idle       60287 -                     0    $0.00    0.5    1.0G     0     7    0      1m
cursor:Agent-monitor     cursor   running    63186 -                     0    $0.00   27.8    1.1G     0    16    0      1m
cursor:Agent-monitor     cursor   running    64888 -                     0    $0.00    5.2    1.0G     0     9    0     10m
cursor:main              cursor   idle       71552 -                     0    $0.00    0.0    666M     0     7    0     15m
cursor:portal-dod-pr-455 cursor   idle       77571 -                     0    $0.00    0.3    1.7G     0    13    0      3m

8 agents (3 running, 5 idle, 0 stopped) · 0 tokens · $0.00 · 72 procs · 0 mcp · 0 orphaned
```

(Số hàng / CPU dao động giữa các lần poll; snapshot JSON sau đó còn 7 agents khi một process kết thúc.)

### 4.2 Trường JSON hữu ích (schema_version = 1)

Mỗi agent row có: `pid`, `name` (`cursor:<cwd-basename>`), `harness: "cursor"`, `state` (`running`|`idle`), `cwd`, `cpu_percent`, `rss_bytes`, `process_count`, `mcp_count`, `usage.*` (toàn 0), `cost_usd` (0), `model` (null), `session_id` (null), `session_path` (null), `attribution: "none"`, `tree` (cmdline `cursor-agent` / `agent`).

**Totals (JSON sau):** `tokens: 0`, `cost_usd: 0.0`, `mcp_processes: 0`, `orphaned_mcp: 0`; RSS cộng các agent ~ **6.5–7 GB**.

### 4.3 Đối chiếu OS

`ps` thấy nhiều `/Users/admin/.local/bin/cursor-agent` (+ alias `agent`) cùng version `2026.10.16-e3cb207` — khớp các PID agent-top liệt kê. Label tên lấy từ **basename của cwd** worktree (vd. `Agent-monitor`, `main`, `portal-dod-pr-455`).

---

## 5. Tokens / cost Cursor — xác nhận thực tế

| Nguồn | Claim |
| ----- | ----- |
| [Harness support](https://agenttop.dev/harnesses/) | **Aider, Copilot CLI, cursor-agent:** discovery = process table only; **Tokens and cost = not yet**; State = CPU heuristic |
| Spike `04-sota-landscape.md` / `00-synthesis.md` | Cursor tokens “not yet” |

**Trial này xác nhận:** mọi session `harness=cursor` hiện **TOKENS=0**, **COST=$0.00**, `model=null`, `session_id=null`, `attribution=none`. Không phải “session im” — agent đang `running` với CPU cao vẫn 0 token. → **Gap token/cost Cursor vẫn đúng; process CPU/MEM/cwd hữu dụng ngay.**

---

## 6. Khuyến nghị integrate với ledger

### Verdict

**Adopt agent-top làm nguồn host (CPU/MEM/process tree) + join ledger theo PID và/hoặc cwd — không chỉ manual.**  
**Không** dùng agent-top làm SoT cho token/$ Cursor cho đến khi adapter transcript có.

### Vì sao join (không chỉ manual)

| Join key | Độ tin | Ghi chú |
| -------- | ------ | ------- |
| **`pid`** | Cao trong cửa sổ sống | `agent-top --json` → `agents[].pid`; Orca/worker OS process của session đó. Cửa sổ ngắn (PID reuse) → ghi snapshot + `taken_at`. |
| **`cwd`** | Cao cho worktree Orca | Path tuyệt đối (`…/orca/workspaces/ticket-solution/Agent-monitor`) map worktree / Issue; basename → label `cursor:…`. Nhiều agent cùng cwd (parallel trên cùng wt) → **cần thêm pid**, không chỉ cwd. |
| **`session_id` / transcript** | Hiện **null** với Cursor | Không join được usage; đừng giả định. |
| **Role ID** | Không có trong agent-top | Vẫn lấy từ Task Spec / ledger Orca (`dispatch_id`, Role catalog) — agent-top không biết BA/BE. |

### Đề xuất MVP vận hành

1. **Manual OK** cho debug ad-hoc: `agent-top` / `agent-top --once` khi nghi host thrash / MCP orphan.
2. **Integrate nhẹ:** định kỳ (hoặc cuối Dispatch) `agent-top --json` local → join ledger trên `(pid | cwd)` + `dispatch_id` / `terminalHandle` đã biết từ Orca; lưu metric `host.cpu_percent`, `host.rss_bytes`, `process_count` với `meter=observed`.
3. **Không** ingest token từ agent-top cho Cursor; cost vẫn proxy (`wall_ms`, rework, invoice) theo taxonomy `01`.
4. Privacy: dữ liệu ở máy; **không** bật OTLP/`serve` upload trong spike này; tắt update check nếu cần (`AGENT_TOP_NO_UPDATE_CHECK=1`).

### Non-goals (trial)

- Không sửa scripts repo.
- Không production dashboard / portal Vemoki.
- Không brew/cargo binary trong git.

---

## 7. Acceptance checklist

| Tiêu chí | Kết quả |
| -------- | ------- |
| Cài + version ghi được | **OK** — Homebrew `0.27.1` (`/opt/homebrew/bin/agent-top`); cargo FAIL rustc 1.95 |
| Lệnh + quan sát Cursor CPU/MEM | **OK** — `--once` / `--json`; nhiều `cursor:*` với CPU% và MEM |
| Tokens Cursor “not yet” xác nhận thực tế | **OK** — luôn 0 / `$0.00` / `session_id=null` |
| Khuyến nghị ledger join vs manual | **OK** — join PID+cwd cho host; token vẫn manual/proxy |
| Cite agenttop.dev | **OK** |
| Không sửa scripts / không upload SaaS | **OK** |

**Outcome trial:** **succeeded** (cài bằng brew sau cargo fail; evidence đủ; gap Cursor tokens documented as known upstream + confirmed).
