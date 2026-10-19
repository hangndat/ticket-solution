# Cost catalog — Cursor model pins (Vemoki / Orca)

Nguồn **pin** `--model` theo Cost tier khi spawn `--agent cursor`. Rule: `.cursor/rules/orca-agent-routing.mdc`.

**Không** dùng `auto` / omit flags làm mặc định (inherit UI thường đắt). Chỉ fallback inherit khi host **reject** mọi ID trong band và đã ghi limitation.

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
| `cheap` | `composer-2.5-fast` | `composer-2.5`, `grok-4.7-low`, `gemini-3.7-flash-low` | Docs, hygiene, DoD hẹp, planner đơn |
| `standard` | `composer-2.5` | `claude-sonnet-5-thinking-medium`, `claude-sonnet-5-thinking-low` | Feature BE/web/iOS, BA/PD, DoD thường |
| `heavy` | `claude-sonnet-5-thinking-high` | `gpt-5.6-sol-high` | Architect/ADR, security hot path, DAG rối, retry reasoning |

**Cấm mặc định:** `…-xhigh`, `…-max`, `…-ultra`, `claude-opus-*` (trừ user/spec yêu cầu rõ).

## Map spawn

```text
ORCA orchestration worker-start \
  --task <id> --worktree … --agent cursor \
  --model composer-2.5-fast \
  --display-name "James · reviewer-dod" \
  --json
```

Sau launch: so `launch.requested` vs `launch.effective`. Reject primary → thử fallback cùng tier → mới `launch: inherit (host rejected pins)` + limitation.

## Hạ tier (volume)

| Loại Task | Tier mặc định |
| --------- | ------------- |
| Docs/rules, Project comment, rename, board hygiene, CI fix hẹp | `cheap` (ưu tiên coordinator **inline** nếu &lt; ~15 phút) |
| DoD docs-only / revalidate tip SHA / checklist cũ (≤ ~15 file, không runtime) | `cheap` |
| Epic planner DAG đơn (&lt; ~8 Task, không ADR mở) | `cheap` |
| Feature coding, BA/PD thường, DoD có runtime/checks | `standard` |
| `reviewer-security` thường | `standard` |
| Architect/ADR; security authz/RLS/quota/check-in/secrets; planner DAG rối; retry sau FAIL reasoning | `heavy` |

DoD thường **không** nâng `heavy` chỉ vì implementer đã `heavy`.

## Soft caps liên quan

- ≤ **2** `heavy` live / Run (`orca-agent-routing` / `orca-parallel-workers`)
- ≤ **3** reviewer (`reviewer-dod` + `reviewer-security`) live / Run — xem `orca-parallel-workers.mdc`
