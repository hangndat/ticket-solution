# iOS mockup drift — Build 26 · Slice A (Khám phá & attendee)

**Ngày:** 2026-10-21  
**Task:** `task_dc19f7b6e506`  
**Mockup (read-only):** `fix-prod-redeem-gate-1021/docs/plans/mobile-production-refactor/full-prototype.html` (+ README, PD-HANDOFF, IOS-AUDIT)  
**Code đối chiếu:** worktree `IOS-Refactor` @ `fc552987` (build 26 trên máy = commit `924d01d4` — có thể lệch bundle so với tip worktree).  
**Phạm vi Slice A:** danh sách sự kiện, chi tiết sự kiện, đổi mã (`/redeem`, `/redeem-global`), nhận vé mời (`/claim`), lời mời thành viên (`/membership-invite`), đăng nhập/landing theo tác vụ.

## Tóm tắt số lệch

| Mức | Số dòng trong bảng |
| --- | ---: |
| **P0** | 3 |
| **P1** | 14 |
| **P2** | 8 |

## Bảng đối chiếu

| Màn | Mockup (`full-prototype.html`) | Code hiện tại (file:line) | Lệch | Mức | Đề xuất sửa |
| --- | --- | --- | --- | --- | --- |
| **Sự kiện (list)** | `screen=events`: bar `vemoki.`; H1 «Sự kiện» trong content; ô tìm `⌕ Tìm tên sự kiện`; thẻ sự kiện (art 142px, org, tên, ngày·địa điểm, pill «Sắp diễn ra»); link vé full-width trong thẻ; CTA secondary «Đổi mã lấy vé» cuối list. | `screens/events.tsx` — FlatList + search (`eventsCopy.searchPlaceholder` ~L236), thẻ `PublishedEventCard` (~L47–143), CTA `/redeem-global` (~L279–285); nav compact `tab-stack-options.ts` L15–27, `TabStackTitle` `large={false}` (~L331). | Thiếu wordmark trên tab Sự kiện (mock có trên bar); tiêu đề «Sự kiện» ở nav compact thay vì H1 30px trong scroll; placeholder tìm không có ký tự ⌕; link «Bạn có N vé» là text link dưới thẻ, không phải `owned-link` full-width trong thẻ; không dùng `heroHeadline`/`heroSupport` trong copy file. | P1 (layout/chrome) + P2 (placeholder/hero copy) | Cân nhắc H1 in-content hoặc large title đồng bộ mock; styled `owned-link` trong card; prefix ⌕ tùy chọn; bỏ hoặc dùng hero copy nếu PD cần. |
| **Sự kiện — empty/loading/error** | Mock luôn có 2 sự kiện mẫu (không mô phỏng lỗi catalog). | `events.tsx` L256–273, `events-home` + `screen-state-copy.ts` L68–86: loading, empty, error, misconfigured (title «Chưa sẵn sàng tải sự kiện»). `catalog-context.ts` L14–16: platform catalog luôn `configured`. | Trên build 26 cũ có thể vẫn thấy misconfigured/tenant; tip worktree đã platform API — khớp quyết định README nhưng khác trải nghiệm mock (luôn có list). | P2 (thiết bị build 26 vs source) | Xác nhận Release 26 rebuild từ tip; giữ empty/error copy attendee-friendly. |
| **Chi tiết sự kiện** | `screen=detail`: art hero; H1 tên; đoạn mô tả; **grouped rows** (ngày + sub «Mở cửa…», địa điểm, đơn vị tổ chức); owned-link; khối «Bạn có mã nhận vé?» + một CTA «Đổi mã lấy vé». | `screens/event-detail.tsx` `PublishedEventComposition` ~L264–441: banner, logo, tên, một dòng ngày·địa điểm, `WalletOwnedTicketsLink`, **hai** CTA (đổi mã → `/redeem-global`, «Nhận lời mời» → `/claim`), nội dung API trong `Notice` (~L401–431). | Không có grouped inset rows; thiếu copy khối mã nhận vé; thêm CTA claim không có trong mock; `BrandWordmark` trên detail (mock chỉ back + art). | P1 | Layout grouped list cho metadata; gom CTA đổi mã + copy mock; claim tách deep link, không hiện như secondary CTA chính nếu PD không yêu cầu. |
| **Đổi mã — khách (`redeem` mock)** | Guest: chỉ title, «Đăng nhập để nhận vé…», nút «Đăng nhập để tiếp tục» → `login` (không ô mã). | `screens/global-redeem.tsx` guest ~L418–455: `Notice` + **ô mã** + «Đăng nhập để tiếp tục» (OIDC, không màn `login`). | Khách có thể nhập mã trước đăng nhập; không có màn landing «Đăng nhập» riêng như mock. | P1 | Hoặc ẩn ô mã đến sau đăng nhập (mock), hoặc cập nhật mock/PD nếu giữ nhập mã trước. |
| **Đổi mã — đã đăng nhập (`redeem` mock)** | Một label «Mã nhận vé», placeholder «Nhập hoặc dán mã», CTA «Tìm vé», hint «Không cần chọn tổ chức hoặc sự kiện»; lookup modal rồi nhận vé (không slug). | `screens/global-redeem.tsx` verified ~L459–527: `Notice` giải thích tra cứu/duyệt; placeholder «Mã đổi»; CTA «Tra cứu mã» / «Xác nhận đổi mã»; form + terms sau resolve. | Copy/label khác mock («Mã đổi» vs «Mã nhận vé», «Tra cứu» vs «Tìm vé»); nhiều `Notice` kỹ thuật; bước form sau tra cứu (mock đơn giản hóa). | P1 + P2 (copy) | Rút gọn UI bước 1 giống mock; đổi copy theo mock; giữ form sau resolve nhưng thu gọn chrome. |
| **`/redeem` (scoped)** | Mock chỉ có luồng một mã — không slug/UUID. | `screens/redeem.tsx` ~L391–468: slug tổ chức/sự kiện, nút tải biểu mẫu, **ID tổ chức / ID sự kiện**, jargon «Slug…»; route `app/redeem.tsx` redirect guest → global, verified → `RedeemScreen`. | Màn operator/dev vẫn tồn tại cho user đã đăng nhập nếu vào `/redeem`; lệch hoàn toàn mock production. | **P0** | Deprecate UI scoped trên attendee path hoặc ẩn sau feature flag; chỉ `redeem-global` cho khách. |
| **`/claim` (vé mời)** | Mock **không** có màn claim riêng (chỉ đổi mã / ví). | `screens/claim.tsx` ~L318–447: «Nhận vé mời», OIDC gate, form API, disclaimer membership. | Ngoài mock nhưng hợp sản phẩm (deep link); UI `Page` + `Notice` dày, không grouped. | P2 (scope mock) | Giữ chức năng; polish layout/copy khi có PD cho invite link. |
| **`/membership-invite`** | Không có trong prototype. | `app/membership-invite.tsx` ~L23–99: mở **browser ngoài** (`WebBrowser.openBrowserAsync`), không WebView in-app. | Khác PD privacy (Account mock: WebView in-app). | P1 (nếu so chuẩn web invite) | Cân nhắc in-app WebView + quay lại; hoặc ghi nhận intentional bridge. |
| **Đăng nhập / landing (`login`)** | `screen=login`: H1 «Đăng nhập», copy theo intent đổi mã, «Tiếp tục đăng nhập», hint mock bỏ OIDC. | Không có route `login`; `use-attendee-sign-in.ts` + `attendee-auth-gate.ts` gọi Keycloak trực tiếp từ redeem/claim/account. | Không có màn trung gian copy/context trước OIDC (mock có). | P1 | Màn primer ngắn (copy mock) trước `signIn()` trên gate redeem; Account vẫn primary theo PD. |

## Kết luận theo màn (bắt buộc)

| Màn | Kết luận |
| --- | --- |
| **Sự kiện (list)** | **Lệch chủ yếu P1:** cấu trúc thẻ + search + CTA đổi mã **khớp ý** mock; chrome (wordmark, H1 in-content, owned-link trong thẻ) chưa khớp. Catalog platform ở tip worktree **khớp** README; build 26 trên máy cần rebuild để khớp source. |
| **Chi tiết sự kiện** | **Lệch P1:** media + tên + link vé + đổi mã có; thiếu grouped metadata và copy khối mã; thừa CTA claim so mock. |
| **`/redeem-global`** | **Gần mock về một mã** nhưng **P1** copy/CTA và guest có ô mã sớm; verified có lớp Notice/tra cứu dày hơn mock. |
| **`/redeem` (scoped)** | **P0:** không phù hợp mock attendee — slug/UUID/biểu mẫu thủ công. |
| **`/claim`** | **Không trong mock** — chức năng hợp lệ; drift **P2** thẩm mỹ/copy. |
| **`/membership-invite`** | **Không trong mock** — bridge web; **P1** nếu yêu cầu in-app WebView như privacy mock. |
| **Đăng nhập / landing** | **P1:** thiếu màn `login` minh họa; OIDC inline đúng kỹ thuật nhưng khác storyboard mock. |

## Ghi chú phương pháp

- Đối chiếu screen id trong JS mock (`events`, `detail`, `redeem`, `login`) với route Expo tương ứng.
- Không sửa code, không commit (theo task).
- Màu/token: mock dùng ink `#0B1220`, paper `#F4F6F8`, signal `#E11D48`; code `brand`/`AttendeeCta` — **khớp hướng** token (P2: SF Symbols tab vs ký tự mock).

## Việc còn lại (cho wave implement)

1. Ưu tiên **P0:** loại/ẩn `RedeemScreen` scoped trên luồng khách.
2. **P1:** event detail IA + global redeem copy/layout + auth primer.
3. Rebuild cài đặt > build 26 từ tip worktree trước UAT mock parity trên DATHN.
