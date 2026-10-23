# Cost catalog — Cursor + Codex (Vemoki / Orca)

Nguồn **pin** `--model` theo agent và Cost tier. Rules: `orca-agent-routing-core.mdc` · coordinator spawn: `orca-agent-routing-coordinator.mdc`.

**Không** dùng `auto` / omit flags làm mặc định (inherit UI thường đắt). Chỉ fallback inherit khi host **reject** mọi ID trong band và đã ghi limitation.

**Trần tier (2026-10-19):** chỉ **`cheap`** và **`standard`**. Cấm Cost tier `heavy` và mọi `--model` vượt band standard (vd. `…-thinking-high`, `claude-sonnet-5-thinking-medium`, `gpt-5.6-sol-high`, `claude-opus-*`, `…-xhigh`/`max`/`ultra`). Task trước đây gắn `heavy` → **`standard`**. Codex chọn lọc theo bảng dưới là ngoại lệ được user duyệt 2026-10-23, không mở tier mới.

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

| Cost tier  | `--model` (primary) | Fallback cùng band                     | Ghi chú                                                                                    |
| ---------- | ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `cheap`    | `composer-2.5`      | `grok-4.7-low`, `gemini-3.7-flash-low` | Docs, hygiene, DoD hẹp, planner đơn                                                        |
| `standard` | `composer-2.5`      | `claude-sonnet-5-thinking-low`         | Mọi việc còn lại (feature, architect, security hot path, planner DAG rối, retry reasoning) |

**Cấm:** `composer-2.5-fast`; `claude-sonnet-5-thinking-medium`; tier/model vượt standard — `heavy`, `…-thinking-high`, `gpt-5.6-sol-high`, `…-xhigh`, `…-max`, `…-ultra`, `claude-opus-*` (kể cả user override trừ khi coordinator ghi ngoại lệ ngoài Orca spawn).

## Map spawn

```text
ORCA orchestration worker-start \
  --task <id> --worktree … --agent cursor \
  --model composer-2.5 \
  --display-name "James · dod+sec" \
  --task-title "James · dod+sec — PR #<n> exact SHA" \
  --json
```

Sau launch: so `launch.requested` vs `launch.effective`. Reject primary → thử fallback cùng tier → mới `launch: inherit (host rejected pins)` + limitation.

## Hạ tier (volume)

| Loại Task                                                                     | Tier mặc định                                                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Docs/rules, Project comment, rename, board hygiene, CI fix hẹp                | `cheap` (ưu tiên coordinator **inline** nếu &lt; ~15 phút)                                   |
| DoD docs-only / revalidate tip SHA / checklist cũ (≤ ~15 file, không runtime) | `cheap`                                                                                      |
| Epic planner DAG đơn (&lt; ~8 Task, không ADR mở)                             | `cheap` + Composer; một planner/Epic, task lẻ nhỏ làm inline                                                                                      |
| Feature coding, BA/PD, DoD runtime, reviewer-security (mọi hot path)          | `standard`                                                                                   |
| Architect/ADR; planner DAG rối; retry sau FAIL reasoning                      | `standard` (`composer-2.5`; fallback `claude-sonnet-5-thinking-low` nếu host reject primary) |

Không tier cao hơn `standard`; không nâng model chỉ vì role “quan trọng”.

## Soft caps liên quan

Theo user: giữ fan-out tối đa task ready trong scope dưới caps 5 non-review + 3 reviewer; một planner/Epic khi triển khai Epic. Reuse cùng Composer/context dù task chuyển cheap ↔ standard. Cùng model không có nghĩa cùng chi phí: task dài/context lớn vẫn tiêu hao nhiều hơn. Quy tắc hiện hành: `orca-parallel-workers.mdc`.

- ≤ **3** reviewer (`reviewer-dod`, `reviewer-security`, `reviewer-uiux`) live / Run; gộp nhiều role trong một session tính **một** reviewer — xem `orca-parallel-workers.mdc`.

## Wave D — đo cost (bắt buộc 1 dòng / wave)

Sau mỗi wave `worker-start` (hoặc cuối checkpoint idle-fill), coordinator ghi **một dòng evidence** (Issue comment / Run note / chat leader):

```text
cost-wave | run=<id> | n=<spawned> | cheap=<c> standard=<s> | pinned=<p> inherit=<i> | inherit%=<i*100/n> | models=<effective ids> | source=receipt|receipt+mixed|wt-comment-estimate
```

| Trường           | Nguồn                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `cheap/standard` | Cost tier trong Spec / task-title / displayName (`heavy` legacy → đếm `standard`)                                                             |
| `pinned`         | `launch.effective.model` khác null và không `auto`; requested không chứng minh effective                                                                         |
| `inherit`        | omit `--model`, `--model auto`, hoặc receipt `effective.model` **null**                                                                       |
| `models`         | `launch.effective.model` (ưu tiên). Comment wt chỉ là soft signal (`source=mixed` / `wt-comment-estimate`)                                    |
| `source`         | `receipt` = chỉ worker-show; `receipt+mixed` = null effective nhưng comment có pin; `wt-comment-estimate` = `--comments-only` hoặc không live |

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

| Gate                                                   | Hành vi                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Thiếu `--model` / `--model auto`                       | **Reject** wave (trừ `--terminal` reuse)                           |
| `--model` ngoài cost-catalog pin set                   | **Reject** — refresh `agent models` rồi cập nhật catalog           |
| Receipt `effective.model` null sau spawn dù đã request | Ghi limitation; đếm **inherit** trên cost-wave; không claim pinned |

Snippet spawn tối thiểu:

```text
ORCA orchestration worker-start \
  --task <id> --worktree path:<abs> --agent cursor \
  --model <pin-from-cost-catalog> \
  --display-name "<Persona> · <ui-label>" \
  --task-title "<Persona> · <ui-label> — #<issue> <tóm tắt>" \
  --json
```

Sau `worker-start`: đối chiếu `launch.requested` vs `launch.effective` trên receipt JSON; ghi dòng `cost-wave` với `source=receipt`.

## Codex chọn lọc — 2026-10-23

| Vai trò | Agent/model mặc định | Điều kiện |
| --- | --- | --- |
| Coordinator / Orchestrator | codex / `gpt-6-sol` | Phân công, quyết định, tổng hợp review và xử lý blocker |
| Backend, web/portal, iOS | cursor / `composer-2.5` | Coding thường lệ theo spec/AC rõ |
| Documentation, unit tests | cursor / `composer-2.5` | cheap |
| Architect phức tạp, security | codex / `gpt-6-sol` | standard; ưu tiên khi quyền sử dụng khả dụng |
| DoD | cursor / `composer-2.5` hoặc codex / `gpt-6-sol` | Codex cho auth/tenant, contract, reasoning phức tạp |
| Critical implementation | codex / `gpt-6-sol` | Coordinator ghi lý do và scope cụ thể |

Pin GPT-6 = `gpt-6-sol`, có trong catalog host 2026-10-23; catalog không chứng minh entitlement. Không tự đổi sang Astra/6.1 hoặc model khác. Codex truyền `--effort medium` (hoặc low); preflight từ chối effort cao hơn. Cặp agent/model phải khớp; không truyền Codex pin vào Cursor.

Thử nghiệm ban đầu: tối đa **1 Codex worker live** toàn fleet được coordinator quan sát (các session user khác vẫn có thể dùng chung allowance). Không tăng đồng loạt 5 coding + 3 reviewer. Kiểm allowance trước/sau, ghi thời điểm/reset/source; dữ liệu thiếu = unknown, không coi bằng 0 hoặc unlimited. Khi allowance unknown, coordinator Codex vẫn điều phối theo chỉ định user; không mở thêm Codex worker ngoài benchmark được chỉ định. Task thực thi thông thường giao Composer. Token count không quy đổi trực tiếp thành phần trăm allowance hay USD. Gói ChatGPT không cấp thêm Cursor quota; không tự chuyển sang API billing.

Fallback giữ nguyên Cursor primary → các pin cùng band → inherit chỉ khi host reject tất cả và có limitation; preflight vẫn chặn inherit mặc định. Codex hết quota/auth/model unavailable → checkpoint, xác minh attempt đã dừng và settle theo Orca recovery rồi Cursor replacement cùng Task/worktree; không chạy hai owner cùng lúc. Không reset worktree. Ghi fallback riêng, không gán kết quả Composer cho Codex.

Chỉ mở rộng tỷ lệ sau benchmark: cùng SHA/input, reviewer độc lập, findings được xác minh, thời gian và allowance có nguồn. Một cặp review không đủ kết luận tỷ lệ đạt DoD cho coding hoặc pilot ready.

`pinned` trong cost-wave chỉ đo effective model có được ghi nhận; preflight kiểm allowlist trước spawn. Coordinator vẫn phải đối chiếu requested/effective để phát hiện host đổi model. Metrics không thay quota gate.

Host Orca 1.4.237: `--display-name` truyền tại `task-create`; với `worker-start --worktree current` không truyền creation-only flags (gồm `--display-name`). Persona giữ trong Task; `--task-title` vẫn truyền khi start.

## Điều chỉnh theo user sau benchmark — 2026-10-23

**Codex điều phối; Composer làm phần ít cần suy luận.** Coordinator giữ context quyết định, contract, findings và checkpoint; giao Composer coding theo spec rõ, docs, viết/chạy test theo AC, thu log/CI và sửa lỗi đã xác định nguyên nhân. Worker trả báo cáo ngắn kèm paths, SHA/checks và blocker; coordinator đọc sâu khi cần quyết định hoặc xác minh rủi ro. Gộp việc nhỏ vào task Composer phù hợp; lifecycle và hygiene vài lệnh vẫn do coordinator thực hiện, không spawn chỉ để đổi vài dòng.

Giới hạn 1 Codex worker live không tính coordinator gốc, nhưng allowance tính cả hai. Chỉ mở thêm Codex cho kiến trúc phức tạp, security/contract review cần suy luận hoặc critical implementation có lý do. Reviewer vẫn khác implementer. User báo tổng tiêu hao 4% quota tuần; số đo benchmark chỉ bao phủ một đoạn phiên. Chưa tăng tỷ lệ Codex workers hoặc chạy thêm benchmark. Fallback hiện có giữ nguyên.
