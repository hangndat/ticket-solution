# #869 — kiểm chứng chức năng và tooling (Minh)

Ngày 2026-10-24; batch theo quyết định user ưu tiên function trong `docs/plans/UI869-FUNCTION-FIRST.md`. Base `109e0c59066498071f95fdf6e4851f2d4f6af6d9`; reviewer phải dùng SHA tích hợp sau commit. Không reset lịch sử 2/2 + ngoại lệ; thiết kế MKT/catalog tiếp tục chờ duyệt.

## F01 — shutdown khi leader đã chết

`scripts/dev-local-process.py`: nếu leader đã chết nhưng private process group còn thành viên, `stop` trả nonzero `owned_group_identity_unverifiable`, giữ cả PID và owner receipt, không gửi signal. Khi group trống mới xóa receipt. Không suy ownership từ PID/group đơn thuần.

`pnpm run dev:local:test`: **8/8 PASS**. Regression mới kiểm leader chết trước stop, child ignore TERM còn sống, exit nonzero và receipt giữ nguyên; test tự dọn đúng child với birth identity/PGID. Nhánh group trống vẫn dọn stale record. Các kiểm private group, idempotent start, foreign birth identity, pause marker, descendant shutdown và compose failure đều PASS. Không restart/down stack đang phục vụ để chạy tests này. Cần James revalidate F01 trên exact SHA trước khi đóng finding.

## Account — mutation thật trên QA cô lập

- `scripts/dev-local-qa-user.mjs` tạo identity tổng hợp trong đúng container Keycloak project `ui869dev`, không membership. Receipt ignored0600 bind issuer/realm/username/user ID; rerun không reset hoặc ghi đè user không khớp receipt. Keycloak không trả unmanaged attribute marker, nên root đã bind identity tạo trước đó trong chính session này sau khi đối chiếu tên và cửa sổ createdTimestamp; helper mới ghi receipt từ Location header ngay khi create. Rerun `created:false` PASS.
- Orca profile QA riêng, page `b4561919-f290-44ed-a724-e3d0500ad590`, real Keycloak → `/account`, email fixture `qa-functions@example.com`. Không dùng attendee/staff để gửi yêu cầu xóa.
- Mở disclosure: trước checkbox nút disabled; tick checkbox rồi gửi một lần. UI hiện “Đã tiếp nhận yêu cầu … Đây chưa phải xóa dữ liệu ngay”, ẩn form gửi lại. PostgreSQL đọc kiểm đúng **1 REQUESTED**, policy `O06-2026-10-18`; không chạy anonymize/erasure job.
- Reload bị thu hồi phiên: UI yêu cầu đăng nhập, không hiện trạng thái “chưa có yêu cầu” hoặc bật nút gửi mới. Không claim status tracking sau reload đã PASS; đây là hành vi auth hiện có sau revoke session.
- Evidence: `assets/UI869-FUNCTION/account-accepted.png`, `account-after-reload-auth-required.png`. Các ảnh trước trạng thái chỉ là checkpoint, không phải outcome.

## Single-code — QA003

Orca page `843c4e0d-4692-42de-b479-a45b8764e03a`, attendee real OIDC. Chỉ nhập `DEMO-MFEST-003` → tự hiện MFest / MFest · Demo / General → đồng ý terms → phát vé Sẵn sàng, hiện “Đổi mã thành công”, submit disabled. Mã `DEMO-MFEST-002` giữ cho user. Evidence `assets/UI869-FUNCTION/redeem-issued.png`. Wallet mở trực tiếp ở page `b0e059d1-a522-422e-938a-7d02b780751f`: **5 vé**, gồm MFest mới `5E836141` cùng vé claim `CF3411E3`, đều Sẵn sàng (`wallet.png`). Viewport đo thực 1227×973, DPR2. Không dùng API để thay hành trình UI.

Orca có lúc typed click chỉ focus mà không submit; native `button.click()` qua Orca eval đã submit form hiện có, không thay payload/consent/cookie hoặc gọi backend trực tiếp. Sau screenshot có compositor frame, account/redeem đều trở về một main visible và hydrate; không lấy `main=2`/AX stale làm bằng chứng lỗi app độc lập. Không restart thêm stack để vượt gap.

## Fixture và phạm vi

Lời mời local dùng pipeline import → preview → commit → dispatch → real SMTP Mailpit; token ở file ignored0600 và Mailpit, không commit link. Xem `UI869-INVITATION-FIXTURE.md`. Claim thật và regression web do Linh ghi trong `UI869-FUNCTION-WEB.md`; root account/single-code evidence bổ sung sau checkpoint của Linh. F10 consent checkbox có desktop/mobile runtime evidence riêng tại `assets/UI869-F10/`.

Journal structured `node scripts/company-worklog.mjs validate` PASS (16 personas); lifecycle Linh function `ctx_ef17ec64438f` đã settle/release. Root đóng các tab mình mở sau UAT, giữ local stack/autostart chạy. Không merge/deploy; CI và review độc lập còn là gate.
