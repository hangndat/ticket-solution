# Kế hoạch kiểm thử local — Web, Portal và backend

Ngày đối chiếu: **28/10/2026**. Source baseline: `022cb80fd159dad2a7ebd0eeeea07fd64391f90a`.

**Trạng thái: danh mục AC đã review, implementation và runtime evidence còn một phần.** Đây là phạm vi kiểm thử, không phải kết luận sản phẩm đã đáp ứng PRD. Một ID bên dưới có thể tách thành nhiều test theo dữ liệu; không tương đương một file test. Quyết định tách PR #1028 và trạng thái full AC ở bảng tiếp theo.

Danh mục hiện có **86 nhóm ca: 70 P0, 16 P1**, chia 9 suite. Smoke ban đầu dùng 10 ID với biến thể tối thiểu; không yêu cầu viết mới toàn bộ 86 nhóm vì backend đã có test nền cần tái sử dụng.

### Quyết định tách phạm vi PR #1028 — 29/10/2026

User đã chọn tách các nhóm chưa đạt full functional AC khỏi gate của PR #1028. Trên SHA `e6359be97f7d4cd283ffd9d2b765ce34f44863ba`, matrix F04 ghi **0 PASS, 85 BLOCKED, 1 OUT**; selector chạy xanh hoặc test viết sẵn không đồng nghĩa cả nhóm đã PASS. PR #1028 bàn giao harness, test/coverage hiện có và thay đổi O06 theo review riêng; không tuyên bố hoàn thành 85 nhóm hoặc miễn gate phát hành/pilot. Các thay đổi test đang nằm ngoài commit và kết quả trên working tree dirty không là bằng chứng theo SHA của PR.

| Suite | ID còn BLOCKED | P0 | P1 | Issue theo dõi full AC |
| --- | --- | ---: | ---: | --- |
| AUTH | AUTH-01–08 | 8 | 0 | [#1029](https://github.com/hangndat/ticket-solution/issues/1029) |
| DB | DB-01–19 | 16 | 3 | [#1030](https://github.com/hangndat/ticket-solution/issues/1030) |
| GATE | GATE-01–09, gồm GATE-03 signed QR | 9 | 0 | [#1031](https://github.com/hangndat/ticket-solution/issues/1031) |
| JOB | JOB-01–07 | 6 | 1 | [#1032](https://github.com/hangndat/ticket-solution/issues/1032) |
| PLAT | PLAT-01–05 | 4 | 1 | [#1033](https://github.com/hangndat/ticket-solution/issues/1033) |
| POL | POL-01–04, gồm POL-03 retention | 0 | 4 | [#1034](https://github.com/hangndat/ticket-solution/issues/1034) |
| PORT | PORT-01–14 | 10 | 4 | [#1035](https://github.com/hangndat/ticket-solution/issues/1035) |
| SEC | SEC-01–06 | 6 | 0 | [#1036](https://github.com/hangndat/ticket-solution/issues/1036) |
| WEB | WEB-01–13, gồm WEB-13 claim branches | 11 | 2 | [#1037](https://github.com/hangndat/ticket-solution/issues/1037) |
| **BLOCKED** | **85 ID** | **70** | **15** | **Chưa lên lịch trên Project #3** |

`JOB-08` là P1 **OUT** theo PLAN §6.3, không tính vào 85 ID. GATE-03 và WEB-13 vẫn là blocker sản phẩm bên trong issue GATE/WEB, không được đếm hai lần; roadmap phải review trước khi mở feature mới. Tách scope PR không đổi expected outcome của bất kỳ ID nào.

- Người phụ trách tài liệu: Minh — `coordinator`, hồ sơ [company/employees.json](../../company/employees.json). Biên soạn trong phiên trực tiếp hiện có; không tạo worker chỉ cho tracking.
- Architecture impact: **Không** — tài liệu không đổi kiến trúc, API, policy hoặc runtime.
- Routing worker theo yêu cầu user mới nhất: ưu tiên **Claude** khi khả dụng, Codex fallback theo cost catalog; tier phải được phân loại theo task khi thực thi. Các lượt Codex trước đây giữ nguyên provenance trong báo cáo riêng.
- Phạm vi ban đầu của tài liệu là đối chiếu yêu cầu và tạo plan trong `tests/e2e`; tiến độ implementation sau đó được ghi ở `IMPLEMENTATION.md` và các issue F04 bên dưới.

## 1. Mục tiêu và cách xác định kết quả đúng

Kiểm chứng hai phần: **UI Web/Portal nối hệ thống local thật**, và **HTTP/backend integration dùng PostgreSQL thật**. Ưu tiên hành vi người dùng, transaction và kết quả bền vững sau lỗi.

Nguồn yêu cầu: [PRD](../../docs/PRD.md), [Decision Log](../../docs/DECISION-LOG.md), [Technical Design](../../docs/TECHNICAL-DESIGN.md), [kiến trúc hiện trạng](../../docs/architecture/ar891-current-architecture.md), [Roadmap](../../docs/ROADMAP.md). Quyết định mới thay phần lịch sử tương ứng; không lấy mọi câu trong PRD/ADR cũ làm AC đồng thời.

Mọi ca mutation cần đối soát những dữ kiện phù hợp: response/UI, ticket/request/code/quota, operation, outbox/notification, check-in và audit. HTTP 200 hoặc screenshot đơn lẻ không đủ. Với ca từ chối, kiểm tra cả việc **không phát sinh mutation ngoài ý muốn**.

Trước implementation, đối chiếu contract hiện hành và assertion của test đang có. Nếu khác quyết định đã chốt, ghi rõ drift; không đổi expected outcome cho khớp bug, không tự thêm feature hoặc tự quyết policy còn mở.

## 2. Những phần bổ sung hoặc sửa so với plan trong hội thoại

| Nội dung                               | Expected outcome theo quyết định hiện hành                                                                                 | Phủ bằng                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Auth guest redeem — UX-11              | Keycloak + email verified trước cấp vé; không anonymous issue, không bắt OTP/magic link mới                                | AUTH-03, WEB-03, DB-04         |
| Ba client và session — O16, ADR-20     | Attendee, staff Portal, Platform có client/audience và cookie đúng ranh giới; logout từng surface                          | AUTH-01–08, PLAT-01, SEC-01–02 |
| Public event — O15, ADR-19             | Published projection từ server; không fallback fixture khi API lỗi                                                         | WEB-01–02, WEB-10, DB-12       |
| Dashboard — O12/O14                    | Confirm APPLIED theo dictionary, xử lý undo đúng; emailNeedsCs không đếm mọi retry; `asOf`, refresh thủ công               | PORT-08, DB-15, JOB-04         |
| Portfolio/roles/onboarding — O17       | Portfolio chỉ event có quyền; named server presets; đăng ký tạo PENDING, Operator mới ACTIVE                               | PORT-10–13, PLAT-02, DB-16–17  |
| Cổng — O31/O32                         | Tạo/list theo event, quyền và lỗi trùng tên; gateId nullable, không thêm đổi tên/xóa hoặc unique phiên tự phát             | PORT-07, GATE-01               |
| Offline sync và receipt — ADR-18, #859 | API replay/idempotency/skew; receipt chỉ lịch sử, đúng ownership và không mutation/admission                               | GATE-06–09                     |
| Privacy — O06                          | Xóa/anonymize có thời hạn; revoke session; retention DB/object và giữ aggregate                                            | AUTH-08, DB-18, POL-01–04      |
| Marketing và locale — O04/O13/O17      | Marketing VI+EN, demo có nhãn; lead không tự provision tenant; Portal VI mặc định, EN additive                             | WEB-12, PORT-13                |
| Notify và CS — M09, O14                | Template/reminder, resend cooldown, enum provider hiện hành; ACCEPTED không chứng minh inbox/đã đọc; crash có thể lặp SMTP | PORT-09, JOB-01–07             |
| Web Gate — O23                         | Không kiểm tra scan/confirm trên browser; `/gate` 308 về `/` không là lỗi launch; Portal chỉ đọc, cấu hình cổng            | PORT-07, GATE-01–09            |
| Cold-offline web — O25                 | Không đòi PWA/cache vé khi mở web lần đầu không mạng                                                                       | WEB-10; native offline OUT     |
| A11y — O33                             | Đã waive MVP/pilot; không chạy a11y UAT, không ghi FAIL/GAP/PASS a11y                                                      | OUT                            |

O27/O28/O29/O30 về NativeTabs, profile, privacy native, watermark và chrome iOS thuộc native acceptance, không biến thành yêu cầu UI web. Payload/quyền backend dùng chung vẫn được test trong gói này.

## 3. Phạm vi và mức ưu tiên

- **P0:** nhận vé, auth/quyền, isolation, chống trùng, transaction, recovery và các luồng vận hành cốt lõi. Full regression P0 không được âm thầm skip.
- **P1:** chiều rộng đã thuộc sản phẩm: cấu hình nâng cao, locale, marketing, portfolio, retention dài hạn và các nhánh ít gặp. Đây là thứ tự làm; không tự miễn yêu cầu PRD hoặc đổi gate phát hành.
- **Smoke:** tập con P0 chạy nhanh để phát hiện stack/auth/nhận vé/tenant bị hỏng. Smoke PASS không thay full regression.

Các lớp bằng chứng:

| Ký hiệu | Lớp                                   | Chứng minh được                                                                                                     |
| ------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| B       | Playwright trên browser thật          | DOM, thao tác, điều hướng, session và dữ liệu hiển thị qua BFF/API thật                                             |
| H       | HTTP integration vào server thật      | JWT Keycloak thật, routing/validation/authz, BFF/Origin và error envelope                                           |
| D       | Domain/repository + PostgreSQL Docker | Transaction, constraints, RLS runtime role, state và concurrency; không tự chứng minh HTTP/OIDC                     |
| R       | Runtime với process thật              | Worker và SMTP Mailpit thật, stop/restart, lease/reclaim khi ca yêu cầu; khác test chỉ gọi trực tiếp relay function |

Test D có thể dùng adapter lỗi có kiểm soát cho fault injection. Test B/H không mock production auth, không chèn cookie/JWT giả. Khi cần chứng minh toàn luồng email, phải có worker process thật, không dùng lời gọi relay trực tiếp thay nó.

**Ngoài gói:** UI/native build iOS, camera, APNs/device push, cache/queue native, App Store; visual pixel regression; a11y UAT theo O33; benchmark tải/SLO 2×20k/50 scanner; production DNS/TLS/deploy, disaster restore/HA trên VPS và SLA trực hỗ trợ. Android/payment/refund/transfer/seat/Wallet/custom-domain/custom-sender vẫn ngoài phạm vi sản phẩm đã chốt. Không mở resolution desk, search receipt rộng hoặc workflow/cron engine mới.

Local integration có thể kiểm thử API offline-sync và fault nhỏ, nhưng không chứng minh hai thiết bị offline tránh được admission trùng ngoài đời hoặc app restart phục hồi đúng.

## 4. Môi trường và fixture

### 4.1 Stack

Node/pnpm theo repo; Docker Compose cho PostgreSQL, Redis, Keycloak, MinIO, Mailpit; build và start API, worker, Web, Portal ở chế độ production local để kiểm tra SSR/BFF thật. Harness quản lý process do chính nó tạo, healthcheck, port và cleanup. Không dừng hoặc reset server/data user đang dùng.

Mỗi run có namespace và database/object prefix/mailbox định danh riêng. Database migration dùng tài khoản DDL riêng; API/worker/RLS test dùng role runtime không owner/superuser/BYPASSRLS. Không dùng database bootstrap admin để tuyên bố isolation PASS.

Preflight chỉ nhận service origins loopback/hostname e2e allowlist và tài nguyên mang namespace run; từ chối cấu hình trỏ production hoặc database dùng chung trước seed/cleanup/fault injection. Không đọc `.env` production để tự điền cấu hình còn thiếu.

**Host isolation cần hostname khác nhau**, không chỉ `localhost:3000` và `localhost:3013`: cookie không được cách ly theo port. Profile smoke/full E2E bắt buộc dùng **HTTPS qua proxy TLS local** cho `app.<runId>.e2e.test`, `portal.<runId>.e2e.test`, `marketing.<runId>.e2e.test`, `auth.<runId>.e2e.test`. Resolver, certificate/SAN, Keycloak issuer, redirect URI và public origin phải khớp cả browser lẫn server. `sessionCookieOptions` luôn đặt `Secure` khi `NODE_ENV=production`; đặt `AUTH_COOKIE_SECURE=false` không tắt điều này. Vì vậy HTTP trên các hostname e2e không phải profile login thay thế. Trust certificate chỉ trong process/profile do harness sở hữu, không tự sửa hosts/keychain hệ thống hoặc tắt TLS validation toàn cục. Preflight HTTPS/login/cookie phải pass trước smoke; thiếu TLS/trust/resolver/issuer → các ca B/H cần session ghi BLOCKED, không báo smoke PASS. API/DB thuần có thể chạy profile riêng nhưng không thay bằng chứng cookie đa host.

### 4.2 Cô lập tài nguyên mỗi run

- `runId` duy nhất; dùng Compose project riêng `e2e-<runId>` và override cho test. Không chạy nguyên cấu hình mặc định với tên project, volumes và port cố định của môi trường dev.
- Mỗi run có container/volume/network riêng cho PostgreSQL, Redis, Keycloak, MinIO và Mailpit; tất cả published ports bind loopback và được cấp riêng, gồm proxy TLS, SMTP và API/browser services. Harness ghi manifest các resource/port thực tế trước seed.
- Keycloak có realm/users/clients riêng theo run trong instance test; redirect/issuer theo origin run. Không dùng hoặc reset realm `ticket` của stack dev; một container Keycloak riêng chỉ được seed fixture do run sở hữu.
- Redis dùng instance/data volume riêng, không FLUSHDB/FLUSHALL trên Redis dùng chung. Database, bucket/object prefix và Mailpit instance/mailbox cũng riêng; cookie/auth storage state không dùng lại giữa các run.
- Run manifest ghi container labels, project/volume/network IDs, database/bucket, realm, users, origins và process IDs được tạo; cleanup chỉ được xóa tài nguyên đã xác minh thuộc run, kể cả khi test fail hoặc bị interrupt.
- Nếu host không đủ tài nguyên cho nhiều run, dùng lock liên tiến trình để chạy tuần tự trên một stack **dành riêng cho test và do harness sở hữu**; kiểm ownership, reset đúng fixture rồi release lock trong finally. Không tái dùng stack dev/user như một cách thay isolation. Lock hết hạn phải xác minh owner/process trước khi thu hồi; không cho hai run reset cùng stack.

### 4.3 Dữ liệu tối thiểu

- Tenant A ACTIVE: event A1 và A2; Tenant B ACTIVE: event B1. Có tenant PENDING và SUSPENDED độc lập.
- Platform Operator, Owner, Manager assigned một event, CS, Supervisor, Scanner; staff bị revoke và staff không assignment. Quyền lấy từ server role map/preset, không suy từ tên role; Owner cũng phải có assignment khi contract yêu cầu.
- Attendee X/Y verified không cần membership quản trị, attendee chưa verified; X có vé ở cả A/B để kiểm tra owner aggregate nhiều tenant.
- Event draft/published/private/archived/cancelled; cửa sổ redeem và check-in độc lập; timezone khác nhau, gồm biên thời gian theo clock server.
- Loại vé/nguồn tách biệt; quota có giới hạn và không giới hạn theo contract; nguồn auto/manual; mã hợp lệ/hết hạn/đã dùng/đang pending, cùng chuỗi mã ở event khác.
- CSV hợp lệ, sai dòng/header/encoding theo format được hỗ trợ, trùng trong file/DB, quá giới hạn, dữ liệu có công thức để kiểm tra export.
- Ticket ACTIVE/REVOKED/CANCELLED, QR cũ/sai event/giả; reservation còn hạn/hết hạn; check-in đã undo; receipt offline CURRENT/UNDONE/TICKET_REVOKED/NO_LONGER_CURRENT.
- Email và dữ liệu người chỉ là fixture tổng hợp. Key/secret local phát sinh cho test, không commit hoặc in vào report. Không dùng tài khoản/dữ liệu production.

Seed có thể gọi DB/domain/API để dựng trạng thái trước test. Ca kiểm thử tạo event/import/approve phải tự thực hiện thao tác đó qua UI, không seed sẵn rồi báo UI mutation PASS. Ca khác seed độc lập để tránh chuỗi phụ thuộc. JWT lấy từ Keycloak; MFA dùng TOTP fixture của realm test, không bypass verifier hoặc tắt gate để đạt PASS.

## 5. Danh mục browser và HTTP

### 5.1 AUTH — Identity, phiên và boundary

| ID      | P   | Lớp   | Tình huống và điều kiện đạt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------- | --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | P0  | B/H   | Login attendee và staff đúng client/callback, PKCE/state/nonce, scope theo realm; về path allowlist, BFF `/me` đúng actor; không kẹt callback/login loop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AUTH-02 | P0  | B/H   | Sai mật khẩu, state/callback không hợp lệ, token sai issuer/audience/hết hạn: không cấp session hợp lệ, không lộ token; phân biệt lỗi auth và upstream                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| AUTH-03 | P0  | B/H   | Guest/attendee chưa verified: thấy ô mã/flow hiện hành nhưng lookup/confirm/cấp vé được gate theo contract UX-11; «Cần đăng nhập»/«Xác minh email»; không giữ code/quota hoặc tạo pending khóa mã                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AUTH-04 | P0  | B/H   | Logout từng surface clear đúng cookie; URL bảo vệ từ chối sau logout; cookie app/staff/platform không được trộn. Không giả định logout một host xóa mọi jar hoặc IdP không tác động refresh sau đó                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| AUTH-05 | P0  | B/H   | Access token hết hạn: BFF refresh server-side và rotate cookie; refresh fail/revoke: clear/fail-closed. Request đồng thời không dùng session của actor khác                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AUTH-06 | P0  | B/H   | Membership/event assignment/session bị revoke: mutation tiếp theo bị từ chối, UI không báo thành công từ capability cũ; attendee không tự có workspace staff                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| AUTH-07 | P0  | B/H   | Chuyển tài khoản với request cũ đang chạy, back/reload, mở lại URL: không render/cache vé hoặc dữ liệu quản trị của actor trước; kiểm tra `no-store` dữ liệu riêng                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| AUTH-08 | P0  | B/H/D | Web `/account`: chưa consent thì không gửi được; consent → POST thành công hiển thị ACK «Đã tiếp nhận», không nói đã xóa. Double click/timeout/retry không tạo yêu cầu trùng: giữ attempt key tại UI khi outcome chưa rõ và đối soát DB đúng một open request; retry qua API có thể bị identity gate từ chối sau khi request đầu đã commit, không bắt buộc re-ACK thành công. Reload/reauth bị chặn/fail-closed đúng gate; không yêu cầu GET current trả trạng thái sau tạo request. Đối soát session revoke/job erasure; lỗi IdP không ghi hoàn tất giả. Khả năng tự xem trạng thái sau đăng nhập lại là gap sản phẩm riêng nếu có AC bắt buộc; deadline anonymize thuộc POL-01 |

### 5.2 WEB — Attendee và public

| ID     | P   | Lớp   | Tình huống và điều kiện đạt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WEB-01 | P0  | B/H   | Catalog/detail chỉ projection published; draft/unpublished không public, private không xuất hiện catalog; link private không tự cấp quyền dữ liệu; event không tồn tại xử lý có chủ đích                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| WEB-02 | P0  | B     | Nhận vé auto qua UI với user verified, form/terms hợp lệ: đúng event/type/source/owner, QR và danh sách vé; reload vẫn có đúng vé; đối soát ticket/code/quota/operation/outbox                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| WEB-03 | P0  | B/H   | Redeem từ trang event và entry mã toàn cục: giữ context/code được phép qua login; mã sai/ambiguous giữa event xử lý theo contract, không lộ event hoặc chủ mã ngoài projection cho phép                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| WEB-04 | P0  | B/H   | Mã sai/hết hạn/đã dùng, event đóng, tenant suspend, hết quota/limit: error đúng nhóm, không lộ email chủ vé, không cấp vé hoặc giữ state dở                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| WEB-05 | P0  | B/H   | Form text/email/phone/select/checkbox và terms: required/type/allowlist đúng cả client/server; lưu đúng form/terms version, không tự chấp nhận schema mới từ client                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| WEB-06 | P0  | B     | Nguồn manual: submit hiển thị pending chưa bảo đảm suất; approve/reject trên Portal phản ánh đúng cho owner; expiry có trạng thái rõ, không ISSUED thiếu ticket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| WEB-07 | P0  | B/H   | Double click, reload/poll và mất response sau commit: UI reconcile/retry đúng operation, không tạo vé thứ hai; payload khác cùng key xử lý conflict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| WEB-08 | P0  | B/H/R | Cấp vé qua UI → worker thật → Mailpit có email đúng người/event/QR/link. Mở link theo contract có authz; không suy SMTP ACCEPTED là inbox thật/đã đọc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| WEB-09 | P0  | B/H   | My Tickets X ở nhiều tenant không cần staff membership; Y không xem được list/detail/QR/request/operation của X khi sửa ID hoặc URL; revoked/cancelled hiển thị đúng trạng thái                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| WEB-10 | P0  | B/H   | API lỗi/timeouts: catalog/vé/redeem phân biệt unavailable, empty, pending; retry khi phục hồi. Không fallback fixture, không fake success; không yêu cầu cold-offline/PWA                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| WEB-11 | P1  | B     | Desktop và viewport 390px: form, menu, modal, vé/QR và CTA thao tác được, không tràn nút chính; kiểm tra chức năng, không chấm pixel/VoiceOver/WCAG                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| WEB-12 | P1  | B/H   | Marketing VI/EN, demo có nhãn giả lập, CTA sang host sản phẩm đúng; form quan tâm không tạo tenant ACTIVE hoặc quyền Owner; privacy/support links không 500; không ép locale marketing truyền sang app nếu chưa có AC                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| WEB-13 | P0  | B/H/R | Invitation khách mời: Portal import GUESTS → preview/commit → dispatch-preview/dispatch qua UI → worker thật gửi InvitationReady vào Mailpit → mở link Web → login đúng email verified → claim. Nhánh AUTO dùng fixture nguồn auto và đủ quota: vé/QR đúng owner/event/type. Nhánh MANUAL dùng fixture nguồn manual: PENDING_REVIEW, chưa có vé/QR hoặc quota allocation; sau Manager approve mới có vé/QR, reject/expiry đúng trạng thái. Import/dispatch chưa tự cấp vé. Cùng key replay không tạo thêm ticket/request; token dùng lại với key mới bị từ chối theo contract. Link hết hạn/sai email/chưa verified bị chặn; giữ intent qua login và không lộ token trong report |

### 5.3 PORT — Quản trị tenant/event

| ID      | P   | Lớp   | Tình huống và điều kiện đạt                                                                                                                                                                                                                                                                                          |
| ------- | --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PORT-01 | P0  | B     | Tạo event qua wizard, type/source/quota, lưu/reload, publish; đúng tenant/event và navigation, không cần sửa code/DB để hoàn thành                                                                                                                                                                                   |
| PORT-02 | P0  | B/H   | Chỉnh draft/preview không đổi public; publish/rollback cấu hình hợp lệ cập nhật đúng event. Hai tab save version cũ không ghi đè âm thầm; entitlement/terms vé cũ không đổi                                                                                                                                          |
| PORT-03 | P1  | B/H   | Clone không mang theo codes/attendees/tickets/check-ins/staff ngoài lựa chọn contract cho phép; archive/cancel/đổi lịch có audit và thông báo nếu được chọn; publish khác mở redeem/check-in                                                                                                                         |
| PORT-04 | P0  | B/H   | Sửa quota/type/source: validate liên kết và giới hạn; không giảm dưới allocated+hold hợp lệ; thiếu quyền bị chặn; lỗi giữ nguyên dữ liệu đã commit                                                                                                                                                                   |
| PORT-05 | P0  | B/H   | Import upload → mapping/preview → commit → list/report. Sai dòng/trùng mã/mã đã dùng/quá giới hạn có kết quả đúng; retry không thêm trùng; owner/tenant khác không lấy file qua API                                                                                                                                  |
| PORT-06 | P0  | B/H   | Approve/reject với lý do, pending hết hạn và quota vừa hết: backend kiểm lại tại quyết định; action lặp/conflict không tạo hai vé, audit lưu staff và owner đúng                                                                                                                                                     |
| PORT-07 | P0  | B/H   | «Cổng vào»: list/create đúng event, chỉ có action với `event.update`, tên 1–80/order 0–9999; trùng tên → `GATE_NAME_CONFLICT` tiếng Việt; 0 cổng có hướng dẫn. Portal không có scan/confirm/undo admission hoặc link Web Gate; không thêm rename/delete                                                              |
| PORT-08 | P0  | B/H   | Dashboard event đúng O12: confirm APPLIED/undo/reject theo nguồn, pending/quota/emailNeedsCs, `asOf` và refresh thủ công. Lỗi không render 0 giả; KPI deep-link đúng công việc, không resend trực tiếp từ thẻ                                                                                                        |
| PORT-09 | P0  | B/H   | CS tìm vé trong scope, timeline/PII masking đúng role; resend cooldown/limit, không xoay QR hoặc tạo vé mới. Assertion theo NotificationProviderStatus: PENDING/ACCEPTED/FAILED/DEAD/UNKNOWN; không tự thêm enum QUEUED/DELIVERED/BOUNCED. Quy tắc riêng: ACCEPTED không chứng minh email đã tới inbox hoặc được đọc |
| PORT-10 | P1  | B/H   | Portfolio nhiều event dùng cùng dictionary; chỉ event actor có `report.read`/assignment; `asOf`, cursor/limit và unknown đúng; không BI doanh thu/UTM hoặc total bịa                                                                                                                                                 |
| PORT-11 | P0  | B/H/R | Members/invites: mời qua Portal → worker process thật gửi Mailpit → portal login/accept đúng email verified; hết TTL/reuse/wrong email/wrong tenant bị chặn; role/preset từ server, client không tự gửi permission để nâng quyền. Không gọi relay function trực tiếp thay worker để chứng minh hành trình email      |
| PORT-12 | P1  | B/H   | Self-serve theo UI/API hiện có: tạo PENDING, verify/invite đúng flow, chưa có quyền vận hành ACTIVE trước Operator; submit/retry không tạo tenant/membership ngoài ý muốn                                                                                                                                            |
| PORT-13 | P1  | B     | Portal VI mặc định/EN additive, locale giữ sau login/reload; filter/sort/pagination và saved views local theo user+tenant, đổi actor/tenant không hydrate view cũ; không yêu cầu shared saved views/automation chưa chốt                                                                                             |
| PORT-14 | P0  | B/H   | Audit/codes/export: quyền hiện hành+assignment, masking, cursor không trộn tenant; report.read không tự là export. Export filter đúng và link download hết hạn đúng contract; raw code/HMAC/QR/PII không xuất hiện trong browser audit/codes                                                                         |

### 5.4 PLAT — Platform Operations

| ID      | P   | Lớp | Tình huống và điều kiện đạt                                                                                                                                                                            |
| ------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PLAT-01 | P0  | B/H | Login zone Operator bằng platform client/audience và MFA ACR=2; kiểm biên step-up `auth_time` 15 phút theo policy hiện hành. Owner/staff cookie/token không mở platform. TOTP local thật, không bypass |
| PLAT-02 | P0  | B/H | Operator provision/activate/suspend và cấu hình limits; PENDING không tự ACTIVE; suspend chặn đúng mutation theo contract, không mặc định vô hiệu vé đã cấp/check-in                                   |
| PLAT-03 | P0  | H/D | Support grant có reason, tenant/scope/expiry, max 1h; hết hạn/revoke/wrong scope bị chặn; audit đầy đủ, không impersonate âm thầm hoặc mặc nhiên đọc PII                                               |
| PLAT-04 | P0  | B/H | Platform audit/limits/usage không qua staff report.read; projection không dump secret/PII. Giới hạn tenant được enforce ở API, không chỉ hiện trên UI                                                  |
| PLAT-05 | P1  | B/H | Lỗi setup platform/MFA, usage/queue/email và API lỗi hiển thị fail-closed; không số liệu giả hoặc claim dịch vụ khỏe khi chưa đọc được; đường quay lại/login đúng surface                              |

## 6. Danh mục backend, concurrency và recovery

### 6.1 DB — Business state và transaction

| ID    | P   | Lớp | Tình huống và điều kiện đạt                                                                                                                                                                                |
| ----- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-01 | P0  | D/H | RLS transaction-local: A/B xen kẽ, pool reuse, rollback/exception, thiếu tenant context; FK tenant+event, owner aggregate và worker/export scope không leak                                                |
| DB-02 | P0  | D/H | Role/assignment matrix, active membership và revocation; không tin client role/tenant hay claim cũ; owner identity khác quyền staff; identity theo issuer+subject, không auto-link vì cùng email           |
| DB-03 | P0  | D/H | Một mã + nhiều actor, một request + nhiều retry: đúng một ticket, code/counter/quota/audit/outbox nhất quán; key cùng payload trả kết quả cũ, khác payload conflict                                        |
| DB-04 | P0  | D/H | Unverified/guest không hold code/quota/pending; canonicalization theo IdP, không tự bỏ dấu chấm/plus; nhiều mã cùng owner tranh per-email limit không vượt                                                 |
| DB-05 | P0  | D   | Tranh suất cuối ở event/type/source, quota nullable không giới hạn; allocated không âm/vượt capacity; lỗi transaction rollback mọi mutation liên quan                                                      |
| DB-06 | P0  | D   | Race issue vs quota change/close/suspend/config policy: lock order hiện hành, kết quả có thứ tự hợp lệ, không oversell/deadlock không kiểm soát; retry lỗi transient có giới hạn                           |
| DB-07 | P0  | D/H | Manual pending khóa code nhưng chưa chiếm quota; approve vs expiry/reject và nhiều approver: một kết quả hợp lệ, quota kiểm lại; TTL đọc từ config, không invent TTL mới                                   |
| DB-08 | P0  | D   | Crash/fault trước commit rollback ticket/quota/code/operation/outbox; sau commit mất response vẫn tra/retry cùng key về cùng kết quả; operation lookup đúng actor/event/command                            |
| DB-09 | P0  | D/H | Revoke/cancel không tái sử dụng mã; credential rotate làm QR cũ vô hiệu; không transfer/đổi owner qua generic PATCH. Allocation theo policy đã xác minh, không tự thêm release-allocation chưa được chốt   |
| DB-10 | P0  | D/H | Import preview không reserve; commit/retry song song không duplicate, không ghi đè mã used; invitation import không tự cấp vé/tạo tài khoản; file/job ownership đúng                                       |
| DB-11 | P0  | D/H | Staff invite TTL 48h theo cấu hình đã chốt, một lần, email matching; attendee invitation claim khác host/quyền, hết hạn/replay/wrong owner không tạo vé                                                    |
| DB-12 | P0  | D/H | Published projection, cache tenant/event/version/locale, preview no-store; draft/unpublished không lộ; publish/rollback optimistic concurrency, không fixture fallback                                     |
| DB-13 | P1  | D/H | Event windows độc lập, UTC/IANA timezone và deadline theo DB sau chờ lock; clone/archive/cancel không copy nhầm business records; vé đã cấp vẫn theo policy sau đóng redeem                                |
| DB-14 | P0  | D/H | Form/terms version, schema allowlist, entitlement snapshot; đổi brand/config không đổi quyền lợi vé cũ hoặc chấp nhận JS/CSS/HTML tùy ý                                                                    |
| DB-15 | P0  | D/H | Report sau confirm/reject/undo/cancel và notification final failure đối soát đúng dictionary O12; undo giữ lịch sử, không lấy ticket USED làm mẫu số thay thế                                              |
| DB-16 | P1  | D/H | Portfolio RLS+assignment filter, cursor/limit/watermark đúng; không leak event không assign, không auto-upgrade quyền Owner/Manager                                                                        |
| DB-17 | P0  | D/H | Named role presets versioned, self-serve PENDING và Operator activation; reject arbitrary permission arrays/escalation; tenant limits đúng ở mutation và báo usage                                         |
| DB-18 | P0  | D/H | Account deletion bền vững, session/membership bị revoke theo contract, IdP retry không bypass; dữ liệu cần audit/đối soát không bị hard-delete tùy tiện; anonymization theo POL                            |
| DB-19 | P1  | D/H | Rotation key/pepper theo version đang hỗ trợ: mã/QR phát bằng key cũ còn trong vòng đời vẫn được kiểm đúng, key/version không hỗ trợ fail-closed; không lộ material, không làm QR đã revoke hợp lệ trở lại |

### 6.2 GATE — Chỉ kiểm tra API/DB, không native UI

| ID      | P   | Lớp | Tình huống và điều kiện đạt                                                                                                                                                                                                                                                                     |
| ------- | --- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GATE-01 | P0  | H/D | List/create gate đúng tenant/event+permission, FK chặn gate khác event; session không gate hợp lệ khi không chọn; response gateId/gateName đúng; mở lại cùng cổng không bị ép unique phiên mới                                                                                                  |
| GATE-02 | P0  | H/D | Reserve vé hợp lệ, cùng holder retry đúng contract; staff khác nhận HELD riêng, không báo đã check-in; cancel/expiry release hold, không tạo check-in trước confirm                                                                                                                             |
| GATE-03 | P0  | H/D | QR giả/sai audience/kid/version/hash/event, revoked/cancelled, manual code không hợp lệ: từ chối, projection tối thiểu, có reject-audit đúng contract                                                                                                                                           |
| GATE-04 | P0  | D/H | Confirm đồng thời chỉ một current check-in; expiry sau chờ lock, wrong holder/token, confirm vs revoke/permission/session revoke có kết quả đúng; mất response retry operation không confirm thêm                                                                                               |
| GATE-05 | P0  | H/D | Undo có quyền+lý do+idempotency, giữ lịch sử; Scanner không override; undo vs scan/revoke có thứ tự hợp lệ; O05 một check-in hiện hành, không re-entry policy mới                                                                                                                               |
| GATE-06 | P0  | H/D | Offline batch ≤50, scope/session/version đúng; skew biên ±300s và vượt biên; invalid item, sequence/replay order theo contract; không backdate để nhận thứ tự ưu tiên toàn cục ngoài cam kết                                                                                                    |
| GATE-07 | P0  | H/D | clientEventId cùng payload DUPLICATE, payload khác conflict; hai session replay một vé không hai current check-in; mixed APPLIED/DUPLICATE/REJECTED/CONFLICT và audit đúng; authz được kiểm cả khi retry                                                                                        |
| GATE-08 | P0  | H/D | Receipt GET chỉ historical APPLIED: CURRENT/UNDONE/TICKET_REVOKED/NO_LONGER_CURRENT, đọc sau gate đóng vẫn theo authz; không admissionEligible, không ghi ledger/check-in hoặc phát quyền vào mới                                                                                               |
| GATE-09 | P0  | H/D | Receipt wrong actor/tenant/event/original-session/missing join → 404 chung sau authz; thiếu permission/active owned session → 403, query sai →422. Original session inactive nhưng caller có session mới hợp lệ vẫn đọc historical; client input không cấp ownership, rate bucket GET tách POST |

### 6.3 JOB — Outbox, SMTP, object và notification

| ID     | P   | Lớp   | Tình huống và điều kiện đạt                                                                                                                                                                                                                                                                                                                                          |
| ------ | --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JOB-01 | P0  | R/D   | Ticket và outbox commit cùng transaction; worker tắt lúc cấp vé vẫn xem vé, bật lại xử lý job đến Mailpit; Redis restart không làm mất durable job PG                                                                                                                                                                                                                |
| JOB-02 | P0  | R/D   | Kill worker sau claim, lease hết hạn/reclaim, stale worker ack bị fencing; không mất việc hoặc đánh dấu hoàn tất giả; DB chỉ một business effect logic                                                                                                                                                                                                               |
| JOB-03 | P0  | R/D   | SMTP fail/timeout và crash sau provider accept trước ack: bounded retry, trạng thái đúng, ticket không rollback. Cho phép khả năng lặp SMTP theo ADR-17, không assert exactly-once delivery                                                                                                                                                                          |
| JOB-04 | P0  | D/H   | Resend cooldown/tenant cap/user limit và logical notification dedup; retry tạm khác terminal failure, emailNeedsCs đúng. Provider status chỉ PENDING/ACCEPTED/FAILED/DEAD/UNKNOWN theo contract; ACCEPTED là provider nhận, không phải bằng chứng inbox/read; trạng thái job/reminder dùng enum riêng tương ứng                                                      |
| JOB-05 | P1  | B/H/D | Notification template preview/publish/fallback, biến allowlist và locale hiện có; reminder schedule/cancel/retry theo contract, không phát minh cron/automation mới                                                                                                                                                                                                  |
| JOB-06 | P0  | D/R   | Job budget, timeout/cancel, shutdown và overlap có giới hạn; một job chậm không giữ claim/connection vô hạn, tenant cap được giữ; không claim SLO/fairness tuyệt đối từ fixture nhỏ                                                                                                                                                                                  |
| JOB-07 | P0  | H/D   | Upload/export/QR object private, URL cấp sau authz và có hạn; wrong tenant không lấy URL từ API. URL presigned còn hạn là bearer capability: không assert người giữ URL tự động bị chặn bởi tenant nếu storage không có contract đó                                                                                                                                  |
| JOB-08 | P1  | H/D   | Chỉ áp dụng khi transport và handler callback hiện hành có hỗ trợ: kiểm signature/raw body/timestamp, duplicate event, thứ tự đến đảo và mapping về enum provider hiện có. Không có handler/transport hỗ trợ → OUT có lý do; handler bắt buộc đã có nhưng môi trường thiếu → BLOCKED. Không tự mở provider integration, thêm enum hoặc giả inbox delivery từ Mailpit |

### 6.4 SEC — Boundary và chống lạm dụng

| ID     | P   | Lớp   | Tình huống và điều kiện đạt                                                                                                                                                                                                                                                                                                                                           |
| ------ | --- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | P0  | B/H   | Cross-tenant/event/owner trên mỗi nhóm resource: URL/body/query/job/file ID không mở dữ liệu; kiểm đủ read/mutate/list/export/operation, không chỉ ẩn nút                                                                                                                                                                                                             |
| SEC-02 | P0  | B/H   | Cookie host-only, HttpOnly/SameSite và Secure theo profile; CSRF Origin thiếu/sai → deny, token audience staff/platform không hoán đổi; CORS không thay authz                                                                                                                                                                                                         |
| SEC-03 | P0  | H     | Host/forwarded headers và return/next/redirect giả: không open redirect, không poison cache/origin hoặc redirect ra host ngoại; legacy GET/HEAD không biến thành redirect mutation mù                                                                                                                                                                                 |
| SEC-04 | P0  | H/D   | Rate limit lookup/redeem/resend/Gate/receipt đúng scope; assert 429/error code/retryable theo từng endpoint. Chỉ bắt buộc Retry-After cho route/nhánh đã có contract đó, không áp lên mọi 429; dùng ma trận endpoint bên dưới. Admission token khi bật kiểm chữ ký/expiry/scope; lỗi không consume state dở; Gate theo failure matrix hiện hành, không load benchmark |
| SEC-05 | P0  | B/H/D | CSV formula injection khi export, upload type/size/row caps, rich text XSS/output escaping và CSP theo profile; payload bị từ chối không chạy script hoặc tạo dữ liệu sai                                                                                                                                                                                             |
| SEC-06 | P0  | H/D   | Audit/codes list/error/log/report không lộ raw code/HMAC/QR token/reservation secret/cookie/password/PII; cursor opaque, limit cap; dữ liệu session/ticket không public-cache                                                                                                                                                                                         |

#### Ma trận 429 và Retry-After cho SEC-04

| Nhóm endpoint/nhánh hiện hành                                                          | Kỳ vọng header và căn cứ                                                                                                                               |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate reserve/confirm/offline-sync/receipt; redeem dùng consumeUserRateLimit            | 429 với error envelope theo nhánh; helper không thêm Retry-After. Không bắt header nếu contract route không quy định; không cấm header additive hợp lệ |
| Global redemption resolve                                                              | Nhánh RATE_LIMITED trả 429 trực tiếp, hiện không thêm Retry-After; kiểm code/retryable đúng, không invent header                                       |
| Notification/CS resend cooldown, resend limit, rate limit                              | Đối chiếu từng error code và status/retryable hiện hành; không suy từ 429 rằng luôn có header                                                          |
| Import jobs list, invitations list, tenant limits usage dùng RateLimitedWithRetryAfter | Kiểm Retry-After trên đúng nhánh này, giá trị giây đến cửa sổ kế tiếp; BFF forward header khi route BFF có contract tương ứng                          |
| Các endpoint bổ sung khi inventory                                                     | Chốt riêng route/method/bucket/error/header; nếu yêu cầu đã duyệt khác implementation, ghi contract drift chứ không hạ assertion để hợp thức hóa bug   |

Căn cứ hiện trạng: [http-rate-limit.ts](../../apps/api/src/http-rate-limit.ts), [gate.ts](../../apps/api/src/gate.ts), [tickets.ts](../../apps/api/src/tickets.ts), [redemptions-resolve.ts](../../apps/api/src/redemptions-resolve.ts), [notifications.ts](../../apps/api/src/notifications.ts), [cs.ts](../../apps/api/src/cs.ts), [inventory.ts](../../apps/api/src/inventory.ts), [tenant-limits.ts](../../apps/api/src/tenant-limits.ts).

### 6.5 POL — Privacy/retention đã chốt

| ID     | P   | Lớp   | Tình huống và điều kiện đạt                                                                                                                                                                                                            |
| ------ | --- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POL-01 | P1  | D     | Requested erasure anonymize trong ≤30 ngày: fixture thời gian trước/sau deadline, job retry/idempotency; giữ record tối thiểu phục vụ đối soát theo policy, không chờ 30 ngày thật                                                     |
| POL-02 | P1  | D     | Vé/check-in sau event 365 ngày anonymize PII, giữ aggregate/KPI; audit TTL730 ngày; kiểm biên trước/sau và tenant scope, không tự xóa audit còn hạn                                                                                    |
| POL-03 | P1  | D/H   | Object cleanup ≤90 ngày sau expiry nghiệp vụ, signed URL ngắn hạn, retry không xóa nhầm object còn dùng/tenant khác; clock và cutoff xác định rõ                                                                                       |
| POL-04 | P1  | B/H/D | Privacy copy phản ánh O06, không ghi retention còn unresolved; erasure marker/tombstone theo implementation được đối chiếu. Restore VPS, region thực tế, RPO/RTO và SLA support là evidence ops riêng, không ghi PASS từ local fixture |

## 7. Traceability PRD và các quyết định ngoài bảng ca

| Module PRD            | Nhóm kiểm thử chính                             | Giới hạn bằng chứng                                                                      |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| M01 Tenant            | AUTH-06, PLAT-02–04, DB-01–02/17, SEC-01        | Host mapping không tự là authorization                                                   |
| M02 Identity/quyền    | AUTH-01–08, PORT-11, PLAT-01/03, DB-02/04/11/18 | UX-11 thay OTP guest; native token/cache OUT                                             |
| M03 Event lifecycle   | PORT-01–03, WEB-01/04, DB-06/12–13              | Không dùng publish để suy đang mở redeem/check-in                                        |
| M04 Branding/nội dung | PORT-02, WEB-01/12, DB-12/14, SEC-05            | Per-event tenant isolation; UI native OUT                                                |
| M05 Type/source/quota | PORT-01/04, WEB-04, DB-03–09                    | Không thêm policy hoàn quota chưa chốt                                                   |
| M06 Import/invitation | PORT-05/11, WEB-13, DB-10–11, JOB-07, SEC-05    | Browser guest import→dispatch→claim; staff invite khác flow; bearer URL khác API cấp URL |
| M07 Redemption/duyệt  | WEB-02–07, PORT-06, DB-03–08                    | Pending TTL theo config/contract đã xác minh                                             |
| M08 Ticket/ví         | WEB-02/07–10, DB-09/14, GATE-03                 | Ví/QR browser có test; offline native OUT                                                |
| M09 Notification      | WEB-08/13, PORT-09, JOB-01–08                   | SMTP Mailpit không chứng minh inbox internet/APNs; callback chỉ khi có handler           |
| M10 Gate              | PORT-07, GATE-01–09, DB-15                      | API/DB+Portal read-only; camera/native recovery OUT                                      |
| M11 CS/reporting      | PORT-08–10/14, DB-15–16, JOB-04                 | Refresh thủ công+asOf; không benchmark ≤10s                                              |
| M12 PlatformOps       | PLAT-01–05, PORT-12, DB-17, SEC-01–06           | Không biến tenant Owner thành Operator                                                   |

- **O01/O02/O08:** một identity, ownership và staff membership khác nhau; shared schema+RLS. Test quyền/backend, không test native mode switch.
- **O03:** small concurrency/fault tests có trong gói; capacity 2 event×20k vé/50 scanner và p95 cần benchmark riêng, chưa có PASS.
- **O04/O09/O13:** VI mặc định, marketing VI+EN, Vemoki và host boundaries, không dùng demo làm khách thật. Local không tự chứng minh DNS/TLS public.
- **O05:** một lượt hiện hành; undo lưu lịch sử. Không yêu cầu checkout/re-entry/multi-day.
- **O06/O07/O10:** retention đã chốt có POL; không custom-domain/sender, payment/refund/transfer/Android/seat/Wallet.
- **O11/O14:** test các flow đã chốt, reject-audit và CS recovery; không mở validate-only/resolution desk hoặc tự thay AC readiness.
- **O12/O17:** event dashboard khác portfolio; named presets và PENDING onboarding; EN/saved views local có phạm vi, không automation engine/shared views chưa có AC.
- **O15/ADR-19:** server published projection là SoT; fail-closed, không fixture fallback.
- **O16/O18/O22/O26:** Portal riêng, Ant Design/ProComponents theo bổ sung O26 mới; không assert Portal buộc bỏ ProComponents hoặc áp Vemoki custom theme. Consumer light-only theo O22; không mở dark-mode testing mới.
- **O23/O25/O27–O30/O33:** Web Gate và native-only AC không lẫn vào UI web; cold-offline web và a11y UAT OUT như mục 2–3. Không chạy lại suite E Web Gate từ catalog lịch sử.
- **O31/O32:** cổng theo event, session có gateId nullable; gateName lấy API là trách nhiệm native consume nên chỉ chứng minh response API trong gói này.
- **ADR-09/11/13/14/17/18/20:** Keycloak, stack self-host, SMTP/Mailpit, MinIO, PG outbox direct, offline sync và BFF boundary; không dựng BullMQ hoặc auth mock thay production path.
- **ADR-12/APNs và phát hành iOS:** ngoài scope; test email không được suy ra push delivered, native build hoặc store available.

## 8. Tái sử dụng test và evidence hiện có

Các đường dẫn dưới là **inventory để tái sử dụng, chưa xác nhận PASS tại baseline**. Việc có tên file không chứng minh mọi expected outcome bên trên đã được assert. Không copy nguyên suite hoặc giữ script screenshot như bằng chứng hành trình authenticated đầy đủ.

| Nền hiện có                        | Đường dẫn tiêu biểu                                                                                                                                                                                                          | Việc cần làm khi implementation                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Auth/redeem browser local          | [web-uat.mjs](../../scripts/web-uat.mjs), [fe-uat-stack.sh](../../scripts/fe-uat-stack.sh)                                                                                                                                   | Tái sử dụng setup/login logic phù hợp, bỏ phụ thuộc state/demo bền; thêm assertion state, cleanup và reporting thống nhất           |
| Web helper/route tests             | [apps/web/tests](../../apps/web/tests), [routes.integration.mjs](../../apps/web/tests/routes.integration.mjs)                                                                                                                | Giữ unit/route fail-closed; chúng không thay BFF+API+worker full-stack                                                              |
| Portal helper/BFF/UI scripts       | [apps/portal/tests](../../apps/portal/tests), [apps/portal/scripts](../../apps/portal/scripts)                                                                                                                               | Đối chiếu Origin, mutation intent, role/locale; script UAT cũ có a11y không được chạy nguyên để tái mở scope O33                    |
| RLS/issuance/quota/approval        | [backend/test](../../packages/backend/test): `rls*.test.cjs`, `issue.test.cjs`, `approval.test.cjs`, `event-quota-suspended.test.cjs`, `form-consent.test.cjs`                                                               | Đối chiếu DB-01–08/14; giữ deterministic concurrency proof và runtime DB role                                                       |
| Gate/offline/receipt               | Cùng thư mục: `gate.test.cjs`, `gates.test.cjs`, `offline-sync-apply.test.cjs`, `offline-sync-receipt.test.cjs`; [apps/api/test](../../apps/api/test)                                                                        | Bổ sung HTTP token thật nếu suite D chỉ gọi domain; đối chiếu receipt read-only và gate nullable                                    |
| Account/privacy/platform/roles     | Cùng thư mục: `account-*.test.cjs`, `platform.test.cjs`, `tenant-registration.test.cjs`, `role-presets.test.cjs`, `tenant-limits-usage.test.cjs`                                                                             | Tách immediate revoke/erasure retry với deadline retention; không nhận policy TTL PASS từ test xóa session                          |
| Event/config/catalog/report/import | Cùng thư mục: `event-lifecycle.test.cjs`, `config-publish.test.cjs`, `published-events.test.cjs`, `branding.test.cjs`, `reporting.test.cjs`, `portal-*.test.cjs`, `import-invitations.test.cjs`, `cs-export.test.cjs`        | Map từng assertion vào PORT/DB; kiểm cursor, privacy, KPI và source published                                                       |
| SMTP/outbox/runtime                | `n1-email-mime.test.cjs`, `outbox-fence.test.cjs`, `worker-db-cancel.test.cjs`, `worker-provider-deadline.test.cjs`; [worker/test](../../apps/worker/test), [rint-outbox-recovery.sh](../../scripts/rint-outbox-recovery.sh) | Giữ failure fixtures; thêm vài ca R worker process thật. Không suy relay function test là runtime end-to-end                        |
| Session policy                     | [packages/web-session/test](../../packages/web-session/test), các test refresh/origin/session/cookie trong Web/Portal                                                                                                        | Reuse pure policy; thêm multi-host B/H cho cookie thật                                                                              |
| CI và launch catalog               | [ci.yml](../../.github/workflows/ci.yml), [PROD-LAUNCH-UAT.md](../../docs/plans/PROD-LAUNCH-UAT.md)                                                                                                                          | Tái dụng case còn hiệu lực; local regression không thay production UAT. CI integration là bước giao riêng, không sửa trong gói plan |

Đầu ra kiểm kê lúc triển khai: mỗi ID có test path/test name cụ thể, assertion đã phủ, phần thiếu và kết quả run/SHA. Một test có thể phủ nhiều ID; một ID có thể cần B+H+D/R. Không đánh dấu `Đã phủ` chỉ từ tên file.

## 9. Thứ tự thực hiện

### Bước 0 — Khóa expected outcome và baseline

Đối chiếu source/contract/SHA mới trước coding; map suite đang có vào IDs; chạy baseline cần thiết và lưu phân biệt fail sẵn có với fail do test mới. Chốt các điểm ở mục 11 bằng evidence, không dựng feature để thỏa plan. Kết quả: inventory coverage và danh sách ca cần thêm.

### Bước 1 — Harness local và smoke

Provision Compose project/ports/Keycloak realm/Redis và dữ liệu riêng hoặc lấy lock stack test theo mục 4.2; dựng resolver+proxy **TLS local** cùng issuer/callback đúng origin, xác minh HTTPS/login/cookie Secure trước smoke. Sau đó setup/seed/login thật, worker/Mailpit/MinIO, healthcheck và cleanup. Thiếu prerequisite session → smoke BLOCKED, không thay bằng HTTP hoặc dev mode để ghi PASS production-mode. Smoke ban đầu chọn **AUTH-01/03, WEB-02/04/07/08, PORT-01/05, SEC-01/02** với biến thể tối thiểu; các biến thể còn lại thuộc full P0. Khi test AUTH-03, tạo riêng attendee unverified đúng realm thay vì tắt verified requirement.

Hành trình demo riêng: Owner tạo event/import/publish qua Portal → attendee verified nhận vé qua Web → worker gửi Mailpit → ticket detail/reload → check-in bằng API có staff auth → Portal refresh report/export. Hành trình này không thay các test độc lập.

### Bước 2 — Hoàn thiện full P0

Thêm manual approval, CS, RBAC/revocation, Platform/MFA/support grants, config/import/export, **WEB-13 invitation khách mời end-to-end và AUTH-08 form xóa tài khoản Web**, gates API, HTTP boundary và các ca concurrency/recovery. Tái dụng D hiện có; chỉ bổ sung thiếu. Test crash SMTP không đặt kỳ vọng exactly-once.

### Bước 3 — P1 và độ rộng giao diện

Portfolio/onboarding/locale/views/marketing, lifecycle nâng cao, viewport và deadline retention có kiểm soát clock. Nếu runtime chưa có contract/handler theo quyết định đã chốt, ghi gap/blocked với owner và evidence; không bỏ silently hoặc tự nhận quyền viết feature.

### Bước 4 — Đóng gói và bàn giao

README local, lệnh chạy, report/trace policy, coverage mapping và giới hạn. Chỉ cân nhắc nối CI sau khi local ổn định và được giao scope root CI; không mở thêm native/UAT production từ việc hoàn thành bộ test.

## 10. Cách chạy dự kiến và điều kiện nghiệm thu bộ test

Các lệnh sau là **interface đề xuất, hiện chưa tồn tại**, không phải hướng dẫn chạy ngay:

```sh
pnpm test:e2e:smoke
pnpm test:e2e
pnpm test:integration:local
pnpm test:regression:local
```

- Smoke: tập con **B/H/R**, bắt buộc worker thật cho WEB-08; E2E: đầy đủ hành trình B/H/R đã triển khai, gồm WEB-13 trong full P0; integration: D/R và HTTP cần thiết; regression hợp nhất theo scope, không chạy suite hai lần chỉ vì nằm hai nhóm. Smoke không chạy crash drill của toàn bộ nhóm R.
- First-run tải dependency/browser/image cần network; test nghiệp vụ local không cần tài khoản SaaS/model/API AI. APNs và SMTP internet không tham gia.
- Tự quản lý dịch vụ và dữ liệu fixture; nếu prerequisite thiếu thì preflight fail/BLOCKED có lý do, không chạy skipped suite rồi báo PASS toàn bộ. Không tự cài/sửa cấu hình hệ thống ngoài scope.
- Browser Chromium desktop trước; viewport mobile là responsive web, không là iOS Simulator. Browser engine khác chỉ thêm khi có ma trận hỗ trợ được chốt.
- Không sleep cố định để chờ email/job; poll điều kiện bền vững có timeout. Race dùng barrier/lock/fault có kiểm soát; không phụ thuộc may rủi scheduling hoặc thời gian máy người dùng.
- Không retry browser vô hạn để giấu flaky. Retry chỉ theo contract nghiệp vụ/harness có giới hạn; báo ca flaky riêng và nguyên nhân, không gộp thành PASS sạch.
- Report có case ID, baseline SHA, profile/env đã lọc, expected/actual, duration, request/operation correlation đã sanitize. State `PASS`, `FAIL`, `BLOCKED`, `OUT`; không coi OUT/BLOCKED là PASS hoặc nhận toàn bộ P0 PASS khi thiếu prerequisite.
- Screenshot lỗi mask QR và thông tin nhạy cảm. Trace có thể chứa token/URL/header: chỉ giữ private local ngắn hạn, không commit/upload nguyên bản; report chia sẻ phải sanitize. Artifact path dự kiến `tests/e2e/.artifacts/` và auth state phải gitignore khi triển khai.
- Cleanup trong finally: đóng browser/context/tab và process/container do harness tạo, giữ nguyên tài nguyên user. Agent UAT thủ công dùng Orca browser theo rule; runner Playwright tự động dùng path CI/local đã được repo cho phép.
- Full P0 cần assertion business state và bằng chứng đúng lớp. Có tài liệu cách tái hiện, test độc lập và mapping coverage thực tế; không tạo test chỉ đọc source text rồi gọi đó là UI E2E.
- Chạy bộ test trực tiếp không gọi model AI và không tốn token. Dùng Codex để viết/debug/đọc report vẫn tính token của phiên agent.

Hoàn thành bộ test chỉ chứng minh regression local trên SHA/profile đã chạy. Không đồng nghĩa mọi yêu cầu release đã pass, production/pilot ready, inbox delivery, native camera/offline hay App Store available.

## 11. Điểm cần xác minh trước khi khóa assertion

1. **TTL/cancel policy:** pending/reservation TTL lấy cấu hình đã chốt; retention operation và hoàn allocation sau cancel không được tự đặt theo đoạn TD còn ghi đề xuất. Chưa có policy/endpoint được duyệt thì không tạo release-allocation.
2. **Capabilities theo scope:** source role map/API là nơi xác định permission thực; đặc biệt Owner vẫn cần assignment ở audit/report, Supervisor không tự có report.read. Không cấp rộng cho fixture để che thiếu quyền.
3. **Onboarding/saved views/reminders/retention:** O17/O06 là quyết định phạm vi/policy, không chứng minh mọi handler/job đã tồn tại. Bước 0 phải map assertion cụ thể, ghi implementation gap nếu thiếu.
4. **Email transport:** one logical notification không là one SMTP delivery; không test APNs hoặc sửa semantics at-least-once để đạt test.
5. **Local multi-host/TLS và isolation:** HTTPS proxy/trust/resolver/issuer là prerequisite của production-mode smoke; không thay bằng HTTP hoặc hai port. Manifest và ownership/lock phải khóa đủ Compose project/volume/port/Keycloak/Redis, không chỉ DB/object/mailbox.
6. **PRD/ADR lịch sử:** quyết định O23/O25/O26 bổ sung/O28–O30/O33 và canonical architecture thắng mô tả Web Gate, theme Portal, OTP guest, native IA, a11y hoặc BullMQ đã cũ. Không dùng catalog production làm policy mới khi nó lệch quyết định.

7. **Trạng thái sau yêu cầu xóa tài khoản:** `currentDeletion` và POST đi qua `selfActor` → identity upsert; pending deletion chặn upsert. AUTH-08 chỉ yêu cầu ACK khi POST được tiếp nhận và không tạo request trùng; không bắt GET sau reload/reauth thành công. Nếu sản phẩm cần self-service xem tiến độ sau đăng nhập lại, ghi gap/AC riêng cho owner quyết định; không sửa gate hoặc coi lỗi đọc là đã xem được trạng thái.

Không có câu hỏi bắt buộc user trả lời để viết tài liệu này. Khi triển khai, ưu tiên tự xác minh bằng source và cấu hình; chỉ đưa quyết định nghiệp vụ thật sự chưa chốt cho user, kèm ca bị ảnh hưởng và phần có thể tiếp tục độc lập.

## 12. Tài liệu quyết định đối chiếu thêm

- [ADR-17 — PG outbox direct](../../docs/ops/ADR-17-OUTBOX-PG-DIRECT.md)
- [ADR-18 — Offline Gate sync](../../docs/ops/ADR-18-OFFLINE-GATE-SYNC.md)
- [ADR-19 — Published projection](../../docs/ops/ADR-19-EVENT-SERVER-SOURCE.md)
- [ADR-20 — Portal auth/BFF/privacy](../../docs/ops/ADR-20-PORTAL-ADMIN.md), đọc cùng O23 và bổ sung O26 để tránh áp phần lịch sử đã thay
- [Portal contracts — import/audit/codes/privacy](../../docs/architecture/PORTAL-CONTRACT-HANDOFF.md)
- [Portal P2 — portfolio/roles/onboarding](../../docs/architecture/PORTAL-P2-ADR.md), phân biệt contract sketch với implementation đã xác minh
- [Offline receipt historical-only](../../docs/architecture/F02-OFFLINE-RECEIPT-2026-10-24.md)
- [O06 — retention và support](../../docs/ops/O06-OPTIONS.md)
- [Cost catalog](../../docs/agents/cost-catalog.md); routing worker hiện ưu tiên Claude theo yêu cầu mới nhất của user

## 13. Xử lý review plan — lượt sửa 1

Đối chiếu source trên baseline ở đầu tài liệu. Các mục dưới chỉ xác nhận **đã sửa tài liệu**, không phải reviewer độc lập hoặc runtime PASS.

| Finding                              | Kết luận và thay đổi                                                                                                                                   | Căn cứ source                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| F01 — Enum notification              | Đúng; PORT-09/JOB-04 dùng PENDING/ACCEPTED/FAILED/DEAD/UNKNOWN. Delivery tới inbox là quy tắc riêng. JOB-08 chỉ áp dụng có handler                     | packages/contracts/src/notifications.ts:28–33                                                         |
| F02 — Retry-After quá rộng           | Đúng; SEC-04 tách expected outcome theo endpoint/nhánh, giữ drift nếu contract bắt buộc nhưng implementation thiếu                                     | apps/api/src/http-rate-limit.ts; redemptions-resolve.ts:123–139; notifications.ts:206–223             |
| F03 — TLS smoke                      | Đúng; proxy TLS và trust/issuer/callback đúng origin là prerequisite; thiếu thì BLOCKED                                                                | packages/web-session/src/index.ts:108–120                                                             |
| F04 — Thiếu browser guest invitation | Đúng; thêm WEB-13 B/H/R, bao gồm import GUESTS→dispatch→Mailpit→login/claim và link replay/expiry/wrong email                                          | apps/portal/src/bff/paths.ts; apps/api/src/inventory.ts; apps/web/app/(consumer)/claim/claim-form.tsx |
| F05 — Thiếu UI xóa tài khoản         | Đúng; AUTH-08 thành B/H/D, thêm consent, copy tiếp nhận, retry và reload/reauth                                                                        | apps/web/app/(consumer)/account/account-panel.tsx:135–168,250–293                                     |
| F06 — Isolation chưa cụ thể          | Đúng; thêm manifest run, project/ports/volumes, realm/users/clients, Redis và cleanup ownership; fallback chỉ stack test riêng có lock liên tiến trình | compose.yaml:1–24 và mục 4.2                                                                          |
| F07 — Smoke thiếu lớp R              | Đúng; smoke B/H/R với worker thật cho WEB-08; không đồng nghĩa chạy toàn bộ runtime fault suite                                                        | WEB-08, mục 9 Bước 1 và mục 10                                                                        |

Sau review: **86 nhóm ca (70 P0, 16 P1)**; smoke vẫn 10 ID tối thiểu. WEB-13 thêm vào full P0, không âm thầm kéo dài smoke. Giữ nguyên scope chỉ local Web/Portal + backend, không sửa runtime để xử lý các findings của tài liệu.

## 14. Xử lý review bổ sung — lượt sửa 2

Giữ nguyên findings F01–F07 và lịch sử lượt 1; các mục bổ sung dưới đây thay kỳ vọng liên quan trong bản trước. Chỉ sửa tài liệu theo source baseline, chưa chạy bộ test hoặc kết luận nghiệm thu runtime.

| Finding                                 | Kết luận và thay đổi                                                                                                                                                                                                                                                        | Căn cứ source                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| F08 — AUTH-08 đọc trạng thái sau reauth | Đúng; bỏ assertion GET current thành công sau tạo request. Kiểm ACK ban đầu, session bị chặn và DB không có request trùng, kể cả retry bị identity gate từ chối. Ghi riêng gap nếu AC sản phẩm cần xem trạng thái sau đăng nhập lại; làm rõ phần reload/reauth ở F05 lượt 1 | apps/api/src/platform/platform-self.service.ts:47–63; platform-actors.ts:21–43; packages/backend/src/users.ts:33–34; account-deletion.ts:490–505 |
| F09 — WEB-13 auto/manual                | Đúng; fixture AUTO đủ quota cho nhánh vé/QR. MANUAL phải pending trước approve, chưa ticket/quota allocation; replay không duplicate cả ticket và pending request                                                                                                           | packages/backend/src/guest-invitations.ts:715–743; issue.ts:481,718–732,802                                                                      |
| F10 — PORT-11 thiếu R                   | Đúng; ghi B/H/R và worker process thật gửi email vào Mailpit, không dùng relay function thay runtime proof                                                                                                                                                                  | PORT-11 và định nghĩa lớp R                                                                                                                      |
| F11 — Sót số 85 trong phần mở đầu       | Đúng; sửa thành 86, không thêm hoặc xóa ca                                                                                                                                                                                                                                  | Mục mở đầu và kiểm đếm bảng                                                                                                                      |

Số lượng giữ nguyên **86 nhóm ca: 70 P0, 16 P1**; smoke vẫn 10 ID. Không đổi scope sản phẩm, auth gate hoặc semantics claim để làm test pass.
