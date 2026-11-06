# #1233 · Đổi mã / chi tiết vé — review gộp ban đầu

## James final keyboard evidence — exact `38f11b0bef63914c5b0428d428ab2ed1be754990`

[Matrix tích hợp 45 khung](D6-integrated390-revalidation.md) pin `d6-redeem-invalid-keyboard-390.png`/AX ở strict390: `CODE_INVALID` còn thông báo VI, mã giữ trong ô sửa được và software keyboard thật. Evidence signed ticket QR/manual code thực ở390 bổ sung cho chi tiết vé; F01–F05 đã đóng theo các checkpoint bên dưới. **DoD/UI nhóm PASS trong AC Đổi mã/chi tiết, Security PASS code scope và guard đã quan sát**; không suy QR Gate admission từ signed ticket. Fix counter 2/2 giữ nguyên.

- Reviewer James (`dod+sec+ux`), session `53a7f6a7-762f-445d-9b6e-1fb42f0ab14e`, độc lập Zico / `ctx_5023256db435`. Fix `0/2`.
- Base `9f240683460c43a29743fe116584e017faa63916` → exact head/build `b8cd25e9ab703bf2ddc5aef8cc08591155168c7f` (`0a8d3f65`, `b8cd25e9`). Diff: `global-redeem.tsx`, `ticket-detail.tsx`, `ticket-detail-credential.test.ts` trong `apps/mobile/src/screens/`; không có file thứ tư trong `git diff --name-status`.
- CRG ticket worktree: stats HEAD khớp, `detect_changes` trên base (risk 0.75), `tests_for` ticket detail; source/tests quyết định. Architecture impact: Không. Nguồn: AC1–AC3 `.orca-metrics/d6-redeem-ticket-detail-spec.md`, PRD M07–M08, Technical Design §9.1/§12.3, O28–O30/O33.
- HTML gốc pin SHA256: redeem `37a5a38fb2186ea25f64412fd0a08374f32505745d9ac9382d84d60392c89ea6`, detail `2ac0417f4148125f64416a39a6107a9a6952d431f376dccec2e77923f6995f14`; đều khớp. Native critique bằng một context theo role worker; O33 waive a11y UAT, không ghi PASS a11y.
- Reuse handoff `apps/mobile/.uat-artifacts/d6/redeem-ticket-detail-report.md`: trên SHA này typecheck, 563/563 tests, lint (8 warning ngoài slice), UI budget, diff check, local iOS Release đều PASS; không chạy lại. Release bundle pin SHA; simulator iOS 27.0, 390×844 pt, ảnh 1170×2532 px, locale vi, fixture tổng hợp.
- Kiểm lại cả 8 PNG: guest `a6f3b40d`, verified `34678129`, invalid `2e5f80de`, pending `66bbf950`, ACTIVE `6fabbbf6`, USED `80a360b1`, missing `6009e8a0`, missing-scrolled `b9a0c6fc` (prefix SHA256, full hash trong handoff); đúng nhãn, khác hash. `ui-evidence-check.sh apps/mobile/.uat-artifacts/d6`: OK 46 file, không trùng. Handoff/ảnh chứng minh guest→verified→pending/issued, ví→detail→Back, body thiếu credential cuộn tới CTA trên tab bar; ảnh không chứng minh keyboard/offline.

| Gate | Verdict | Căn cứ |
| --- | --- | --- |
| DoD / AC1 | PASS | Guest có ô mã nhưng lookup qua sign-in; pending báo chưa phải vé, issued mở detail; invalid rõ; retry/idempotency giữ nguyên. |
| DoD / AC2 | FAIL | ACTIVE/USED/missing đúng ảnh và code owner scope; offline detail runtime thiếu (F01). |
| DoD / AC3 | FAIL | Back/scroll chứng minh; keyboard và safe area khi mở bàn phím thiếu (F02). |
| UI/UX | FAIL | Khớp mẫu trên state đã chụp; F02 chặn và F03 copy nên sửa. |
| Security | PASS | QR chỉ từ envelope signed-format qua owner-scoped load; guest/pending không có detail; USED mờ + thông báo hết hiệu lực; thiếu credential không có QR/mã tay. Không đổi protocol, auth, retry/idempotency; fixture JWS không chứng minh Gate signature. |

**F01 — thiếu evidence AC2, blocker, chặn acceptance/merge.** Handoff ghi ngắt fixture làm app về guest, chưa mở được detail offline; PRD M08 yêu cầu vé lưu offline và AC2 yêu cầu offline/sync trung thực. Đóng khi chạy build pin SHA với owner đã bind/cache, ngắt mạng, mở detail offline và ghi ảnh/AX last-sync, QR từ credential lưu hoặc unavailable trung thực; xác nhận không hiển thị credential chéo owner.

**F02 — thiếu evidence AC3/UI, blocker, chặn acceptance/merge.** Handoff chỉ Orca type; không quan sát bàn phím phần mềm trên 390×844. `global-redeem.tsx:693` dùng KeyboardAvoidingView nhưng source không chứng minh CTA/ô nhập còn thấy khi keyboard mở. Đóng khi chụp/đo guest và verified với software keyboard hiện rõ, cuộn tới ô/CTA, xác nhận không bị safe area/tab bar che và thao tác tiếp tục được.

**F03 — copy/locale, should-fix, không chặn merge riêng.** Ảnh `redeem-pending-final.png` cho thấy bước “Xác nhận” và notice “Chờ duyệt — chưa phải vé”, nhưng câu dẫn vẫn “Xem kỹ thông tin vé trước khi xác nhận nhận vào ví” (`global-redeem.tsx:481`); người dùng có thể tưởng cần xác nhận lần nữa. Đóng khi đổi câu dẫn cho pending/issued và kiểm ảnh hoặc render test state; không mở lại nút submit.

Tổng DoD **FAIL** do F01–F02; security **PASS** trong diff, UI/UX **FAIL**. Chưa có evidence physical device hay Gate verification; không suy pilot ready. Không sửa source, commit, publish, merge hoặc deploy.

## Revalidation fix 1/2 — kết luận mới trên `458e2a10c0c1793a231420fd7d9b77a4eb16a0bb`

- Diff từ `b8cd25e9` chỉ ba file mobile trên (`2a67fdcc`, `458e2a10`); CRG stats HEAD khớp và `detect_changes` trên base. Checks **đã chạy bởi Zico trên SHA mới**: typecheck, 564/564 tests, lint, UI budget, diff check, local Release PASS; tôi tái dùng, không gọi 563 tests/ảnh bản đầu là chạy trên SHA mới.
- Kiểm trực tiếp bốn ảnh fix 1: pending `bf85bad6`, verified cache `7b2608ec`, keyboard guest `3a12d29d`, keyboard verified `e7c7d28a` (SHA256 khớp full hash handoff; 1170×2532 px, 390×844 pt); `ui-evidence-check.sh` OK 53 file, không trùng. Fixture/JWS tổng hợp; ảnh cache không phải bằng chứng cold restart.
- **F03 đã xác minh:** `global-redeem.tsx:128-135,487-489` chọn câu dẫn riêng cho pending/issued; ảnh/AX pending nói chưa có vé, không còn gợi ý xác nhận lại. Không thấy regress nút submit/idempotency.
- **F02 đã xác minh trong scope:** ảnh guest/verified trên iPhone 12/iOS 27.0 cho thấy software keyboard thực, ô nhập/caret và CTA ở trên keyboard; kết hợp hành trình nhập→Tìm vé ở handoff gốc. Không suy thêm kết quả cho F03 keyboard của Task Khám phá.
- **F01 còn mở, blocker:** verified-session cache fallback khi `/v1/me/tickets` 503 có ảnh/AX QR, mã tay, last-sync và cảnh báo, đúng đường `ticket-detail.tsx:178-250`. Cold restart sau ngắt fixture lại về guest, không có offline binding/chi tiết vé; cross-owner runtime chưa quan sát. Đóng khi có fixture đã ghi binding sau online verify, kill/relaunch offline, ảnh/AX detail + last-sync/QR hoặc unavailable trung thực và chuyển owner không lộ cache cũ.
- **F04 mới — security/correctness, blocker, chặn merge:** `ticket-detail.tsx:195-205` nay trả cache có QR khi `resolveCredential()` là `unavailable`. `session-boundary.ts:157-160,306-320` cho thấy thiếu credential trong store có thể trả `unavailable` trong lúc snapshot còn `verified`; đây không phải tín hiệu mạng (`refresh-unreachable` riêng). Khi đó detail hiển thị QR từ cache mà không có bearer hoặc offline binding được xác nhận; test mới chỉ mock `status:'token'`. Đóng khi `unavailable` fail closed (hoặc chỉ qua offline binding đã xác minh) và test verified snapshot + credential missing + cache có QR phải không render QR; giữ fallback cho network/503 và owner switch.

| Gate trên SHA mới | Verdict | Lý do |
| --- | --- | --- |
| DoD | **FAIL** | F01 cold restart AC2 và F04 auth/cache còn mở; AC1/AC3 được giữ hoặc tái xác minh. |
| Security | **FAIL** | F04 mở nhánh hiển thị cached credential khi bearer unavailable; 503 và explicit unauthorized API vẫn được tách. |
| UI/UX | **FAIL** | F02/F03 đã đóng, nhưng AC2 offline cold restart bắt buộc vẫn thiếu evidence F01. |

Fix count `1/2`; không có source edit, commit hay publish trong lượt này. Không kết luận acceptance/pilot ready.

## Revalidation fix 2/2 — `458e2a10c0c1793a231420fd7d9b77a4eb16a0bb` → `1528782715a89983c62263e584539d1a2b4b2a2d`

- James (`dod+sec+ux`), độc lập Zico. Chỉ hai file `apps/mobile/src/screens/ticket-detail.tsx` và `ticket-detail-credential.test.ts` đổi; đã đọc toàn diff. CRG ticket đúng worktree/HEAD `15287827` (stats + `file_summary`, `tests_for`); LeanCTX đối chiếu source/session/cache. Architecture impact **Không**: chỉ fail-closed presentation, không đổi auth, API hoặc offline binding.
- **F04 đã xác minh/đóng trên `15287827`:** `resolveCredential()` trả `unavailable` khi snapshot verified nhưng SecureStore thiếu credential (`session-boundary.ts:306-320`); `ticket-detail.tsx:195-207` nay đặt error, không dùng cache dù đã tìm thấy ticket. QR chỉ tạo từ `visibleLoad.ready`; mã tay cũng chỉ hiện khi QR hợp lệ. Test mới đặt cache có QR và mã tay tổng hợp, credential unavailable, khẳng định không probe, không QR/mã tay và có ErrorState. Đây là assertion trên nhánh lỗi thực, không chỉ mock bearer thuận lợi.
- Bearer hợp lệ + HTTP 503 thật qua `realProbeMeTickets` thành `unreachable`, sau đó detail dùng cache theo `userId`/scope, hiển thị QR và notice offline. Test kiểm QR và notice nhưng mock `walletOfflineNoticeBody` thành “Offline”, nên timestamp last-sync được xác minh bằng đường source `cache.syncedAt` → `walletOfflineNoticeBody`, cộng evidence runtime fix 1 trên SHA `458e2a10`; không gọi test mới là bằng chứng timestamp runtime trên SHA hiện tại. `unauthorized` chuyển ErrorState, không fallback cache. `readTicketDisplayCache` kiểm key và payload `userId`/`tenantId`; `loadMatchesOwner` lọc ngay frame đổi owner, effect hủy response cũ; test delayed owner switch giữ QR bằng 0. Các đường này không đổi trong fix 2.
- Reuse check Zico trên **chính `15287827`**: typecheck PASS, 567/567 tests PASS, lint PASS (8 warning ngoài slice), UI budget PASS, `git diff --check` PASS, local iOS Release PASS; không chạy lại suite vì không có rủi ro còn thiếu mà rerun giải quyết. Evidence UI F02/F03 và cache runtime fix 1 vẫn hợp lệ cho phần không đổi; không chuyển nhãn ảnh cũ sang SHA mới.
- **F01 vẫn mở, blocker AC2:** Release fixture fix 2 khởi động guest, không có online sign-in/restore tạo persisted owner binding; cold restart offline và chuyển owner runtime chưa được chứng minh. Đầu vào chẩn đoán tối thiểu: fixture/account tổng hợp cho phép app lưu bearer và `/v1/me` trả cùng `userId` sau verify; `/v1/me/tickets` trả ticket ACTIVE có `tenantId` và Gate envelope để wallet ghi cache kèm thời điểm sync do app tạo, rồi `bindAfterOnlineVerify` ghi binding. Xác nhận trạng thái bound/cache trước khi tắt mạng, rồi kill/relaunch offline, mở detail và quan sát QR hoặc unavailable trung thực cùng last-sync; đổi sang owner khác và xác nhận không lộ cache cũ. Cần pin build/SHA và AX/ảnh runtime. Chưa có evidence này, không suy sản phẩm lỗi hay acceptance PASS.

| Gate `15287827` | Verdict | Căn cứ |
| --- | --- | --- |
| DoD/AC1, AC3 | PASS trong scope đã xác minh | Diff fix 2 không chạm luồng Đổi mã/keyboard; evidence fix 1 giữ hiệu lực. |
| DoD/AC2 | **FAIL** | F04 đóng nhưng F01 cold restart/cross-owner runtime còn mở. |
| Security | **PASS cho diff fix 2** | `unavailable` fail closed; 503 có bearer dùng owner cache; unauthorized và stale owner response không lộ QR. Không chứng minh Gate signature hoặc cold offline binding runtime. |
| UI/UX | **FAIL tổng AC2** | F02/F03 giữ trạng thái đã xác minh; offline detail sau cold restart chưa có runtime evidence. |

Fix count **2/2** đã hết; dừng fix tự động, không đề nghị lượt thứ ba. Coordinator giữ task chờ chẩn đoán fixture/session có giới hạn và quyết định tiếp theo theo review workflow; chưa merge/deploy/store, chưa đánh acceptance/pilot ready. Báo cáo này không commit.

## Coordinator evidence bổ sung — chờ James revalidate, `b5a9f0eeb8cd2b5d8c360660d6a0a2aa6033db93`

- Trên iPhone 16 Pro của Dexter, bản UAT riêng ký Team cá nhân build 49/50 đã khôi phục phiên verified tổng hợp, tải vé A rồi cold restart khi API dừng. Root route Ví hiển thị vé A từ cache, thời điểm đồng bộ và cảnh báo trạng thái. Link chi tiết A mở offline, không dựng QR/mã tay vì fixture không cung cấp credential.
- Sau chuyển online sang owner B, ví hiển thị vé B; cold restart offline ví chỉ còn B, link vé A báo không mở được và không hiện QR/mã tay. Build 50 kiểm lại header `Chi tiết vé` và guard owner trên exact SHA. Ảnh/hash, API provenance và giới hạn tại `apps/mobile/.uat-artifacts/d6/usb-verified-staff-report.md`.
- `pnpm check` 38/38, mobile 593/593, local Xcode Release và USB install đạt. F01 được **đề nghị revalidate**, chưa tự đổi verdict reviewer. Fixture không có signed credential, kích thước máy 402×874 pt và UI camera/claim/delete không thuộc evidence này.

## James revalidation F01 — exact source/build `b5a9f0eeb8cd2b5d8c360660d6a0a2aa6033db93`

- Review độc lập Zico, giữ fix count **2/2**. Base đã review `1528782715a89983c62263e584539d1a2b4b2a2d` → `b5a9f0ee`; kiểm diff tích hợp liên quan, nhất là root `/wallet-access` ở `d231b4e9` và header `Chi tiết vé` ở `b5a9f0ee`. Worktree lúc review ở `438fb559` nhưng `git diff b5a9f0ee..HEAD -- apps/mobile` rỗng; CRG stats/query được làm mới cho HEAD và source mobile trùng exact SHA cần kết luận. Architecture impact **Không**.
- Handoff USB pin build 50 bằng preinstall `EXConstants.bundle/app.config` (SHA `b5a9f0ee`, UAT bundle riêng, local API, build 50), local Xcode Release/USB install PASS. Đây là provenance do worker ghi; binary metadata thô không nằm trong artifact để reviewer trích xuất lại. Fixture chỉ có owner A/B và Staff tổng hợp, bearer trong file ignored, không có credential Gate signed hay dữ liệu thật. Reuse `pnpm check` **38/38**, mobile **593/593**, lint/diff check trên chính SHA; không rerun.
- Đối chiếu 8 PNG USB A/B build 49/50: SHA-256 đều khớp bảng trong `usb-verified-staff-report.md`; build 50 ảnh 1206×2622 px = **402×874 pt**. A online vé `…44444444`, sau API stop + cold relaunch A offline wallet vẫn có vé này, last-sync và cảnh báo trạng thái cũ; offline detail hiện placeholder “Chưa có mã QR để quét” và “Chưa có mã nhập tay”. B online vé `…55555555`, sau API stop + cold relaunch B offline wallet chỉ có B với last-sync/stale notice; link vé A trả “Không mở được vé này”, không có A ticket/QR/mã tay. Build 50 xác minh header “Chi tiết vé” ở detail B và guard link A còn hiệu lực.
- Source guard: `OfflineDisplayBoundary.hydrate` chỉ lấy binding bền vững; `MyTicketsScreen:427-436` chọn offline wallet theo `userId`/`tenantId` bound. `readTicketDisplayCache` dùng key theo cả hai ID và so khớp payload; offline wallet đọc đúng cặp này. Detail dùng cặp owner và ticketId, `loadMatchesOwner` chặn stale ready state ngay khi đổi owner; QR chỉ từ signed-format envelope, mã tay chỉ khi credentialAvailable. Root route giữ offline display trong Stack thay vì redirect vào NativeTabs ẩn. Evidence runtime và source đủ **đóng F01** cho cached detail thiếu credential và cross-owner case đã giao; không suy QR signed, Gate admission hay mọi tenant/account.
- **F05, rủi ro UX mới cần kiểm, không gán lỗi runtime đã xác nhận:** CTA “Về Vé của tôi” trên error/missing detail ở `ticket-detail.tsx:318,329` luôn `router.replace('/(tabs)/my-tickets')`, trong khi offline bound `showMyTicketsTab` ẩn NativeTabs trigger và root `/wallet-access` là route đã dùng để tránh redirect ẩn. Ảnh B old-owner link cho thấy CTA nhưng CLI không tap được, nên chưa biết nút có trở về ví offline hay không. Coordinator kiểm bằng tap trên build pin trước khi đánh PASS điều hướng AC3; không giao fix thứ ba tự động.

| Gate trên `b5a9f0ee` | Verdict |
| --- | --- |
| F01 / AC2 offline display | **PASS, đóng F01** cho scenario A→B và cold restart đã chứng minh; last-sync/stale notice trung thực. |
| Security | **PASS trong scope**: owner cache/binding tách A/B, old-owner link không lộ dữ liệu; fixture không kiểm chữ ký Gate. F04 giữ trạng thái đã đóng vì source nhánh credential không đổi. |
| UI/UX | **PASS cho F01 states đã chụp**; header build 50 đúng. F05 CTA chưa tap, và geometry 390×844 pt không được ảnh USB 402×874 pt chứng minh. |
| DoD tổng #1233 | **Chờ xác minh F05/AC3** nếu CTA là đường quay về ví bắt buộc; không tự suy toàn Task PASS từ F01. |

Không sửa source, commit, merge, deploy hoặc store trong review này; chuyển F05 và giới hạn evidence cho coordinator quyết định theo workflow sau mốc 2/2.

## James revalidation F05 — `b5a9f0eeb8cd2b5d8c360660d6a0a2aa6033db93` → exact source/build `70f7df23a66ee2e47d06b82739a26c58aa41aeac`

- CRG ticket stats/build/query khớp HEAD `70f7df23`, rồi LeanCTX kiểm source. Toàn diff mobile chỉ `app.config.ts` (build 50→51), `ticket-detail.tsx`, `ticket-detail-credential.test.ts`. Architecture impact **Không**; auth, cache, Gate payload và owner guard không đổi. Fix count gốc **2/2** giữ nguyên; đây là revalidation F05 sau quyết định coordinator, không reset vòng sửa.
- Hai CTA error/missing ở `ticket-detail.tsx:318,329` đều `router.replace('/wallet-access')`. Root route `wallet-access/index.tsx` hiển thị `MyTicketsScreen` khi offline bound, còn verified online redirect tới `/(tabs)/my-tickets`; do đó source loại bỏ đích NativeTabs ẩn mà F05 nêu. Test mới thực sự gọi `onPress()` ở cả nhánh unauthorized và missing rồi assert route `/wallet-access`, nhưng mock luôn verified và không mount root route, nên không chứng minh tap offline trên thiết bị.
- Reuse bàn giao coordinator trên **chính `70f7df23`**: mobile 593/593 tests, typecheck, lint 0 error/8 warning sẵn có, diff check PASS; local Xcode Release Team `BLUA62D52G`, USB build 51 `com.hangndat.ticket.uat`, EXConstants được bàn giao pin exact SHA/local UAT flags (không có binary metadata thô để reviewer trích xuất lại). Ảnh `usb-separate/build51-wallet-root-settled.png` SHA-256 `ef2dcf69d15db046683f0a012bea51641fdc332095421c87067d69c8373d8635` khớp, cho thấy `/wallet-access` online hiển thị Ví của tôi trên iPhone 402×874 pt. Không rerun suite; không có ảnh/tap CTA offline vì CLI thiết bị không hỗ trợ thao tác này.

| Gate `70f7df23` | Verdict |
| --- | --- |
| F05 code/test | **PASS / đã sửa trong source**: cả hai CTA trỏ root route; test onPress kiểm đúng href. |
| F05 runtime offline tap | **GAP, chưa xác minh**: chưa quan sát bấm CTA ở màn old-owner link khi offline bound và trở về ví B. Không gọi ảnh root online là bằng chứng tap offline. |
| Security | **PASS giữ nguyên trong diff F05**: không đổi đường credential/cache hoặc isolation đã xác minh F01/F04. |
| UI/UX, DoD tổng #1233 | **Chờ runtime F05 nếu cần nghiệm thu CTA AC3**; F01 đã đóng, các giới hạn 402×874 pt và không có signed Gate credential giữ nguyên. |

Không sửa source, commit, merge, deploy hoặc store trong lượt review này; coordinator quyết định cách thu một lần evidence tap offline hoặc phạm vi AC3, không tự mở vòng fix mới.

## James revalidation F05 runtime — source/build `70f7df23a66ee2e47d06b82739a26c58aa41aeac`, docs HEAD `1e9222fe8fed78708a34d7cb7ed03e7766185d26`

- Lượt này chỉ đối chiếu evidence, không review/sửa source mới: `git diff --name-only 70f7df23..HEAD -- apps/mobile` rỗng. CRG miễn cho cập nhật evidence docs; kết luận source/test trên `70f7df23` ở trên giữ hiệu lực. Build 51 UAT riêng và API fixture đã dừng theo bàn giao coordinator; không suy từ ảnh về binary metadata thô.
- Người dùng báo một lần tap CTA “Về Vé của tôi” ở màn offline B mở link vé cũ của A. Ảnh trước `usb-separate/build51-f05-offline-prepared.png` SHA-256 `5e069420fbbfb4298760f87ab31ea9ae355baced9eaa883b62fb6350d46be61e` cho thấy “Không mở được vé này”, CTA, không có vé/QR/mã tay A. Ảnh sau `usb-separate/build51-f05-after-tap.png` SHA-256 `d6faf51039169b41cf2b5b346f8d64ba81a18e3aa10817331f585b953e8ad49d` cho thấy root Ví của tôi offline chỉ có B `…55555555`, last-sync và cảnh báo trạng thái có thể cũ. Cả hai hash khớp, 1206×2622 px = **402×874 pt**.
- **F05 runtime PASS / đóng** cho hành trình old-owner error → CTA → ví offline B trên build pin, kết hợp lời xác nhận tap của người dùng, ảnh trước/sau và source/test đã PASS. Ảnh tĩnh có đồng hồ 22:48 và 23:03, nên riêng chúng không chứng minh tính “ngay sau” hay quay video liên tục; không diễn giải thành kiểm mọi nhánh CTA. AC3 điều hướng trong scenario này đạt; Security isolation A/B vẫn PASS trong scope fixture. Giữ fix count gốc **2/2**.
- **Không đánh PASS toàn #1233/pilot ready từ evidence này:** viewport USB 402×874 không thay thế 390×844 cho các state chưa đo; fixture không có signed Gate credential nên không chứng minh QR hợp lệ hoặc admission. Các giới hạn và gate ngoài F05 trong report giữ nguyên. Không rerun suite, sửa source, commit, merge, deploy hay store.
