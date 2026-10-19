# Cost catalog — Cursor model pins (Vemoki / Orca)

Nguồn **pin** `--model` theo Cost tier khi spawn `--agent cursor`. Rule: `.cursor/rules/orca-agent-routing.mdc`.

**Không** dùng `auto` / omit flags làm mặc định (inherit UI thường đắt). Chỉ fallback inherit khi host **reject** mọi ID trong band và đã ghi limitation.

**Trần tier (2026-10-19):** chỉ **`cheap`** và **`standard`**. Cấm Cost tier `heavy` và mọi `--model` vượt band standard (vd. `…-thinking-high`, `claude-sonnet-5-thinking-medium`, `gpt-5.6-sol-high`, `claude-opus-*`, `…-xhigh`/`max`/`ultra`). Task trước đây gắn `heavy` → **`standard`** + pin `composer-2.5` (mọi feature / architect / security).

**Composer (2026-10-19):** chỉ **Composer Standard** (`composer-2.5`). **Cấm** `composer-2.5-fast` (Composer Fast) trên mọi spawn Orca / preflight.

## Refresh catalog (bắt buộc khi pin fail / account đổi)

```text
agent models
# hoặc
cursor-agent models
```

Đối chiếu ID còn trong output. Nếu Orca có `~/Library/Application Support/orca/agent-model-catalog.json` entry `agent: cursor` thì ưu tiên ID khớp fingerprint host; hiện (2026-10-19) file đó chủ yếu cache **Codex** — Cursor pin lấy từ `agent models`.

Sau khi refresh: cập nhật bảng **Pinned** bên dưới + `Pinned at` nếu ID đổi.

## Pinned (host hangndat · 2026-10-19)

Nguồn: `agent models` trên máy này. Effort nằm **trong** model id Cursor (vd. `…-low`, `…-thinking-high`) → **không** truyền `--effort` trừ khi receipt/host yêu cầu rõ.

| Cost tier | `--model` (primary) | Fallback cùng band | Ghi chú |
| --------- | ------------------- | ------------------ | ------- |
| `cheap` | `composer-2.5` | `grok-4.7-low`, `gemini-3.7-flash-low` | Docs, hygiene, DoD hẹp, planner đơn |
| `standard` | `composer-2.5` | `claude-sonnet-5-thinking-low` | Mọi việc còn lại (feature, architect, security hot path, planner DAG rối, retry reasoning) |

**Cấm:** `composer-2.5-fast`; `claude-sonnet-5-thinking-medium`; tier/model vượt standard — `heavy`, `…-thinking-high`, `gpt-5.6-sol-high`, `…-xhigh`, `…-max`, `…-ultra`, `claude-opus-*` (kể cả user override trừ khi coordinator ghi ngoại lệ ngoài Orca spawn).

## Map spawn

```text
ORCA orchestration worker-start \
  --task <id> --worktree … --agent cursor \
  --model composer-2.5 \
  --display-name "James · dod+sec" \
  --json
```

Sau launch: so `launch.requested` vs `launch.effective`. Reject primary → thử fallback cùng tier → mới `launch: inherit (host rejected pins)` + limitation.

## Hạ tier (volume)

| Loại Task | Tier mặc định |
| --------- | ------------- |
| Docs/rules, Project comment, rename, board hygiene, CI fix hẹp | `cheap` (ưu tiên coordinator **inline** nếu &lt; ~15 phút) |
| DoD docs-only / revalidate tip SHA / checklist cũ (≤ ~15 file, không runtime) | `cheap` |
| Epic planner DAG đơn (&lt; ~8 Task, không ADR mở) | `cheap` |
| Feature coding, BA/PD, DoD runtime, reviewer-security (mọi hot path) | `standard` |
| Architect/ADR; planner DAG rối; retry sau FAIL reasoning | `standard` (`composer-2.5`; fallback `claude-sonnet-5-thinking-low` nếu host reject primary) |

Không tier cao hơn `standard`; không nâng model chỉ vì role “quan trọng”.

## Soft caps liên quan

- ≤ **3** reviewer (`reviewer-dod` + `reviewer-security`) live / Run — xem `orca-parallel-workers.mdc`

## Wave D — đo cost (bắt buộc 1 dòng / wave)

Sau mỗi wave `worker-start` (hoặc cuối checkpoint idle-fill), coordinator ghi **một dòng evidence** (Issue comment / Run note / chat leader):

```text
cost-wave | run=<id> | n=<spawned> | cheap=<c> standard=<s> | pinned=<p> inherit=<i> | inherit%=<i*100/n> | models=<effective ids> | source=receipt|receipt+mixed|wt-comment-estimate
```

| Trường | Nguồn |
| ------ | ----- |
| `cheap/standard` | Cost tier trong Spec / task-title / displayName (`heavy` legacy → đếm `standard`) |
| `pinned` | `launch.effective.model` (hoặc `requested`) khác null và không `auto` |
| `inherit` | omit `--model`, `--model auto`, hoặc receipt `effective.model` **null** |
| `models` | `launch.effective.model` (ưu tiên). Comment wt chỉ là soft signal (`source=mixed` / `wt-comment-estimate`) |
| `source` | `receipt` = chỉ worker-show; `receipt+mixed` = null effective nhưng comment có pin; `wt-comment-estimate` = `--comments-only` hoặc không live |

**Ngưỡng hành động:** `inherit%` > **20%** trong một đợt → refresh `agent models`, sửa pin stale, **không spawn thêm** cho đến khi wave kế có `--model` (Wave E). Comment wt **không** đủ để hạ `inherit%`.

Helper:

```text
node scripts/orca-cost-wave-evidence.mjs              # Wave E: receipts trước
node scripts/orca-cost-wave-evidence.mjs --comments-only  # ước lượng cũ (Wave D)
```

Weekday automation ticket-solution báo `inherit%` (comment) — leader vẫn chạy helper receipt sau mỗi wave spawn.

## Wave E — enforce `--model` trước spawn

Coordinator **không** gọi `worker-start` nếu argv thiếu pin:

```text
node scripts/orca-spawn-model-preflight.mjs -- \
  --agent cursor --model composer-2.5 --display-name "…" …
# exit 0 → mới worker-start với cùng flags
# exit 2 → thiếu/invalid --model → dừng wave
```

| Gate | Hành vi |
| ---- | ------- |
| Thiếu `--model` / `--model auto` | **Reject** wave (trừ `--terminal` reuse) |
| `--model` ngoài cost-catalog pin set | **Reject** — refresh `agent models` rồi cập nhật catalog |
| Receipt `effective.model` null sau spawn dù đã request | Ghi limitation; đếm **inherit** trên cost-wave; không claim pinned |

Snippet spawn tối thiểu:

```text
ORCA orchestration worker-start \
  --task <id> --worktree path:<abs> --agent cursor \
  --model <pin-from-cost-catalog> \
  --display-name "<Persona> · <ui-label>" \
  --json
```

Sau `worker-start`: đối chiếu `launch.requested` vs `launch.effective` trên receipt JSON; ghi dòng `cost-wave` với `source=receipt`.