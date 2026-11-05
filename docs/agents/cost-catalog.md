# Cost catalog — tier và mapping model (Vemoki / Orca)

Nguồn **pin** `--model` theo agent và Cost tier. Rules: `docs/agents/policies/routing.md` · coordinator spawn: `docs/agents/workflows/dispatch.md`.

**Không** dùng `auto` / omit flags làm mặc định (inherit UI thường đắt). Chỉ fallback inherit khi host **reject** mọi ID trong band và đã ghi limitation.

**Năm tier (2026-10-24):** `cheap`, `standard`, `focused`, `advanced`, `high`. Tier mô tả mức độ công việc; agent/model/effort được chọn từ mapping hiện hành bên dưới. Coding theo bảng OpenCode Go; reviewer/chuyên gia không coding ở tier `focused|advanced|high` ưu tiên Claude Sonnet 5 trước Codex khi user không chỉ định khác. Cấm Cost tier `heavy` và các model/effort ngoài pin hiện hành (vd. Cursor `…-thinking-high`, `claude-sonnet-5-thinking-medium`, `gpt-5.6-sol-high`, `claude-opus-*`; Codex `xhigh`/`max`/`ultra`).

**Composer (2026-10-19):** chỉ **Composer Standard** (`composer-2.5`). **Cấm** `composer-2.5-fast` (Composer Fast) trên mọi spawn Orca / preflight.

## Refresh catalog (bắt buộc khi pin fail / account đổi)

```text
agent models
# hoặc
cursor-agent models
```

Đối chiếu ID còn trong output. Với Cursor, ưu tiên ID khớp fingerprint host nếu có trong `~/Library/Application Support/orca/agent-model-catalog.json`; nếu không thì lấy từ `agent models`. Với Claude, đối chiếu entry `agent: claude` và effort trên host; không dùng pin Cursor cho Claude Code.

Sau khi refresh: cập nhật bảng **Pinned** bên dưới + `Pinned at` nếu ID đổi.

## Coding — chỉ định user 02/11/2026

Khi giao **code**, thay Composer 2.5 bằng hai model **OpenCode Go** dưới đây. Đây là lựa chọn cho worker coding; coordinator vẫn Codex và reviewer độc lập giữ route được giao. Code đơn giản không dùng Codex. Các route cũ còn trong catalog phục vụ task khác hoặc chỉ định riêng; khi OpenCode lỗi, dùng ngoại lệ Codex Luna bên dưới; không đổi Cursor ngầm.

| Loại coding                                               | Cost tier                                 | `--agent`  | `--model`                         | `--effort`                                                   |
| --------------------------------------------------------- | ----------------------------------------- | ---------- | --------------------------------- | ------------------------------------------------------------ |
| Nhanh, đơn giản, nhiều request                            | `cheap`, `standard`                       | `opencode` | `opencode-go/deepseek-v4.1-flash` | Không truyền                                                 |
| Cần reasoning hoặc context lớn                            | `focused`, `advanced`, `high` theo rủi ro | `opencode` | `opencode-go/deepseek-v4-pro`     | Không truyền                                                 |
| Fallback khi OpenCode Go báo limit/quota hoặc lỗi runtime | Giữ tier Task hiện tại (`cheap`–`high`)   | `codex`    | `gpt-6-luna`                      | `low` cheap/standard/focused; `medium` advanced; `high` high |

Pin đã được xác minh bằng `opencode models` trên host ngày 02/11/2026; Orca có active account OpenCode Zen-Go. OpenCode không hỗ trợ `--effort` qua Orca: tier vẫn là metadata về scope/rủi ro, `high` vẫn bắt buộc `--tier-reason`. Start qua wrapper với `--employee`, trên worktree hiện có và kiểm requested/effective trong receipt. Không suy quota hoặc mức giá/off-peak từ tên model hay từ quota Codex; giữ số lượng quota unknown khi provider không cung cấp.

**Fallback user cập nhật 02/11/2026:** khi OpenCode Go báo limit/quota hoặc lỗi runtime, chuyển thẳng sang Codex `gpt-6-luna`, giữ employee, Task, Cost tier và review/fix budget. Không dùng Beam Free. Checkpoint và xác minh attempt cũ đã dừng trước `--retry-of`; không bật Extra Usage. Flash/Pro vẫn là primary. Chi tiết: [fallback OpenCode](policies/provider-fallback.md).

## Pinned (Cursor host hangndat · 2026-10-19; Codex/Claude · 2026-10-24)

Nguồn: `agent models` trên máy này. Effort nằm **trong** model id Cursor (vd. `…-low`, `…-thinking-high`) → **không** truyền `--effort` trừ khi receipt/host yêu cầu rõ.

| Cost tier  | `--agent` | `--model` primary | `--effort`   | Fallback cùng tier                                                 |
| ---------- | --------- | ----------------- | ------------ | ------------------------------------------------------------------ |
| `cheap`    | `cursor`  | `composer-2.5`    | Không truyền | `grok-4.7-low`, `gemini-3.7-flash-low`; Claude `claude-haiku-5-5` / không effort (xem ghi chú 05/11) |
| `standard` | `cursor`  | `composer-2.5`    | Không truyền | `grok-4.7-low`, `gemini-3.7-flash-low`; Claude `claude-haiku-5-5` / không effort (xem ghi chú 05/11) |
| `focused`  | `claude`  | `claude-sonnet-5` | `low`        | Codex `gpt-6-sol` / `low`; `gpt-6.1-sol` / `low` khi Sol 6 đầy tải |
| `advanced` | `claude`  | `claude-sonnet-5` | `medium`     | Codex `gpt-6-sol` / `medium`                                       |
| `high`     | `claude`  | `claude-sonnet-5` | `high`       | Codex `gpt-6-sol` / `high`                                         |

**Pinned at 05/11/2026 — Claude Haiku ở `cheap`/`standard`:** user yêu cầu thêm route khi cả ba route `cheap`/`standard` khác đồng thời không dùng được trong cùng dispatch (`cursor` launcher bị tắt ở host, `codex gpt-6-luna` còn 12% dưới reserve 20%, `opencode-go/deepseek-v4.1-flash` báo hết weekly usage limit — Task `task_d7f44eb4446f`, Run `run_8394757df5b2`). Đăng ký `agent: claude, model: claude-haiku-5-5, effort: null` trong `scripts/lib/agent-cost-tiers.mjs` để preflight chấp nhận; chưa có probe/benchmark xác nhận Haiku tương đương Sonnet cho việc review design. Dùng route này khi các route khác cùng tier đều đã xác minh không khả dụng, không thay cho `claude-sonnet-5` ở các tier có reasoning cần `focused+`.

Task mới khai báo tier độc lập với agent/model/effort. Mapping thực thi nằm trong `scripts/lib/agent-cost-tiers.mjs`: mỗi tier là danh sách các route được phép. Khi thêm model khác, xác minh pin/effort trên host và cập nhật route cùng bảng này; tên tier và tiêu chí công việc giữ nguyên. Preflight chấp nhận đúng tổ hợp đã đăng ký, không tự mở model mới.

**Pinned at 2026-10-30 — fallback focused:** user yêu cầu chọn model tiết kiệm khi Cursor hết usage; Claude cũng usage-limited và dispatch `ctx_303d8eee5ee5` gặp `gpt-6-sol` capacity error. Host probe cache `agent-model-catalog.json` lúc `2026-10-30T14:29:34.365Z` (fingerprint `54876ac0198101d3b359b7fe638e4611cd11153f76da98c256309a6dd8f09db0`) có `gpt-6.1-sol` với effort `low`; session James đã chạy tiếp thành công trên model này, còn receipt trước recovery giữ pin cũ. Đăng ký fallback `focused` / `low` để launch mới có receipt đúng; không bật Fast. Cùng bucket quota `codex`, giữ reserve và giới hạn worker hiện hành. Chưa có phép đo giá hoặc benchmark chứng minh hai model tương đương.

### Claude cùng tier với Codex

Reviewer/chuyên gia không coding ở tier `focused|advanced|high` ưu tiên Claude Sonnet 5 trước Codex; coordinator gốc vẫn dùng Codex. Worker coding dùng bảng OpenCode Go ở trên. Claude Code dùng `--agent claude`, khác Claude qua Cursor (`--agent cursor`). Pin đọc từ cache Orca host ngày 2026-10-24, entry live gần nhất `2026-10-23T15:22:09.147Z`; đây là bằng chứng pin/effort, chưa chứng minh entitlement hoặc launch thành công. Dùng ID phiên bản ở bảng, không dùng alias trôi `sonnet`/`opus`, không bật Fast hoặc effort vượt high.

“Tương ứng” là cùng tiêu chí task/gate; chưa có benchmark chứng minh ngang chất lượng, giá hay mức dùng quota. `focused` dùng Sonnet low cho câu hỏi hẹp; `advanced` dùng Sonnet medium cho suy luận nhiều bước; `high` dùng Sonnet high và vẫn bắt buộc `--tier-reason`.

Thứ tự route trong `agent-cost-tiers.mjs` là thứ tự ưu tiên: Claude trước Codex. Coordinator chọn Claude nếu quota và scope phù hợp; chọn Codex cùng tier khi Claude không khả dụng, quota không đủ/unknown, có evidence cần đổi provider hoặc user chỉ định Codex, và ghi lý do. Wrapper vẫn yêu cầu agent/model/effort tường minh, không tự fallback/retry. Chọn một route trước dispatch dựa trên scope và quota provider; không chạy cả hai để đối chứng trừ khi task yêu cầu. Khi chuyển provider, giữ checkpoint/SHA, findings và số lượt sửa; xác minh attempt cũ đã dừng. Không chuyển ngầm do quota Codex thấp. Claude chưa có quota adapter: coordinator kiểm `/usage` của đúng tài khoản trước dispatch, ghi thời điểm/reset/source; unknown thì hoãn Claude và xét Codex cùng tier với quota hợp lệ. Áp dụng dự phòng 20% và lý do việc thiết yếu như Codex nếu provider hiển thị phần trăm còn lại; wrapper hiện chỉ ghi `adapter_unavailable`, không tự enforce quota Claude. Giữ nguyên caps hiện hành, không tăng fan-out khi có thêm provider.

Tên cũ chỉ dùng khi đọc evidence: `codex-low` → `focused`, `codex-medium` → `advanced`, `heavy` → `standard`. Preflight yêu cầu tên mới cho launch mới; không sửa receipt lịch sử.

**Cấm:** `composer-2.5-fast`; mọi `claude-sonnet-5-thinking-*` trên `--agent cursor` (kể cả `thinking-low`); Cursor vượt `standard`; tier `heavy`; Codex/Claude effort `xhigh|max|ultra`; model ngoài pin trong bảng. Tier `high` không mở các pin Cursor bị cấm. Coding UI/test thường lệ dùng OpenCode Go Flash `standard`; coding cần reasoning/context lớn dùng Pro với tier tương ứng. `high` chỉ khi khớp tiêu chí high.

## Map spawn

Đặt Persona khi tạo Task trước; start trên current/existing chỉ truyền launch flags hợp lệ. Ví dụ:

```text
ORCA orchestration task-create \
  --display-name "James · dod+sec" \
  --task-title "James · dod+sec — PR #<n> exact SHA" \
  --spec "<spec đã điền>" --json

node scripts/agent-workflow-run.mjs start \
  --run-id <RUN> --task <id> --role-id reviewer-dod --employee james \
   --task-title "James · dod+sec — PR #<n> exact SHA" \
  --cost-tier <tier-theo-scope> --agent <agent-theo-bang> --model <pin-theo-bang>
```

Chọn tier/route trước dispatch; thêm effort đúng bảng khi agent hỗ trợ, không dùng placeholder nguyên văn. Sau launch: so `launch.requested` vs `launch.effective`. Reject primary → xét fallback cùng tier có evidence → mới inherit khi đủ điều kiện catalog và ghi limitation; không retry attempt chưa xác minh dừng.

## Chọn một trong năm tier

Chọn tier theo **quyết định cần đưa ra, mức độ rõ của giải pháp và hậu quả nếu làm sai**. Tiêu chí `high` bên dưới được xét trước tên role, loại file, số file hoặc tên giai đoạn. Một Task nhận tier cao nhất cần cho phần việc chưa thể tách độc lập.

| Tier       | Khi nào chọn                                                                                                                    | Ví dụ / ranh giới                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cheap`    | Thao tác và expected outcome đã rõ, ít quyết định, hậu quả sai thấp                                                             | Thu log, chạy test có sẵn, sửa trình bày/link, ghi quyết định đã chốt, chia DAG đơn từ AC rõ. Chưa cấp verdict cho invariant nhạy cảm.                      |
| `standard` | Cần thực hiện và tự kiểm một giải pháp trong phạm vi rõ; chưa cần phân tích sâu                                                 | Coding/UI/BA/PD thường lệ, viết test theo AC, tái hiện và sửa lỗi cục bộ, review thông thường. Coding dùng OpenCode Go Flash.                               |
| `focused`  | Cần phán đoán kỹ thuật tập trung cho một câu hỏi hẹp, bằng chứng và contract đã rõ, rủi ro thấp                                 | Đối chiếu một consumer với contract đã chốt; xác minh một giả thuyết cụ thể hoặc một finding không nhạy cảm. Không dùng chỉ để chạy lệnh/thu log.           |
| `advanced` | Cần suy luận nhiều bước, lần theo vài module hoặc so sánh phương án; phạm vi và rủi ro vẫn có giới hạn                          | Phân tích tác động của contract tương thích, debug có vài giả thuyết từ evidence, review luồng logic nhiều module nhưng không ảnh hưởng invariant nhạy cảm. |
| `high`     | Quyết định kiến trúc còn mở với trade-off lớn hoặc hậu quả sai nghiêm trọng; bất kỳ tiêu chí high bên dưới đều ưu tiên tier này | Kiến trúc khó, auth/tenant, race/idempotency, migration rủi ro, sự cố nghiêm trọng; triển khai và review tương ứng. Spec rõ vẫn chọn high nếu rủi ro cao.   |

`focused` và `advanced` mô tả độ sâu phán đoán; effort cụ thể phụ thuộc mapping của agent/model đang chọn. Năm tier mô tả mức phân công; không suy ra thứ tự giá tiền hay tỷ lệ quota khi chưa có phép đo. Revalidate chọn tier theo diff và findings còn mở; sửa ít file không tự hạ tier.

### Mặc định tiết kiệm quota

Việc khó nhưng scope rõ, rủi ro giới hạn mặc định `advanced`. Coding dùng bảng OpenCode Go; reviewer/chuyên gia không coding ưu tiên Claude Sonnet 5 medium, Codex GPT-6 Sol medium là lựa chọn sau theo catalog. Câu hỏi hẹp dùng `focused`; triển khai thường lệ dùng `standard`. Không chọn `high` chỉ vì nhiều file, nhiều bước hoặc thời gian dài. Không lần lượt thử đủ năm tier: chọn thẳng mức cần thiết từ evidence; giữ nguyên giới hạn sửa của review-convergence.

Tier `high` bắt buộc lý do cụ thể trong Task Spec và `--tier-reason` khi preflight/start. Flag này chỉ lưu local, không truyền vào Orca. Thu evidence/việc nhỏ gom cùng context; giữ reviewer độc lập cho verdict.

### Khi nào dùng `high`

Ghi trong Task Spec rủi ro cụ thể, quyết định cần suy luận và evidence cần kiểm. Chọn `high` cho:

- Thiết kế hoặc sửa ranh giới auth, phân quyền, tenant/RLS, secrets hay dữ liệu nhạy cảm khi sai sót có thể cấp sai quyền hoặc lộ dữ liệu.
- Thay đổi invariant nghiệp vụ nhiều bước: giao dịch, idempotency, race condition, offline sync hoặc trạng thái tiền/vé/check-in; cần phân tích failure modes và recovery.
- Migration dữ liệu/schema hoặc contract xuyên slice có nguy cơ mất dữ liệu, phá tương thích hay làm sai dữ liệu đang phục vụ.
- Quyết định kiến trúc/ADR có nhiều phương án và trade-off lớn, ảnh hưởng nhiều slice hoặc khó đảo ngược.
- Điều tra sự cố bảo mật hoặc lỗi production nghiêm trọng; chẩn đoán bug cần suy luận về race, thứ tự sự kiện, nhiều tầng hệ thống hoặc các giả thuyết xung đột sau khi đã thu evidence. Chỉ chưa biết nguyên nhân của một lỗi cục bộ không đủ để chọn `high`.
- Review DoD/security độc lập của các thay đổi trên, hoặc review cần kiểm chứng nhiều invariant và đường tấn công trên exact SHA.

Coding `high` dùng `--agent opencode --model opencode-go/deepseek-v4-pro`, không truyền effort. Reviewer/chuyên gia `high` ưu tiên `--agent claude --model claude-sonnet-5 --effort high`, Codex cùng tier khi phù hợp chỉ định/quota. Giữ lý do tier, caps và reviewer độc lập. Coding `cheap|standard` dùng OpenCode Go Flash; tên tier không chứng minh một task thực tế tiêu hao ít hơn task khác.

### Tách việc và chuyển tier

- Tách implementation thông thường cho OpenCode Go Flash khi có đầu vào, đầu ra và ranh giới độc lập; coding cần reasoning/context lớn dùng Pro. Bàn giao ghi contract/AC đã chốt, expected outcome, paths và điểm phải dừng để coordinator quyết định. Không tách mọi hàng trong bảng thành một worker; gom việc nhỏ cùng context.
- Việc sửa logic vẫn khớp tiêu chí `high` sau handoff thì tiếp tục chọn mapping thuộc `high`. Spec rõ hoặc đã có handoff thiết kế không tự biến thay đổi rủi ro cao thành `standard`.
- Worker gặp quyết định/rủi ro vượt scope: checkpoint evidence và báo coordinator phân loại lại phần còn lại trước khi tiếp tục. Câu hỏi hẹp cần phán đoán kỹ thuật → `focused`; cần nhiều bước nhưng rủi ro giới hạn → `advanced`; khớp tiêu chí high → `high`. Một lần FAIL hoặc thiếu nguyên nhân ban đầu không tự nâng tier; chuyển tier không reset số lượt sửa theo review-convergence.
- Reviewer chọn tier từ diff, invariant và findings đang mở. Người thu evidence có thể khác người kết luận; chạy test đạt không thay verdict độc lập.

| Ví dụ                         | Cách chia                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Offline sync/check-in         | Coding logic xung đột/idempotency dùng OpenCode Go Pro `high`; Flash viết test đơn giản từ expected outcome đã chốt (`standard`); reviewer Claude `high` (Codex fallback) khác implementer kiểm invariant. Nếu phải thiết kế expected outcome cho race thì phần test cũng là `high`. |
| Sửa bảng/list trong portal    | OpenCode Go Flash `standard` triển khai và reviewer độc lập review UI; thu ảnh theo kịch bản đã chốt có thể `cheap`. Nếu phải sửa logic cấp quyền hoặc tenant scoping, dùng Pro `high`.                                                                                              |
| Lỗi chưa rõ nguyên nhân       | Coding sửa lỗi cục bộ đã rõ dùng Flash `standard`; coding cần lần theo nhiều module dùng Pro `advanced`. Khi evidence chỉ ra race hoặc nhiều invariant nhạy cảm, chọn `high`; reviewer vẫn độc lập.                                                                                  |
| Đổi một field API tương thích | Flash `standard` triển khai theo spec; Claude `focused` (Codex fallback) đối chiếu consumer khi cần review độc lập. Coding phải lần qua nhiều module dùng Pro `advanced`; đụng quyền, dữ liệu nhạy cảm hoặc phá tương thích → Pro `high`.                                            |

## Soft caps liên quan

Theo user: giữ fan-out tối đa task ready trong scope dưới caps 5 non-review + 3 reviewer; planner chỉ khi Epic ≥2 owner và dep artifact thật. Reuse cùng Composer/context dù task chuyển cheap ↔ standard. Cùng model không có nghĩa cùng chi phí: task dài/context lớn vẫn tiêu hao nhiều hơn. Quy tắc hiện hành: `docs/agents/workflows/dispatch.md`.

- ≤ **3** reviewer (`reviewer-dod`, `reviewer-security`, `reviewer-uiux`) live / Run; gộp nhiều role trong một session tính **một** reviewer — xem `docs/agents/workflows/dispatch.md`.

## Wave D — đo cost (bắt buộc 1 dòng / wave)

Sau mỗi wave `worker-start` (hoặc cuối checkpoint idle-fill), coordinator ghi **một dòng evidence** (Issue comment / Run note / chat leader):

```text
cost-wave | run=<id> | n=<spawned> | cheap=<c> standard=<s> focused=<l> advanced=<m> high=<h> | pinned=<p> inherit=<i> | inherit%=<i*100/n> | models=<effective ids> | source=receipt|receipt+mixed|wt-comment-estimate
```

| Trường          | Nguồn                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Năm bộ đếm tier | Ưu tiên khai báo Cost tier trong Task Spec, rồi task-title, cuối cùng comment/displayName worktree (`heavy` legacy → đếm `standard`)                                     |
| `pinned`        | `launch.effective.model` khác null và không `auto`; requested không chứng minh effective                                                                                 |
| `inherit`       | omit `--model`, `--model auto`, hoặc receipt `effective.model` **null**                                                                                                  |
| `models`        | `launch.effective.model` (ưu tiên). Comment wt chỉ là soft signal (`source=mixed` / `wt-comment-estimate`)                                                               |
| `source`        | `receipt` = start receipt local hoặc worker-show; `receipt+mixed` = null effective nhưng comment có pin; `wt-comment-estimate` = `--comments-only` hoặc không có receipt |

**Ngưỡng hành động:** `inherit%` > **20%** trong một đợt → refresh `agent models`, sửa pin stale, **không spawn thêm** cho đến khi wave kế có `--model` (Wave E). Comment wt **không** đủ để hạ `inherit%`.

Helper:

```text
node scripts/orca-cost-wave-evidence.mjs --run RUN --dispatch DISPATCH --receipt-file .orca-metrics/lifecycle/.../start-receipt.json  # Wave E; lặp --dispatch/--receipt-file cho cả wave
node scripts/orca-cost-wave-evidence.mjs --run RUN --comments-only  # ước lượng cũ (Wave D), chỉ worker active của Run
```

Weekday automation ticket-solution báo `inherit%` (comment) — leader vẫn chạy helper receipt sau mỗi wave spawn.

## Wave E — enforce `--model` trước spawn

Coordinator **không** gọi `worker-start` nếu argv thiếu pin:

```text
node scripts/orca-spawn-model-preflight.mjs -- \
  --cost-tier standard --agent opencode --model opencode-go/deepseek-v4.1-flash
# exit 0 → worker-start với agent/model/effort; cost-tier/tier-reason là metadata local
# exit 2 → thiếu/sai tier hoặc agent/model/effort → dừng wave
```

`--cost-tier` bắt buộc với preflight và `agent-workflow-run.mjs start`; đây là metadata local, không truyền flag này vào Orca `worker-start`. Khi reuse `--terminal`, coordinator đối chiếu model/effort effective trong receipt với tier mới trước khi giao việc; preflight reuse không chứng minh tier khớp.

| Gate                                                             | Hành vi                                                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Thiếu `--model` / `--model auto`                                 | **Reject** wave (trừ `--terminal` reuse)                                                        |
| Thiếu/sai `--cost-tier`, hoặc agent/model/effort không khớp tier | **Reject** trước snapshot/start; ví dụ Codex `high` + effort `medium` sai. Codex Luna/Terra `standard` + `low` là route đã đăng ký, chỉ dùng đúng điều kiện catalog |
| `--model` ngoài cost-catalog pin set                             | **Reject** — refresh `agent models` rồi cập nhật catalog                                        |
| Receipt `effective.model` null sau spawn dù đã request           | Ghi limitation; đếm **inherit** trên cost-wave; không claim pinned                              |

Snippet spawn trên existing worktree sau khi Task đã có Persona:

```text
node scripts/agent-workflow-run.mjs start \
  --run-id <RUN> --task <id> --worktree path:<abs> \
  --role-id <role> --employee <employee> --cost-tier <tier> \
  --agent <agent-from-cost-catalog> --model <pin-from-cost-catalog> \
  --task-title "<Persona> · <ui-label> — #<issue> <tóm tắt>"
```

Thêm `--effort` theo route và `--tier-reason` khi tier high. Wrapper thực hiện preflight/start và trả JSON; không chạy start trực tiếp thêm lần nữa. Đối chiếu `launch.requested` vs `launch.effective` trên receipt; ghi dòng `cost-wave` với `source=receipt`.

## Vai trò và năm tier — 2026-10-24

| Vai trò                         | Agent/model mặc định                                                                              | Điều kiện                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coordinator / Orchestrator      | codex / `gpt-6-sol`                                                                               | `advanced` cho điều phối thường lệ; phần quyết định khó/rủi ro theo tiêu chí `high`                                                                     |
| Backend, web/portal, iOS coding | opencode / `opencode-go/deepseek-v4.1-flash` hoặc `opencode-go/deepseek-v4-pro`                   | Flash cho code đơn giản; Pro cho reasoning/context lớn, tier theo rủi ro                                                                                |
| Documentation, unit tests       | Coding test dùng OpenCode Go Flash/Pro theo tier; docs/evidence không coding theo route được giao | `cheap` cho ghi chép/thu evidence đã chốt; test đơn giản `standard`; quyết định policy/invariant và thiết kế test phức tạp phân loại theo tiêu chí tier |
| Architect phức tạp, security    | Claude trước Codex theo tier                                                                      | `high` nếu khớp tiêu chí trên; đối chiếu/phân tích có giới hạn chọn `focused` hoặc `advanced`                                                           |
| DoD                             | cursor / `composer-2.5` hoặc Codex/Claude theo tier                                               | Thường lệ `standard`; Codex/Claude chọn `focused`, `advanced` hoặc `high` theo câu hỏi review và rủi ro                                                 |
| Critical implementation         | opencode / `opencode-go/deepseek-v4-pro`                                                          | `high`; coordinator ghi lý do và scope cụ thể; reviewer độc lập theo route review                                                                       |

Pin GPT-6 = `gpt-6-sol`, có trong catalog host 2026-10-23; catalog không chứng minh entitlement. Fallback `gpt-6.1-sol` chỉ được đăng ký ở `focused` / `low` theo refresh 2026-10-30 bên trên; các model khác cần refresh và đăng ký trước. Codex truyền đúng effort của tier: `focused` → `low`, `advanced` → `medium`, `high` → `high`; preflight từ chối mọi cặp lệch và effort cao hơn `high`. Cặp agent/model phải khớp; không truyền Codex pin vào Cursor.

Tối đa **1 Codex worker live** toàn fleet được coordinator quan sát (các session user khác vẫn có thể dùng chung allowance). Không tăng đồng loạt 5 coding + 3 reviewer. Kiểm allowance trước/sau, ghi thời điểm/reset/source; dữ liệu thiếu = unknown, không coi bằng 0 hoặc unlimited. Khi allowance unknown, coordinator Codex vẫn điều phối theo chỉ định user; không mở thêm Codex worker. Coding thường lệ theo bảng OpenCode Go; non-coding theo route được giao. Token count không quy đổi trực tiếp thành phần trăm allowance hay USD. Gói ChatGPT không cấp thêm Cursor quota; không tự chuyển sang API billing.

Fallback coding theo [policy OpenCode → Luna](policies/provider-fallback.md); non-coding chọn route khác đã đăng ký trong cùng tier khi có evidence. Route hết quota/auth/model unavailable → checkpoint, xác minh attempt đã dừng và settle theo Orca recovery trước replacement. Nếu phần còn lại đã đủ rõ để hạ tier, coordinator ghi lại scope và tier trước replacement; không hạ tier chỉ vì quota. Phần việc vẫn khớp `high` dùng route high đã đăng ký và đúng loại công việc. Không chạy hai owner cùng lúc, không reset worktree; ghi riêng agent/model thực tế sau fallback.

Chỉ mở rộng tỷ lệ sau benchmark: cùng SHA/input, reviewer độc lập, findings được xác minh, thời gian và allowance có nguồn. Một cặp review không đủ kết luận tỷ lệ đạt DoD cho coding hoặc pilot ready.

`pinned` trong cost-wave chỉ đo effective model có được ghi nhận; preflight kiểm allowlist trước spawn. Coordinator vẫn phải đối chiếu requested/effective để phát hiện host đổi model. Metrics không thay quota gate.

Host Orca 1.4.237: `--display-name` truyền tại `task-create`; với `worker-start --worktree current` không truyền creation-only flags (gồm `--display-name`). Persona giữ trong Task; `--task-title` vẫn truyền khi start.

## Phân công sau benchmark — cập nhật theo routing 02/11/2026

**Codex điều phối; coding theo bảng OpenCode Go.** Coordinator giữ context quyết định, contract, findings và checkpoint. Docs/evidence không coding theo route được giao. Worker trả báo cáo ngắn kèm paths, SHA/checks và blocker; coordinator đọc sâu khi cần quyết định hoặc xác minh rủi ro. Gộp việc nhỏ vào task cùng owner/context; lifecycle và hygiene vài lệnh vẫn do coordinator thực hiện, không spawn chỉ để đổi vài dòng.

Giới hạn 1 Codex worker live không tính coordinator gốc, nhưng allowance tính cả hai. Codex worker theo route được giao, chỉ định user hoặc fallback đã được duyệt; không loại ngoại lệ Luna/Terra hợp lệ chỉ vì task ở tier standard. Reviewer vẫn khác implementer. Chưa tăng số Codex workers đồng thời hoặc chạy thêm benchmark. Fallback giữ tier và scope theo policy hiện hành.

## Quota gate trước dispatch

Wrapper `agent-workflow-run.mjs start` kiểm snapshot Codex mới (tối đa 5 phút), mọi window hiện diện của bucket được route đăng ký (`quotaLimitIds`). Mức còn lại lấy window thấp nhất. Policy tại `scripts/lib/agent-quota-policy.mjs` giữ **20% dự phòng**:

- Còn trên 20%: được qua quota gate; vẫn áp dụng các gate scope/worker/review.
- Còn từ trên 0% đến 20%: hoãn việc thường; chỉ dùng dự phòng khi có `--essential-reason` nêu việc bắt buộc. Tier high không mặc nhiên là khẩn cấp.
- Hết quota, snapshot thiếu/không hợp lệ/quá cũ hoặc reset đã qua: chặn worker Codex mới. Không tự hạ tier, chuyển billing hoặc retry.

Lưu quyết định trong `quota-decision.json` riêng tư. `--tier-reason` và `--essential-reason` là metadata local. Quota là allowance theo tài khoản/bucket, không phải số token còn lại cho từng model; gate không bảo đảm task tiếp theo không dùng hết quota. Coordinator phải xác minh tài khoản CLI snapshot trùng tài khoản worker Orca; wrapper chưa chứng minh được binding này. Reuse terminal cũng cần kiểm quota trước giao việc mới.

Claude/Codex recovery (tier `focused|advanced|high`): `scripts/agent-provider-recovery.mjs` + state `.orca-metrics/provider-recovery/` — [provider-recovery.md](setup/provider-recovery.md). Wrapper chặn start Claude khi probe chưa `serviceAvailable`; không suy phần trăm quota Claude từ probe. Cursor/Composer không bị gate Codex. Không tự chọn model ngoài route đã đăng ký.

## Chỉ định Terra — 2026-10-31

User yêu cầu ngừng spawn Cursor khi hết usage và dùng ChatGPT Terra cho đợt tích hợp/phát hành. Host catalog có `gpt-6.1-terra`, effort low/medium/high. Đăng ký Codex Terra cho standard/focused low, advanced medium và high high; giữ quota bucket `codex`, dự phòng và caps. Chỉ định user ưu tiên hơn route mặc định trong đợt này; không tự suy entitlement hoặc quota riêng từ tên model.

### Fallback Codex tiết kiệm khi OpenCode lỗi — user duyệt 02/11/2026

Pin `gpt-6-luna` và effort low/medium/high đã đối chiếu host `agent-model-catalog.json`. Đây là route coding fallback, không đổi primary hoặc reviewer mặc định. Giữ tier/scope/employee/Task/findings/fix budget; effort theo bảng coding trên. Chưa có phép đo giá/quota thực tế để hứa mức tiết kiệm. Trước retry phải chứng minh attempt cũ đã dừng, checkpoint WIP và dùng cùng Task với --retry-of qua wrapper. Codex vẫn kiểm allowance đúng tài khoản, reserve20%, cap hiện hành; không loop/nâng model/billing nếu route này lỗi.
