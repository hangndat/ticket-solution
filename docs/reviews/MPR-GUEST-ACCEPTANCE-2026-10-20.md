# Nghiệm thu độc lập giao diện Khách — Dexter, 20/10/2026

**Kết luận: FAIL — chưa nghiệm thu giao diện Khách theo prototype đã duyệt.** Không thay kết quả này bằng CI xanh hoặc báo cáo cài build.

## Mẫu kiểm tra

- Root trực tiếp thao tác WDA/XCUITest trên iPhone 16 Pro Dexter, UDID `00008140-000605803C01801C`; bundle `com.hangndat.ticket`, PID `2962`.
- `xcrun devicectl device info apps --device 00008140-000605803C01801C` xác nhận app **1.0.0 (19)**. Báo cáo Zico ghi build 20 là không khớp bản đang cài. Zico xác nhận read-only: native Info.plist vẫn 19; app.config đổi 20 chưa phản ánh binary đã cài.
- Source checkout/tip PR #596: `41debdbb07d65066669bcd50ea1c053a3c30c4f4` (docs), code `037753fee98217ca705d7fc1e9f50ba68580956e`. Chưa chứng minh binary trên máy chính xác SHA này; build được cài trước commit. Không ghi exact-SHA acceptance PASS.
- Chuẩn: `docs/plans/mobile-production-refactor/full-prototype.html`, `PD-HANDOFF.md`, quyết định guest luôn xem Sự kiện, guest ẩn ví, auth theo tác vụ, không jargon cấu hình/phiên.
- Script `/tmp/dexter-live-uat.py`; ảnh + XML ở `apps/mobile/.uat-artifacts/dexter-live-uat/30-*` đến `41-*`.
- Không đổi dữ liệu production, không claim vé/admit hoặc xóa tài khoản; chỉ navigation/form tìm kiếm trên tài khoản chưa đăng nhập.

## Kết quả thao tác

| Màn/luồng | Kết quả | Bằng chứng thực tế |
| --- | --- | --- |
| Sự kiện không đăng nhập | PASS phần dữ liệu và navigation | `31-guest-events`: 2 sự kiện production, search ngay dưới header; chỉ Sự kiện/Tài khoản, không ví |
| Tìm kiếm sự kiện | PASS — nhập Studio, chỉ còn Studio Night; không còn card MFest | `41-search-result.png/xml` |
| Khoảng trống hero cũ | PASS đã bỏ | `31-guest-events.png` không còn vùng trống lớn |
| CTA cuối catalog | **FAIL visual** | `31-guest-events.png/xml`: nút Đổi mã lấy vé tại y=785…837, tab bar y=795…849 đè lên nút. Việc CTA nằm sau danh sách là đúng thứ tự prototype; lỗi là overlap, không yêu cầu tự thêm sticky CTA |
| Card/detail mở được | PASS navigation, chưa PASS toàn visual | `32-guest-detail`: bấm card mở đúng MFest |
| Quay lại từ detail/global redeem | **FAIL copy** | `30-acceptance-start`, `32-guest-detail`: nhãn BackButton là `(tabs)` |
| Global redeem (từ trạng thái đầu phiên) | **FAIL UX/copy** | `30-acceptance-start`: lộ «bộ nhớ (không ghi URL)», «chưa có phiên»; nhiều CTA tra cứu/Tiếp tục/Xác nhận cùng màn guest. Không giống auth gate đơn giản trong prototype |
| Detail → Đổi mã | **FAIL — chặn nghiệm thu** | `33-detail-redeem`: mở màn kỹ thuật yêu cầu Slug tổ chức, Slug sự kiện, ID tổ chức, ID sự kiện, nút Tải biểu mẫu và điều khoản đã xuất bản; thay vì auth gate/luồng nhận mã cho khách |
| Guest Tài khoản | PASS ba nhóm và guest state; còn lỗi copy | `36-guest-account`: 3 nhóm + Đăng nhập; câu «Đăng nhập để bật nhắc vé và sự kiện» xuất hiện lặp 2 lần |
| Privacy trong app | PASS mở/trở về native | `37-guest-privacy`, `38-privacy-back`: app vẫn com.hangndat.ticket, nội dung chính sách chính thức tải trong màn; không chuyển Safari |
| Privacy visual | Chưa PASS khớp prototype | `37-guest-privacy`: website có nav marketing/demo/login trong WebView, tab bar app vẫn hiện; prototype privacy ẩn tabs. Không sửa nội dung pháp lý để khớp dữ liệu minh họa |

## Việc sửa trước nghiệm thu lại

1. Thống nhất đường đổi mã guest từ catalog và chi tiết: auth gate theo tác vụ, không cho khách nhập slug/UUID, không lộ xử lý nội bộ; bảo toàn contract/auth/session phía server.
2. Sửa bottom insets/scroll reachability để CTA không bị tab bar che; không đổi thứ tự prototype chỉ để đẩy CTA lên fold.
3. Thay nhãn route `(tabs)` bằng copy người dùng; bỏ copy kỹ thuật và dòng thông báo lặp.
4. Đối chiếu Account/privacy với prototype; giữ chính sách production thật, không chép nội dung pháp lý mẫu.
5. Build/install từ SHA đã ghi nhận, xác nhận CFBundleVersion thực trên máy; không gọi build 20 khi máy đang 19. Re-UAT toàn guest flow với ảnh trước/sau trên đúng binary.

**Trạng thái:** chức năng từng phần đã chạy; visual/flow acceptance **chưa đạt**. Không merge/đóng Epic hoặc tuyên bố pilot ready dựa trên phiên này.

---

## Revalidation (Zico — sau root FAIL, không sửa verdict trên)

**Mục tiêu:** khắc phục findings §Việc sửa; cài binary có `CFBundleVersion` khớp `app.config` + `EXPO_PUBLIC_BUILD_GIT_SHA` baked; WDA guest re-UAT với ảnh `dexter-live-uat/50-*` trở lên.

| Finding root | Thay đổi code (dự kiến) |
| --- | --- |
| Detail → `/redeem` slug/UUID | Detail CTA → `/redeem-global`; guest gate đơn giản, ẩn jargon |
| Global redeem jargon / CTA dư | `global-redeem.tsx` guest branch; copy `redeemCopy.globalGuestBody` |
| Back `(tabs)` | Root stack `headerBackButtonDisplayMode: 'minimal'` |
| CTA bị tab bar che | `events.tsx` `TAB_BAR_CLEARANCE` + footer padding |
| Account push lặp | Bỏ `AccountSectionFooter` guest trùng `statusLine` |
| Privacy + tab bar | `/privacy-policy` root `fullScreenModal` |
| Build 19 vs claim 20 | `ios/Info.plist` + `app.config` **21**; install sau commit SHA |

**Binary provenance (Zico cài sau commit):**

| Trường | Giá trị |
| --- | --- |
| Git SHA (build-time `EXPO_PUBLIC_BUILD_GIT_SHA`) | `f3c0588ab3142cf98c9d5b4f9939f0aade9fa969` |
| `devicectl` / DerivedData `CFBundleVersion` | **21** (`1.0.0`) |
| Cài sau commit | Có — `expo run:ios --configuration Release` với SHA env; `ios/Vemoki/Info.plist` sync **21** |

**Kết quả revalidation (WDA — một phần, build 21):**

| Màn | Kết quả | Evidence |
| --- | --- | --- |
| Global redeem guest copy/back | **PASS** (mẫu) | `51-global-redeem.xml` — Back «Sự kiện» (không `(tabs)`); không thấy slug/UUID/bộ nhớ/phiên trong tree |
| Events CTA vs tab bar | **NOT RUN** (session flake) | Cần scroll tới footer + đo y; script `50-guest-events` |
| Detail → redeem | **NOT RUN** | Cần `53-detail-redeem` |
| Account push dup | **NOT RUN** | Cần `54-guest-account` |
| Privacy no tabs | **NOT RUN** | Cần `55-guest-privacy` |

**Kết quả revalidation tổng:** _PARTIAL — chờ pass WDA đầy đủ `50-*`…`55-*`; không đổi bảng §Kết quả thao tác root FAIL._

### Zico batch 2 (sẵn sàng root UAT build 21+SHA mới — không cài trong lúc root đang UAT)

| Hạng mục | Thay đổi |
| --- | --- |
| CTA vs tab bar | `useAttendeeTabBarInset()` (+56 clearance), footer padding, `scrollIndicatorInsets` |
| Deep link `/redeem` guest | `app/redeem.tsx` → `Redirect` `/redeem-global` khi chưa verified |
| Post-login return | `parkSignInReturn('/redeem-global')` trong global redeem; allowlist path |
| Provenance install | `scripts/sync-ios-build-number.mjs`, `scripts/release-ios-dexter.sh`, `pnpm sync-ios-build` |
| Account scroll | `paddingBottom` theo tab inset |

**SHA batch 2:** `31b91857c7c3005ee0b896e457af2fcfa65e69a8` — root cài: `apps/mobile/scripts/release-ios-dexter.sh` (hoặc `EXPO_PUBLIC_BUILD_GIT_SHA=31b9185…` + `pnpm sync-ios-build` + `expo run:ios` Release); xác `devicectl` CFBundleVersion **21**.

### Zico batch 3 — privacy modal blocker (build **22**)

| Root finding | Fix |
| --- | --- |
| `68-build21-privacy.xml` không có Button — guest kẹt | `headerBackTitle` + `headerBackButtonDisplayMode: default`; in-screen `privacy-cta-close` → `closePrivacyPolicy()` |
| Provenance | `app.config` + `sync-ios-build` → CFBundleVersion **22** |

**SHA batch 3:** _ghi sau push/install._

## Root revalidation trực tiếp — build 22 và 23

Giữ nguyên các FAIL lịch sử ở trên. Root thao tác trên iPhone vật lý Dexter qua WDA, không dùng kết quả unit test thay cho thao tác trên máy. Artifacts riêng tư/local: `apps/mobile/.uat-artifacts/dexter-live-uat/` (PNG + XML, không commit).

### Build 22 — source `436838eb7826a78579fa87175b357fa3f64a777c`

| Luồng | Kết quả | Evidence |
| --- | --- | --- |
| Guest catalog, search, 2 tabs | PASS | `70-build22-start` |
| Scroll tới CTA đổi mã, bấm được phía trên tab bar | PASS | `71-build22-events-footer`, `72-build22-global` |
| Global guest chỉ nhập mã, không slug/UUID/jargon; back đúng nhãn | PASS | `72-build22-global` |
| Account 3 nhóm, bỏ câu push lặp | PASS | `74-build22-account` |
| Privacy ẩn tabs, đúng một nút đóng, quay lại được | PASS | `75-build22-privacy`, `76-build22-privacy-return` |
| Hủy đăng nhập giữ mã đang nhập | PASS | `77`–`82` |
| Đăng nhập attendee qua UI OIDC trở về mã đang nhập | PASS | `83`–`89` |
| API global đang tắt, UI lộ lỗi tiếng Anh | FAIL | `89-attendee-return`; sửa nguồn tại `3d2d236`, cần re-UAT binary mới |
| Ví owner không có tenant env | FAIL | `91-attendee-wallet`; phụ thuộc API W1 PR #597 + mobile `84868b0` |
| Đăng xuất attendee, hoàn tất Keycloak logout, về guest 2 tabs | PASS | `92`–`99` |

Privacy build 22 có **một** actual visible button `privacy-cta-close`; `headerBackTitle` trong source không chứng minh có nút đóng thứ hai trên màn hình.

### Build 23 — source `0f17517c0d77b81cd5874611c088beffb6f014f3`

`devicectl device info apps` xác nhận Vemoki `com.hangndat.ticket` **1.0.0 (23)**. Binary Release trên đĩa do Zico cài: executable SHA-256 `1c9ad82c614a8f76e90a84658c755d4017e09d6e0194c53e7f655eeb0f335126`; JS bundle SHA-256 `0c4a6c494cc594829073fa5f42903bd41bc8e5f523ed5f32c2447d25e10eb99a`.

| Luồng | Kết quả | Evidence |
| --- | --- | --- |
| Staff giữ phiên, 3 tabs | PASS | `114-build23-start` |
| Manual toolbar Tài khoản | FAIL — vẫn Manual | `115-build23-staff-account` (root đã xem PNG và XML) |
| Scan camera screen | PASS mở màn | `116-build23-scan` |
| Scan toolbar Tài khoản (tọa độ nút đã xác nhận) | FAIL — trở về Manual | `118-build23-reactivate`, `119-build23-scan-account-tap` |

Zico nhận fix tiếp: thay hidden NativeTabs staff-account bằng root stack `/staff-account`. Build 23 **chưa đạt acceptance**; chưa nghiệm thu ví production khi API W1 chưa triển khai. Không claim pilot ready, QR admit hay APNs delivery từ các kiểm tra trên.

### Root build 24 — source `916c56b8b69f4e23e3c90cd3c495d67609a1b928`

`devicectl` xác nhận **1.0.0 (24)**. Executable SHA-256 `a6102c6cc0201d78ba44e32d63603544417e8495e705de61b82d3449fa1327e8`; bundle SHA-256 `6026ac393895f1a3a94ec2ba7e930a58e60a868b318a22d2bec2f84e2f48457a`.

| Luồng | Kết quả | Evidence |
| --- | --- | --- |
| Guest catalog → chi tiết MFest → đổi mã global | PASS | `120`–`125`: một ô mã, không slug/UUID, nhãn back đúng |
| Guest Account + privacy mở/đóng | PASS chức năng | `126`–`128`: một nút đóng, không tabs trong privacy |
| Guest Account tiêu đề gọn | FAIL | `126`: `TabStackTitle` mặc định large ghi đè layout compact; sửa sau tại `97cb087` |
| Staff OIDC login UI | PASS | `129`–`138`; đóng accessory AutoFill rồi tap Sign In (không lỗi app) |
| Staff toolbar mở Account root | PASS | `139`, `141`: email fixture, các nhóm dữ liệu, Quay lại quét, Đăng xuất; không tabs |
| Quay lại quét | FAIL | `140`: trở về Manual thay vì Scan |
| Staff logout | FAIL — crash xác nhận | `142`: về Springboard; `143`: relaunch PID mới, guest 2 tabs |

Crash report iOS xác nhận `com.hangndat.ticket` build **24**, PID **3259**, `2026-10-20 16:58:28 +0800`, `EXC_CRASH/SIGABRT`. Log process Vemoki cùng thời điểm: `Unhandled JS Exception: Error: useStaffGateWorkspace requires StaffGateWorkspaceProvider`, từ `StaffManualEntryScreen` qua `StaffGateTabGuard`. Khi logout, identity mất verified trước khi effect reset eligibility; guard vẫn cho child dùng context đã inactive. Zico nhận sửa guard đồng bộ fail-closed, kèm regression signed-out + stale eligibility. Log archive/IPS giữ local, không commit.

Build 24 **chưa acceptance complete**. Root đang kiểm tra tiếp bản sửa; không thay FAIL lịch sử bằng PASS từ source/unit tests.
