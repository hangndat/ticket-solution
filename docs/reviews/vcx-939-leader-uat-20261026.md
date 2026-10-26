# #939 — fixture độc lập và UAT bổ sung ngày 26/10/2026

**Kết quả:** bốn scenario runtime còn thiếu đã được kiểm chứng local. Có hai lỗi web được tái hiện và sửa. Chuyển **Chờ duyệt**, chưa merge, chưa acceptance complete/pilot ready.

## Phạm vi và provenance

- Coordinator: Minh (`minh`), leader độc lập, không dispatch worker/reviewer; không tạo/bind/consume Orca Run. Không sử dụng Run của #928.
- Baseline: `8a2a532d2e45fa5d59aba1f78345f477f3d10ea4`.
- Code cuối: `1f4ce0be70edfe864e399007bff2cf392285b086`; commit đầu sửa tenant scope: `ea2fbaae5463316630dae0a3c5e6336fab50f6d2`.
- Chỉ sửa `apps/web`: BFF owner status, hàm fetch, redeem/claim callers, state giữ tenant cho claim pending và regression tests. Architecture impact: Không; không đổi contract API.
- Packet: [leader-20261026](evidence/vcx-939/leader-20261026/). Các snapshot/network là observation thật qua Orca, không dựng UI/state để chụp.
- Owner redeem/unknown/email được đo ở source `ea2fbaae` (một số capture trước commit nhưng source được commit nguyên trạng). Guest cuối được đo trên production build của `1f4ce0be`. Diff giữa hai SHA chỉ giữ tenant pending trong claim; tái dùng evidence owner, không đổi nhãn SHA cũ.
- `build-provenance.json`: build ID production cuối, HTTP `_buildManifest.js` khớp byte với `.next/static` trên đĩa, source tree và SHA. `ports*.json`: execution host `local`, scan timestamp, PID, owner `cwd`, đường dẫn worktree. Port không tự chứng minh SHA.
- Guard observation kết hợp DOM Orca với provenance build từ filesystem/owned process + HTTP; không có DOM commit marker trong ứng dụng. Fingerprint là kiểm tra integrity, **không** phải chứng thực host/review độc lập.

## Khôi phục fixture

Stack cũ `:3539` health OK nhưng resolve trả `500`; log chỉ ra PostgreSQL `28P01` với runtime credential cũ. Cấu hình cũ #939 và stack #928 cùng trỏ `ticket_ui869_dev@:55439`, vì vậy không reset/reseed hay đổi password DB này.

Đã snapshot DB fixture bằng `pg_dump` vào **`ticket_vcx939_leader_20261026`**, tạo login riêng `vcx939_leader_rt` thừa hưởng quyền runtime, không bypass RLS. Mọi mutation UAT chỉ trên DB mới. OIDC `:8180` dùng auth thật và persona fixture `attendee@example.com` / `staff@example.com`; không sửa realm/user/client.

Runtime riêng trong worktree `vcx-939-uat-leader`: web `:3417`, API `:3540`, fault proxy `:3541`. Chỉ dừng web #939 cũ để tái sử dụng callback port; giữ nguyên API `:3500`, Portal #928, dữ liệu và các session user-takeover. Không sửa #940 hoặc `apps/portal`.

Trên DB riêng: nguồn MFest đặt MANUAL, tăng giới hạn fixture, thêm bốn mã `VCX939-LEADER-{ISSUE,REJECT,EMAIL,UNKNOWN}` bằng HMAC cấu hình API và chạy routing backfill. Cả bốn resolve `201`, tenant/event khớp. Sau repro guest đầu, reset **chỉ bản sao invitation local** `82b6b2f1-239b-40fc-9c33-d719e26fb807` về DISPATCHED và xóa claim-code reference để chạy lại fixture; request cũ vẫn giữ nguyên. Không dùng bước reset này làm bằng chứng transition sản phẩm.

## Ma trận runtime bổ sung

Tất cả hàng có ảnh/snapshot tại **390×844, 1024×900, 1440×900, tiếng Việt** trừ khi ghi khác. `*` ở tên artifact là width.

| Scenario | Kết quả quan sát | Artifact / nguồn |
| --- | --- | --- |
| Redeem pending → issued | Submit thật tạo pending, chưa có vé; staff approve `201`; refresh owner `200`, UI «Đổi mã thành công», ticket ACTIVE | `email-failed-ticket-issued-*`, `decision-approve-*.json`; source `ea2fbaae` |
| Redeem pending → rejected | Staff deny `201`; owner `200 REJECTED`; UI «Yêu cầu bị từ chối», không ticket | `rejected-*`, `decision-deny-afdadc9b-313a-4ddd-9d8f-33cad641f05c.json`; source `ea2fbaae` |
| Mất phản hồi sau commit → unknown | Proxy chuyển phản hồi upstream `201` thành `500`, tạm trả `500` cho operation lookup. UI «Chưa xác định kết quả — chưa phải vé», không success/denied | `unknown-after-commit-*`, `proxy-network.jsonl`; source `ea2fbaae` |
| Unknown → kiểm tra lại | Gỡ fault, nút kiểm tra lại GET **cùng** operation key `dee8e471-1301-47f9-bb51-41b3c75094de`, `500 → 200`, trở về pending. DB chỉ một request cho code này và không ticket | `unknown-recovered-pending-*`, `request-counts.json`, `request-uniqueness.json` |
| SMTP fail không rollback ticket | SMTP thực `127.0.0.1:1` → ECONNREFUSED; notification FAILED, outbox PENDING, ticket vẫn ACTIVE và UI issued | `email-fail.json`, `email-failed-ticket-issued-*` |
| Retry email không duplicate | SMTP Mailpit `:1039` → ACCEPTED; cùng ticket, cùng notification/outbox, ordinal 1 FAILED → ordinal 2 ACCEPTED. Tick sau không claim/gửi thêm | `email-recover.json`, `email-recover-noop.json`, `email-inspect.json` |
| Wallet + QR sau email recovery | Wallet còn các vé đã cấp, QR của ticket `73894c9c-3b93-421d-bc05-b46f3a499024` tải được, ACTIVE, có cảnh báo fixture | `wallet-after-email-recovery-*`, `qr-after-email-recovery-*`; production build `ea2fbaae` |
| Guest claim pending → rejected | Claim thật `201`; sau xóa intent, staff deny `201`, refresh GET owner có tenant `200`; UI rejected | `guest-pending-fixed-*`, `guest-rejected-fixed-*`, `decision-deny-3e351c03-10d6-42d3-bd9c-f771430fd8cd.json`; production build `1f4ce0be` |

Request owner issued: `da22c4d4-cfc8-4c5e-b794-59876e405ab8`; owner rejected: `afdadc9b-313a-4ddd-9d8f-33cad641f05c`; unknown: `114b94a3-ae4a-4a23-89d7-bcf85f24795d`; email issued: `7fd43221-7147-4592-9c39-49cdd369be2a`. Request/code counts được lưu trước hai lượt guest sau cùng; không trình bày đó là snapshot DB cuối phiên.

Owner/guest QR, email hay notification đều là fixture local. Không có nghiệm thu mail thật. Email-error AC được kiểm bằng lỗi SMTP thực; không suy PASS từ một redeem denied.

## Findings và thay đổi

| ID | Căn cứ / repro | Cách sửa và xác minh | Trạng thái |
| --- | --- | --- | --- |
| F-939-05 | Fixture invalid/automation chưa cho thấy outcome; code review trước không đủ runtime | DB riêng, mã resolve xác minh, condition wait, snapshot outcome và ảnh có nội dung | Đã bổ sung evidence; chờ reviewer xác minh |
| F-939-07 | Baseline BFF bỏ tenant trong khi API owner yêu cầu `tenantId`, trả 422; approve thật nhưng UI «Không đọc được trạng thái hiện tại» | Giữ tenant từ caller qua fetch/BFF, validate UUID, giữ bearer auth và owner check API. Phần scope tương tự đã có trên tip chưa merge của PR #954; đưa vào nhánh hiện tại với regression tests | Đã sửa, local runtime/test xác minh; review độc lập pending |
| F-939-08 | Guest claim pending xóa parked intent/hash; lấy tenant từ location sau đó rỗng, không gửi owner GET | Chốt `pendingTenantId` khi nhận pending, reset khi context mới; refresh dùng scope kết quả, không giữ token. Guest request `3e351c03…`: owner GET 200 → rejected | Đã sửa, local production runtime xác minh; review độc lập pending |

Không miễn acceptance nào thành known gap. Đây là một đợt chẩn đoán fixture rồi sửa batch lỗi scope có repro; không reset bộ đếm lịch sử của #939. Không có dispatch fix/reviewer mới. Nếu xuất hiện lỗi liên quan sau revalidation, coordinator đối chiếu checkpoint/budget cũ trước khi mở lượt tiếp.

## Checks và cách chạy

- Source cuối `1f4ce0be`: `pnpm --filter @ticket/web test` **296/296 PASS**, `lint`, `typecheck`, `build` **PASS**. Log đã lưu trong packet; `git diff --check` PASS.
- UI detector chạy một lần trên hai consumer form, không finding; không thay CSS/copy/layout.
- Browser dùng executable `/Applications/Orca.app/Contents/Resources/bin/orca`: `tab create --worktree path:<worktree> --url …`, `snapshot --page <id>`, `fill/check/click`, `eval` DOM `form.requestSubmit()` khi click chưa submit, `wait --selector/--text --timeout 12000`, `exec --command 'set viewport W H'`, `screenshot --page <id>`.
- Fault injection ở **proxy network riêng**, không mock auth, không sửa backend hay React state. Staff transitions qua API thật với OIDC bearer; log xuất chỉ HTTP/status/IDs, không token/cookie/header.
- Ảnh một màu khi compositor chưa repaint bị loại khỏi packet. Các lần chụp phải tuần tự theo page; promise RAF không giới hạn trên tab ẩn có thể treo. Timeout/ảnh thiếu không được tính PASS; tab của probe treo đã đóng, capture dùng giới hạn paint và snapshot xác minh.
- Browser pages do phiên này tạo được đóng sau nghiệm thu; không đóng tab user. Giữ server local để review. Receipt: `browser-cleanup.json`.

## Gate còn lại

UAT bổ sung local đã đạt các scenario trên; reviewer độc lập chưa revalidate code/evidence trên SHA mới. PR/CI tích hợp và review vẫn cần trước merge/Hoàn thành. Không spawn reviewer khi user cấm Run mới và không cho dùng Run #928. Không tự review rồi ghi acceptance complete. Cold-offline/PWA ngoài scope O25; không suy pilot ready hoặc deploy production.

Company log hiện yêu cầu runId/dispatchId thực trong schema; phiên standalone này không bịa ID và không tạo Run để ghi log. Danh tính coordinator và provenance được lưu trong packet.
