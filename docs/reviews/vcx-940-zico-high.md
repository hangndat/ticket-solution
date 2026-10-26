# VCX-940 — Zico iOS high · Epic #914 / #940 / #941

| Trường | Kết quả |
| --- | --- |
| Nhân viên / role | Zico (`zico`) · `ios`; cost tier `high` vì race/idempotency Gate |
| Route yêu cầu | Codex `gpt-6-sol/high` vì quota Claude Sonnet 5 chưa xác minh; effective model không có receipt để tự xác nhận |
| Base / code SHA | `ddb7428b6e266d4ea406ff74478cc71cf30c5055` → `4150e5c87c81b7a89975fb91d946f77627573c22` (F-979-01/02 code `a633b687cfc71ce9bab4436357589e0b6d6fef04`) |
| Evidence SHA F-979-01/02 | `6e015509ec28f78d56d49deb064803ba9f499387` |
| Evidence SHA F-979-03 | `db07c56d2eac9b325b27c16ad2d889290012e4a5` (commit report/test/runtime; dòng metadata này ghi sau commit đó) |
| Scope | `apps/mobile/**`; không đổi backend, contract, #928 hay fixture DB khác |
| Kiến trúc | Không đổi ADR-18 hoặc admission invariant; sửa lifecycle client và hiển thị conflict |
| Trạng thái | Code complete; F-979-01/02/03 đã có code/test và narrow runtime evidence, **chờ James revalidate diff và CI exact PR tip mới**. Chưa gán acceptance complete / pilot ready. |

## Chẩn đoán và thay đổi

1. **F-940-CONFLICT-SIM — lỗi client thật, đã sửa và có runtime evidence.** `queue_hold` chỉ hủy POST `/offline-sync`, GET receipt đi qua upstream. Với một operation, proxy trước sửa ghi 436 POST bị hủy, 237 GET receipt `404` rồi 199 GET `429`. `projectStaffGateOwnedSnapshot` tạo wrapper `focusSync` mới mỗi render; `useFocusEffect` đăng ký lại và gọi sync sau mỗi cập nhật queue. Client còn coi GET `429` là receipt sai schema, tạo copy “Máy chủ trả biên nhận không hợp lệ” trước khi upstream admit. Sửa callback focus ổn định nhưng luôn gọi action hiện hành; `429/5xx` giữ operation chờ, không gắn lỗi schema. Nối banner conflict vào sticky trên màn Quét/Nhập tay, ưu tiên conflict kể cả khi mạng mất.
2. **Contract API đúng.** Probe riêng trên vé ACTIVE của DB `ticket_vcx940_leader_20261026`: GET receipt chưa apply → `404 OFFLINE_SYNC_RECEIPT_NOT_FOUND`; check-in upstream thật `:3544`; POST sync qua `:3543` → HTTP `201`, item `CONFLICT / ALREADY_CHECKED_IN`, có winning check-in; GET receipt sau conflict vẫn 404 vì ledger receipt chỉ lưu `APPLIED`. Không sửa backend.
3. **F-940-REVOKE-AUTHZ — thao tác UAT cũ chụp màn sau khi Staff guard đã chuyển route.** Probe API riêng tạo reservation rồi revoke membership trước confirm → `403 MEMBERSHIP_REVOKED`, membership khôi phục trong `finally`. Trên build đó, tap xác nhận trong sheet sau revoke gửi `POST /sessions -> 403`, Staff biến mất, vé vẫn `ACTIVE`. Evidence này chỉ đo đường confirm; F-979-03 bên dưới xử lý đường replay POST riêng.
4. **F-940-LOGOUT-SIM — harness cũ dừng tại modal OIDC.** `endKeycloakSession()` mở `ASWebAuthenticationSession`; dialog hệ thống dùng chữ “Sign In” chung. Sau tap Continue trên build với client `ticket-mobile`, app về màn attendee đã đăng xuất. Đăng nhập lại cùng user bằng UAT session: Gate báo “Chưa mở phiên cổng”, không còn nút queue/banner conflict. Queue/phiên local đã purge. Bản build tạm dùng nhầm client `ticket-ios` gây “Invalid redirect uri”; đã loại khỏi kết luận bằng rebuild cuối `ticket-mobile`.

### Batch review PR #979 — F-979-01 / F-979-02

James high review trên `ff2c1df3` phát hiện banner dưới event đang chọn lấy `queueSnap.conflictCount` toàn thiết bị; Lịch sử lại lọc tenant+event. Code SHA `a633b687cfc71ce9bab4436357589e0b6d6fef04` sửa `StaffGateOpsSticky` chỉ hiện banner khi item `conflict/rejected` khớp **cả tenantId và eventId** của `gateScope`. Không chọn event thì không hiện banner. `GateStatusStrip` vẫn dùng `queueSnap.pendingCount/conflictCount` toàn thiết bị để giữ nút đồng bộ; thao tác sync toàn hàng đợi không đổi. Copy chuyển từ “Xem chi tiết bên dưới” sang “Mở tab Lịch sử của sự kiện này để xem chi tiết”.

Regression mới seed hàng đợi hai event cùng tenant và một item cùng eventId nhưng tenant khác; event A có pending, event B có conflict. Trên cả hai lần bind/hydrate, ở trạng thái offline: A không có banner, B báo đúng **1** conflict, Lịch sử B có đúng item B, tổng thiết bị vẫn có pending/conflict để hiện sync. Test cũng khẳng định copy dẫn đúng tab. Đây là regression state/client; UAT simulator bên dưới dùng một event fixture riêng, không claim UAT hai event.

### F-979-03 — revoke trên offline replay POST

James bổ sung blocker trong cùng batch: POST `/offline-sync` trả `401` hoặc membership `403` trước đây bị `OfflineScanQueue` đánh dấu `rejected` như kết quả vé, nên không có receipt lookup và `StaffGateWorkspaceProvider` không reset Staff chrome. Code SHA `4150e5c87c81b7a89975fb91d946f77627573c22` dùng `isMembershipAuthzDenial` trên batch response. Operation giữ `pending` trong memory và durable store, không tăng conflict/admit, replay trả `authzDenial`. Workspace kiểm user/session epoch hiện hành rồi gọi `clearStaffChromeAfterAuthzDenial()` trước đối soát ops; hàm này reset eligibility ngay và refetch MeEvents theo quyền server. Tín hiệu denial vẫn tới workspace nếu nhân viên đổi event khi POST đang chạy, nhưng không tác động phiên user mới. `403` với mã lỗi nghiệp vụ vé không đi vào nhánh authz.

Regression queue kiểm `401`, `403 MEMBERSHIP_REVOKED`, `403 ALREADY_CHECKED_IN`, hydrate lại hàng đợi, và SecureStore write fault sau POST. Regression tích hợp với provider thật: Staff active có pending, revoke, chạm sync → một POST `403`, `useStaffWorkspace()` đổi từ true sang false, operation vẫn pending, không có admit. Narrow simulator trên build cuối và fixture DB riêng: pending trước revoke; proxy ghi POST `/offline-sync -> 403`; AX sau sync chỉ còn tab attendee, không còn Staff. Membership fixture được khôi phục trong `finally`. Vé probe đã được admit từ probe contract trước; không dùng nó để chứng minh trạng thái vé ACTIVE mới.

## Runtime evidence (private, không commit ảnh/token)

| Bằng chứng | Kết quả |
| --- | --- |
| `apps/mobile/.uat-artifacts/vcx-940/probes/high-proxy-trace.json` | Trước sửa: 436 POST drop, 237 receipt 404, 199 receipt 429. Sau sửa: một POST sync 201 cho fixture conflict mới; một POST sessions 403 cho revoke. |
| `high-contract-probe.json` | Fixture API độc lập: real upstream admit → `CONFLICT / ALREADY_CHECKED_IN`; receipt 404 đúng contract. |
| `high-conflict-fresh-queue.png` / `-ax.json` | Queue mới: “Chờ đồng bộ — Chưa xác nhận vào cổng”; chưa admit. |
| `high-conflict-synced.png` / `-ax.json` | Chạm đúng nút AX “Đồng bộ hàng đợi offline”: “Không cho vào — Vé đã check-in trước đó”. |
| `high-conflict-banner-final.png` / `-ax.json` | Build cuối, restart: banner “Có xung đột đồng bộ” bền vững, không tạo lượt vào mới. |
| `high-revoke-probe.json`, `high-revoke-final.png` / `-ax.json` | API 403 `MEMBERSHIP_REVOKED`; trên simulator sau request 403 không còn Staff; vé fixture vẫn ACTIVE. |
| `high-logout-final-relogin.png` / `-ax.json` | Sau logout OIDC và UAT re-login cùng user: “Chưa mở phiên cổng”, không còn queue. |
| `high-979-queued.png` / `-ax.json`, `high-979-conflict.png` / `-ax.json` | Build mới: queue trước sync không cho vào; sau sync banner “1 mục” dưới event đang chọn và copy dẫn tab Lịch sử. |
| `high-979-history.png` / `-ax.json`, `high-979-ui.json` | Tap tab Lịch sử thấy lượt conflict tương ứng trên ảnh. AX dump xác nhận route Lịch sử và số lượt, nhưng bỏ sót hàng đầu đang hiển thị; giới hạn được giữ rõ trong JSON. |
| `high-979-replay-revoke-pending.png` / `-ax.json`, `high-979-replay-revoke-after.png` / `-ax.json`, `high-979-replay-revoke.json` | Build cuối F-979-03: pending trước revoke, POST replay `403` trong proxy trace private, Staff chrome biến mất; membership fixture khôi phục. |

Provenance: simulator riêng `D11-Gate-UAT` (`121ECECA-D9F9-45D6-BC69-789958E07055`), Orca emulator AX/tap, Release simulator build local từ source tree khớp code SHA; API proxy `:3543` → Nest `:3544`, OIDC local `:8180`, DB fixture riêng. Proxy/ảnh/credential nằm dưới `.local-dev/` và `.uat-artifacts/` gitignored. Lệnh build là `xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release -destination 'platform=iOS Simulator,id=121ECECA-D9F9-45D6-BC69-789958E07055' -derivedDataPath .uat-artifacts/vcx-940/high/DerivedData DEVELOPMENT_TEAM=BLUA62D52G build` với env API/OIDC fixture và `ticket-mobile`; log private cuối `high-build-979-f03-exact.log` có `BUILD SUCCEEDED`. Simulator ký ad hoc; cấu hình team Xcode đã xác minh là personal `BLUA62D52G`. Không dùng Expo/EAS Cloud.

## Checks và giới hạn

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/mobile test` | 478/478 PASS, gồm callback focus, receipt 429/503, banner hai event/offline/restart, replay authz denial |
| `pnpm --filter @ticket/mobile test:durable-integration` | 3/3 PASS, gồm Staff active pending → revoke → sync `403` → ẩn chrome, không admit |
| `pnpm --filter @ticket/mobile typecheck` | PASS |
| `pnpm --filter @ticket/mobile lint` | 0 error; 7 warning có sẵn ngoài diff |
| `git diff --check` | PASS trước commit code |
| Build + UAT | Local Xcode Release simulator PASS; AX + ảnh private như trên |

B-03 physical [PR #972](https://github.com/hangndat/ticket-solution/pull/972#issuecomment-6412271884) và B-04 email user đã PASS; **không chạy/gửi lại**. #941 receipt `APPLIED`/physical proof mượn từ B-03 trên SHA cũ vì diff chỉ thêm xử lý `429/5xx` và không đổi parser `200 APPLIED`; reviewer cần quyết định tái sử dụng evidence trên PR tip. Không claim camera, PKCE login UI, Portal end-to-end hay thiết bị thật mới trong lượt này. Không mở Run, không dùng Agent tool.

**Checkpoint:** `F-940-CONFLICT-SIM`, `F-940-REVOKE-AUTHZ`, `F-940-LOGOUT-SIM` đã có bằng chứng simulator sau sửa. `F-979-01/02/03` có code/test và narrow simulator evidence; chờ James diff revalidation trên SHA mới. #940/#941 còn chờ acceptance tổng hợp. Không tự merge hoặc đánh PASS khi chưa đủ gate.
