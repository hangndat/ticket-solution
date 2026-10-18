# Tiếp tục việc dang dở D11 / O14 / O15

User giao ngày 18/10/2026: “làm các việc dang dở đi”. Run điều phối: `run_127c4628d08d` (tiếp tục sau research). Phạm vi là delivery đã duyệt; không tự mở feature từ research production mới, không deploy/store, không EAS Cloud Build.

Architecture impact: **Không** ở phần điều phối này; các task đối chiếu ADR-14/ADR-19 theo scope riêng. Không thay contract ngoài handoff đã duyệt.

## Phân công và tránh trùng

| Run / Dispatch | Việc | Quyền ghi |
| --- | --- | --- |
| `run_1246840dce98` | Review/integration Web Gate #232 / PR #263; backend CI #255 | Coordinator cũ giữ ownership; đã gửi checkpoint qua mailbox |
| `run_86f42281f748` | Consumers web #256 và iOS #257 / Epic #254 | Không spawn trùng coding/reviewer |
| `ctx_2ec2eebc7270` | Planner D11 còn lại | Chỉ `D11-REMAINING-DELIVERY-PLAN.md`; đã settle/release |
| `ctx_04c43a91a6ad` | DoD/security PR #252 | Report + PR comment; đã settle/release |
| `ctx_b31ad1ecbefd` | DoD PR #253 | Report + PR comment; verdict FAIL; đã settle/release |
| `ctx_359224f7ea27` | CS/email recovery #246 | `apps/web` only; role `web` / `docs/agents/roles/web.md` |
| `ctx_2961fe7737b7` | Sửa tương thích seed MFest cũ trong PR #253 | `packages/backend` only; role `backend` / `docs/agents/roles/backend.md` |
| `ctx_d0c14124e629` | UAT tích hợp / local iOS build #236 | Evidence + task-owned runtime, không feature code; role `reviewer-dod` |

Mọi dispatch mới dùng Cursor theo `orca-agent-routing.mdc`. Worker có role/path trong Task Spec; không spawn worker con. Local build dùng Xcode; headless web và `sim-uat` trên simulator riêng, không dùng chuột macOS.

## Kết quả đã kiểm chứng tại checkpoint

- PR #252: DoD + security PASS độc lập trên `eb14eef12de3924ccfc24e843d5e7b526d155ec3`; smoke local cô lập kiểm tra health, init lặp lại, bucket private, Put/Get và sai credential fail-closed. Report ở worktree `remaining-review-252/docs/reviews/PR-252-MINIO-DOD-SECURITY.md`, nội dung đã đăng comment PR. Merge `77b4655e39e8928feb2e2695f7b2bd651f904ecc`; CI trên merge SHA SUCCESS (run `39091273535`). Không deploy mới.
- PR #263 / #232: coordinator run_124 đã merge `783f1c1eefca0261b36ec010248ea57a2470d170`; cần index exact-SHA evidence vào #236. CI riêng bị supersede; CI xanh trên descendant `77b4655…` đã quan sát.
- PR #267 / #257: DoD PASS trên `1506daaaf79d0b6d077620de5e00d44c24ce8773`; merge `1c106c5eaa32b42e2c8100690f12112fce9a97f9`. Local native build chưa có từ worker #257, giao #236 thu; không coi JS CI là native evidence.
- PR #253: SHA cũ `ec0f74efa017027cdaccce99c623690da1a62071` FAIL vì conflict với main. Coordinator merge main vào feature branch bằng `f8abf3f`, giữ publish marketing config ADR-19 và routing smoke O13, đổi key/slug MFest cho test published-events. Không rebase/force-push. Build contracts/backend + isolated PostgreSQL demo-seed/published-events: **2/2 PASS**; `node --check scripts/web-uat.mjs` PASS. Phát hiện thêm rerun seed cũ bị chặn ở tenant slug; đã giao backend sửa và thêm evidence trước review lại tip mới.
- Xcode local preflight: `Xcode 26.5`, build `17F42`. Đây chỉ là preflight, không phải native build PASS.

## Tracking còn lại

Story #272 (hỗ trợ khách / lời mời) thuộc Epic #222, gồm #246 CS và #271 invite HTTP. Hierarchy đã link bằng REST. #271 đã thêm Project #3 và đặt Sẵn sàng; #246 Đang làm khi dispatch. #271 chỉ dispatch sau khi slot feature web rảnh và queue review dưới cap.

Story #272 đã có trong Project #3 (item `274949237`), hierarchy Epic #222 → Story #272 → Tasks #246/#271. Đã PATCH thành công qua REST Projects V2, API version `2026-03-10`: #246 → Chờ duyệt, #272 → Đang làm. GraphQL vẫn lỗi rate limit; không dùng lỗi GraphQL làm lý do bỏ sync. Status field numeric ID `427520249`.

Các việc đang chạy không được ghi Hoàn thành chỉ vì `worker_done`. Gate đóng #236/#222/#254 cần headless UAT, native build local theo scope, review exact SHA và CI tích hợp. O06 còn mở trước dữ liệu người dùng thật; đợt này không tự chốt retention/region/SLA.

## Checklist kết thúc

- [ ] CS #246: PR, review, CI, headless evidence, merge.
- [ ] Invite #271: HTTP path thật, negative token/CSRF checks, DoD/security và merge nếu có fix.
- [x] MFest #253: independent DoD/security PASS exact `56a19dea29526ed0335cf3c833eefe8e4ba1d193`, CI 16/16 SUCCESS; merge `6f7995ea66e47120303167574e65424fdb3c7182`.
- [x] #256 web: PR #270 merged `e5f985ff0626a36711c7dc02effd9e4562ec9666`; evidence review commit `8519ba8e4f1188714ad88a6aecfaa058e55ca4d5` (run_86).
- [ ] #236: index đầy đủ, headless web/iOS và native local build.
- [ ] Sync board/parents theo DoD, gồm Story #272 đã thêm và cập nhật trạng thái.
- [ ] Drain mailbox, preserve evidence, release task-owned workers/processes; không đụng Run khác.

## Checkpoint review tiếp theo

- CS #246: PR #277, exact SHA `62a50a6bca3a3b6e17169516d0159891b364e498`; implementer đã release. Reviewer `ctx_3639bb85f5f1` kiểm tra DoD/security. Chưa có authenticated resend UAT; không suy nghiệm thu từ component checks.
- MFest #253: đồng bộ published-first với main, migration seed legacy giữ ID; tip `56a19dea29526ed0335cf3c833eefe8e4ba1d193` thêm Error cause theo lint. Toàn bộ check-runs exact tip SUCCESS. Reviewer độc lập `ctx_616f01f87c05` đang revalidate; backend fix worker đã release.

- CS #277 code đã merge `39ecbd01266ccb9990d3f1b41c6f8b53685fb4f8`; #246 vẫn Chờ duyệt vì authenticated UAT ở #236. Reviewer đã release.
- Invite #271 được dispatch `ctx_23223774b34c`, role web, worktree `d11-invite-http-271`. Checkpoint trước dispatch: board chỉ 1 Chờ duyệt (#246), PR mở chỉ #253; dưới WIP cap. #271 đã Đang làm qua REST.
- MFest final reviewer đã release; report final được preserve trong gói evidence này.

- Board audit REST `?fields=427520249`: #232/#255/#256/#257 Hoàn thành; #236/#254/#271/#272 Đang làm; #246 Chờ duyệt. PR279 đã merge evidence revalidation Gate (run124), không copy trùng artifact.
- Các dòng worker-list `retained` cũ có resource absent do reuse (ví dụ ctx_897 → ctx_3639 đã release); không có terminal/resource giữ lại cần dừng. Không stop worker live hoặc unverifiable.
