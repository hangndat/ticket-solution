# UI-FIXALL iOS — review độc lập 2026-10-23

**Kết luận:** DoD **FAIL** · Security **FAIL** · UI/UX **FAIL** (findings F01–F02 bên dưới). M08 offline wallet, cách ly hai tài khoản và native OIDC auth return đã có bằng chứng simulator; M10 Gate nhập tay còn feedback gây hiểu nhầm khi API lỗi. Đây là **code/acceptance review trên simulator**, chưa phải pilot ready hay nghiệm thu camera thiết bị vật lý.

## Pin phạm vi và nguồn

| Trường | Giá trị |
| --- | --- |
| Issue/scope | #859 FA-IOS; `apps/mobile/src/identity/config.ts`, `config.test.ts`, `tickets/wallet-sync-display*`, `screens/my-tickets.tsx`, `screens/ticket-detail.tsx`; Gate manual theo AC M10 |
| Reviewer độc lập | Orca `orca_session_id:b7a14c6c-6172-454d-b5bb-2eab8fd91b2b`, dispatch `ctx_012e5c27244a`; implementer Zico `ctx_ae86d4fb9ba0` |
| Exact HEAD | `b2faa48a1ce443c8fc6c849cb74a06a57f8b0c37` + dirty mobile source; không có commit mới |
| Bản chạy | iOS dev-client Debug build 26, Expo SDK 58.0.12; Metro `:8083` rebundle JS source đang review; API fixture `:3001` qua proxy mobile `:3009` |
| Simulator | `UI-FixAll-859` UDID `B0727247-340D-423A-8547-A6C107A9756A`, iPhone17,3/iOS 26.5; ảnh **1179×2556 pixel = 393×852 point, DPR 3** (`sips`), không phải nhãn `390×844` của packet cũ |
| Locale | Simulator `en-US` (status 9:xx PM); copy app và dòng `syncedAt` hiển thị tiếng Việt/`vi-VN` |
| Quyết định/AC | PRD M07/M08/M10; TECH §5.1/§12.3; O02, UX-11, ADR-18; FA-IOS AC-1…AC-5 |
| Checks kế thừa | Implementer `apps/mobile pnpm test` **364 pass**, `pnpm typecheck` OK trong `REPORT-IOS.md`; reviewer không lặp full suite vì source không đổi. |

Fingerprint trước/sau UAT của bốn file mới: `config.ts` `9a65e8f1`, `config.test.ts` `a3ae87c3`, `wallet-sync-display.ts` `34388feb`, `wallet-sync-display.test.ts` `7d8b8f82` (SHA-256 prefix; giống nhau trước/sau). Kết thúc: `my-tickets.tsx` `cdca85e4`, `ticket-detail.tsx` `c0023823`, `app.config.ts` `81fad74b`; `git status --short apps/mobile/src apps/mobile/app.config.ts` vẫn chỉ các file dirty của implementer, reviewer không sửa source. Ảnh và private harness nằm riêng tại `docs/reviews/assets/UI-FIXALL-IOS-REVIEW-2026-10-23/` và `.orca-metrics/fix-all/native-review/`.

## Ma trận bằng chứng native

| Journey | Kết quả đúng mức | Bằng chứng |
| --- | --- | --- |
| Online wallet có vé | **PASS simulator** | Attendee synthetic JWT thật được `/v1/me` xác minh; vé MFest hiển thị trên [ảnh online](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-wallet-online.png). Dev `uat/session` là session injection, **không** được tính là PKCE. |
| Offline wallet và `syncedAt` | **PASS simulator** | Proxy riêng `:3009` chuyển `offline` (socket destroy), API chung `:3001` giữ 200; khởi động lại app, ví từ cache có banner và dòng `Lần đồng bộ gần nhất: lúc 21:27 ngày 23 tháng 10, 2026`, kèm cảnh báo trạng thái server có thể đổi: [ảnh offline](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-wallet-offline.png). Proxy đã trả `online`, health 200. |
| QR cache không phải Gate truth | **PASS copy/source** | `ticket-detail.tsx` hiển thị server quyết định thu hồi/đã dùng; owner có ảnh QR trong packet FA-IOS. Không suy điều này thành Gate admit. |
| UI logout + user2 không thấy cache user1 | **PASS simulator trong phạm vi cách ly tài khoản** | UI logout attendee1 → Keycloak RP logout confirmation → PKCE login synthetic verified `attendee2-fix859@example.com` (không vé/quyền staff) → [ví online trống](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-attendee2-empty-wallet.png). Với proxy offline + app restart, [cache user2 vẫn trống](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-attendee2-offline-empty.png), không hiện vé MFest user1. `wallet-logout.test.ts`/`ticket-wallet-race.test.ts` của owner kiểm purge/late write; reviewer không đọc trực tiếp Keychain. |
| Native OIDC auth return về redeem | **PASS simulator** | Guest MFest detail → `Đổi mã lấy vé` → `Tiếp tục đăng nhập` → native `ASWebAuthenticationSession` mở Keycloak local → synthetic attendee credentials → redirect `vemoki://oauth/callback` trở lại [form Redeem](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-oidc-return-redeem.png). Đây là browser/PKCE UI journey riêng với UAT injection. |
| Gate offline không false admit | **PARTIAL / FAIL feedback** | Staff JWT thật (TOTP fixture) + scope MFest; proxy offline; nhập UUID vé synthetic qua UI Nhập tay. Modal [ghi «Vé hợp lệ» + «Xác nhận vào cổng» trước server](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-gate-offline-manual.png); sau confirm có [«Đang xử lý»](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-gate-offline-result.png), rồi [màn Nhập tay không kết quả](assets/UI-FIXALL-IOS-REVIEW-2026-10-23/review-gate-offline-after.png). Không thấy xanh/admit hay bằng chứng server commit; cũng không thấy thông điệp non-admit/queued và recovery rõ. Đây là **manual scan software path**, chưa nghiệm thu camera vật lý. |
| Camera native | **CHƯA ĐẠT acceptance vật lý** | Packet owner chỉ có camera permission/scan screen. Không có scan bằng camera vật lý, ánh sáng yếu hoặc multi-device; ảnh permission không chứng minh quét hay commit. |
| HTML mockup | **Đã phân biệt** | `full-prototype.html` là visual intent; verdict native chỉ từ app simulator và source ở SHA trên. |

## Findings — một batch

| ID | Loại/mức/chặn | Căn cứ, tái hiện và tác động | Điều kiện đóng / owner |
| --- | --- | --- | --- |
| **F01** | Security + contract; **blocker / Có** | `getApiBaseUrl()` tại `apps/mobile/src/identity/config.ts:68-86` dùng `EXPO_PUBLIC_ALLOW_UAT_SESSION=1/true` để chấp nhận **bất kỳ** `EXPO_PUBLIC_API_BASE_URL`/baked extra (kể cả HTTP). `app.config.ts:60-76` khi `APP_VARIANT=production` chỉ điền default nếu biến rỗng, không cấm UAT flag hay URL local. Test `config.test.ts:55-69` chứng minh override positive nhưng không kiểm retail negative. Một Release archive vô tình bake flag=1 sẽ gửi auth bearer/API request tới origin tùy biến; route `uat/session` cũng được thiết kế cho opt-in Release (`navigation/dev-only-routes.ts:17-20`), nhưng hiệu lực dynamic env trong binary Release cần kiểm bằng artifact. Vi phạm pin retail K-API-02 và yêu cầu không mở UAT/session/URL override trong retail. | Zico: tách local UAT khỏi retail bằng guard build-variant không thể bật trong production archive; fail build/config nếu production và UAT flag/API URL ngoài pin; test ma trận production + UAT flag + URL override và inspect Release bundle/route. Giữ fixture Debug hợp lệ. |
| **F02** | UI/correctness; **blocker / Có** | `staff-manual-entry-flow.ts` mới parse syntax, chưa server validate; `staff-manual-confirm-sheet.tsx:50-65` vẫn ghi «Vé hợp lệ»/«Xác nhận vào cổng» khi proxy offline. `staff-manual.tsx:38-46` luôn xóa input/đóng modal sau `submitScan`; `StaffGateScanToast` chỉ mount tại `staff-scan.tsx:96-99`, nên manual screen không render non-admit/queued result. Repro + ba ảnh Gate ở ma trận. Staff có thể hiểu preview là vé được xác thực và không có tín hiệu dừng khách sau lỗi mạng; không quan sát false server admit. | Zico: preview nói rõ «Mã đọc được, chưa xác minh»; offline/queued/rejected/unknown sau submit phải hiện ngay trên Nhập tay bằng chữ/icon/tone không thành công, giữ kết quả đủ lâu và affordance đối soát/sync; chỉ dùng lời xác nhận vào cổng sau server `APPLIED`/confirm. Re-UAT offline → non-admit → proxy online → sync/recovery trên cùng màn, quay ảnh/AX. |

## Verdict theo vai trò và giới hạn

- **DoD FAIL:** AC-1/AC-3/AC-4/AC-5 có bằng chứng trong scope simulator; AC-2 còn F02. Không đánh «acceptance complete» khi feedback Gate sai hoặc thiếu physical camera/device UAT theo PRD.
- **Security FAIL:** F01 là rủi ro cấu hình build retail có đường gửi bearer sang API origin tùy biến. Trong source được review không thấy token logging mới; cache `display-cache.ts:12-39` dùng SecureStore `WHEN_UNLOCKED_THIS_DEVICE_ONLY` với key user+tenant; `wallet-logout.ts:40-136` invalidate write epoch, logout, clear binding/cache; UAT hai user không thấy rò dữ liệu. Không dùng fixture token injection làm bằng chứng production auth.
- **UI/UX FAIL:** F02 (loại `interaction/feedback`); online/offline ví và auth return có copy tiếng Việt rõ, nhưng Gate manual hiển thị xác nhận hợp lệ quá sớm rồi không báo kết quả. `impeccable critique` native chạy single-context theo role worker không spawn; đối chiếu PD handoff + app render. Chỉ kiểm viewport 393×852 point, chưa kiểm Dynamic Type/physical device.
- **Pilot ready: Không.** TestFlight/store/cloud build không chạy; không có camera vật lý, push delivered, low-light, multi-device gate, revoke/session drill.

`bash docs/agents/tools/ui-evidence-check.sh docs/reviews/assets/UI-FIXALL-IOS-REVIEW-2026-10-23` → **OK**, ảnh không trùng nội dung. File `review-account-unconfigured.png` chỉ là chẩn đoán Metro cũ thiếu OIDC issuer/client; sau rebundle đã hết, không dùng ảnh này làm finding sản phẩm. Findings phát hiện trên HEAD/dirty fingerprint trên, lượt sửa tự động của review này **0/2**; owner source fix là iOS, reviewer chỉ revalidate diff và AC sau bàn giao.

Các lệnh thao tác chính: `orca emulator attach B0727247-340D-423A-8547-A6C107A9756A --worktree active --json`, `orca emulator ax/tap/type/gesture --worktree active --json`; ảnh lấy bằng `xcrun simctl io <UDID> screenshot` sau attach. Proxy chỉ đổi `.orca-metrics/fix-all/native-review/mobile-proxy-mode.txt` giữa `online`/`offline`, cuối cùng `online` + `GET :3009/v1/health` 200; API chung `:3001` không bị dừng. Tài khoản thứ hai tạo đúng một user verified local fixture, mật khẩu giữ trong file private `0600`, không cấp role/ticket và không đưa token/password vào report/ảnh.
