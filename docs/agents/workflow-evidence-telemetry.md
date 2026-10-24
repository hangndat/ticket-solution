# Workflow evidence và đo token

Coordinator đọc khi chạy UAT/evidence hoặc benchmark; worker chỉ nhận các bước liên quan trong spec. Không nạp tài liệu này vào mọi prompt. Giữ Codex điều phối, Composer thực thi thường lệ, max fan-out và planner theo routing hiện hành.

## Ngăn các vòng làm lại

1. Evidence-only: ghi checkpoint trước khi sửa bằng `node scripts/agent-workflow-guard.mjs scope --base HEAD --mode evidence-only --record-checkpoint .orca-metrics/scope-start.json`. Checkpoint v2 ghi cả nội dung working tree và index; không dùng lại checkpoint v1.
2. Trước batch UAT: probe một journey đại diện qua Orca browser, xác nhận route, locale, viewport, build commit/ID, DOM và auth/operator/MFA theo AC. `node scripts/agent-workflow-guard.mjs probe --tab PAGE_ID --expect EXPECT.json`. Lưu JSON kết quả; lỗi probe thì chẩn đoán auth/môi trường/automation trước, không chụp hàng loạt hoặc sửa business code để vượt môi trường lỗi.
3. Thu ảnh riêng từng state. Manifest chứa SHA-256, viewport của từng ảnh PNG, quan sát build và provenance commit/tree. Ảnh trùng giữa hai state khác nhau phải giải thích bằng `sameVisualState`; JSON placeholder không thay bằng chứng DOM. Fingerprint chỉ chứng minh integrity của expect/observation, không phải host attestation hay reviewer độc lập.
4. Trước bàn giao: `node scripts/agent-workflow-guard.mjs handoff --manifest MANIFEST.json --checkpoint .orca-metrics/scope-start.json`. `git.scope` trong manifest phải có base/head/mode. Evidence-only phát sinh thay đổi ngoài allowlist thì dừng/escalate; coordinator quyết định implementation task và phạm vi revalidation, không lặng lẽ mở rộng scope.
5. Giữ provenance lúc capture bất biến. Revalidation commit mới ghi bằng comment/link kèm SHA cũ → mới, diff và checks; không tạo chuỗi commit chỉ để thay SHA trong chính báo cáo. CI/gate trên integrated commit vẫn bắt buộc.

Manifest v1 dùng các trường dưới đây (thay toàn bộ giá trị minh họa bằng dữ liệu thật):

```json
{
  "schema": "agent-workflow-guard/manifest/v1",
  "capturedAt": "<UTC sau probe>",
  "preflight": {"fingerprint": "<probe.fingerprint>", "at": "<UTC probe>", "ok": true, "kind": "integrity_expect_observation"},
  "expect": {
    "route": {"exact": "/ops/dashboard"}, "htmlLang": "vi",
    "viewport": {"width": 1280, "height": 720},
    "authMode": "protected",
    "authProbe": {"url": "/api/auth/session", "authenticated": true, "operator": "platform", "mfa": "verified"},
    "build": {"commit": "<full SHA đang serve>", "id": "<build ID>"},
    "dom": [{"selector": "[data-testid=shell]", "visible": true}],
    "states": [{"id": "dashboard-vi", "screenshot": "docs/reviews/assets/dashboard.png", "viewport": {"width": 1280, "height": 720}}]
  },
  "observations": "<object probe.observation, không phải string>",
  "git": {
    "commit": {"ref": "<capture ref>", "sha": "<full SHA>", "dirty": false},
    "sourceTree": {"path": ".", "sha": "<git rev-parse SHA^{tree}>"},
    "build": {"id": "<build ID>"},
    "scope": {"base": "<full base SHA>", "head": "<full head SHA>", "mode": "evidence-only"}
  },
  "artifacts": [{"path": "docs/reviews/assets/dashboard.png", "sha256": "<64 hex>", "viewport": {"width": 1280, "height": 720}}]
}
```

Trang public dùng `authMode: public`, bỏ `authProbe`. Route/text mong đợi nằm trong file local không có credentials; output chỉ giữ pathname và booleans. iOS vẫn cần evidence từ emulator; browser guard này không thay gate iOS. Manifest do worker cung cấp vẫn cần reviewer xác minh, không tự cấp acceptance.

## Một báo cáo canonical

Coordinator soạn spec review đã điền 150–250 từ từ [template](templates/review.md). Initial kiểm đủ scope; lần sau chỉ mở findings/diff/regression liên quan. Không chạy lại suite cho từng vai trò trên cùng SHA. Không bỏ evidence/gate để đạt giới hạn chữ.

```bash
node scripts/agent-review-publish.mjs --repo owner/repo --pr 123 --issue 124 \
  --sha FULL_SHA --verdict PASS --body-file docs/reviews/report.md
```

Mặc định chỉ đọc và in plan. Khi task đã authorize đăng GitHub, thêm `--apply`: một báo cáo trên PR, Issue chỉ nhận link + trạng thái. Report phải chứa exact head SHA; cùng body/SHA chạy lại không đăng trùng. Không tự thay Project, merge hoặc coi worker_done là nghiệm thu.

## Thu telemetry trong lifecycle

Với worker mới, dùng wrapper để preflight, snapshot quota trước start và lưu receipt private:

```bash
node scripts/agent-workflow-run.mjs start --run-id RUN --task TASK --role-id ROLE \
  --cost-tier standard --agent cursor --model composer-2.5 --display-name "Persona · role" --task-title "Persona · việc cần làm"
```

`--cost-tier` phải khớp Task Spec và agent/model/effort trong cost-catalog. Wrapper lưu `routing.json` cùng receipt và không gửi flag local này vào Orca. Đọc `state`, requested/effective và receipt, không chỉ `ok`. Start thất bại/không rõ hoặc ledger lỗi sau khi agent ready: quan sát dispatch hiện hữu, không launch lại tự động. Worker cũ reuse bằng Orca theo skill: chụp quota theo wave và collect trước release, giữ receipt model gốc; model unknown phải báo unknown.

Sau `worker_done` hợp lệ và đối chiếu task/dispatch/run:

```bash
node scripts/agent-workflow-run.mjs settle --run-id RUN --dispatch-id DISPATCH --role-id ROLE --release
node scripts/agent-role-monitor/telemetry.mjs report --run-id RUN --out .orca-metrics/report.json
```

Wrapper chỉ collect/release dispatch completed/failed đúng run, không tự giả settlement hay ack mailbox. Coordinator vẫn xử lý delivery, findings và quyết định terminal. Transcript lưu metadata cấu trúc + sourceExact/contentComplete/clipping, không lưu prompt/response hoặc secrets. Terminal fallback/nguồn thiếu phải ghi partial/unknown.

Cursor hook `stop`/`afterAgentResponse` dedupe theo generation; conversation ↔ dispatch phải join đúng. Shared worktree có nhiều worker thì dùng `record-join` với conversation ID thật; không suy từ một active-dispatch.json dùng chung. Provider không đưa token/cache thì giữ null, không báo bằng 0.

## Codex: mốc đo cho coordinator và worker

Provider JSONL phải lấy từ session/thread thật, không đoán file mới nhất trên máy. Lưu baseline **trước đoạn công việc cần đo**:

```bash
node scripts/agent-role-monitor/telemetry.mjs snapshot-provider \
  --provider-file /absolute/rollout.jsonl --thread-id THREAD --out .orca-metrics/before.json
# Thực hiện công việc đã authorize, sau đó collect:
node scripts/agent-role-monitor/telemetry.mjs collect --run-id RUN --role-id coordinator \
  --provider-file /absolute/rollout.jsonl --thread-id THREAD --baseline-file .orca-metrics/before.json \
  --comparison-key SAME_WORKLOAD_KEY
```

Worker có thể truyền các flags provider/thread/baseline/comparison-key này vào `settle`. Baseline xác minh thread, counters đơn điệu và SHA-256 phần file trước boundary; append hợp lệ, sửa/truncate prefix bị từ chối. Thiếu baseline thì chỉ báo cumulative session/range; không gán toàn bộ session cho task vừa nhận. Coordinator kéo dài cần checkpoint gọn và đổi session ở boundary an toàn khi context lớn; không nạp lại toàn bộ lịch sử đã đóng, không cắt ngang dispatch live hoặc bỏ mailbox/authority.

## Diễn giải chi phí

| Số đo | Ý nghĩa / giới hạn |
| --- | --- |
| input / output | Provider counters; input có thể tính lại cùng context qua nhiều request, không phải số token duy nhất |
| cachedInput / input | Tỷ lệ token input được provider báo cached, không phải request cache hit rate hoặc % quota tiết kiệm |
| reasoning | Thành phần của output; cachedInput là thành phần của input, không cộng lần nữa |
| task_delta | Chỉ có khi baseline thật trước/sau trên cùng nguồn; task phải chiếm riêng boundary đó |
| quota usedPercent | Snapshot account/rateLimits/read qua app-server, không tạo inference; shared toàn tài khoản |
| quota delta | Chỉ so khi account hash/plan/limit/window/reset và thứ tự thời gian hợp lệ; đơn vị **điểm phần trăm**, không phải tiết kiệm riêng task |

`report --run-id NEW --baseline-run-id OLD --comparison-key KEY` chỉ tính % input giảm khi workload key, model/provider và boundary coverage khớp. Key phải đại diện cùng AC, input/diff và checks; thay template nhưng đổi workload không phải A/B hợp lệ. Một run nhiều task chưa có pairing 1:1 thì không được lấy một task đại diện để báo tiết kiệm cả run. Không quy token/cache thành % quota hoặc USD của subscription. Không có baseline lịch sử cho review GitHub trước đây thì không hồi suy được % tiết kiệm thực tế.

Ledger, snapshots và lifecycle receipts ở `.orca-metrics/` gitignored, files 0600; chỉ share số liệu đã whitelist. Hướng dẫn CLI chi tiết: [agent-role-monitor](../../scripts/agent-role-monitor/README.md). Kiểm thử: `pnpm agent:workflow:test`.

Quota gate Codex trước start: xem `cost-catalog.md`, dự phòng 20%, snapshot tối đa 5 phút, kiểm primary/secondary theo bucket route. `quota-decision.json` ghi quyết định; `--essential-reason` chỉ cho phép dùng dự phòng, không vượt quota exhausted/unknown/stale. High cần `--tier-reason`. Các flag này không truyền Orca; provider khác vẫn kiểm quota thủ công.
