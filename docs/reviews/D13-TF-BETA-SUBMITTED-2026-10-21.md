# D13 — TestFlight Beta App Review submitted (build 26)

| Trường | Giá trị |
| ------ | ------- |
| Ngày (UTC+7) | **2026-10-21** |
| Epic | [#301](https://github.com/hangndat/ticket-solution/issues/301) · Task [#327](https://github.com/hangndat/ticket-solution/issues/327) (smoke) · [#332](https://github.com/hangndat/ticket-solution/issues/332) (App Store submit — **chưa làm**) |
| App ASC | `6823694490` · Vemoki · `com.hangndat.ticket` |
| Build | **1.0.0 (26)** · id `0e1fb73f-367c-49b7-bd26-0536bc7f3399` · `VALID` |
| Source tip lúc ghi | `9ede68f` (origin/main) |
| Người duyệt submit | User (xác nhận trong chat trước khi gửi) |

## Kết quả

Beta App Review đã **gửi** qua ASC API: tạo external group `Beta Review` (id `4db43e3b-bebe-43e6-b25a-88d7b1d85a90`, 0 tester, không public link), gắn build 26, `POST /v1/betaAppReviewSubmissions` → `betaReviewState=WAITING_FOR_REVIEW`; build `externalBuildState=WAITING_FOR_BETA_REVIEW`, `internalBuildState=IN_BETA_TESTING`.

**Chưa** có kết quả Apple. **Không** claim approved. **Chưa** Submit App Store (#332).

## Smoke máy thật (supersede FAIL trong [D13-S4-T3-DEVICE-SMOKE.md](./D13-S4-T3-DEVICE-SMOKE.md))

Thiết bị: DatHN iPhone (iPhone 15 Pro). Bản cài **từ TestFlight**; `1.0.0 (26)` đọc từ thiết bị bằng `pymobiledevice3 apps list`. Operator thao tác tay (tự động gõ credential bị chặn HID).

| # | Bước | Kết quả | Bằng chứng (local, gitignored `apps/mobile/.uat-artifacts/beta-evidence/`) |
| - | ---- | ------- | -------------------------------------------------------------------------- |
| 1 | Sign-in OIDC prod `review-attendee@vemoki.com`, My Tickets, QR | **PASS** | `01-current-screen.png` sha256 `be1a4188…60af` — vé `8c556fad…`, «Còn hiệu lực» |
| 2 | Staff `review-staff@vemoki.com` quét camera | **PASS** | `03-staff-scan-2.png` sha256 `a84d6531…a208` — «Đã vào cổng»; server ghi check-in **thật** |
| 3 | Màn hình xóa tài khoản | **PASS** (chỉ xem, đã Hủy, không gửi) | `02-account-deletion.png` sha256 `5bc39eb9…342d` — copy ≤30 ngày, không xóa ngay |

Hệ quả bước 2: vé `8c556fad…` thành USED; đã undo + cấp vé spare `02c06057…`, xem [D13-REVIEW-ACCOUNTS-2026-10-21.md](./D13-REVIEW-ACCOUNTS-2026-10-21.md). Mỗi lần quét camera thật phải undo hoặc dùng vé khác.

Ảnh không commit (chứa QR/mã vé). Push, iPad: chưa test.

## Trạng thái gate ASC

| Mục | Trạng thái |
| --- | ---------- |
| SMTP Keycloak + worker (Porkbun) | Verified (mail tới user, đặt mật khẩu + cập nhật tên OK) — PR #672 |
| Review accounts + vé ACTIVE ×2 | OK — PR #693 |
| Test Information / What to Test / Review Detail / contactPhone | Đã điền API (phone thật cập nhật 2026-10-21) |
| App Privacy | **Published** 2026-10-21 (5 loại: Name, Email, User ID, Device ID, Other User Content; Linked, App Functionality, No tracking) |
| Paid Apps Agreement | Không yêu cầu (app Free, không IAP) |

## Còn lại cho App Store (#332, chưa làm)

Territory chưa chốt (đề xuất VN) · gắn build vào version 1.0.0 · App Review Information của version đang rỗng · xác nhận Age rating/Content rights/Category/Price trên UI · kiểm screenshot (simulator, 6.7" + iPad 13") · nên chờ kết quả Beta Review. Cần user duyệt riêng.

## Giữ nguyên trong lúc chờ Apple

Không đổi/quét/đăng nhập đổi mật khẩu trên `review-attendee` và `review-staff`; không gửi build mới cùng train nếu không cần.
