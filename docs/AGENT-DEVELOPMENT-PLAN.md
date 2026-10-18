# Kế hoạch phát triển song song bằng Orca agents

**Vai trò tài liệu:** kế hoạch ownership / wave / contract-first / DoD vận hành agent — **không** phải nguồn Status live.  
**Status động:** [GitHub Project #3](https://github.com/users/hangndat/projects/3). **Phạm vi & gate hiện tại:** [ROADMAP.md](./ROADMAP.md).

Trạng thái kế hoạch: đã dùng để thực thi **W0** ([W0 report](./W0-FOUNDATION-REPORT.md)); các wave W1–W4 bên dưới là **khung lịch sử** đã được ánh xạ sang đợt D1–D5 trên Project (D0–D3 parent Hoàn thành; D4/D5 Đang làm tại sync 2026-10-17). Không đọc “Chưa triển khai W1” ở cuối file như trạng thái hiện tại.  
Nguồn: [PRD](./PRD.md), [Technical Design](./TECHNICAL-DESIGN.md).  
Mục tiêu: build web + iOS + NestJS bằng các wave nhỏ, tích hợp sớm và kiểm chứng invariants trước mở rộng.

## 1. Cấu hình nhóm ban đầu

Một coordinator/integrator và ba worker đang chạy cùng lúc là cấu hình đề xuất, không phải giới hạn nền tảng Orca. Tăng concurrency chỉ khi có task độc lập thực sự, đủ tài nguyên máy và không làm tích hợp trở thành nút thắt.

| Vai trò                  | Ownership chính                                                                                                           | Không tự ý thay đổi                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Coordinator / Integrator | Backlog, dependencies, decisions, bootstrap chung, integration branch, root tooling, contract review, merge và smoke test | Không đổi nghiệp vụ đã freeze chỉ để giải quyết conflict |
| A — Backend / Data       | NestJS modules, schema/migrations, transactions, RLS, outbox, endpoint implementation và backend tests                    | Public contract chưa thống nhất; UI web/mobile           |
| B — Web                  | Next.js portal, admin, web Gate, browser tests và web-specific components                                                 | Database, auth policy, native app                        |
| C — iOS                  | Expo app, navigation, auth client, ví vé, camera/Gate client, native capability tests                                     | Backend rules, web app, store submission thật ngoài task |

Ở wave hardening, chuyển một slot thành QA/security reviewer hoặc infrastructure worker tùy task. Không giữ agent chỉ vì tên vai trò: worker thực hiện task có đầu ra cụ thể rồi được tái sử dụng hoặc release.

Các module bảo mật quan trọng cần review độc lập sau khi implementation kết thúc. Người viết không tự là người duy nhất nghiệm thu tính đúng của RLS/quota/check-in.

## 2. Ranh giới file và các file dễ conflict

Cấu trúc mục tiêu kế thừa technical design. **Lịch sử:** tại thời điểm viết kế hoạch (trước W0) chưa scaffold; monorepo + apps đã có trên `main` sau D0. Ownership bảng dưới vẫn áp dụng.

| Khu vực                                                | Writer chính                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `apps/api/**`, `apps/worker/**`, `packages/backend/**` | A                                                                       |
| Schema/migrations, SQL policies                        | A, serial theo migration sequence                                       |
| `apps/web/**`                                          | B                                                                       |
| `apps/mobile/**`                                       | C                                                                       |
| `packages/contracts/**` và OpenAPI source              | A đề xuất, coordinator review và publish snapshot                       |
| `packages/api-client/**`                               | Generated bằng lệnh chung; không sửa tay                                |
| `packages/brand-tokens/**`                             | Coordinator chốt baseline; B/C đề xuất qua task                         |
| Root manifests, workspace config, lockfile, CI chung   | Coordinator                                                             |
| `infra/**`                                             | Coordinator trong các wave đầu; giao độc quyền một worker khi hardening |
| PRD/technical design                                   | Coordinator quản lý decision log, worker gửi đề xuất                    |

Không để ba agent cùng sửa Prisma schema hoặc tự thêm trạng thái/API error codes. Cần đổi contract thì gửi coordinator: vấn đề, diff đề xuất, consumer bị ảnh hưởng và cách giữ compatibility.

Việc API bootstrap/import module phải có owner cụ thể trong task. Worker không tự sửa root entrypoint ngoài ownership chỉ vì muốn build pass.

## 3. Workspace và Git strategy

**Lịch sử mở đầu:** tại thời điểm lập kế hoạch, thư mục chỉ có tài liệu/PDF, chưa là Git repository. Baseline Git và repo private đã có từ W0 trở đi; xem W0 report. Khi phát triển song song có package manifests, lockfile và schema, worktree isolation vẫn là lựa chọn đề xuất. GitHub Flow hiện tại: feature branch → PR → Cursor DoD review → CI → merge `main` (xem `.cursor/rules/git-workflow.mdc`).

Trước khi launch implementation:

1. Tạo Git repository và baseline commit chứa docs, scaffold, scripts và cấu hình kiểm thử chung. Chưa cần remote để dùng worktrees.
2. Đăng ký/resolve đúng workspace trong Orca; xác minh runtime và worktree receipts bằng CLI.
3. Coordinator dùng integration checkout. Mỗi writer có Orca-managed checkout riêng vì có nguy cơ sửa chung lockfile/generated output/schema và cần môi trường test riêng.
4. Mọi task trong wave xuất phát từ cùng commit integration đã ghi nhận; không mặc định branch từ repo default nếu default chưa có foundation mới.
5. Đặt tên task/worktree có ID và wave, ví dụ `w1-api-issue`, `w1-web-redeem`, `w1-ios-wallet`.
6. Tách cổng, DB/database schema test, Redis prefix/instance, bucket prefix và `.env` theo worktree. Không để test destructive của một worker xóa dữ liệu worker khác.

Worktree riêng không cô lập database, simulator, Keychain, signing credentials hoặc port. Mobile worker có ownership simulator/device session; agent khác không đồng thời reset hoặc cài lại app trên cùng simulator. Load tests dùng môi trường riêng, không chạy trên stack đang UAT.

Không tự tạo remote repository, publish hoặc submit stores trong bước chuẩn bị. Thực hiện theo task được giao và môi trường đã cấu hình.

## 4. Contract-first vừa đủ

Trước mỗi wave, freeze phần API mà wave cần, không viết hết API toàn hệ thống ngay từ đầu.

Contract packet gồm:

- Endpoint, request/response schema và error codes.
- Actor/tenant/event scope và permission yêu cầu.
- Idempotency key, operation recovery semantics và terminal/retryable states.
- Fixture/mock dùng chung cho loading, empty, rejected, timeout và success.
- Cấu hình/brand schema version và compatibility nếu liên quan.
- Generated client và cách kiểm tra contract drift.

Web/iOS được build song song bằng mock theo snapshot này. Mock không được coi là proof backend tích hợp. Mỗi wave chỉ hoàn tất khi cả consumer gọi API thật qua một luồng demo.

Nếu contract đổi: coordinator chốt thay đổi → publish snapshot mới → xác định consumers phải cập nhật → merge theo thứ tự producer/consumer an toàn. Không cho consumer âm thầm tự chế endpoint.

## 5. Flow phát triển theo wave

Ánh xạ nhanh (kế hoạch → đợt Project): W0→D0, W1→D2 (+ D1 identity gate trước đó), W2→D3, W3→D4, W4→D5. Chi tiết Status/checkbox: [ROADMAP.md](./ROADMAP.md). Phân biệt **code complete** / **acceptance complete** / **pilot ready** như ROADMAP §1.1. UAT thiết bị thật và proof limits: ROADMAP §1.2.

### W0 — Bootstrap và nền móng *(đã thực thi → D0)*

Một bước serial ngắn do coordinator sở hữu:

- Workspace, versions/lockfile, Docker local PostgreSQL/Redis, scripts, test harness, lint/typecheck, CI skeleton.
- Quy ước module, transaction context, error envelope, contracts, fixtures và task ownership.
- Health endpoint, môi trường dev/staging và secret placeholders; không đặt secret thật trong repository.

Sau baseline, ba task chạy song song:

| Worker | Task                                                                            | Bằng chứng hoàn tất                                                        |
| ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A      | Tenant/identity boundary, schema nền, Prisma transaction context, RLS prototype | DB tests truy cập chéo, pool reuse, owner-only read; role không bypass RLS |
| B      | Web shell, routing tenant/event, brand renderer, published event page fixture   | Browser flow hai tenant, không lẫn cache/brand; build/typecheck            |
| C      | iOS shell, auth adapter, event screen, SecureStore/cache lifecycle spike        | Development build chạy trên iPhone/simulator, account switch/logout đúng   |

Chọn identity provider bằng spike với acceptance criteria trong technical design; không dùng auth stub như giải pháp production. Nếu cần credentials, worker báo dependency sớm và tiếp tục phần không phụ thuộc.

Gate W0: foundation integrated, scripts chạy được từ clean checkout, RLS test đạt, identity direction và minimal API contract rõ.

### W1 — Một luồng nhận vé xuyên web và app *(khung → D2; board D2 Hoàn thành)*

Giới hạn scope để có lát cắt end-to-end sớm: một event, một nguồn mã, một loại vé, auto-approve. Multi-tenant isolation có từ đầu, không retrofit sau.

| Worker | Task                                                         | Bằng chứng hoàn tất                                                                  |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| A      | Mã/quota → issue transaction → ticket → outbox/email adapter | Concurrency test tranh suất cuối; retry cùng key trả cùng vé; email lỗi không mất vé |
| B      | Form đổi mã, auth/verification states, success/ticket view   | Browser đổi vé qua API thật, xử lý exhausted/used/timeout                            |
| C      | My Tickets, chi tiết QR, local cache tối thiểu               | Vé đổi trên web xuất hiện trên iOS cùng identity; mở vé đã lưu khi offline           |

Có fixture cho pending review nhưng chưa triển khai toàn bộ approval UX nếu không thuộc task. Email local dùng sandbox adapter, staging dùng provider cấu hình thật trước nghiệm thu delivery.

Gate W1: demo web đổi vé → email/sandbox notification → cùng user mở vé trên app; kiểm thử độc lập lại quota/idempotency trước W2.

### W2 — Check-in xuyên app và web *(khung → D3; board D3 Hoàn thành; camera device → D5 #26)*

| Worker | Task                                                                        | Bằng chứng hoàn tất                                                                        |
| ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A      | Staff session, reserve/confirm/status, revoke/undo, audit                   | Hai confirm chỉ một thành công; race revoke/expiry/permission revocation; timeout recovery |
| B      | Web Gate dự phòng, CS lookup tối thiểu, operation status UI                 | Browser flow API thật, lỗi rõ và không cho qua khi kết quả chưa biết                       |
| C      | Camera scan, dedupe callback, reserve/confirm, persisted operation recovery | Hai thiết bị scan cùng vé; app restart/đổi mạng vẫn đối soát kết quả                       |

Gate W2: hai thiết bị thật hoặc môi trường thiết bị kiểm chứng tương đương; không chỉ unit test camera mock. Chạy kịch bản nhân viên phát vòng và timeout theo runbook.

Đến đây phải chứng minh được phần rủi ro cốt lõi trước khi mở rộng admin/template.

### W3 — Hoàn thiện platform *(khung → D4; board Đang làm)*

Chia thành các task nhỏ nối tiếp, không giao một worker “làm toàn bộ admin”. Ba slot tiếp tục song song theo contract từng đợt:

- A: member/event permissions, import mã/khách mời, approval, config version/publish, notification retry/reconcile, reporting APIs.
- B: event setup, quản lý mã/quota, approval/CS, config preview/publish, dashboard và export UI.
- C: đổi mã trên app, event content, push/deep link, staff supervisor UX và accessibility.

Mỗi nhóm có backend contract trước, consumer có mock, rồi integration API thật. Security-sensitive changes có reviewer khác tác giả trước merge.

Gate W3: tenant thứ hai tự tạo event và brand qua admin, không sửa code; không hardcode MFest/VIP/Brand/Fandom; đủ release scope PRD.

### W4 — Hardening và pilot readiness *(khung → D5; board Đang làm; chưa pilot ready)*

Đổi phân công theo workload thay vì giữ ba vai trò cố định:

| Slot     | Công việc                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Worker 1 | Review/test độc lập RLS, authorization, transaction races; không tự viết lại kiến trúc trong review task |
| Worker 2 | CI/staging, observability, backup/failover drill, k6/load scenarios và admission spike                   |
| Worker 3 | iOS physical-device UAT/TestFlight, camera/mạng yếu, deep link/push, bugfix được giao                    |

Coordinator phân task fix cho owner thích hợp, tích hợp regression, chuẩn bị runbook và release checklist. Reviewer phát hiện lỗi không tự sửa ngoài scope; fix được dispatch thành task rõ ràng rồi reviewer kiểm chứng lại.

Gate W4: tests, benchmark và recovery evidence đạt tiêu chí technical design; các chỉ số chưa đạt phải được nêu rõ, không che bằng demo pass. Việc publish production hoặc submit App Store là task phát hành riêng.

## 6. DAG rút gọn

```text
Bootstrap + common contracts
    ├── Foundation backend / RLS
    ├── Web shell / branding
    └── iOS shell / identity spike
                   ↓ integration gate
    ├── Issue backend / outbox
    ├── Web redeem
    └── iOS wallet
                   ↓ end-to-end + invariant gate
    ├── Gate backend
    ├── Web Gate / CS
    └── iOS scan / recovery
                   ↓ concurrency + device gate
    ├── Platform backend expansion
    ├── Admin / customization
    └── iOS feature completion
                   ↓ full-scope integration
    Security review + capacity + failure drills + device UAT
                   ↓ pilot readiness decision
```

Dependencies ở Task-level chỉ diễn tả ordering thật; không bắt iOS shell đợi backend quota hoặc bắt web UI đợi email provider. Full wave merge gates không ngăn worker làm task độc lập của wave kế tiếp nếu contract/base phù hợp và đã được coordinator giao.

## 7. Quy trình một task trong Orca

Dùng supervised orchestration cho kế hoạch này: một Run cho milestone, Tasks là các phần việc, Dispatch là từng lần giao thực hiện. Không dùng terminal send làm cơ chế theo dõi task chính.

1. Coordinator tạo self-contained task spec, ownership, base commit, dependencies và acceptance.
2. Launch toàn bộ task ready trong wave trước khi chờ. Chọn agent + **Cost tier** (`cheap|standard|heavy`) theo `orca-agent-routing.mdc`; map `--model`/`--effort` trên fresh launch (không bịa model id; so sánh `launch.effective`). Không reuse pane `heavy` cho Task `cheap` kế tiếp.
3. Worker check follow-ups ở checkpoint; câu hỏi blocking gửi qua orchestration ask để coordinator trả lời.
4. Coordinator xử lý thay đổi contract và questions, không để worker tự đoán các quyết định nghiệp vụ lớn.
5. Worker báo `worker_done` với outcome và evidence; điều này chứng minh worker báo xong, chưa tự chứng minh branch đã integrated.
6. Coordinator kiểm tra report/commit/tests, giao reviewer nếu cần, rồi tích hợp theo thứ tự dependencies.
7. Sau accepted settlement, quyết định reuse/release/retain theo trạng thái Orca; không đóng terminal bằng cách bỏ qua lifecycle.
8. Hoàn thành integration gate rồi phát hành base commit mới cho wave tiếp theo.

Trạng thái task ở kế hoạch phát triển: READY → RUNNING → REPORTED → REVIEWED → INTEGRATED. Trạng thái lifecycle Orca có thể đã settled ở REPORTED; theo dõi integration bằng task/record riêng, không sửa nghĩa worker_done.

Timeout hoặc mất liên lạc không đồng nghĩa worker đã dừng. Không launch task trùng editor khi chưa xác minh attempt cũ đã kết thúc. Không release hoặc xóa checkout chưa bảo toàn commit/work.

## 8. Template task spec

```text
Task ID: W1-API-ISSUE
Target: packages/backend/{inventory,redemptions,tickets}/ và test liên quan
Base: <integration commit SHA thật khi dispatch>
Change: implement verified-user auto-issue theo technical design mục 8
Ownership: backend files được liệt kê; migration cần owner A quản lý sequence
Do not touch: web/mobile/root tooling/generated client bằng tay
Contract: <snapshot path + version/commit>
Agent: cursor
Cost tier: standard
Architecture impact: Không — không đổi contract/boundary
Constraints:
- Một mã tối đa một vé; quota không vượt; transaction có audit + outbox.
- Tenant context trong transaction; không provider call trong transaction.
- Contract đổi phải hỏi coordinator trước khi implementation diverge.
Acceptance:
- Integration test hai tenant và raw SQL constraints.
- Concurrent tranh quota cuối, request retry và timeout recovery.
- Ghi chính xác lệnh test, kết quả, limitation; không chỉ báo build pass.
Handoff:
- Commit SHA, files changed, migration order, test report path.
- Known risks và task downstream cần unblock.
- Không merge integration hoặc deploy ngoài task.
- Dispatch evidence: Cost tier + launch.requested vs launch.effective (nếu có override model/effort).
```

Task phải đủ nhỏ để review một hành vi rõ ràng; tránh ôm cả module nhiều state machines trong một dispatch. Không dùng duration estimate như acceptance criterion.

## 9. Quy tắc tích hợp và chất lượng

- Tích hợp theo thứ tự schema/contract → backend producer → generated client → consumers, hoặc một atomic integration batch nếu có thay đổi chưa backward compatible.
- Coordinator review diff giữa base/task commit; không chỉ xem working tree hoặc lời mô tả agent.
- Root dependency/lockfile changes do integrator xử lý có kiểm soát; regenerate lockfile bằng package manager, không sửa tay conflict.
- Không force-push, reset hoặc xóa worktree để dọn conflict. Preserve commits và giao owner rebase/fix.
- Sau merge chạy typecheck/build của package ảnh hưởng, backend integration tests cho transaction/security, contract drift check và một smoke flow API thật.
- Không lặp toàn bộ load test sau mọi UI edit; full capacity/failure suite chạy khi thay đổi hot path hoặc qua milestone phù hợp.
- Test DB phải dùng cùng engine và role model production; mock repository không chứng minh RLS/locking.
- Mỗi migration chỉ được apply một lần đúng thứ tự; không cho nhiều branch tự sửa migration đã merge.
- Các findings của reviewer được phân loại blocker/non-blocker, gắn task fix và evidence retest.

## 10. Điều kiện tăng số agents

Chỉ thêm slot khi có task độc lập rõ ownership, ví dụ: email worker adapter, load scripts, security review hoặc CI. Không thêm hai agent cùng implement redemption, cùng sửa schema hoặc cùng điều khiển simulator.

Theo dõi thời gian chờ contract/review, conflicts, broken builds, bug reopen và tần suất tích hợp. Nếu queue review tăng hoặc agents chủ yếu chờ nhau, giảm task breadth và giải quyết dependency trước khi thêm agents.

Không ước lượng tốc độ tăng tuyến tính theo số agent. Bắt đầu 1+3, đo một wave end-to-end rồi quyết định.

## 11. Việc tiếp theo — lịch sử khởi động & hướng dẫn hiện tại

### 11.1 Lịch sử (trước/trong W0 — không phải backlog hiện tại)

1. Chốt app baseline và identity spike criteria, lập decision log cho các mục mở.
2. Khởi tạo baseline Git/scaffold chung theo technical design.
3. Tạo Run W0 và ba task foundation với ownership cụ thể.
4. Launch workers trong Orca-managed workspaces đã xác minh; coordinator theo dõi đến settlement và integration gate.

W0 đã chạy bằng Orca supervised orchestration; xem W0 report. Các wave W1–W4 đã được thực thi một phần hoặc toàn phần dưới đợt D1–D5 trên Project — câu “chưa làm W1+” trong bản kế hoạch cũ **không còn đúng**.

### 11.2 Hiện tại (đọc Project + ROADMAP trước khi dispatch)

1. Lấy Status từ [Project #3](https://github.com/users/hangndat/projects/3); không tin checkbox docs nếu lệch board.
2. Trọng tâm còn mở: D4 (#5, #22, #23, #56) và D5 (#6, #25, #26) — workers `vemoki-*-complete` / review đang sở hữu implementation; không trùng checkout.
3. Chỉ gọi **pilot ready** khi gate D5 + UAT thiết bị thật đạt và chỉ số thiếu được nêu rõ (ROADMAP §1.1–§1.2).
4. Native iOS build bắt buộc local Xcode/xcodebuild/fastlane trên Mac/runner macOS tự quản lý; tuyệt đối không dùng Expo/EAS Cloud Build, workflow EAS-hosted hoặc fallback cloud.
