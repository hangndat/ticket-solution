# VCX-940 — Zico iOS high · Epic #914 / #940 / #941

| Trường | Kết quả |
| --- | --- |
| Nhân viên / role | Zico (`zico`) · `ios`; cost tier `high` vì race/idempotency Gate |
| Route yêu cầu | Codex `gpt-6-sol/high` vì quota Claude Sonnet 5 chưa xác minh; effective model không có receipt để tự xác nhận |
| Base / code SHA | `ddb7428b6e266d4ea406ff74478cc71cf30c5055` → `ed6f8a10a69e1f2f43d71985b1fbf3d63141482b` |
| Scope | `apps/mobile/**`; không đổi backend, contract, #928 hay fixture DB khác |
| Kiến trúc | Không đổi ADR-18 hoặc admission invariant; sửa lifecycle client và hiển thị conflict |
| Trạng thái | Code complete, simulator evidence complete cho ba finding; **chờ review độc lập và CI exact PR tip**. Chưa gán acceptance complete / pilot ready. |

## Chẩn đoán và thay đổi

1. **F-940-CONFLICT-SIM — lỗi client thật, đã sửa và có runtime evidence.** `queue_hold` chỉ hủy POST `/offline-sync`, GET receipt đi qua upstream. Với một operation, proxy trước sửa ghi 436 POST bị hủy, 237 GET receipt `404` rồi 199 GET `429`. `projectStaffGateOwnedSnapshot` tạo wrapper `focusSync` mới mỗi render; `useFocusEffect` đăng ký lại và gọi sync sau mỗi cập nhật queue. Client còn coi GET `429` là receipt sai schema, tạo copy “Máy chủ trả biên nhận không hợp lệ” trước khi upstream admit. Sửa callback focus ổn định nhưng luôn gọi action hiện hành; `429/5xx` giữ operation chờ, không gắn lỗi schema. Nối banner conflict vào sticky trên màn Quét/Nhập tay, ưu tiên conflict kể cả khi mạng mất.
2. **Contract API đúng.** Probe riêng trên vé ACTIVE của DB `ticket_vcx940_leader_20261026`: GET receipt chưa apply → `404 OFFLINE_SYNC_RECEIPT_NOT_FOUND`; check-in upstream thật `:3544`; POST sync qua `:3543` → HTTP `201`, item `CONFLICT / ALREADY_CHECKED_IN`, có winning check-in; GET receipt sau conflict vẫn 404 vì ledger receipt chỉ lưu `APPLIED`. Không sửa backend.
3. **F-940-REVOKE-AUTHZ — thao tác UAT cũ chụp màn sau khi Staff guard đã chuyển route.** Probe API riêng tạo reservation rồi revoke membership trước confirm → `403 MEMBERSHIP_REVOKED`, membership khôi phục trong `finally`. Trên build cuối, tap xác nhận trong sheet sau revoke gửi `POST /sessions -> 403`, Staff biến mất, vé vẫn `ACTIVE`. Đây là fail closed đúng PRD M02/M10 và SEC-CACHE; policy yêu cầu purge cục bộ khi logout, còn revoke chặn thao tác mới và ẩn quyền.
4. **F-940-LOGOUT-SIM — harness cũ dừng tại modal OIDC.** `endKeycloakSession()` mở `ASWebAuthenticationSession`; dialog hệ thống dùng chữ “Sign In” chung. Sau tap Continue trên build với client `ticket-mobile`, app về màn attendee đã đăng xuất. Đăng nhập lại cùng user bằng UAT session: Gate báo “Chưa mở phiên cổng”, không còn nút queue/banner conflict. Queue/phiên local đã purge. Bản build tạm dùng nhầm client `ticket-ios` gây “Invalid redirect uri”; đã loại khỏi kết luận bằng rebuild cuối `ticket-mobile`.

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

Provenance: simulator riêng `D11-Gate-UAT` (`121ECECA-D9F9-45D6-BC69-789958E07055`), Orca emulator AX/tap, Release simulator build local từ source tree khớp code SHA; API proxy `:3543` → Nest `:3544`, OIDC local `:8180`, DB fixture riêng. Proxy/ảnh/credential nằm dưới `.local-dev/` và `.uat-artifacts/` gitignored. Lệnh build cuối là `xcodebuild -workspace ios/Vemoki.xcworkspace -scheme Vemoki -configuration Release -destination 'platform=iOS Simulator,id=121ECECA-D9F9-45D6-BC69-789958E07055' -derivedDataPath .uat-artifacts/vcx-940/high/DerivedData DEVELOPMENT_TEAM=BLUA62D52G build` với env API/OIDC fixture và `ticket-mobile`; log private `high-build-final.log` có `BUILD SUCCEEDED`. Simulator ký ad hoc; cấu hình team Xcode đã xác minh là personal `BLUA62D52G`. Không dùng Expo/EAS Cloud.

## Checks và giới hạn

| Check | Kết quả |
| --- | --- |
| `pnpm --filter @ticket/mobile test` | 475/475 PASS, gồm callback focus ổn định, receipt 429/503 giữ queued, conflict banner offline ưu tiên |
| `pnpm --filter @ticket/mobile typecheck` | PASS |
| `pnpm --filter @ticket/mobile lint` | 0 error; 7 warning có sẵn ngoài diff |
| `git diff --check` | PASS trước commit code |
| Build + UAT | Local Xcode Release simulator PASS; AX + ảnh private như trên |

B-03 physical [PR #972](https://github.com/hangndat/ticket-solution/pull/972#issuecomment-6412271884) và B-04 email user đã PASS; **không chạy/gửi lại**. #941 receipt `APPLIED`/physical proof mượn từ B-03 trên SHA cũ vì diff chỉ thêm xử lý `429/5xx` và không đổi parser `200 APPLIED`; reviewer cần quyết định tái sử dụng evidence trên PR tip. Không claim camera, PKCE login UI, Portal end-to-end hay thiết bị thật mới trong lượt này. Không mở Run, không dùng Agent tool.

**Checkpoint:** `F-940-CONFLICT-SIM`, `F-940-REVOKE-AUTHZ`, `F-940-LOGOUT-SIM` đã có bằng chứng simulator sau sửa; #940/#941 chờ reviewer độc lập, CI và acceptance tổng hợp. Không tự merge hoặc đánh PASS khi chưa đủ gate.
