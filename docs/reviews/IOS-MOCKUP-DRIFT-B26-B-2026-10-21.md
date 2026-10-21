# iOS mockup drift — Build 26 · Slice B (Ví & tài khoản)

**Ngày:** 2026-10-21 · **Task:** `task_a9089bd9fac2` · **SHA worktree (chỉ đọc):** `fc55298724012aedbfefc8393afb56f78d370cd4`  
**Mockup:** `full-prototype.html` (screen id: `wallet`, `ticket`, `account`, `delete`, `privacy`; staff `account` + luồng nhân viên) · **PD:** `PD-HANDOFF.md`  
**Phạm vi:** my-tickets, ticket-detail, account (tab + staff-account), privacy-policy, xóa tài khoản, staff-access, wallet gate, banner offline. **Không sửa code.**

## Tóm tắt

| Mức | Số lệch ghi nhận |
| --- | ---: |
| **P0** | 5 |
| **P1** | 9 |
| **P2** | 6 |

Slice B đã refactor một phần theo PD (nhóm Tài khoản, push matrix, card ví, màn xóa tách route) nhưng **chrome native tiếng Anh trên stack Vé**, **cổng ví deep-link trống**, và **chi tiết vé còn khối kỹ thuật / jargon** lệch mockup và AC PD rõ nhất.

---

## Bảng đối chiếu

| Màn | Mockup (`full-prototype.html`) | Code hiện tại (file:line) | Lệch | Mức | Đề xuất sửa |
| --- | --- | --- | --- | --- | --- |
| **my-tickets** (danh sách) | Large title «Vé của tôi»; subtitle «3 vé · 2 sự kiện»; section «{sự kiện} · N vé»; thẻ vé có pill «Chưa sử dụng», loại vé + tên, CTA «Xem vé & mã QR →»; filter chip nền xám; card push (lần đầu); CTA «Đổi mã lấy vé» secondary; **không** wordmark hero | `my-tickets.tsx` 563–694: `BrandWordmark`, caption `attendeeWalletCopy.verifiedCaption` («Vé đã xác minh»), subtitle `walletListSubtitle` (khớp format), `WalletGroupedTicketList` + `TicketRow` 123–196; filter 584–623; `WalletPushPromptCard` 645–647; CTA redeem 672–677 | Header stack **tiếng Anh** «My Tickets» (`(tabs)/my-tickets/_layout.tsx` 5); hàng vé là card border trái đỏ, hiện **ticketId + «Phiên bản vé»** thay vì loại vé/tên + CTA riêng; thêm «Làm mới vé», «Mở tài khoản», footnote kỹ thuật cache 691–694; pill trạng thái «Còn hiệu lực» (`attendee-outcome-copy.ts` 45–46) ≠ «Chưa sử dụng» | **P0** (title EN), **P1** (layout/copy/hành động thừa) | Đổi `Stack.Screen` title → «Vé của tôi» / «Vé của bạn»; bỏ wordmark + caption kỹ thuật trên ví; map `ACTIVE` → copy consumer; thu gọn footer; căn card vé theo mock (pill, meta, CTA text link) |
| **my-tickets** (empty / loading / error) | (mock luôn có vé minh họa; aside mô tả empty/error) | `walletCopy` + `LoadingState` / `EmptyState` / `ErrorState` (`my-tickets.tsx` 639–662, `screen-state-copy.ts` 14–37) | Empty + «Đổi mã lấy vé» khi trống — **khớp** hướng mock; loading/error có retry «Làm mới vé» — hợp lý prod | **Khớp** (chấp nhận mở rộng so mock) | Giữ; chỉ polish copy nếu PD muốn bớt «bộ đệm» trong `emptyOffline` |
| **ticket-detail** | Title «Vé của bạn»; pill «Chưa sử dụng»; QR + mã đọc được (MF–…); một khối vé; group rows giờ/địa điểm; **không** block kỹ thuật | `ticket-detail.tsx` 206–345: title in-body «Vé của bạn» 264; QR 286–293; **Notice «Chi tiết kỹ thuật»** 329–336 (event id, `ticketTypeId`, `createdAt`); **Notice «Đồng bộ»** 338–345 (phiên/cache); gate copy «phiên» 168–173 | Stack title **«Ticket»** (`_layout.tsx` 6); trạng thái «Còn hiệu lực»; thiếu dòng meta sự kiện như mock; **P0** jargon + panel operator | **P0** | Header «Vé của bạn»; ẩn/xóa Notice kỹ thuật khỏi attendee; pill/label consumer; thêm rows thời gian/địa điểm từ dữ liệu vé khi API có |
| **banner offline** (vé) | Mock **không** có banner offline riêng trên ví (chỉ card push) | `attendee-outcome-copy.ts` 186–188; `my-tickets.tsx` 290–293, 574–577; `ticket-detail.tsx` 210–214 | Khi cache/offline: Notice «Đang xem vé đã lưu — chưa kết nối» + copy fail-closed — **đúng nghiệp vụ** nhưng nặng/jargon («bộ đệm» 579–581) so mock/PD tone | **P1** | Rút gọn copy attendee; tách chi tiết sync vào footnote hoặc chỉ staff/diagnostics |
| **wallet gate** | Khách **không** thấy tab «Vé của tôi»; không màn ví trống | Tab ẩn: `useMyTicketsTabChrome` / `(tabs)/_layout.tsx`; deep link: `my-tickets.tsx` 211–213 chỉ `TabStackTitle`; `WalletAccessGate` + `WalletAccessNotice` **chưa gắn route** (`wallet-access-gate.tsx` 9–14) | User vào `/my-tickets` khi `!canAccess` → **màn trống** (chỉ header), không copy «cần đăng nhập» (`walletCopy` 33–35) | **P0** | Bọc stack hoặc nhánh `!canAccess` → `WalletAccessNotice`; wire `WalletAccessGate` cho `[ticketId]` |
| **account** (tab attendee) | Large title «Tài khoản»; 3 section **Bạn / Thông báo / Quyền riêng tư & dữ liệu**; guest **không** section Thông báo; đăng xuất destructive cuối; privacy → `privacy`; xóa → `delete` | `account.tsx` 296–404 + `accountCopy` (`screen-state-copy.ts` 102–144); `PushAccountSection`; row xóa → `/(tabs)/account/delete` 337–351; privacy → `/privacy-policy` 329–334 | **Khớp IA** và copy PD phần lớn; `TabStackTitle` `large={false}` 403–404 → **mất large title native** so mock/PD chrome; guest vẫn **có** section Thông báo (hint đăng nhập) — mock ẩn hẳn → lệch nhẹ | **P1** (large title), **P2** (guest notifications visible) | `TabStackTitle` `large={true}`; cân nhắc ẩn section Thông báo khi guest nếu bám mock tuyệt đối |
| **staff-account** | Cùng IA account + «Quay lại quét» | `staff-account/index.tsx` → `AccountScreen presentation="stack"`; `account.tsx` 357–365 `staffBackToGate` | **Khớp** luồng mock staff account | **Khớp** | — |
| **privacy-policy** | Screen `privacy`: title «Quyền riêng tư»; nội dung legal trong WebView; thử lỗi tải + quay lại Tài khoản | `privacy-policy-webview.tsx` 67–144; route tab `/(tabs)/account/privacy` + root `/privacy-policy`; loading/error/retry 97–120 | WebView in-app, không browser — **khớp**; tiêu đề stack «Chính sách quyền riêng tư» (`_layout.tsx` 14–16) ≠ «Quyền riêng tư» mock | **P2** | Thống nhất title với mock/PD |
| **delete account** | Màn `delete`: explainer + note pháp lý + «Tiếp tục» → confirm modal «Gửi yêu cầu» | `account-delete.tsx` 7–21 → `SessionScopedAccountDeletionPanel` (`account-deletion-panel.tsx` 211–305); copy `account-deletion-copy.ts` | Push màn riêng — **khớp AC-A2**; UI là Notice + nút thay modal sheet mock; thêm «Làm mới trạng thái yêu cầu» 296–303 | **P2** | Optional: confirm dạng sheet như mock; ẩn refresh khỏi attendee |
| **staff-access** | Mock vào thẳng tab staff; **không** màn deny riêng | `staff-access.tsx` 20–54: loading → redirect staff hoặc `StaffAccessDeny` 57–89; CTA «Về Sự kiện» | Màn deny là **mở rộng prod** (deep link O02) — hợp lý; copy «Tab Nhân viên đã ẩn» (`staff-eligibility.ts` 23–27) hơi operator | **P2** | Rút gọn copy; giữ CTA |
| **account — Thông báo** | Row permission + «Chưa bật…» / denied → Cài đặt; wallet card «Nhận cập nhật…» + Để sau | `push-account-ui.ts` 37–125; `push-account-section.tsx` 44–157; `wallet-push-prompt-card.tsx` + `walletCopy.firstTicketPush` | Matrix PD **khớp**; `runPushOptIn` gọi thẳng system prompt — **khớp AC-A4** | **Khớp** | — |
| **account — đăng xuất / offline cache** | Đăng xuất destructive cuối; offline: row xóa cache | `account.tsx` 309–324 offline rows; 392–401 logout `AttendeeCta` destructive | **Khớp** PD | **Khớp** | — |

---

## Kết luận theo màn (bắt buộc)

| Màn | Kết luận |
| --- | --- |
| **my-tickets** | **Lệch** — logic nhóm vé + filter + card push gần mock; **P0** title stack EN; **P1** chrome/copy vé và CTA thừa. |
| **ticket-detail** | **Lệch** — QR/title body ổn; **P0** header EN + panel «Chi tiết kỹ thuật»/«Đồng bộ» và jargon phiên. |
| **banner offline** | **Lệch nhẹ** — có đúng khi cache; **P1** tone/copy so mock (mock không minh họa). |
| **wallet gate** | **Lệch** — tab ẩn đúng; **P0** deep link không có `WalletAccessNotice`. |
| **account (tab)** | **Gần khớp** — IA/copy PD tốt; **P1** large title tắt. |
| **staff-account** | **Khớp** với mock staff account. |
| **privacy-policy** | **Khớp** hành vi WebView; **P2** khác title. |
| **delete account** | **Khớp** flow tách màn; **P2** chi tiết UI confirm/refresh. |
| **staff-access** | **Khớp** vai trò prod (ngoài mock); **P2** copy. |

---

## Ghi chú build 26 / thiết bị

- Audit **chỉ đọc source** trên worktree `IOS-Refactor` @ `fc552987`; không chạy lại Metro trên DATHN trong task này.
- User báo build 26 (`app.config.ts` `buildNumber: '26'`, commit `924d01d4`) — drift trên có thể **cộng** với bundle Release cũ; ưu tiên sửa source trên nhánh refactor trước khi kết luận UAT.

## Việc không làm (theo task)

Không chỉnh `apps/mobile/src`, không commit, không PR.
