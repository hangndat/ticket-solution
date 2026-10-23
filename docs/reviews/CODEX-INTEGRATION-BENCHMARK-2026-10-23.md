# Tích hợp Codex chọn lọc và benchmark — 2026-10-23

## Phạm vi và trạng thái

Task được user giao: xác minh Codex ChatGPT, thử lifecycle Orca, cập nhật routing/preflight, so sánh review PR #850 + readiness Issue #846. Architecture impact: Không với tooling; Có với nội dung review cutover ADR-20/22. Cost tier: standard cho hai benchmark, cheap cho review tooling. Owner: coordinator; không sửa application slices, merge/deploy hay cutover.

Đã hoàn thành triển khai và kiểm tra local. Chưa commit/push/CI hoặc nghiệm thu exact-SHA cho thay đổi tooling. PR #850 vẫn chưa đạt acceptance; Issue #846 chưa sẵn sàng cutover. Không tuyên bố pilot ready.

## Tài khoản và lifecycle

- `codex-cli 0.162.1`; `codex login status`: Logged in using ChatGPT. Không cần đăng nhập lại.
- `account/read` qua app-server: `type=chatgpt`, `planType=prolite`. `account/rateLimits/read`: `ordinaryUsageAllowed=true`. Đây là bằng chứng tài khoản sử dụng được; không phải kiểm chứng hóa đơn $100.
- Catalog host có `gpt-6-sol`; pin này được chọn để cụ thể hóa GPT-6, effort medium. Không tự chuyển sang Astra/6.1. Theo [OpenAI Docs](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), catalog không đủ chứng minh entitlement; benchmark hoàn tất bổ sung bằng chứng inference thực tế.
- Orca `1.4.237`, Run `run_0c43f65c1b14`. Codex `ctx_5aa5c9cd7f1e`: `ready`, input accepted, turn observed, requested/effective đều `gpt-6-sol / medium`; nhận task → đọc code → ghi report → `worker_done succeeded` → `worker-release released`, archive captured.
- Composer `ctx_e7b63d5ff0e8`: requested/effective `composer-2.5`, ready → report → settled/released. Codex dùng structured chat; Composer dùng terminal theo khả năng host.
- Lần start thử tạo worktree thiếu `--name` bị từ chối trước dispatch. Sau đọc recovery, dùng current worktree (review chỉ đọc, output riêng); không tạo attempt trùng. Host không nhận `--display-name` ở current worktree, Persona đặt tại task-create.
- Fleet projection Codex từng `unverifiable: missing_status`; worker-show/worker-read xác nhận live. Không suy mất process từ thiếu status. Cost-wave đã sửa để không bỏ active structured worker.

## Phép so sánh

Cùng PR SHA `6f700d9e278bd346cdb56326304d6385c6701f41`, cùng Issue #846, role dod+sec, timebox 12 phút, chỉ đọc code/GitHub và ghi report riêng; không đọc report đối thủ. Không chạy lại application tests/UAT; cả hai dùng CI/evidence trên SHA. Đây là một cặp review thực tế, không phải benchmark coding hay thống kê tỷ lệ đạt DoD.

| Chỉ số | Codex GPT-6 Sol medium | Composer 2.5 |
| --- | --- | --- |
| Dispatch → worker_done (Orca UTC) | 05:11:53 → 05:14:02, khoảng **129 giây** | 05:12:31 → 05:14:21, khoảng **110 giây** |
| UAT Operator bắt buộc còn thiếu | Phát hiện | Phát hiện |
| Backend grant không dedupe Idempotency-Key | Phát hiện, truy tới controller/service/INSERT | Bỏ sót; chỉ kiểm UUID/header BFF |
| Thiếu test BFF theo AC #844 | Phát hiện | Không nêu |
| Evidence SHA cũ | Không tách finding | Phát hiện `4f81173` khác SHA review |
| DoD PR #850 | FAIL | FAIL |
| Security | FAIL vì grant idempotency | PASS trên diff |
| Issue #846 | Chưa sẵn sàng | Chưa sẵn sàng |
| Allowance riêng worker | Không đo tách được | Không có số đo |

Thời gian đo bao gồm overhead agent/lifecycle; không kết luận tốc độ model thuần. Timestamp kết thúc tự ghi trong report Composer là 05:15:30, sau worker_done 05:14:21 nên **không dùng**. Báo cáo gốc được giữ để audit, bảng này dùng Orca làm nguồn.

## Đối chiếu findings của coordinator

- **B01 (Codex F01): xác nhận đường đi code**. `apps/api/src/platform/platform-operator.controller.ts:140–146` không nhận key; `packages/backend/src/support-grant.ts:47–72` tạo UUID mới và INSERT mỗi request. UI grant tại `apps/portal/src/ops/platform-mutate-panels.tsx:438–460` sinh key mới mỗi lần submit. Header ở BFF không chứng minh idempotency end-to-end. Chưa có kiểm thử DB tái hiện trong benchmark. Đây là contract gap có trước PR, cần backend + portal owner; không mô tả thành auth bypass hoặc đặc quyền mới. Độ nghiêm trọng security cần owner xác nhận tác động duplicate/revocation; correctness gap có căn cứ.
- **B02 (cả hai): xác nhận thiếu acceptance** từ `PR844-EVIDENCE.md`: login platform bị chặn trước MFA, chỉ có ảnh unsigned. Không cho known gap thay UAT bắt buộc.
- **B03 (Codex F03): thiếu evidence/test BFF** so với AC “Test BFF + UI tối thiểu”; interpreter tests không tự chứng minh route CSRF/auth/replay. Cần portal owner bổ sung bằng chứng hoặc test phù hợp.
- **B04 (Composer F02): xác nhận evidence ghi SHA cũ**. Cần revalidation; không chạy vòng commit báo cáo chỉ để đổi SHA.
- Composer F03 về CSRF cookie GET là đề xuất không chặn, không tính thành lỗi xác nhận. Legacy vẫn hiện diện là công việc dự kiến của #846, không tự là blocker mới; blocker đầu vào là #844 chưa hoàn tất.

Codex bổ sung một phát hiện có giá trị về end-to-end contract trong mẫu này; Composer nhanh hơn khoảng 19 giây theo lifecycle. Chưa đủ dữ liệu kết luận tỷ lệ task đạt DoD hoặc hiệu quả chi phí dài hạn.

## Allowance

App-server đo toàn tài khoản: khoảng 05:12 UTC (sau khi Codex worker đã bắt đầu) `usedPercent=1`; 05:14:54 UTC `usedPercent=2`, cửa sổ `10080` phút. Reset epoch trả `1793336927` rồi `1793336928`. Chênh hiển thị **+1 điểm phần trăm**, không phải chi phí riêng benchmark: snapshot đầu không ở trước dispatch, coordinator/session khác dùng chung tài khoản và số phần trăm bị làm tròn. Không đổi token thành USD/allowance. Không kích hoạt credits/reset hoặc API billing. Chưa có allowance Cursor để so sánh định lượng.

## Routing và kiểm tra

Giữ Composer cho coordinator, backend, web/portal, iOS, docs/tests. Codex chọn lọc cho architect phức tạp, security, DoD theo rủi ro, critical implementation có scope/lý do. Một Codex worker active tối đa trong pilot; unknown allowance chỉ chạy benchmark user chỉ định. Fallback giữ checkpoint và settle attempt trước replacement Cursor; không reset worktree.

Preflight kiểm cặp agent/model, Codex effort low/medium bắt buộc, từ chối missing/auto/fast/mismatch/flags lặp và terminal reuse kèm model. Cost-wave chỉ tin effective, không requested/comment; không bỏ structured worker thiếu fleet status.

- `node --test scripts/orca-spawn-model-preflight.test.mjs`: **18/18 PASS**.
- `node --test scripts/orca-cost-wave-evidence.test.mjs`: **4/4 PASS** (structured active, null effective, auto, không active).
- Cost-wave benchmark: `n=2 active | cheap=0 standard=2 unknown=0 | pinned=2 inherit=0 | inherit%=0 | models=composer-2.5,gpt-6-sol | source=receipt`.
- Reviewer tooling độc lập `ctx_9a9989edaabe`: PASS with known gap, local diff, không phải exact-SHA merge DoD. Coordinator đã sửa các hướng dẫn Cursor-only còn sót (F1/F2/F4); F3 giữ định nghĩa pinned = effective hiện diện, preflight kiểm allowlist. Test cost-wave bổ sung đã được coordinator chạy. Chưa revalidate các sửa docs cuối bằng reviewer.
- `pnpm exec prettier` không chạy được vì workspace chưa có prettier installed; không cài dependency/đổi lockfile cho benchmark. `git diff --check` dùng để kiểm whitespace.

## Evidence

- [Codex review gốc](CODEX-BENCHMARK-850-846.md)
- [Composer review gốc](COMPOSER-BENCHMARK-850-846.md)
- [Review local tooling](CODEX-ROUTING-LOCAL-REVIEW.md)
- [Routing/cost catalog](../agents/cost-catalog.md)

Giữ rollout chọn lọc. Muốn tăng tỷ lệ Codex cần thêm mẫu cùng input/SHA, xác minh findings/false positives, theo dõi rework và allowance ở cửa sổ cô lập. Không mở thêm feature hoặc tự sửa #850/#846 trong task benchmark.

## Quyết định user sau benchmark

User giữ **Codex làm coordinator**, giao **Composer phần ít cần suy luận**. Quyết định này thay mapping coordinator Composer tại thời điểm benchmark ở trên; không thay kết quả đo lịch sử. Routing hiện hành nằm trong cost-catalog và core/coordinator rules. User báo tổng tiêu hao 4% quota tuần; phép đo 1% → 2% chỉ là một đoạn phiên. Không chạy thêm benchmark trong lần điều chỉnh policy này.
