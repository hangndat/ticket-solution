# Vemoki — Roadmap tiếp tục sản phẩm cốt lõi và UX

> **Tài liệu tham chiếu (reference), không phải nguồn thực thi.** Đây là roadmap đầu vào user cung cấp, giữ nguyên để truy vết. Roadmap thực thi canonical của Epic [#914](https://github.com/hangndat/ticket-solution/issues/914) là [`docs/plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md`](plans/VEMOKI-CORE-UX-ROADMAP-2026-10-26.md) cùng quyết định [O25](DECISION-LOG.md); khi khác nhau, canonical thắng. Prompt A/B ở §5–§6 là lịch sử giao việc, đã được áp dụng/điều chỉnh trong canonical. Trạng thái động: GitHub Project #3.

Ngày lập: 25/10/2026.
Baseline đã đọc: `hangndat/ticket-solution`, `main@a1efcc6483b1c243e22f868807b21be993a2af28`.
Tài liệu này là đề xuất planning và lệnh giao việc; không phải bằng chứng đã tạo Issue, đồng bộ Project, triển khai code hoặc nghiệm thu.

## 1. Quyết định phạm vi

Mục tiêu: doanh nghiệp/agency tự chuẩn bị sự kiện, phân phối vé miễn phí bằng mã hoặc khách mời, hỗ trợ người tham dự và giám sát vận hành; một tài khoản quản lý đúng phạm vi nhiều tổ chức/sự kiện.

Giữ kiến trúc và thiết kế hiện hành. Không xây lại sản phẩm theo Tickmi. Miễn phí phần mềm không đồng nghĩa tài nguyên hoặc hỗ trợ không giới hạn. Không xây billing, paywall hoặc pricing tiers trong đợt này; không tự công bố miễn phí trọn đời/unlimited.

### Trong phạm vi

- Portal: tổ chức, nhân sự/quyền, event, ticket type, source, quota, nội dung/thương hiệu, preview/publish, khách và vé, duyệt, import/export, notifications, CS, báo cáo/audit theo contract.
- Attendee: nhận/xem vé trên web; iOS attendee theo phạm vi đã có. Email lỗi không làm mất vé đã phát hành.
- iOS Staff: quét, nhập tay và xác nhận vào cổng; offline/recovery theo contract hiện hành.
- Hoàn thiện UX, responsive, accessibility, tests, evidence và tài liệu cho các luồng trên.
- Tái sử dụng onboarding/limits/abuse controls hiện hữu để vận hành miễn phí có kiểm soát.

### Chỉ xem xét khi có yêu cầu riêng — không triển khai trong đợt này

Payment/refund; kiosk; in thẻ; quay số; quiz; marketplace; editor kéo-thả tổng quát.

Các non-goal hiện hành khác giữ nguyên: Android native, Web Gate admission, chuyển nhượng, seat map, Wallet. Không thêm Zalo/ZNS, custom-domain/sender, CRM hoặc SSO từ suy luận cạnh tranh; chỉ ghi nhu cầu nếu phát hiện, không tự mở implementation.

### Nợ kỹ thuật đã được hoãn — không kích hoạt lại

Comment mới của #901 ghi #901, #903, #904 và AR891-INT-F01 (DB-role wiring gây 500 trong rehearsal) đã được hoãn theo quyết định người dùng. Giữ nguyên các ticket/finding và proof limits. Không tạo ticket khác để làm lại cùng việc dưới tên khác. Nếu một dependency này chặn task mới, đánh dấu blocker với owner và điều kiện mở lại; tiếp tục các nhánh độc lập.

PR #911 đã merge. Không giao viết lại immutable release tooling. Merge không chứng minh đã áp dụng production hoặc đã rehearsal thành công.

## 2. Cấu trúc theo dõi

Dùng GitHub Project #3 hiện hữu. Ưu tiên tái sử dụng Epic/Story/Task đang có. Nếu thực sự chưa có parent phù hợp, đề xuất một Epic: **Hoàn thiện sản phẩm cốt lõi và UX tự phục vụ Vemoki**.

Mã S0–S6/Txx dưới đây là mã planning cục bộ, không phải số GitHub Issue. Số task cuối cùng do discovery và khả năng tái sử dụng quyết định. Không tạo hàng loạt task trùng; không mở lại task đã hoàn tất nếu không có regression/gap mới có bằng chứng.

### S0 — Đối chiếu hiện trạng và chốt kế hoạch

Owner: coordinator; product-ba/product-design chỉ cho gap thực sự cần làm rõ; architect chỉ cho contract/architecture impact.

- T01: đọc HEAD, trạng thái và comment mới của Issue/PR, Project, run/worker/worktree đang hoạt động. Phân loại: đã có / cần sửa / cần bổ sung / bị hoãn / bị chặn.
- T02: chốt flow, states và wireframe/handoff tối thiểu trên hệ thiết kế Vemoki đã duyệt; không redesign logo/brand, không nghiên cứu đối thủ vòng mới.
- T03: lập Epic–Story–Task, dependency thật, ownership, AC, review/test gates và mapping tới task/PR hiện hữu.

Acceptance: mọi công việc có nguồn yêu cầu, phạm vi, owner, dependency và evidence cần thu; không còn nhầm snapshot cũ với trạng thái hiện tại; không đưa nợ hoãn vào ready queue. Review roadmap trước feature coding.

### S1 — Quyền, ngữ cảnh và trạng thái UI đúng

Owner: portal; backend chỉ nhận task riêng khi xác nhận server gap.

- T01: tái hiện và sửa findings access/loading nếu vẫn tồn tại: permission-denied/error không mắc spinner; quyền event không bị đồng nhất với tenant-admin.
- T02: đồng bộ capability cho menu, route, action và BFF/API. Thu hồi membership/assignment phải chặn request mới. Backend tiếp tục là authority.
- T03: chuyển tenant/event an toàn: không hiển thị dữ liệu, selection hoặc response muộn của context cũ; bảo vệ form chưa lưu; giữ màn tương ứng khi hợp quyền, nếu không dùng fallback rõ.
- T04: thống nhất loading/empty/forbidden/error/unknown/stale; timeout và job FAILED không có thông báo thành công. Test ngay cùng thay đổi.

Acceptance: role matrix và direct-route/API tests pass; request chéo tenant bị chặn; không spinner vô hạn, không lẫn dữ liệu, không false success. Không dùng cấp thêm quyền admin hoặc runtime DB owner/BYPASSRLS để làm test pass.

### S2 — Chuẩn bị sự kiện đến xuất bản

Owner: portal; API/contracts theo gap đã duyệt.

- T01: hoàn thiện tạo/sửa metadata theo schema hiện hành: thời gian, timezone, địa điểm, liên hệ, visibility; slug có gợi ý; bước cuối hiển thị dữ liệu thật; kiểm tra payload wizard đầy đủ.
- T02: loại vé, nguồn phát, quota có nhãn nghiệp vụ, đường đi rõ và trạng thái sử dụng; không gộp ba mô hình dữ liệu hoặc thay invariant transaction.
- T03: thông tin/branding/template hiện hữu có preview; giữ dữ liệu không được chỉnh trong payload, không ghi đè bằng một cấu hình tối giản. Dùng mẫu cố định/config có schema; không editor tổng quát.
- T04: draft/save/preview/publish thống nhất; phân biệt nội dung công bố với mở nhận vé/điều kiện vận hành. Có expected revision/version; xử lý conflict không ghi đè im lặng; readiness không biến 403/lỗi mạng thành “thiếu cấu hình”.

Acceptance: một Manager tạo -> sửa -> lưu nháp -> preview -> publish đúng bản đã lưu; dữ liệu trước/sau khớp; tác vụ retry không phát sinh bản ghi trùng; UI không đòi nhớ UUID/revision để thao tác cơ bản.

### S3 — Workspace Khách & vé và xử lý hỗ trợ

Owner: portal cho UI; backend cho endpoint/read model còn thiếu; coordinator cho contracts.

- T01: danh sách trung tâm có server pagination/filter/search; không giả global search trên trang dữ liệu tải thiếu. Phân biệt invitation/request/ticket; không giả định mỗi khách chỉ có một vé, hay invitation đã có ticket. Không nối các trang đầu từ nhiều API để giả một danh sách đầy đủ.
- T02: drawer/page chi tiết với timeline; trạng thái request, ticket, notification và check-in là các trường riêng. PII masking và action theo capability.
- T03: import theo Chọn file -> Ghép cột -> Preview -> Commit; lỗi theo dòng, download errors, job tìm lại được sau reload. Tách import danh sách, gửi invitation và cấp vé. Dùng lại pipeline hiện có.
- T04: danh sách pending, approve/reject có lý do và kiểm quota; bulk chỉ khi contract hiện hữu/được duyệt hỗ trợ, trả kết quả theo từng mục, không báo toàn bộ thành công khi chỉ thành công một phần.
- T05: CS search/detail/resend có cooldown và trạng thái delivery trung thực; export có filter server-side, job state, quyền và link hết hạn. Gắn các panel hiện hữu vào luồng trung tâm, không xây lại CRM/notification engine.

Acceptance: fixture vượt một trang vẫn tìm/duyệt/xuất đúng phạm vi; reload job không mất khả năng tiếp tục; cùng ý định retry dùng cùng idempotency context đến khi biết kết quả; thay đổi ý định phải bắt đầu operation mới hợp lệ. Không tạo vé mới khi resend. Email lỗi không làm mất vé.

### S4 — Khép kín attendee và iOS Staff

Owner: web attendee và ios là hai slice độc lập; backend/contracts chỉ khi có gap rõ.

- T01: attendee nhận vé, xác minh email, nhận biết pending/rejected/issued/unknown, xem QR và khôi phục sau lỗi; không bắt cài app để dùng vé web.
- T02: iOS Staff nhìn rõ tenant/event, kết quả quét, thao tác confirm và pending/conflict/unknown; logout/revoke xử lý dữ liệu theo policy hiện hành.
- T03: regression retry, restart, offline queue, đồng bộ và đọc receipt theo contract hiện có; Portal chỉ báo cáo, không scan/manual admission/confirm.

Acceptance: Manager phát vé -> attendee thấy vé -> Staff xác nhận -> Portal phản ánh trạng thái, có scenario retry/quét trùng/mất mạng. App build local theo policy. Simulator không thay evidence camera/thiết bị thật. Không hứa offline multi-device ngăn trùng vào cửa vật lý; không đổi ADR-18 để tạo claim marketing.

### S5 — Miễn phí, tự phục vụ và vận hành có kiểm soát

Owner: portal/backend/web theo task riêng; không tạo platform mới.

- T01: hoàn thiện onboarding tổ chức, mời thành viên và gán event theo policy hiện hành; account có dữ liệu mẫu/demonstration chỉ trong môi trường phù hợp.
- T02: dùng lại tenant limits, cooldown/rate limit, notification/backpressure và abuse controls; hiển thị hạn mức và hành động xử lý rõ. Không tự đặt/nâng/tắt cap hoặc thay policy đình chỉ tenant.
- T03: overview ưu tiên việc cần làm theo giai đoạn, dùng metric/endpoint có thật; freshness cập nhật theo thời gian, không snapshot giả realtime. Deep link giữ context/quyền.
- T04: hỗ trợ/hướng dẫn trong ngữ cảnh; chỉ mô tả năng lực đã kiểm chứng; không thông điệp unlimited/trọn đời/SLA ngoài cam kết được duyệt. Không billing hoặc upsell.

Acceptance: người tổ chức tự đi hết luồng mẫu; tác vụ giới hạn/unknown có hướng dẫn; không khóa bất ngờ khả năng xem vé/check-in chỉ vì UI diễn giải sai hạn mức. Thay đổi policy dịch vụ cần quyết định riêng. Email production phải có evidence kênh thực trong phạm vi được phép, không lấy Mailpit làm bằng chứng inbox.

### S6 — Nghiệm thu phạm vi mới và bàn giao

Owner: reviewer độc lập + coordinator; UAT theo role/rules hiện hữu.

- T01: thực hiện cross-surface UAT trên SHA tích hợp mới với dữ liệu giả nhiều tenant/event, role matrix, pagination, timeout/retry, stale và permissions.
- T02: kiểm UI trong browser: responsive, keyboard, focus, screen-reader labels, contrast, zoom, empty/error/unknown. Static scan không thay browser/device evidence. Không đổi màu/brand tùy ý.
- T03: đóng finding mới theo review-convergence, CI và revalidation; cập nhật roadmap/status, runbook, demo script và case-study evidence trong phạm vi mới.

Acceptance: exact-SHA evidence, test/CI, reviewer khác implementer, commit/PR và integration receipts; không P0/P1 chưa xử lý thuộc scope nghiệm thu này. Các nợ đã hoãn vẫn tách biệt, không ghi đã sửa. Kết luận rõ code complete / acceptance complete trong scope / release blockers / pilot readiness chưa đủ evidence.

S6 không thay thế hoặc âm thầm tái khởi động #901/#903/#904. Các gate rollout/production-like còn thiếu vẫn giữ nguyên; nghiệm thu local không là giấy phép mở rộng pilot.

## 3. Thứ tự và parallelism

- S0 trước coding; review phạm vi và handoff tối thiểu.
- S1 là nền quyền/context cho những thay đổi phụ thuộc.
- Portal: S1 -> S2 -> S3 -> các phần S5, theo một feature worker/slice.
- Web attendee và iOS Staff có thể chạy S4 song song khi contract liên quan ổn định, không xung đột ownership; không cần đợi toàn bộ Portal xong.
- Backend nhận từng gap cụ thể, không rewrite domain; coordinator chốt shared contracts trước consumers.
- S6 tập hợp candidate cuối; mỗi slice vẫn test/review ngay trong quá trình làm.
- Ưu tiên review -> fix -> CI -> merge -> feature mới theo WIP/backpressure hiện hữu. Không gắn ngày/ETA tùy ý.

## 4. Ownership, quy tắc agents và Definition of Done

- Coordinator: Project #3, task graph, root tooling/CI/lockfile/contracts/integration.
- Portal: `apps/portal/**`; role `web`, áp dụng `apps/portal/AGENTS.md`.
- Web attendee: `apps/web/**`; không worker Portal sửa lấn.
- iOS: `apps/mobile/**`; local build, không EAS/Expo Cloud Build.
- Backend: `apps/api`, `apps/worker`, `packages/backend`, DB theo spec.
- Product-design: flow/state/a11y handoff khi cần; giữ hệ thiết kế đã duyệt.
- Reviewer: khác implementer, exact SHA; gộp dod+ux/sec theo rules, không duplicate review cùng checklist.

Một Task Spec: parent/Issue, mục tiêu, scope/non-goals, path ownership, employee cố định, role/path, Architecture impact Có|Không, Cost tier, skills liên quan, dependency, AC testable, commands/tests, evidence, review, commit dự kiến và rollback/compatibility khi cần.

Dùng `company/employees.json`, workflow wrapper và routing/cost-catalog hiện hành. Không tạo team, CLI, dashboard hoặc orchestration framework mới. Không hard-code model từ đoạn chat. Không worker spawn worker.

Không tự deploy production, đổi DNS/cloud resources, chạy drill phá hủy, gửi email khách thật hoặc submit/release App Store từ roadmap này. Kế thừa approval hợp lệ qua task riêng khi đúng scope/artifact/environment; không diễn giải approval coding là approval các thao tác ngoài phạm vi.

## 5. Prompt A — Lập kế hoạch và Project, chưa coding

```text
Bạn là coordinator gốc của repository hangndat/ticket-solution.

Mục tiêu là tiếp tục hoàn thiện Vemoki theo định hướng hiện hành: multi-tenant cho doanh nghiệp/agency; vé miễn phí qua mã và khách mời; Portal tự phục vụ; attendee web/iOS; admission chỉ iOS Staff. Không xây bản sao Tickmi, không mở rộng sang hệ thống quản lý sự kiện tổng quát.

Đọc roadmap được cung cấp trong message/file này. Các mã S0–S6 là mã planning, không phải GitHub Issue ID.

PHẠM VI LƯỢT NÀY: discovery, planning, thiết kế/handoff tối thiểu và cập nhật GitHub Project #3. Không dispatch feature coding trước khi roadmap đã được review theo repo rules. Không yêu cầu lại các quyết định user đã chốt.

Bước đọc đầu tiên của leader: .cursor/rules/orca-leader-activation.mdc. Sau đó đọc AGENTS.md và chỉ các rules/doc cần cho hành động: PRD/ROADMAP/DECISION-LOG phần liên quan, canonical architecture, Portal roadmap/contract, apps/portal/AGENTS.md, docs/agents/README.md, ui-workflow, company/employees.json và company/README.md. Nạp orchestration/routing/Project/worktree/review rules đúng thời điểm; không dump toàn repo vào mọi worker.

RÀNG BUỘC:
1. Payment/refund, kiosk, in thẻ, quay số, quiz, marketplace, editor kéo-thả tổng quát: Deferred / On request. Không estimate vào critical path, không dispatch implementation.
2. Giữ non-goals và O23; không Android native, Web Gate admission, transfer, seat map, Wallet. Không tự thêm Zalo/ZNS/custom-domain/sender/CRM/SSO.
3. Miễn phí phần mềm; không billing/paywall/pricing tiers và không tự cam kết unlimited/trọn đời. Dùng limits/abuse policies hiện hành, không tự đặt/nâng/tắt cap.
4. #901/#903/#904 và AR891-INT-F01 đã được ghi hoãn trong comment #901. Đọc comment mới để xác nhận. Không kích hoạt lại, không đổi tên để làm lại, không đánh complete. Nếu chúng chặn việc mới, ghi blocker có owner và điều kiện resume; tiếp tục nhánh độc lập.
5. PR #911 đã merge tại baseline a1efcc6; recheck HEAD, không xây lại tooling, không suy ra đã deploy.
6. Giữ stack, design system/logo đã duyệt và source of truth hiện hành. Không microservices, queue mới, component framework mới, hoặc agent framework mới.

THỰC HIỆN:
A. Pin origin/main hiện tại. Đọc latest comment, Issue/PR/CI và Project #3; kiểm Run/worker/worktree đang hoạt động trước khi claim ownership. Không chỉ dựa vào snapshot roadmap.
B. Tái hiện findings review trước trên HEAD. Lập gap matrix: yêu cầu -> implementation/API/UI -> test/evidence -> existing Issue/PR -> gap -> xử lý hay deferred. Không kết luận lỗi còn tồn tại chỉ vì chat cũ.
C. Tái sử dụng existing Epic/Story/Task. Chỉ tạo mới khi không trùng; giữ hierarchy, dependency và labels/status đúng Project. Nếu thiếu quyền Project, báo chính xác chưa sync; không bịa link/status.
D. Tổ chức roadmap S0–S6:
   S0 đối chiếu + handoff + plan;
   S1 quyền/context/state correctness;
   S2 tạo/sửa sự kiện, loại vé/nguồn/quota, template/preview/publish;
   S3 workspace Khách & vé, server paging/filter, detail/timeline, import/job recovery, pending, CS/notify/export;
   S4 attendee và iOS Staff end-to-end theo contract;
   S5 onboarding miễn phí có kiểm soát, limits/copy, overview/actionable freshness;
   S6 scoped integrated UAT/evidence/handoff, không thay các debt gate đã hoãn.
E. Chia task nhỏ theo vertical slice và ownership; mỗi task có kết quả test được. API/contracts discovery trước khi thêm endpoint. Shared contract do coordinator quản lý. Không sửa slice khác cho build pass.
F. Task Spec có employee cố định, Role ID/path, Architecture impact Có|Không, Cost tier, skills, paths, non-goals, dependencies thật, AC, checks/evidence, review plan và conventional commit. Model/agent theo catalog hiện hành, không lấy từ chat cũ.
G. UI: chỉ làm handoff còn thiếu theo thiết kế đã duyệt; test states/permissions/responsive/a11y. Không nghiên cứu đối thủ hoặc redesign brand vòng mới.
H. Lập DAG/waves theo rules WIP: một feature worker/slice; Portal, attendee web, iOS và backend chỉ parallel khi contracts/paths không xung đột. Ưu tiên review/fix/CI/merge trước thêm feature khi đầy WIP.
I. Roadmap/Project/Issue/status bằng tiếng Việt; production code, technical docs và README bằng tiếng Anh theo yêu cầu project. Cập nhật đúng loại tài liệu, không nhân bản nguồn trạng thái.

ĐẦU RA:
- SHA baseline và evidence đã đọc.
- Gap matrix và danh sách giữ scope/deferred/blocker.
- Link Epic/Story/Task thực tế và mapping tới công việc hiện hữu; nêu phần chưa sync nếu thiếu quyền.
- Roadmap, AC và DAG/waves; task nào đủ điều kiện ready sau approval, task nào blocked và vì sao.
- Ownership, reviewer/test plan, commit gợi ý.
- Bản tóm tắt để user review và các quyết định mới thật sự còn thiếu; không hỏi lại scope đã chốt.

Dừng trước feature coding. Không production/store/cloud changes; không gửi dữ liệu thật. Không dùng worker_done hoặc board state để tuyên bố pilot ready.
```

## 6. Prompt B — Thực thi sau khi roadmap được duyệt

```text
Tôi duyệt roadmap tiếp tục sản phẩm cốt lõi và UX Vemoki vừa được review trong cuộc trao đổi này/Issue liên quan. Dùng đúng artifact và Issue ID đã được duyệt; không tự thay phạm vi bằng một bản kế hoạch mới.

Hãy triển khai qua coordinator và đội agents hiện hữu, theo vertical slices và dependency/waves đã chốt. Bắt đầu từ các task S1 đủ điều kiện Ready; song song các task backend/web/iOS khác chỉ khi dependency, ownership và WIP cho phép. Trước dispatch recheck HEAD và latest Issue/PR/Project, không giao trùng công việc đang live hoặc đã merge.

Tuân thủ AGENTS.md, leader activation, orchestration/routing/cost-catalog, employee tracking, task ownership, git-workflow, worktree hygiene và review-convergence. Coordinator spawn qua workflow Orca hiện hữu; workers không spawn con. Không dựng framework/team mới.

Cho phép coding, tests, docs, feature branches, PR và review độc lập trong scope đã duyệt. Integration/merge theo quyền và gates repo hiện hành. Reviewer khác implementer, review exact SHA; có commit mới thì revalidate vùng ảnh hưởng. Ưu tiên dọn review/fix/CI/merge trước khi mở feature khi WIP đầy.

Các tính năng Deferred/On request và nợ #901/#903/#904/AR891-INT-F01 vẫn hoãn. Nếu một nợ hoãn chặn AC mới, ghi blocker và báo cần quyết định riêng; không âm thầm sửa, che lỗi hoặc chạy lại campaign hoãn. Tiếp tục các nhánh độc lập.

Mỗi task chỉ đóng khi AC pass, tests phù hợp pass, review độc lập, docs cần thiết đã cập nhật, meaningful commit/PR và integration theo spec có evidence. Runtime critical flows không nghiệm thu chỉ bằng API mock. Dữ liệu test phải giả và cô lập. Không lấy simulator thay evidence thiết bị thật.

Sau mỗi wave báo: Issue/Task -> PR -> SHA -> tests/CI -> review -> trạng thái Project; deliverable người dùng sử dụng được; finding/blocker còn lại; task tiếp theo. Không tạo giả deadline, trạng thái, artifact hoặc link. Nếu thiếu quyền Project/CI/môi trường, báo cụ thể phần chưa thực hiện.

Không triển khai production, đổi DNS/cloud, chạy destructive drill hoặc gửi email khách thật từ lệnh này. Store/production chỉ theo task ủy quyền riêng còn hiệu lực, đúng scope và artifact. Không public claim về unlimited, SLA/capacity/offline guarantee hoặc pilot readiness chưa có bằng chứng.
```

## 7. Nguồn đối chiếu

- Commit baseline: https://github.com/hangndat/ticket-solution/commit/a1efcc6483b1c243e22f868807b21be993a2af28
- Working agreement: https://github.com/hangndat/ticket-solution/blob/a1efcc6483b1c243e22f868807b21be993a2af28/AGENTS.md
- Portal ownership: https://github.com/hangndat/ticket-solution/blob/a1efcc6483b1c243e22f868807b21be993a2af28/apps/portal/AGENTS.md
- Roadmap: https://github.com/hangndat/ticket-solution/blob/a1efcc6483b1c243e22f868807b21be993a2af28/docs/ROADMAP.md
- Portal roadmap: https://github.com/hangndat/ticket-solution/blob/a1efcc6483b1c243e22f868807b21be993a2af28/docs/plans/PORTAL-ROADMAP.md
- Project coordinator rules: https://github.com/hangndat/ticket-solution/blob/a1efcc6483b1c243e22f868807b21be993a2af28/.cursor/rules/github-project-tracking-coordinator.mdc
- Debt deferral: https://github.com/hangndat/ticket-solution/issues/901#issuecomment-6399232008

Các nguồn nêu hiện trạng lúc đọc, không thay việc coordinator recheck khi bắt đầu. Chưa chỉnh repository hoặc GitHub Project trong lượt lập tài liệu này.
