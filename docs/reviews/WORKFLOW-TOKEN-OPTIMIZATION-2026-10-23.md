# Công cụ đo và guard workflow — kiểm chứng local

Run `run_2caf6c29acd4`. Base HEAD `8a222cd84e443d4acb17a829d018d62a20d122fd`; thay đổi đang ở working tree, chưa commit. Đây là kiểm chứng tooling local, **không phải exact-SHA merge DoD**, acceptance sản phẩm hay pilot readiness.

## Kết quả sửa

| Điểm lãng phí đã trace | Thay đổi / bằng chứng |
| --- | --- |
| Chụp UAT sai locale/state, auth/môi trường lỗi nhưng lặp fix | `agent-workflow-guard probe`: route, lang, viewport, build, DOM và protected session/operator/MFA; probe journey trước batch, thất bại thì chẩn đoán đúng owner |
| Evidence-only phát sinh runtime/auth changes | Checkpoint v2 có working-tree + index hash; handoff bắt buộc scope; package/scripts/.cursor hoặc đường dẫn vượt allowlist đều bị chặn |
| Evidence SHA tự đổi theo commit báo cáo | Giữ provenance capture; revalidate bằng comment exact SHA + diff/checks, không chuỗi commit repin SHA |
| Copy review PR → Issue | Publisher canonical trên PR, Issue chỉ link; read-only mặc định, explicit apply khi task authorize; retry sau lỗi pointer không tạo lại báo cáo PR |
| Review/template/log/context lặp | Spec đã điền ngắn, packet giới hạn output; revalidation theo findings/diff; giữ gates và independent reviewer |
| Thiếu usage/cache/boundary | Thu provider counters, cache ratio, structural transcript + clipping, account snapshots, lifecycle receipts; baseline trước đoạn công việc cần đo |
| Shared worktree join nhầm worker | Auto-join và ingest fallback chỉ nhận một live dispatch đúng ID; nhiều/không có/khác ID/host unknown đều bỏ fallback; explicit conversation join vẫn là nguồn ưu tiên |

Không đổi chính sách max fan-out/planner. Codex điều phối; Composer thực thi thường lệ, Codex worker chọn lọc theo cost catalog. Không chuyển toàn bộ roster sang Codex.

## Căn cứ GitHub

Đã đọc 4 PR (#850, #841, #834, #821), 4 Issue (#844, #838, #833, #813), 30 comments và 9 workflow runs; cache chỉ đọc local.

- [#838: evidence fix chưa đóng acceptance](https://github.com/hangndat/ticket-solution/issues/838#issuecomment-6357342628), [chẩn đoán sau các lượt sửa](https://github.com/hangndat/ticket-solution/issues/838#issuecomment-6357399707).
- [#850: TOTP automation](https://github.com/hangndat/ticket-solution/pull/850#issuecomment-6357939546), [vấn đề Keycloak/môi trường](https://github.com/hangndat/ticket-solution/pull/850#issuecomment-6358250116), [evidence task mở rộng sang runtime](https://github.com/hangndat/ticket-solution/pull/850#issuecomment-6358936854).
- Hai comment review PR #841 được chép nguyên sang Issue #838: thêm **3.625 bytes UTF-8 = 1.790 + 1.835** mỗi lần đọc cả bản trùng. Cặp thứ nhất: [PR 6358027407](https://github.com/hangndat/ticket-solution/pull/841#issuecomment-6358027407) ↔ [Issue 6358027733](https://github.com/hangndat/ticket-solution/issues/838#issuecomment-6358027733); cặp thứ hai: [PR 6358167436](https://github.com/hangndat/ticket-solution/pull/841#issuecomment-6358167436) ↔ [Issue 6358167750](https://github.com/hangndat/ticket-solution/issues/838#issuecomment-6358167750). Đã đối chiếu `body` bằng nhau trong cache GitHub của lần audit. Đây là bytes/context proxy, không phải token billed hay quota đo được.
- Các commit `3fc6bdf7`, `614aac99`, `ca18f38e` có thay đổi repin/evidence rất nhỏ. Không kết luận CI trên các commit này hoàn toàn lãng phí: integrated code và cache vẫn có thể yêu cầu chạy gate.

Tái lập số bytes qua GitHub API (read-only, cần `gh` đã đăng nhập); đếm đúng chuỗi `body` sau parse JSON, không cộng newline do CLI in ra. Nếu comment bị sửa sau audit, kết quả hiện tại có thể khác:

```bash
python3 - <<'PY'
import json, subprocess
def body(comment_id):
    raw = subprocess.check_output([
        'gh', 'api', f'repos/hangndat/ticket-solution/issues/comments/{comment_id}'
    ])
    return json.loads(raw)['body']
total = 0
for pr_id, issue_id in [(6358027407, 6358027733), (6358167436, 6358167750)]:
    original, duplicate = body(pr_id), body(issue_id)
    assert original == duplicate, (pr_id, issue_id, 'body changed')
    size = len(duplicate.encode('utf-8'))
    print(pr_id, issue_id, size)
    total += size
print('duplicate_utf8_bytes', total)
PY
```

## Kiểm thử và smoke

- `pnpm agent:workflow:test`: **62/62 PASS** — evidence packet, guard, publisher, lifecycle, monitor/telemetry; thêm partial-publish retry, append/prefix tamper, thread mismatch, null coverage và hơn 2.000 provider events.
- Sau đính chính quyền file: chạy lại `pnpm agent:workflow:test` → **64/64 PASS**, gồm hai regression test mới cho ledger và cả hai hook: file mới 0600, sửa file cũ từ 0644 về 0600, không mất nội dung. `bash -n` trên hai hook và `git diff --check` cũng PASS. Các số token/quota bên dưới vẫn là snapshot của lần kiểm chứng ban đầu, không được cập nhật bằng usage của lần đính chính này.
- `node --test scripts/orca-spawn-model-preflight.test.mjs scripts/orca-cost-wave-evidence.test.mjs`: **22/22 PASS**.
- `git diff --check`, `bash -n docs/agents/tools/ui-evidence-check.sh`: PASS.
- Orca browser thật, fixture loopback: positive probe PASS; thay expected lang `vi` → `en` có `ok:false` và finding `HTML_LANG_MISMATCH` trong JSON đã lưu. JSON không lưu exit code nên báo cáo không dùng exit code làm bằng chứng. Có route `/ready`, viewport 845×973, build ID/commit, text/attribute assertion và hidden DOM. Không đăng nhập hoặc dùng dữ liệu sản phẩm. JSON ở `.orca-metrics/live-guard-{pass,negative}.json`; tab/server fixture đã dọn.
- Hai lượt giao việc cuối (`ctx_8378173aad65`, `ctx_fbd091fd2a48`) đã được Orca ghi nhận hoàn tất thành công. Wrapper thu telemetry và chụp quota **trước** khi giải phóng terminal; lệnh giải phóng trả `released`. Coordinator đã xử lý và xác nhận nhận các thông báo kết quả. Không còn terminal hoàn tất nào đang chờ quyết định giữ hay giải phóng. Các bản ghi `retained` lịch sử thuộc những lượt giao việc đã dùng lại cùng terminal cho lượt tiếp theo, không phải worker mới còn cần giữ.

Review độc lập guard ban đầu FAIL: [báo cáo findings F01–F09](AGENT-WORKFLOW-GUARD-LOCAL-REVIEW.md). Sau lượt sửa thứ hai, coordinator tự kiểm tra local các bản sửa tree/build mismatch, auth thiếu authenticated, hidden DOM, checkpoint v1/index, viewport/PNG, scope thiếu, dotdot, textIncludes. Lệnh handoff nay giữ checkpoint khi refs nằm trong manifest và từ chối unknown args. Live smoke xác minh cả nested Orca eval receipt; không gọi test fake là browser UAT thật. **Việc coordinator tự kiểm tra không đóng gate review độc lập.**

Giới hạn vòng sửa: hai lượt sửa tự động cho mỗi worker. Coordinator dùng một lượt chẩn đoán/ngoại lệ hẹp cuối vì kiểm tra live phát hiện baseline identity dùng size/mtime sẽ luôn đổi khi append; coordinator trực tiếp sửa prefix hash, append-only telemetry và các contract tích hợp. Các kiểm tra kỹ thuật local (append/tamper/thread, CLI live collect và bộ test) đã đạt, nhưng đây là implementer tự kiểm tra.

**Đang chờ reviewer độc lập trên exact SHA trước khi merge:** phần sửa cuối của coordinator gồm prefix hash/baseline, append-only telemetry, contract handoff/lifecycle/report và join; cùng thay đổi quyền ledger/hook trong lần đính chính này. Coordinator là implementer nên không được tự cấp PASS cho các phần đó. Sau khi có commit, reviewer khác implementer phải kiểm diff/findings và ghi verdict gắn full SHA; checks trên working tree không được gọi là đã chạy trên commit đó. Hiện chưa có commit mới hay verdict độc lập tương ứng; **gate review/merge vẫn mở**, không tuyên bố acceptance complete.

**Cập nhật 2026-10-23:** review độc lập FAIL (F1, F2 chặn) → lượt sửa ngoại lệ được user duyệt → commit `85e98fc19b62b10891320f350c822202cd63ded6` → James revalidate **PASS** trên exact SHA đó (66/66), F3/F4 còn mở mức nhẹ. Chi tiết: [review độc lập](WORKFLOW-TOKEN-OPTIMIZATION-INDEPENDENT-REVIEW-2026-10-23.md), [review James](WORKFLOW-TOKEN-OPTIMIZATION-REVIEW-JAMES-2026-10-23.md). Branch local chưa push, chưa có PR/CI GitHub; merge còn chờ PR + CI.

## Số đo thật và giới hạn

Dữ liệu local được gitignore dưới `.orca-metrics/`. Đính chính quyền: trước lần sửa này, `role-dispatch.jsonl` và `cursor-hooks.log` là **0644**; nay đã chmod thành **0600**, đối chiếu hash xác nhận không đổi nội dung. Ledger và cả hai hook áp dụng 0600 cho file mới, đồng thời sửa quyền file cũ trước khi ghi (ledger sửa cả khi bỏ qua event trùng). Kiểm tra lại ngày **2026-10-23 lúc 16:35 (UTC+08:00)**: toàn bộ **17 file** hiện có dưới `.orca-metrics/` đều là **0600**, gồm 11 file ở cấp gốc và 6 file trong `lifecycle/`. Telemetry ledger không lưu prompt/response/raw transcript; provider rollout vẫn nằm tại nguồn session của Codex, Orca metadata ghi rõ nguồn exact/partial.

Đoạn coordinator từ baseline **2026-10-23 08:12:46.569 UTC** đến lần collect **08:23:03.405 UTC** (thời điểm tạo report là **08:23:46.838 UTC**, không phải mốc collect):

| Số đo | Giá trị |
| --- | ---: |
| Input tokens trong boundary | 2.136.743 |
| Cached input (nằm trong input) | 2.093.696 |
| Output tokens | 12.875 |
| Reasoning (nằm trong output) | 3.298 |
| Cached input / input | 97,99% |

Số cộng dồn cả session tại cùng lần collect, **gồm context đọc lại**, lấy từ `.orca-metrics/workflow-fix-report.json`:

| Trường / phạm vi | Input | Output |
| --- | ---: | ---: |
| `tokens_session_range_delta`: chênh lệch counter cuối − đầu trong file session | 37.825.574 | 103.684 |
| `tokens_provider_session`: counter cộng dồn cuối session tại thời điểm collect | 37.845.915 | 103.812 |

Hai trường khác nhau vì counter đầu file đã khác 0. Đây là tín hiệu khối lượng xử lý của cả session, **không phải chỉ 2,14M input của đoạn cuối**; chưa có boundary/attribution để gọi toàn bộ số session là chi phí riêng run này.

Đây là provider counters cộng qua nhiều request/context được đọc lại, không phải token duy nhất. Session có metadata của cả `gpt-6.1-sol` và `gpt-6-astra`; không gán phép đo tổng này cho một model. Boundary bắt đầu giữa công việc nên không phải tổng chi phí toàn bộ run. Report không tính % savings khi thiếu một workload baseline tương đương.

Snapshot account tại **08:02:41 UTC** và **08:20:29 UTC** cùng plan/bucket/cửa sổ tuần 10.080 phút/reset và account hash: đều **usedPercent 9**. Chênh lệch hiển thị **0 điểm phần trăm**, không chứng minh zero usage và không phải số tiết kiệm. Snapshot đầu đã được chụp sau lúc bắt đầu task. Account activity summary/daily buckets cũng đã đọc được và lưu whitelist; không phân bổ vào từng worker.

**Hai phép đo không cùng khoảng thời gian:** account là **08:02:41 → 08:20:29 UTC**, token boundary là **08:12:46.569 → 08:23:03.405 UTC**. Không dùng cặp snapshot account này để quy đổi token boundary thành mức tiêu thụ hoặc tiết kiệm quota.

Hai Composer dispatch cuối: host chỉ trả terminal fallback (`sourceExact:false`, `contentComplete:false`), hook token fields chưa có — report giữ null/missing. Collector và join đã hoạt động; **full Cursor transcript/token/cache coverage vẫn phụ thuộc dữ liệu provider/Orca cung cấp**, không được gọi là đã đo đủ. Không suy khoản thiếu thành 0 hoặc quy token/cache thành % quota/USD.

Chưa có transcript/baseline lịch sử cho các review GitHub cũ, nên **chưa xác nhận được % quota tiết kiệm thực tế từ template mới**. Từ nay có thể thu boundary và chạy A/B cùng workload/model/provider/checks; run nhiều task cần ghép cặp workload tương đương trước khi tổng hợp. Hướng dẫn vận hành: [workflow-evidence-telemetry](../agents/workflow-evidence-telemetry.md).

Đã mở kiểm tra tài liệu ngày 2026-10-23: [URL Codex app-server trên OpenAI Developers](https://developers.openai.com/codex/app-server) chuyển hướng tới [Codex App Server trên ChatGPT Learn](https://learn.chatgpt.com/docs/app-server), trang mở được và có `account/rateLimits/read`, `account/usage/read`. Vì vậy link Learn trước đó không phải link hỏng; ghi cả URL đầu vào và đích chuyển hướng để dễ xác minh.
