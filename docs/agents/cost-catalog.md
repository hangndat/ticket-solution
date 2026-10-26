# Cost catalog — tier và mapping model (Vemoki / Orca)

Nguồn **pin** `--model` theo agent và Cost tier. Rules: `orca-agent-routing-core.mdc` · coordinator spawn: `orca-agent-routing-coordinator.mdc`.

**Không** dùng `auto` / omit flags làm mặc định (inherit UI thường đắt). Chỉ fallback inherit khi host **reject** mọi ID trong band và đã ghi limitation.

**Năm tier (2026-10-24):** `cheap`, `standard`, `focused`, `advanced`, `high`. Tier mô tả mức độ công việc; agent/model/effort được chọn từ mapping hiện hành bên dưới. Các tier `focused|advanced|high` ưu tiên Claude Sonnet 5 trước Codex; chọn theo task và quota provider. Cấm Cost tier `heavy` và các model/effort ngoài pin hiện hành (vd. Cursor `…-thinking-high`, `claude-sonnet-5-thinking-medium`, `gpt-5.6-sol-high`, `claude-opus-*`; Codex `xhigh`/`max`/`ultra`).

**Composer (2026-10-19):** chỉ **Composer Standard** (`composer-2.5`). **Cấm** `composer-2.5-fast` (Composer Fast) trên mọi spawn Orca / preflight.

## Refresh catalog (bắt buộc khi pin fail / account đổi)

```text
agent models
# hoặc
cursor-agent models
```

Đối chiếu ID còn trong output. Với Cursor, ưu tiên ID khớp fingerprint host nếu có trong `~/Library/Application Support/orca/agent-model-catalog.json`; nếu không thì lấy từ `agent models`. Với Claude, đối chiếu entry `agent: claude` và effort trên host; không dùng pin Cursor cho Claude Code.

Sau khi refresh: cập nhật bảng **Pinned** bên dưới + `Pinned at` nếu ID đổi.

## Pinned (Cursor host hangndat · 2026-10-19; Codex/Claude · 2026-10-24)

Nguồn: `agent models` trên máy này. Effort nằm **trong** model id Cursor (vd. `…-low`, `…-thinking-high`) → **không** truyền `--effort` trừ khi receipt/host yêu cầu rõ.

| Cost tier | `--agent` | `--model` primary | `--effort` | Fallback cùng tier |
| --- | --- | --- | --- | --- |
| `cheap` | `cursor` | `composer-2.5` | Không truyền | `grok-4.7-low`, `gemini-3.7-flash-low` |
| `standard` | `cursor` | `composer-2.5` | Không truyền | `claude-sonnet-5-thinking-low` |
| `focused` | `claude` | `claude-sonnet-5` | `low` | Codex `gpt-6-sol` / `low` |
| `advanced` | `claude` | `claude-sonnet-5` | `medium` | Codex `gpt-6-sol` / `medium` |
| `high` | `claude` | `claude-sonnet-5` | `high` | Codex `gpt-6-sol` / `high` |

Task mới khai báo tier độc lập với agent/model/effort. Mapping thực thi nằm trong `scripts/lib/agent-cost-tiers.mjs`: mỗi tier là danh sách các route được phép. Khi thêm model khác, xác minh pin/effort trên host và cập nhật route cùng bảng này; tên tier và tiêu chí công việc giữ nguyên. Preflight chấp nhận đúng tổ hợp đã đăng ký, không tự mở model mới.

### Claude cùng tier với Codex

Worker/reviewer tier `focused|advanced|high` ưu tiên Claude Sonnet 5 trước Codex; coordinator gốc vẫn dùng Codex, `cheap|standard` vẫn ưu tiên Composer. Claude Code dùng `--agent claude`, khác Claude qua Cursor (`--agent cursor`). Pin đọc từ cache Orca host ngày 2026-10-24, entry live gần nhất `2026-10-23T15:22:09.147Z`; đây là bằng chứng pin/effort, chưa chứng minh entitlement hoặc launch thành công. Dùng ID phiên bản ở bảng, không dùng alias trôi `sonnet`/`opus`, không bật Fast hoặc effort vượt high.

“Tương ứng” là cùng tiêu chí task/gate; chưa có benchmark chứng minh ngang chất lượng, giá hay mức dùng quota. `focused` dùng Sonnet low cho câu hỏi hẹp; `advanced` dùng Sonnet medium cho suy luận nhiều bước; `high` dùng Sonnet high và vẫn bắt buộc `--tier-reason`.

Thứ tự route trong `agent-cost-tiers.mjs` là thứ tự ưu tiên: Claude trước Codex. Coordinator chọn Claude nếu quota và scope phù hợp; chọn Codex cùng tier khi Claude không khả dụng, quota không đủ/unknown, có evidence cần đổi provider hoặc user chỉ định Codex, và ghi lý do. Wrapper vẫn yêu cầu agent/model/effort tường minh, không tự fallback/retry. Chọn một route trước dispatch dựa trên scope và quota provider; không chạy cả hai để đối chứng trừ khi task yêu cầu. Khi chuyển provider, giữ checkpoint/SHA, findings và số lượt sửa; xác minh attempt cũ đã dừng. Không chuyển ngầm do quota Codex thấp. Claude chưa có quota adapter: coordinator kiểm `/usage` của đúng tài khoản trước dispatch, ghi thời điểm/reset/source; unknown thì hoãn Claude và xét Codex cùng tier với quota hợp lệ. Áp dụng dự phòng 20% và lý do việc thiết yếu như Codex nếu provider hiển thị phần trăm còn lại; wrapper hiện chỉ ghi `adapter_unavailable`, không tự enforce quota Claude. Giữ nguyên caps hiện hành, không tăng fan-out khi có thêm provider.

Tên cũ chỉ dùng khi đọc evidence: `codex-low` → `focused`, `codex-medium` → `advanced`, `heavy` → `standard`. Preflight yêu cầu tên mới cho launch mới; không sửa receipt lịch sử.

**Cấm:** `composer-2.5-fast`; `claude-sonnet-5-thinking-medium`; Cursor vượt `standard`; tier `heavy`; Codex/Claude effort `xhigh|max|ultra`; model ngoài pin trong bảng. Tier `high` không mở các pin Cursor bị cấm.

## Map spawn

Đặt Persona khi tạo Task trước; start trên current/existing chỉ truyền launch flags hợp lệ. Ví dụ:

```text
ORCA orchestration task-create \
  --display-name "James · dod+sec" \
  --task-title "James · dod+sec — PR #<n> exact SHA" \
  --spec "<spec đã điền>" --json

ORCA orchestration worker-start \
  --task <id> --worktree current --agent cursor \
  --model composer-2.5 \
  --task-title "James · dod+sec — PR #<n> exact SHA" \
  --json
```

Sau launch: so `launch.requested` vs `launch.effective`. Reject primary → thử fallback cùng tier → mới `launch: inherit (host rejected pins)` + limitation.

## Chọn một trong năm tier

Chọn tier theo **quyết định cần đưa ra, mức độ rõ của giải pháp và hậu quả nếu làm sai**. Tiêu chí `high` bên dưới được xét trước tên role, loại file, số file hoặc tên giai đoạn. Một Task nhận tier cao nhất cần cho phần việc chưa thể tách độc lập.

| Tier | Khi nào chọn | Ví dụ / ranh giới |
| --- | --- | --- |
| `cheap` | Thao tác và expected outcome đã rõ, ít quyết định, hậu quả sai thấp | Thu log, chạy test có sẵn, sửa trình bày/link, ghi quyết định đã chốt, chia DAG đơn từ AC rõ. Chưa cấp verdict cho invariant nhạy cảm. |
| `standard` | Cần thực hiện và tự kiểm một giải pháp trong phạm vi rõ; chưa cần phân tích sâu | Coding/UI/BA/PD thường lệ, viết test theo AC, tái hiện và sửa lỗi cục bộ, review thông thường. Composer là mặc định. |
| `focused` | Cần phán đoán kỹ thuật tập trung cho một câu hỏi hẹp, bằng chứng và contract đã rõ, rủi ro thấp | Đối chiếu một consumer với contract đã chốt; xác minh một giả thuyết cụ thể hoặc một finding không nhạy cảm. Không dùng chỉ để chạy lệnh/thu log. |
| `advanced` | Cần suy luận nhiều bước, lần theo vài module hoặc so sánh phương án; phạm vi và rủi ro vẫn có giới hạn | Phân tích tác động của contract tương thích, debug có vài giả thuyết từ evidence, review luồng logic nhiều module nhưng không ảnh hưởng invariant nhạy cảm. |
| `high` | Quyết định kiến trúc còn mở với trade-off lớn hoặc hậu quả sai nghiêm trọng; bất kỳ tiêu chí high bên dưới đều ưu tiên tier này | Kiến trúc khó, auth/tenant, race/idempotency, migration rủi ro, sự cố nghiêm trọng; triển khai và review tương ứng. Spec rõ vẫn chọn high nếu rủi ro cao. |

`focused` và `advanced` mô tả độ sâu phán đoán; effort cụ thể phụ thuộc mapping của agent/model đang chọn. Năm tier mô tả mức phân công; không suy ra thứ tự giá tiền hay tỷ lệ quota khi chưa có phép đo. Revalidate chọn tier theo diff và findings còn mở; sửa ít file không tự hạ tier.

### Mặc định tiết kiệm quota

Việc khó nhưng scope rõ, rủi ro giới hạn mặc định `advanced` (ưu tiên Claude Sonnet 5 medium, Codex GPT-6 Sol medium là lựa chọn sau). Câu hỏi hẹp dùng `focused`; triển khai thường lệ dùng `standard`. Không chọn `high` chỉ vì nhiều file, nhiều bước hoặc thời gian dài. Không lần lượt thử đủ năm tier: chọn thẳng mức cần thiết từ evidence; giữ nguyên giới hạn sửa của review-convergence.

Tier `high` bắt buộc lý do cụ thể trong Task Spec và `--tier-reason` khi preflight/start. Flag này chỉ lưu local, không truyền vào Orca. Thu evidence/việc nhỏ gom cùng context; giữ reviewer độc lập cho verdict.

### Khi nào dùng `high`

Ghi trong Task Spec rủi ro cụ thể, quyết định cần suy luận và evidence cần kiểm. Chọn `high` cho:

- Thiết kế hoặc sửa ranh giới auth, phân quyền, tenant/RLS, secrets hay dữ liệu nhạy cảm khi sai sót có thể cấp sai quyền hoặc lộ dữ liệu.
- Thay đổi invariant nghiệp vụ nhiều bước: giao dịch, idempotency, race condition, offline sync hoặc trạng thái tiền/vé/check-in; cần phân tích failure modes và recovery.
- Migration dữ liệu/schema hoặc contract xuyên slice có nguy cơ mất dữ liệu, phá tương thích hay làm sai dữ liệu đang phục vụ.
- Quyết định kiến trúc/ADR có nhiều phương án và trade-off lớn, ảnh hưởng nhiều slice hoặc khó đảo ngược.
- Điều tra sự cố bảo mật hoặc lỗi production nghiêm trọng; chẩn đoán bug cần suy luận về race, thứ tự sự kiện, nhiều tầng hệ thống hoặc các giả thuyết xung đột sau khi đã thu evidence. Chỉ chưa biết nguyên nhân của một lỗi cục bộ không đủ để chọn `high`.
- Review DoD/security độc lập của các thay đổi trên, hoặc review cần kiểm chứng nhiều invariant và đường tấn công trên exact SHA.

Mapping primary của `high` là `--agent claude --model claude-sonnet-5 --effort high`; fallback cùng tier là `--agent codex --model gpt-6-sol --effort high`; giữ các gate allowance, giới hạn worker và reviewer độc lập hiện hành. `cheap` và `standard` hiện cùng dùng Composer primary; tên tier không chứng minh một task thực tế tiêu hao ít hơn task khác.

### Tách việc và chuyển tier

- Tách phần thu evidence hoặc implementation thông thường cho Composer khi có đầu vào, đầu ra và ranh giới độc lập. Bàn giao ghi contract/AC đã chốt, expected outcome, paths và điểm phải dừng để coordinator quyết định. Không tách mọi hàng trong bảng thành một worker; gom việc nhỏ cùng context.
- Việc sửa logic vẫn khớp tiêu chí `high` sau handoff thì tiếp tục chọn mapping thuộc `high`. Spec rõ hoặc đã có handoff thiết kế không tự biến thay đổi rủi ro cao thành `standard`.
- Worker gặp quyết định/rủi ro vượt scope: checkpoint evidence và báo coordinator phân loại lại phần còn lại trước khi tiếp tục. Câu hỏi hẹp cần phán đoán kỹ thuật → `focused`; cần nhiều bước nhưng rủi ro giới hạn → `advanced`; khớp tiêu chí high → `high`. Một lần FAIL hoặc thiếu nguyên nhân ban đầu không tự nâng tier; chuyển tier không reset số lượt sửa theo review-convergence.
- Reviewer chọn tier từ diff, invariant và findings đang mở. Người thu evidence có thể khác người kết luận; chạy test đạt không thay verdict độc lập.

| Ví dụ | Cách chia |
| --- | --- |
| Offline sync/check-in | Claude `high` (Codex fallback) thiết kế và sửa logic xung đột/idempotency; Composer viết test từ expected outcome đã chốt (`standard`), chạy test/gom log (`cheap`); Claude `high` (Codex fallback) khác implementer review invariant. Nếu phải phát minh expected outcome cho race thì phần thiết kế test cũng là `high`. |
| Sửa bảng/list trong portal | Composer `standard` triển khai và một reviewer độc lập review UI; thu ảnh theo kịch bản đã chốt có thể `cheap`. Nếu phải sửa logic cấp quyền hoặc tenant scoping, phần đó chuyển `high`. |
| Lỗi chưa rõ nguyên nhân | Composer `standard` tái hiện và khoanh vùng lỗi cục bộ. Khi evidence chỉ ra race hoặc tương tác nhiều invariant, giao phần chẩn đoán đó cho Claude `high` (Codex fallback); sự cố nghiêm trọng vào `high` ngay. |
| Đổi một field API tương thích | Composer `standard` triển khai theo spec; Claude `focused` (Codex fallback) đối chiếu một consumer cụ thể khi cần kiểm độc lập; `advanced` nếu phải lần tác động qua vài module và so phương án. Đụng quyền, dữ liệu nhạy cảm hoặc phá tương thích → `high`. |

## Soft caps liên quan

Theo user: giữ fan-out tối đa task ready trong scope dưới caps 5 non-review + 3 reviewer; một planner/Epic khi triển khai Epic. Reuse cùng Composer/context dù task chuyển cheap ↔ standard. Cùng model không có nghĩa cùng chi phí: task dài/context lớn vẫn tiêu hao nhiều hơn. Quy tắc hiện hành: `orca-parallel-workers.mdc`.

- ≤ **3** reviewer (`reviewer-dod`, `reviewer-security`, `reviewer-uiux`) live / Run; gộp nhiều role trong một session tính **một** reviewer — xem `orca-parallel-workers.mdc`.

## Wave D — đo cost (bắt buộc 1 dòng / wave)

Sau mỗi wave `worker-start` (hoặc cuối checkpoint idle-fill), coordinator ghi **một dòng evidence** (Issue comment / Run note / chat leader):

```text
cost-wave | run=<id> | n=<spawned> | cheap=<c> standard=<s> focused=<l> advanced=<m> high=<h> | pinned=<p> inherit=<i> | inherit%=<i*100/n> | models=<effective ids> | source=receipt|receipt+mixed|wt-comment-estimate
```

| Trường           | Nguồn                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Năm bộ đếm tier | Ưu tiên khai báo Cost tier trong Task Spec, rồi task-title, cuối cùng comment/displayName worktree (`heavy` legacy → đếm `standard`) |
| `pinned`         | `launch.effective.model` khác null và không `auto`; requested không chứng minh effective                                                                         |
| `inherit`        | omit `--model`, `--model auto`, hoặc receipt `effective.model` **null**                                                                       |
| `models`         | `launch.effective.model` (ưu tiên). Comment wt chỉ là soft signal (`source=mixed` / `wt-comment-estimate`)                                    |
| `source`         | `receipt` = start receipt local hoặc worker-show; `receipt+mixed` = null effective nhưng comment có pin; `wt-comment-estimate` = `--comments-only` hoặc không có receipt |

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
  --cost-tier standard --agent cursor --model composer-2.5
# exit 0 → worker-start với agent/model/effort; cost-tier/tier-reason là metadata local
# exit 2 → thiếu/sai tier hoặc agent/model/effort → dừng wave
```

`--cost-tier` bắt buộc với preflight và `agent-workflow-run.mjs start`; đây là metadata local, không truyền flag này vào Orca `worker-start`. Khi reuse `--terminal`, coordinator đối chiếu model/effort effective trong receipt với tier mới trước khi giao việc; preflight reuse không chứng minh tier khớp.

| Gate                                                   | Hành vi                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| Thiếu `--model` / `--model auto`                       | **Reject** wave (trừ `--terminal` reuse)                           |
| Thiếu/sai `--cost-tier`, hoặc agent/model/effort không khớp tier | **Reject** trước snapshot/start; ví dụ `high` + effort `medium` hoặc `standard` + Codex đều sai |
| `--model` ngoài cost-catalog pin set                   | **Reject** — refresh `agent models` rồi cập nhật catalog           |
| Receipt `effective.model` null sau spawn dù đã request | Ghi limitation; đếm **inherit** trên cost-wave; không claim pinned |

Snippet spawn trên existing worktree sau khi Task đã có Persona:

```text
ORCA orchestration worker-start \
  --task <id> --worktree path:<abs> --agent cursor \
  --model <pin-from-cost-catalog> \
  --task-title "<Persona> · <ui-label> — #<issue> <tóm tắt>" \
  --json
```

Sau `worker-start`: đối chiếu `launch.requested` vs `launch.effective` trên receipt JSON; ghi dòng `cost-wave` với `source=receipt`.

## Vai trò và năm tier — 2026-10-24

| Vai trò | Agent/model mặc định | Điều kiện |
| --- | --- | --- |
| Coordinator / Orchestrator | codex / `gpt-6-sol` | `advanced` cho điều phối thường lệ; phần quyết định khó/rủi ro theo tiêu chí `high` |
| Backend, web/portal, iOS | cursor / `composer-2.5` | Coding thường lệ theo spec/AC rõ |
| Documentation, unit tests | cursor / `composer-2.5` | `cheap` cho ghi chép/thu evidence đã chốt; `standard` cho viết test theo AC; quyết định policy/invariant và thiết kế test phức tạp phân loại theo tiêu chí tier |
| Architect phức tạp, security | Claude trước Codex theo tier | `high` nếu khớp tiêu chí trên; đối chiếu/phân tích có giới hạn chọn `focused` hoặc `advanced` |
| DoD | cursor / `composer-2.5` hoặc Codex/Claude theo tier | Thường lệ `standard`; Codex/Claude chọn `focused`, `advanced` hoặc `high` theo câu hỏi review và rủi ro |
| Critical implementation | claude / `claude-sonnet-5`, sau đó codex / `gpt-6-sol` | `high`; coordinator ghi lý do và scope cụ thể |

Pin GPT-6 = `gpt-6-sol`, có trong catalog host 2026-10-23; catalog không chứng minh entitlement. Không tự đổi sang Astra/6.1 hoặc model khác. Codex truyền đúng effort của tier: `focused` → `low`, `advanced` → `medium`, `high` → `high`; preflight từ chối mọi cặp lệch và effort cao hơn `high`. Cặp agent/model phải khớp; không truyền Codex pin vào Cursor.

Thử nghiệm ban đầu: tối đa **1 Codex worker live** toàn fleet được coordinator quan sát (các session user khác vẫn có thể dùng chung allowance). Không tăng đồng loạt 5 coding + 3 reviewer. Kiểm allowance trước/sau, ghi thời điểm/reset/source; dữ liệu thiếu = unknown, không coi bằng 0 hoặc unlimited. Khi allowance unknown, coordinator Codex vẫn điều phối theo chỉ định user; không mở thêm Codex worker ngoài benchmark được chỉ định. Task thực thi thông thường giao Composer. Token count không quy đổi trực tiếp thành phần trăm allowance hay USD. Gói ChatGPT không cấp thêm Cursor quota; không tự chuyển sang API billing.

Fallback: ưu tiên route khác đã đăng ký trong cùng tier. Route hết quota/auth/model unavailable → checkpoint, xác minh attempt đã dừng và settle theo Orca recovery trước replacement. Nếu phần còn lại đã đủ rõ để hạ tier, coordinator ghi lại scope và tier trước replacement. Phần việc vẫn khớp `high` chỉ chạy route đã đăng ký ở `high`; hiện tại chỉ có Codex nên chờ Codex khả dụng, không tự hạ tier vì quota. Cursor inherit chỉ khi host reject tất cả pin cùng band và có limitation; preflight vẫn chặn inherit mặc định. Không chạy hai owner cùng lúc, không reset worktree; ghi riêng agent/model thực tế sau fallback.

Chỉ mở rộng tỷ lệ sau benchmark: cùng SHA/input, reviewer độc lập, findings được xác minh, thời gian và allowance có nguồn. Một cặp review không đủ kết luận tỷ lệ đạt DoD cho coding hoặc pilot ready.

`pinned` trong cost-wave chỉ đo effective model có được ghi nhận; preflight kiểm allowlist trước spawn. Coordinator vẫn phải đối chiếu requested/effective để phát hiện host đổi model. Metrics không thay quota gate.

Host Orca 1.4.237: `--display-name` truyền tại `task-create`; với `worker-start --worktree current` không truyền creation-only flags (gồm `--display-name`). Persona giữ trong Task; `--task-title` vẫn truyền khi start.

## Điều chỉnh theo user sau benchmark — 2026-10-23

**Codex điều phối; Composer làm phần ít cần suy luận.** Coordinator giữ context quyết định, contract, findings và checkpoint; giao Composer coding theo spec rõ, docs, viết/chạy test theo AC, thu log/CI và sửa lỗi đã xác định nguyên nhân. Worker trả báo cáo ngắn kèm paths, SHA/checks và blocker; coordinator đọc sâu khi cần quyết định hoặc xác minh rủi ro. Gộp việc nhỏ vào task Composer phù hợp; lifecycle và hygiene vài lệnh vẫn do coordinator thực hiện, không spawn chỉ để đổi vài dòng.

Giới hạn 1 Codex worker live không tính coordinator gốc, nhưng allowance tính cả hai. Codex worker phải có lý do cần phán đoán kỹ thuật theo tier `focused`, `advanced` hoặc `high`; task thuần thực thi giao Composer. Reviewer vẫn khác implementer. User báo tổng tiêu hao 4% quota tuần; số đo benchmark chỉ bao phủ một đoạn phiên. Chưa tăng số Codex workers đồng thời hoặc chạy thêm benchmark. Fallback phải giữ đúng tier và scope như mục trên.


## Quota gate trước dispatch

Wrapper `agent-workflow-run.mjs start` kiểm snapshot Codex mới (tối đa 5 phút), mọi window hiện diện của bucket được route đăng ký (`quotaLimitIds`). Mức còn lại lấy window thấp nhất. Policy tại `scripts/lib/agent-quota-policy.mjs` giữ **20% dự phòng**:

- Còn trên 20%: được qua quota gate; vẫn áp dụng các gate scope/worker/review.
- Còn từ trên 0% đến 20%: hoãn việc thường; chỉ dùng dự phòng khi có `--essential-reason` nêu việc bắt buộc. Tier high không mặc nhiên là khẩn cấp.
- Hết quota, snapshot thiếu/không hợp lệ/quá cũ hoặc reset đã qua: chặn worker Codex mới. Không tự hạ tier, chuyển billing hoặc retry.

Lưu quyết định trong `quota-decision.json` riêng tư. `--tier-reason` và `--essential-reason` là metadata local. Quota là allowance theo tài khoản/bucket, không phải số token còn lại cho từng model; gate không bảo đảm task tiếp theo không dùng hết quota. Coordinator phải xác minh tài khoản CLI snapshot trùng tài khoản worker Orca; wrapper chưa chứng minh được binding này. Reuse terminal cũng cần kiểm quota trước giao việc mới.

Claude/Codex recovery (tier `focused|advanced|high`): `scripts/agent-provider-recovery.mjs` + state `.orca-metrics/provider-recovery/` — [provider-recovery.md](./provider-recovery.md). Wrapper chặn start Claude khi probe chưa `serviceAvailable`; không suy phần trăm quota Claude từ probe. Cursor/Composer không bị gate Codex. Không tự chọn model ngoài route đã đăng ký.
