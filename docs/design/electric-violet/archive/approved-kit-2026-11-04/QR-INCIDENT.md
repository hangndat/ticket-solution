# Build 48 — chi tiết vé không hiện QR

## Trạng thái cuối — đã khắc phục, 05/11/2026

- User đã đóng/mở lại build 48 và xác nhận **QR lẫn mã nhập tay đều hiện** sau rollout API và backfill. Đây là xác nhận trên thiết bị của owner; agent không thu ảnh và không tuyên bố đã kiểm camera Gate.
- DB ở schema 54, không có migration dang dở; API source `5bb44d28`, artifact `5bb44d28…-578e3216f084`, health đạt và mount read-only. Đã backfill 12/12 vé ACTIVE, không còn vé ACTIVE thiếu mã nhập tay. Backup trước migration còn trên VPS và đã kiểm tra catalogue bằng pg_restore.
- Worker đã khôi phục qua artifact `d3eea7ae9f98b759b7517b950d2e2ea4df06f65b-16a2164340c3`. Manifest được build với `workerPendingPushSafe=true` bằng tool đã sửa, review và kiểm thử; không sửa manifest hoặc bypass pin. Process đang chạy, restartCount=0, mount read-only, cấu hình ký khớp API. Không gửi email test mới nên không tuyên bố email E2E đạt.
- Giữ nguyên pin Web/Portal; không recreate Web, Portal, Postgres, Keycloak, MinIO hay Mailpit. HTTP apex/app/portal/API/OIDC đạt 200; BFF và me-tickets chưa đăng nhập trả 401. Receipt cuối trên VPS: `/opt/vemoki/state/qr-credential-rollout/FINAL-RESULT.json`.
- [PR #1227](https://github.com/hangndat/ticket-solution/pull/1227) đã merge tại `2ad27b7d5a0862e97dc2f33d9f7ea925402c2c40`: 551/551 tests, review độc lập và integrated CI `41990210263` đều đạt. Lượt sửa 1/2 đã đóng finding ví có cả vé mới và vé cũ; không reset budget.
- [PR #1228](https://github.com/hangndat/ticket-solution/pull/1228) đã merge tại `84a6b97a0794218061f130f94f7ca5f17936bb1d`: 30/30 release tests, review DoD/security độc lập và integrated CI `41991542427` đạt. Tool nhận hai baseline cố định của PR #907 đã đối chiếu mã byte-identical; vẫn chặn lineage cũ hoặc không xác định. Không đổi mã runtime backend trong bản sửa tool.
- **TestFlight 1.0.0 (49) đã upload thành công**, Apple đang processing. Source native `1d4733aa8af9b9b47d26e35bb4cfc5d1cecbe292` khớp merge `2ad27b7d`; personal team `BLUA62D52G`, App Store profile, codesign deep/strict và production markers đều đạt. Chưa xác minh processing hoàn tất hoặc tester đã thấy build. Receipt và log: `qr-credential-mobile-fix/.orca-metrics/qr-credential/{TESTFLIGHT.md,TESTFLIGHT.json,testflight-upload.log}`. Cảnh báo dSYM framework không chặn upload; không dùng EAS Cloud hay gửi App Store Review.

Các checkpoint bên dưới là lịch sử điều tra và khắc phục, được kết quả cuối này thay thế. Không tuyên bố pilot ready hoặc toàn Epic hoàn tất.

## Kết quả điều tra

User xác nhận TestFlight `1.0.0 (48)`: thông tin vé có, QR không có, mã nhập tay ghi “Chưa có mã nhập tay”. Đây là incident mới sau xác nhận nghiệm thu trước đó; không phủ nhận PKCE login đã đạt.

- App source `9edad2ea`, native tree giống merge `5bb44d28`: `buildDisplayQrPayload` serialize `ticket.gateCredential`; thiếu field thì `JSON.stringify(undefined)` trả undefined, `TicketDetailScreen` bỏ nhánh QR theo truthiness. `fetch-me-tickets.ts` và `display-cache-parse.ts` chỉ kiểm các field cơ bản, không kiểm signed credential; vì thế vé thiếu credential vẫn được coi hợp lệ. Detail ưu tiên memory/cache rồi return, nên nâng API cũng cần kiểm fresh fetch/cache cũ.
- Read-only production docker inspect xác nhận API mount `/opt/vemoki/releases/4509decfa9f393c39b0a2c5b99668d4b2535ed52-52521a74a7c7`, source manifest `4509decfa9f393c39b0a2c5b99668d4b2535ed52`.
- Kiểm compiled artifact `apps/api/dist/tickets.js`: không có `gateCredential`, `manualEntryCode` hoặc `signGateCredentialJws`. Không lấy token, thông tin cá nhân, QR payload hoặc dữ liệu vé của user.
- Kiểm presence-only environment trong container API: bốn biến `GATE_CREDENTIAL_CURRENT_KEY_ID`, `GATE_CREDENTIAL_SIGNING_KEY_SEALED`, `GATE_CREDENTIAL_VERIFY_KEYS_JSON`, `GATE_MANUAL_CODE_PEPPER` đều chưa set. Không in giá trị secret.
- DB snapshot deploy trước đó là schema 51, source hiện có 54 migrations. Migration `202611020002_gate_credential_jws_manual_code` bổ sung manual code và backfill tracking. Không chạy migration trong điều tra. Vé cũ có thể cần backfill mã nhập tay sau migration; không hứa deploy API tự sinh mã cho tất cả vé cũ.

## Phạm vi khắc phục cần làm

1. Coordinator/backend chuẩn bị rollout tương thích API/Gate: xác minh schema thực tế và các migration pending, cấu hình signing/key verification đúng runbook, build artifact native Linux, pin/schema và rollback phù hợp. Không chỉ restart API cũ hoặc đổi pin bypass schema. Backfill manual code phải theo luồng hỗ trợ, không raw SQL sửa business state.
2. Mobile kiểm soát dữ liệu thiếu credential, không im lặng bỏ QR hoặc tạo QR giả từ ticket UUID. Xử lý cache cũ và refresh khi online với identity/tenant isolation hiện có; offline không tự dựng signed credential.
3. Verify account owner thật: fresh API có signed envelope, app hiện QR trên build có provenance, scan theo quyền/SoT hiện có; tránh prod camera confirm ngoài chủ ý vì có thể tiêu thụ vé.

Lượt check ban đầu chưa deploy API, migrate DB, thay signing secret, backfill, sửa source hoặc upload build mới. Sau đó user đã xác nhận **“Làm đi”**, authorize khắc phục backend/schema/signing và app như đề xuất; không cần hỏi lại quyền đó. Không coi Web deploy trước đó là backend credential rollout.

## Checkpoint triển khai

- Run `run_97d2d791c150`; base exact `5bb44d2872e5c7a14d06b2a85cf16086aa236e18`.
- Zico coding mobile: Task `task_f99ee326d44f`, Dispatch `ctx_6d621636564c`, checkout `qr-credential-mobile-fix`; wrapper xác minh effective Codex Luna/high (OpenCode Go đã weekly-limited), tier high do refresh/cancellation/identity isolation. Sourcefix incident mới 0/2. Không đổi source main-3 dirty.
- James independent backend rollout readiness: Task `task_967a9657fa90`, checkout `qr-credential-rollout-check`; review schema51→54, kýQR, hard-cutover Gate, old worker/rollback và backfill ACTIVE trước production mutation. Không tự restart/migrate trong worker.
- Mobile attempt `ctx_6d621636564c` báo failed do đường đọc input/skill, đã settle; chưa source changes. Recovery đã copy incident vào checkout, thêm RECOVERY.md nêu đúng bootstrap SKILL exception và CLI fallback; retry cùng Task/employee qua wrapper, effective Luna/high, Dispatch `ctx_ef6e7f47c7ac`. Không reset budget, không tạo task khác.
- Retry `ctx_ef6e7f47c7ac` cũng gửi worker_done failed/context, đã settle. Root tiếp quản integration trên worktree riêng; MCP root guard từ chối repo_root khácmain-3 (lỗi thật), đã dùng CRG CLI status/query đúngqr worktree/5bb44d28. Root sửa display-payload và ticket-detail (chưa checks/commit). Sau đó phát hiện worker transcript tiếp tục ghi fetch-me-tickets.ts sau failed report (recovery mail được giao trễ); đã gửi msg_efec076adb22 đến session6700... yêu cầu dừng writer và chỉ ack. worker-stop exactdispatch trả alreadySettled=true/processAction=none, không chứng minh process stopped. Tạm không sửa thêm source cho tới acknowledgment; giữ mọi diff, chưa coi mobilefix hoàn tất. Không retry provider lầnba. Reviewerbackend ctx_eb83f797c7bf vẫn độclập.
- Coordinator sở hữu integration/production backup, artifact build, env/sealing, migration, rollout và verification sau readiness. Chuẩn contract GATE-03 quy định hard cutover và backfill toàn bộ ACTIVE cũ; không tạo UUID QR fallback. Chưa đổi production ở checkpoint này.
- Tiết kiệm chi phí: không chạy lại full auth matrix/brand review; chỉ tests theo credential/cache delta và compatibility/migration có ảnh hưởng. Coding fallback Luna theo catalog; reserve Codex 20% giữ nguyên, không bật Extra Usage.

### Sourcefix đã bàn giao review

Coordinator đã hợp nhất delta validator của worker vào sourcefix mobile, commit `49a56daa0df137860120937daf3eb9622435d06d`, PR https://github.com/hangndat/ticket-solution/pull/1227. Sáu files apps/mobile, không auth/Gate/backend change. Full mobile 550/550 PASS sau regression actual React screen (legacy cache refresh, offline notice/retry, late A→B không QR leak), typecheck/lint (8 existing warnings), Expo iOS export và diffcheck PASS. Contracts đã build trong worktree sau frozen install; không sửa lockfile. REPORT.md tại qr-credential-mobile-fix/.orca-metrics/qr-credential.

Mobile independent review Task `task_6a1c0217072c` James high/dod+sec+ux trên exact49a, khác implementerroot; backend review Task `task_967a9657fa90`/ctx_eb83f797c7bf vẫn độc lập. Một CI watcher PR1227 (execsession90564) ghi `.orca-metrics/electric-violet/qr-mobile-pr-ci.log`, chưa claim CI pass. Không sourcefix iteration nào được giao sau review (0/2). Chưa đổi production, chưa newIPA/TestFlight.

Worker session6700... đã gửi status msg_8a5aec251081 xác nhận dừng mọi ghi source/test/commit/PR và giao worktree cho coordinator. Concurrency writer đã được xác nhận dừng; không cần retry worker implementation.

CI PR1227 run41986580054 PASS (watcher exit0; mobile/ci/changes/turbo-persist success) tại49a56daa, không thayheadtronglượtcheck. Reviewerbackend report chưaready; một inspection transcript do quá hạn cho thấy đangphân tích thật, không lỗi start. Đã steer thu hẹp đúng3migrations/range/key/backfill thay vìbroadscan. Không starttrùng hoặc suy unverifiable=livenessdead.

Backend readiness đã hoàn tất tại5bb44d28: 3migrations additivePASS, fresh5D+4unitPASS; code-levelF01-F05 đã kiểm nhưngmissingoldartifact, coordinator yêucầucùngreviewer chốt signoffcoverage hiệncó (khôngduplicate reviewer) và R-layer hẹp. User được hỏi tìnhtrạng thiếtbịGate build48 trướccutover cứng; chờcâu trảlời, không coi thời gian làđồngý. Chuẩn bị artifact nativeLinux từexact5bb, rangeAPI/worker/portal54, migrateinput51→54, Web51:51 nhưreview; chỉbuildstaging, chưapin/migrate/env/recreate. Log `.orca-metrics/electric-violet/qr-backend-build.log`. Backup và verifiedcurrentSchema phải làm trướcmigration. Reviewer làmrõrangeWeb/Portal khiDB54 vàscopePortal optional trướcroll.

Artifact `5bb44d2872e5c7a14d06b2a85cf16086aa236e18-578e3216f084` build+finalverify+Prisma/sharpnativePASS, remote runnerexit0/118s/health200. Khôngemulation, pin/servicekhôngđổi. Keyconfig operator scripts đãchuẩnbịchưachạy, copychoJamesreviewtrongaddendumcùngsession; tạo/verifyES256 offline/sealedstate, khôngprivatePEMdisk/.envwrite. UserGateanswer vẫnrequiredtrướccutover; khôngpendingpermissionchoquyềndeployđãcó.

User đã trả lời **“Hiện không có máy Gate đang hoạt động”**: điều kiện cửa sổcutoverđủ, không đòi xácnhậnlại hoặc suy mọideviceđãupdate48. Mobile review tại49a FAIL finding1: signedcredentialvalidity không được poison toànresponsewallet. Root fix1/2 bỏcredentialconditionkhỏistructuralvalidator, legacy/null manualaccepted, thêm mixedwallet regression quaactualprobe vàproductionReactdetail. Giữ signedQR failclosedper-ticket. Chờcheck/commitnewSHA đểcùngreviewerrevalidate delta; khôngresetbudget. Backendsecurity/keyopsaddendum vẫnpending, productionpin/env/DBchưađổi.

Fix1/2 commit `1d4733aa8af9b9b47d26e35bb4cfc5d1cecbe292` pushPR1227; 551/551tests,typecheck,lint,Expoexport,diffcheckPASS. Same-reviewer revalidation gửi ctx_357a28d3eab2; coordinator CIwatchsession25562 ghiqr-mobile-fix1-pr-ci.log. Khôngclaimold49aCI chonewSHA. Bản fixđangreview, chưamerge/newIPA.

## Production partial rollout / forward recovery

### Điều tra giật khi back từ chi tiết vé — 05/11/2026

User báo back từ detail về “Vé của tôi” bị giật/layout shift. Kiểm tra source read-only: CRG stats/query `file_summary` đúng main-3 HEAD `51bd5a5b`; LeanCTX đọc wallet/focus helper/navigation/sync guard. `git diff HEAD origin/main` trống cho các file liên quan này tại origin/main `84a6b97a`, nên kết luận không dựa trên wallet cũ khác bản đã merge.

Nguyên nhân thấy trong code: `VerifiedWallet` gọi `startWalletFocusRefresh` trên **mỗi focus**, helper luôn hydrate cache rồi mới fetch API. `hydrateFromCache` luôn `setOffline(true)` ngay cả khi danh sách online vẫn còn; UI chèn `WalletSlimNotice` vào đầu ScrollView, đồng thời ẩn push prompt. API thành công lại `offline:false`, gỡ notice và hiện lại prompt. Những phần tử tham gia layout này thêm/bớt chiều cao ngay lúc native back transition. `busy` chỉ hiện LoadingState khi chưa có vé, nên không phải toàn danh sách luôn bị thay bằng spinner.

Hướng sửa hẹp: hydrate chỉ khi chưa có snapshot của đúng owner/scope; khi quay lại giữ nguyên content/scroll và refresh nền, chỉ chuyển offline khi refresh thực sự thất bại. Giữ epoch/unauthorized/cache isolation hiện có. Cần regression first-focus versus refocus, pending/failed refresh và owner switch; sau đó kiểm transition trên emulator/device. Chưa sửa source, chưa đo frame hoặc tái hiện bằng runtime trong lượt điều tra này.

**Kết quả cuối 05/11/2026:** API/worker đã khôi phục và health đạt sau schema54/backfill12/12; owner xác nhận QR/mã nhập tay trên build48. PR #1227 và #1228 đã merge/CI PASS, TestFlight49 upload thành công (Apple processing được xác nhận; chưa kiểm tester availability). Bằng chứng canonical: https://github.com/hangndat/ticket-solution/pull/1227#issuecomment-6653505618. Các checkpoint partial/pending bên dưới là lịch sử xử lý, không phải trạng thái cuối.

PR #1224–#1228 đã được đưa về Hoàn thành trong Project #3; không đóng domain E2E #1031. IPA/Archive và evidence từ worktree tạm đã sao lưu có checksum tại `/Users/admin/SideProject/ticket-solution/.orca-metrics/releases/electric-violet-2026-11-05`; xem `manifest.json`, `cleanup-receipt.json` và `README.md` ở đó. Đường dẫn worktree cũ bên dưới chỉ còn dùng để truy provenance.

UserGatewindowclosed; securityF01-F05PASS vàR-layer1/1PASS, keyopsreviewPASS. ActualdeployedCompose thiếu6vars (không chỉenvrỗng); narrowpatchchỉ6keyenv choAPI/worker, otherconfigjsonunchanged. ES256offlinegen+seal+productionhelperroundtripPASS, .envpromoted saubackupverified. Backup `/opt/vemoki/backups/qr-pre-schema54-20261105T073934Z.dump`, 438629bytes/SHA987eeb28..., pg_restorecataloguePASS (khôngfullrestore).

DB migration51→54PASS/API5bb44d28-578e3216f084healthy/read-onlymount. Workerpin bịguardfail (`workerPendingPushSafe=false`), workerdaemonstopped, khôngbypassguard/manifest. Rootcause toolinglineage: original710b5714mergePR907khôngancestor5bb, mirrorcdb974a3samePR907làancestor; outbox.ts/appsworker/recoverytests710↔cdbbyteidentical. Guardfix3files d3eea7ae9f98b759b7517b950d2e2ea4df06f65b PR1228 nhận2fixedbaselines, unknown/legacy/missinggitfailclosed; 27+3releaseTestsPASS vàactualbaselineprobesPASS. Newreviewtask020a5f5991e3/ctx_a70d11a1fd06Jameshigh độc lập, CIwatchsession79892; chờreview+CI rồimerge/buildnewartifact/workerresume. Khôngrestartworkerold sauDB54.

Standalonebackfillreviewedjob chạyquaAPInewreadonlyartifact (khôngworkerdaemon): 8tenants,12processed/12minted,0skipped,ACTIVEthiếumanual12→0. Recordremote `/opt/vemoki/state/qr-credential-rollout/backfill-summary.json` khôngQR/manualvalues. APIalreadyup nhưngchưaclaimownerQRHTTP/devicePASS. Userđượchỏi mởlạibuild48verifyQR/manual; chưa cócâutrảlời.

Mobilefix1d reviewPASS, PR1227merged `2ad27b7d5a0862e97dc2f33d9f7ea925402c2c40`; integratedCI41990210263success, nativegitdiff1d→2adempty. Localpersonalteam archiveđangchạy nguồn1d tại qr-credential-mobile-fix, execsessionIOS cầntheodõi; chưauploadnewTestFlight. Artifactforwardoptional Web51:54 đãbuild `1d4733aa8af9b9b47d26e35bb4cfc5d1cecbe292-b976266e5e03` (backendtreeidentical5bb, no pin/recreateWeb/Portal). OldWeb/Portalvẫngiữmount/pin, futureWebrecreatecódùngartifactcompatible54.

User kiểm tra lại app build48 sau khi API lên/backfill và xác nhận **“Đã hiện cả QR và mã nhập tay”**. Ghi là owner/device attestation đúngbuild48, không ảnh doagentthu. Incident QR/manual runtime đãđượcxácnhậnthànhcông; khôngsuythànhphysicalGatecheck-in (không cómáyGatehoạtđộng). Archive1d localpersonalteamBLUA thànhcông/codesign deepstrictPASS, exportAppStoreConnectđangchạy; chưa claimnewbuildđãupload. Workerfix PR1228 đãreviewPASS/30tests+CIgreen vàmerge, artifactd3đangbuild; chưakhởiphụclạiworker.

Escalation lặp ctx_01c18ff8d0a7/task_8c08a732e588 là stale: worker-abandon guard trả state=succeeded/alreadySettled=true/stale=true/residualResources=none/processAction=none. Không mở lại hoặc gửi thêm follow-up cho assignment bàn giao; không có writer mobile worker đang tiếp tục implementation.

CRG: đúng checkout main-3, HEAD `51bd5a5b77ba6fdeeac011a0982dd6770f7bdac5`, stats head_matches_build true; query `file_summary` ticket-detail. Source reads qua LeanCTX; production artifact/environment probes read-only, chỉ xuất boolean và source metadata.
